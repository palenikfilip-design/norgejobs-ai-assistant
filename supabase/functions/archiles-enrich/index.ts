// Archiles enrichment pipeline — Phase 2
// Processes public_jobs rows: deterministic region+salary, AI extraction, trust score, review decision.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// EUR conversion rates — quarterly review (last updated 2026-Q2, ECB reference, rounded)
const EUR_RATES: Record<string, number> = {
  EUR: 1.00, CZK: 0.040, NOK: 0.085, SEK: 0.090, GBP: 1.18,
  USD: 0.92, CHF: 1.06, PLN: 0.23, DKK: 0.134, HUF: 0.0026, RON: 0.20,
};

const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  CZ: "CZK", SK: "EUR", PL: "PLN", HU: "HUF", RO: "RON",
  DE: "EUR", AT: "EUR", CH: "CHF", NL: "EUR", BE: "EUR", FR: "EUR",
  NO: "NOK", SE: "SEK", DK: "DKK", FI: "EUR", IS: "ISK", EE: "EUR",
  IT: "EUR", ES: "EUR", PT: "EUR", GR: "EUR", MT: "EUR",
  UK: "GBP", IE: "EUR", US: "USD", CA: "CAD",
  AU: "AUD", NZ: "NZD", AE: "AED", SA: "SAR", JP: "JPY", SG: "SGD",
};

const VALID_LANG_CODES = new Set([
  "en","cs","sk","pl","de","no","sv","da","fi","is","et","lv","lt","nl","fr",
  "it","es","pt","hu","ro","bg","hr","sl","el","mt","ga","ar","zh","ja","ko",
  "ru","uk","tr",
]);

const LANG_NAME_TO_CODE: Record<string, string> = {
  english: "en", czech: "cs", slovak: "sk", polish: "pl", german: "de",
  norwegian: "no", swedish: "sv", danish: "da", finnish: "fi", icelandic: "is",
  estonian: "et", latvian: "lv", lithuanian: "lt", dutch: "nl", french: "fr",
  italian: "it", spanish: "es", portuguese: "pt", hungarian: "hu", romanian: "ro",
  bulgarian: "bg", croatian: "hr", slovenian: "sl", greek: "el", maltese: "mt",
  irish: "ga", arabic: "ar", chinese: "zh", japanese: "ja", korean: "ko",
  russian: "ru", ukrainian: "uk", turkish: "tr",
};

function normalizeLangCode(input: string): string | null {
  if (!input) return null;
  const lower = String(input).trim().toLowerCase();
  if (VALID_LANG_CODES.has(lower)) return lower;
  if (LANG_NAME_TO_CODE[lower]) return LANG_NAME_TO_CODE[lower];
  // Map two-letter variants
  if (lower === "nb" || lower === "nn") return "no";
  return null;
}

/**
 * Decode HTML entities then strip tags. Greenhouse `content` is
 * double-encoded (`&lt;p&gt;...`), so naive tag stripping leaves visible markup.
 */
function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const decoded = String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

/**
 * Late detail-refetch for Greenhouse jobs that lack a description.
 * Mirrors ingest-jobs/adapterGreenhouse detail fetch but is safe to call during enrichment.
 */
async function refetchGreenhouseDetail(job: any): Promise<{ description: string | null; department: string | null; metadata: any } | null> {
  const portal = String(job.source_portal || "");
  const m = portal.match(/^greenhouse:(.+)$/i);
  if (!m || !job.external_id) return null;
  const company = m[1];
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs/${encodeURIComponent(String(job.external_id))}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const d = await res.json();
    const desc = stripHtml(d?.content);
    const dept = Array.isArray(d?.departments) && d.departments[0]?.name ? d.departments[0].name : null;
    return { description: desc, department: dept, metadata: d?.metadata ?? null };
  } catch {
    return null;
  }
}

function detectCurrency(salaryStr: string, countryCode?: string | null): string | null {
  if (!salaryStr) return countryCode ? COUNTRY_DEFAULT_CURRENCY[countryCode] ?? null : null;
  const s = salaryStr;
  if (/€|\bEUR\b/i.test(s)) return "EUR";
  if (/Kč|\bCZK\b/i.test(s)) return "CZK";
  if (/\bNOK\b/i.test(s)) return "NOK";
  if (/\bSEK\b/i.test(s)) return "SEK";
  if (/£|\bGBP\b/i.test(s)) return "GBP";
  if (/\$|\bUSD\b/i.test(s)) return "USD";
  if (/\bCHF\b/i.test(s)) return "CHF";
  if (/zł|\bPLN\b/i.test(s)) return "PLN";
  if (/\bDKK\b/i.test(s)) return "DKK";
  if (/\bHUF\b|Ft/i.test(s)) return "HUF";
  if (/\bRON\b|lei/i.test(s)) return "RON";
  if (/\bkr\b/i.test(s)) return "NOK"; // generic kr → assume NOK
  return countryCode ? COUNTRY_DEFAULT_CURRENCY[countryCode] ?? null : null;
}

function normalizeSalaryToEur(
  salary_min: number | null,
  salary_max: number | null,
  currency: string | null,
  rawSalary: string | null,
  countryCode: string | null,
): { eur: number | null; note: string | null } {
  let cur = (currency || "").toUpperCase() || detectCurrency(rawSalary || "", countryCode);
  let min = salary_min;
  let max = salary_max;

  if ((min == null || max == null) && rawSalary) {
    const nums = rawSalary.match(/[\d][\d.,\s]*/g);
    if (nums && nums.length > 0) {
      const parsed = nums
        .map((n) => parseFloat(n.replace(/\s/g, "").replace(/,/g, "")))
        .filter((v) => !isNaN(v) && v > 0);
      if (parsed.length >= 2) {
        min = min ?? Math.min(...parsed);
        max = max ?? Math.max(...parsed);
      } else if (parsed.length === 1) {
        min = min ?? parsed[0];
        max = max ?? parsed[0];
      }
    }
    if (!cur) cur = detectCurrency(rawSalary, countryCode);
  }

  if (min == null && max == null) {
    return { eur: null, note: rawSalary ? `Could not parse salary: ${rawSalary}` : null };
  }
  if (!cur || !EUR_RATES[cur]) {
    return { eur: null, note: `Unknown currency for salary: ${rawSalary ?? `${min}-${max}`}` };
  }

  const mid = ((min ?? max)! + (max ?? min)!) / 2;
  let monthly = mid;
  // Heuristic: detect hourly/yearly from raw string or magnitude
  if (rawSalary && /hour|hr|\/h\b|hodin/i.test(rawSalary)) {
    monthly = mid * 160;
  } else if (rawSalary && /year|annual|annum|\/y\b|rok/i.test(rawSalary)) {
    monthly = mid / 12;
  } else if (mid > 15000) {
    // No unit but huge in EUR → assume yearly
    monthly = mid / 12;
  } else if (mid < 100 && cur !== "HUF" && cur !== "CZK" && cur !== "RON") {
    // No unit but tiny → assume hourly
    monthly = mid * 160;
  }

  const eur = Math.round(monthly * EUR_RATES[cur]);
  return { eur, note: null };
}

function computeTrustScore(
  job: any,
  companyStats: { jobCount: number; countryCount: number },
  aiResult: any,
  salaryParsed: boolean,
): { score: number; signals: Record<string, unknown> } {
  const signals: Record<string, unknown> = { base: 50 };
  let score = 50;

  if (job.company && String(job.company).trim()) { score += 10; signals.has_company = 10; }
  if (companyStats.jobCount >= 3) { score += 5; signals.multi_job_employer = 5; }

  // Multi-country presence — established multinational signal
  signals.country_count = companyStats.countryCount;
  signals.total_jobs_in_db = companyStats.jobCount;
  let multiBonus = 0;
  if (companyStats.countryCount >= 10) multiBonus = 15;
  else if (companyStats.countryCount >= 4) multiBonus = 10;
  else if (companyStats.countryCount >= 2) multiBonus = 5;
  if (multiBonus) { score += multiBonus; signals.multinational_bonus = multiBonus; }

  // Hiring volume
  if (companyStats.jobCount >= 50) { score += 10; signals.volume_bonus = 10; }

  const portal = String(job.source_portal || "").toLowerCase();
  const atsPrefixes = ["greenhouse","lever","workday","smartrecruiters","personio"];
  if (atsPrefixes.some((p) => portal.includes(p))) { score += 10; signals.ats_verified = 10; }

  const govDomains = ["mpsv","arbeitsagentur","eures","nav.no","jobnet.dk"];
  if (govDomains.some((g) => portal.includes(g) || (job.url || "").includes(g))) {
    score += 10; signals.government_source = 10;
  }

  if ((job.description || "").length > 300) { score += 5; signals.detailed_description = 5; }
  if (salaryParsed) { score += 5; signals.salary_specified = 5; }

  const url = String(job.url || "");
  if (url && !/(bit\.ly|tinyurl|t\.co|goo\.gl)/i.test(url)) { score += 5; signals.clean_url = 5; }

  const flags: string[] = Array.isArray(aiResult?.red_flags) ? aiResult.red_flags : [];
  signals.red_flags = flags;
  if (flags.includes("upfront_payment")) score -= 10;
  if (flags.includes("too_good_to_be_true")) score -= 15;
  if (flags.includes("vague_description")) score -= 10;
  if (flags.includes("missing_employer_info")) score -= 10;
  if (flags.includes("no_contract_info")) score -= 5;
  if (aiResult?.description_quality === "low") { score -= 20; signals.low_quality = -20; }

  return { score: Math.max(0, Math.min(100, score)), signals };
}

/**
 * Compute completeness based on what data we actually have.
 * Transparent about sparse jobs rather than guessing.
 */
function computeCompleteness(job: any, langs: string[], skillLevel: string, salaryEur: number | null):
  { label: "complete" | "partial" | "sparse"; score: number } {
  let score = 0;
  if (job.description && String(job.description).length > 200) score += 25;
  if (salaryEur != null) score += 15;
  if (job.company && String(job.company).trim()) score += 15;
  if ((job.raw_data?.department) || (job.job_type)) score += 10;
  const loc = String(job.location ?? "").toLowerCase();
  if (loc && !["multiple", "remote", ""].includes(loc)) score += 10;
  if (langs.length > 0) score += 10;
  if (skillLevel && skillLevel !== "unknown") score += 5;
  if (job.posted_at) score += 10;

  const label = score >= 70 ? "complete" : score >= 40 ? "partial" : "sparse";
  return { label, score };
}

/**
 * Title-based category fallback for SE/DE jobs without descriptions.
 * Returns a display_category id ("tech", "office", ...) or null.
 */
function categorizeFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const t = String(title).toLowerCase();
  const rules: Array<{ cat: string; words: string[] }> = [
    { cat: "tech", words: ["software","developer","entwickler","programmer","programmierer","devops","sysadmin","data engineer","data scientist"," it ","it-"," it,","frontend","backend","fullstack","mjukvaru","utvecklare"] },
    { cat: "healthcare", words: ["pflege","krankenschwester","krankenpfleger","pflegehelfer","nurse","sjuksköterska","vårdbiträde","undersköterska","arzt","ärztin","doctor","läkare","therapeut","therapist","sjukgymnast"] },
    { cat: "construction", words: ["bau","maurer","construction","bygg","elektriker","installatör","schreiner","zimmerer","betong","snickare","rörmokare","plumber"] },
    { cat: "hospitality", words: ["koch","köchin","kellner","kellnerin","restaurant","hotel","chef","kock","servitör","servitris","restaurang","barista","barman","bartender","reinigungs","städ","housekeeping"] },
    { cat: "education", words: ["lehrer","lehrerin","teacher","lärare","förskollärare","professor","dozent","erzieher","pädagog","barnskötare"] },
    { cat: "logistics", words: ["fahrer","driver","förare","lager","logist","lkw","truck","kurier","chaufför","transport","spediteur","warehouse"] },
    { cat: "sales", words: ["verkäufer","verkäuferin","sales","säljare","vertrieb","account manager","kassa","kassierer","butikssäljare"] },
    { cat: "manufacturing", words: ["produktion","maschine","operatör","montage","montör","schweißer","svetsare","cnc","produktionsmitarbeiter","industrimekaniker","fabrik"] },
    { cat: "office", words: ["steuer","steuerfach","buchhalter","accounting","ekonom","redovisning","controller","sekretär","sekretariat","administration","sachbearbeit","kundtjänst","kundenservice","assistent","hr ","personal","jurist","advokat"] },
    { cat: "agriculture", words: ["lantbruk","landwirt","bauern","agrar","gartenbau","trädgård","skogs","forst","farm"] },
    { cat: "maritime", words: ["maritim","sjöman","seafarer","cruise","fartyg","schiff"] },
  ];
  for (const r of rules) {
    if (r.words.some((w) => t.includes(w))) return r.cat;
  }
  return null;
}

// Rough category multipliers vs. national average — used only to estimate
// when source data has no salary. Always flagged salary_is_estimated=true.
const CATEGORY_SALARY_MODIFIER: Record<string, number> = {
  tech: 1.3,
  healthcare: 1.1,
  construction: 1.0,
  manufacturing: 0.95,
  office: 1.0,
  sales: 1.0,
  education: 0.9,
  logistics: 0.9,
  maritime: 1.0,
  ski_resort: 0.8,
  hospitality: 0.75,
  aupair: 0.6,
  agriculture: 0.7,
  other: 0.9,
};

function estimateSalaryEur(
  countryName: string | null,
  displayCategory: string | null,
  countryIndex: Map<string, any>,
): number | null {
  if (!countryName) return null;
  const ctx = countryIndex.get(String(countryName).toLowerCase());
  const avg = Number(ctx?.avg_salary_eur);
  if (!ctx || !Number.isFinite(avg) || avg <= 0) return null;
  const cat = (displayCategory || "other").toLowerCase();
  const mod = CATEGORY_SALARY_MODIFIER[cat] ?? 0.9;
  return Math.round(avg * mod);
}

async function callArchilesAi(job: any, lovableApiKey: string): Promise<any> {
  const description = (job.description || "").slice(0, 2000);
  const prompt = `You are Archiles, a job librarian. Analyze this job posting and extract structured metadata.

Job:
- Title: ${job.title}
- Location: ${job.location ?? ""}, ${job.country ?? ""}
- Company: ${job.company ?? ""}
- Description: ${description}
- Source: ${job.source_portal ?? ""}

Return ONLY valid JSON with ALL of these fields (do not omit any field, especially country_resolved and country_confidence):
{
  "language_requirements": ["en", "no", "de", ...],
  "expat_openness": "high" | "medium" | "low" | "unknown",
  "skill_level": "entry" | "mid" | "senior" | "any" | "unknown",
  "category_suggestion": "Gastronomy" | "Construction" | "IT" | "Healthcare" | "Agriculture" | "SkiResort" | "AuPair" | "Marine" | "Logistics" | "Office" | "Manufacturing" | "Transport" | "Sales" | "Education" | "Other",
  "is_seasonal": true | false | null,
  "description_quality": "high" | "medium" | "low",
  "red_flags": ["upfront_payment", "no_contract_info", "vague_description", "too_good_to_be_true", "missing_employer_info", "none"],
  "positions_available": 1,
  "confidence": 0-100,
  "country_resolved": "<English country name resolved from Location, or null>",
  "country_confidence": "high" | "medium" | "low",
  "title_cs": "<short natural Czech translation/adaptation of the job title, max 80 chars>",
  "summary_cs": "<1-2 sentence Czech summary of what the job involves, max 240 chars>"
}

title_cs / summary_cs MUST be in Czech regardless of source language. If the title is already Czech, copy it verbatim into title_cs. If you cannot produce a faithful Czech version (e.g. empty/unreadable input), set them to null.

Detect how many positions are offered. Look for phrases like "hiring 5 chefs", "X positions available", "více pozic", "multiple positions", "X otevřených pozic". If found, return that integer for positions_available. If not mentioned, default to 1.

Resolve country_resolved from the Location string above:
- If the Location contains an explicit country name (Norway, United Kingdom, United States, Brazil, Germany, ...) → use that country name in English.
- If it contains a US state or well-known US city (New York, Brooklyn, Houston, Texas, San Francisco, Seattle, ...) → "United States".
- If it contains a UK city (London, Manchester, Edinburgh, ...) → "United Kingdom".
- If it is "Multiple Locations", "2 Locations", "Remote", empty, or otherwise ambiguous → null. DO NOT GUESS.
Set country_confidence accordingly: "high" when a country/state/major city is unambiguous; "medium" when reasonably likely; "low" when unsure (and prefer null + low).

Be conservative. If unsure, use "unknown" or null. Better to mark for human review than guess wrong.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "raw",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    return typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    // Strip code fences if present
    const cleaned = String(content).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  }
}

async function enrichJob(
  supabase: any,
  job: any,
  countryIndex: Map<string, any>,
  autonomy: any,
  lovableApiKey: string,
  testMode: boolean,
): Promise<{ ok: boolean; needs_review: boolean; result?: any; error?: string; ms: number }> {
  const started = Date.now();
  try {
    const notes: string[] = [];

    // STEP 0 — Late detail refetch for Greenhouse jobs missing a description.
    // Earlier ingest runs occasionally stored the row without a description
    // (URL-fix migration overwrote enriched data, or detail fetch was skipped
    // because the URL key changed). Refetch on demand instead of leaving sparse.
    let lateDetail: { description: string | null; department: string | null; metadata: any } | null = null;
    if ((!job.description || String(job.description).length < 50)
        && String(job.source_portal || "").startsWith("greenhouse:")) {
      lateDetail = await refetchGreenhouseDetail(job);
      if (lateDetail?.description) {
        job.description = lateDetail.description;
        job.raw_data = { ...(job.raw_data ?? {}), department: lateDetail.department, gh_metadata: lateDetail.metadata };
        notes.push("Description backfilled from Greenhouse detail endpoint.");
      }
    }

    // STEP A — Region
    let region: string | null = "Unknown";
    let countryCode: string | null = null;
    if (job.country) {
      const key = String(job.country).trim().toLowerCase();
      const match = countryIndex.get(key);
      if (match) {
        region = match.region;
        countryCode = match.country_code;
      } else {
        notes.push(`Unknown country '${job.country}', please add to country_context`);
      }
    } else {
      notes.push("Job has no country");
    }

    // STEP B — Salary normalization
    const rawSalary = job.raw_data?.salary ?? job.raw_data?.salary_text ?? null;
    const { eur: salaryEur, note: salaryNote } = normalizeSalaryToEur(
      job.salary_min != null ? Number(job.salary_min) : null,
      job.salary_max != null ? Number(job.salary_max) : null,
      job.currency,
      rawSalary,
      countryCode,
    );
    if (salaryNote) notes.push(salaryNote);

    // STEP C — AI enrichment
    const ai = await callArchilesAi(job, lovableApiKey);
    const aiConfidence = Math.max(0, Math.min(100, Number(ai.confidence ?? 0)));

    // STEP C.1 — Country resolution from free-text location.
    // Multi-national employers (Workday tenants like Equinor) post jobs in many
    // countries; ingest leaves job.country=null and we resolve it here from
    // job.location via the AI's country_resolved field. Falls back to the
    // employer HQ country (stashed in raw_data.employer_source_country) only
    // as a low-confidence last resort.
    let resolvedCountryChange: string | null = null;
    {
      const resolved = typeof ai.country_resolved === "string" ? ai.country_resolved.trim() : "";
      const conf = String(ai.country_confidence ?? "").toLowerCase();
      const before = job.country ?? null;
      let newCountry: string | null = job.country ?? null;
      let countrySource = "ingest";

      if (resolved && resolved.toLowerCase() !== "null" && (conf === "high" || conf === "medium")) {
        newCountry = resolved;
        countrySource = `ai-${conf}`;
      } else if (!newCountry) {
        // No AI answer and no ingest country — try last-resort fallback.
        const fallback = job.raw_data?.employer_source_country;
        if (typeof fallback === "string" && fallback.trim()) {
          newCountry = fallback.trim();
          countrySource = "employer-hq-fallback";
          notes.push(`Country fallback to employer HQ (${fallback}) — low confidence.`);
        }
      }

      if (newCountry && newCountry !== before) {
        job.country = newCountry;
        notes.push(`Country resolved: ${before ?? "null"} → ${newCountry} (${countrySource})`);
        // Re-resolve region / country_code from the country_context index.
        const key = String(newCountry).trim().toLowerCase();
        const match = countryIndex.get(key);
        if (match) {
          region = match.region;
          countryCode = match.country_code;
        }
        resolvedCountryChange = newCountry;
      }
    }

    const langs: string[] = (Array.isArray(ai.language_requirements) ? ai.language_requirements : [])
      .map((l: string) => normalizeLangCode(l))
      .filter((l: string | null): l is string => l !== null)
      .slice(0, 3);

    const expatOpenness = ["high","medium","low","unknown"].includes(ai.expat_openness) ? ai.expat_openness : "unknown";
    const skillLevel = ["entry","mid","senior","any","unknown"].includes(ai.skill_level) ? ai.skill_level : "unknown";

    // Czech labels — short translated title + summary. Keep null if AI didn't provide.
    const titleCs = typeof ai.title_cs === "string" && ai.title_cs.trim()
      ? ai.title_cs.trim().slice(0, 120) : null;
    const summaryCs = typeof ai.summary_cs === "string" && ai.summary_cs.trim()
      ? ai.summary_cs.trim().slice(0, 400) : null;

    // STEP D — Trust score with multi-country company presence.
    // For multinationals that mark country="Multiple" (e.g. Stripe) we also count
    // distinct entries from additional_locations so the multinational bonus applies.
    let companyStats = { jobCount: 0, countryCount: 0 };
    if (job.company) {
      const { data: companyJobs } = await supabase
        .from("public_jobs")
        .select("country, additional_locations")
        .eq("company", job.company);
      const rows = (companyJobs ?? []) as { country: string | null; additional_locations: unknown }[];
      const locs = new Set<string>();
      for (const r of rows) {
        if (r.country && r.country !== "Multiple") locs.add(r.country);
        if (Array.isArray(r.additional_locations)) {
          for (const a of r.additional_locations) {
            if (typeof a === "string" && a.trim()) locs.add(a.trim());
          }
        }
      }
      // Fallback: if we couldn't extract any individual location but the company
      // has many "Multiple" jobs, treat it as at least bi-national.
      if (locs.size === 0 && rows.some((r) => r.country === "Multiple")) {
        locs.add("Multiple");
        locs.add("Global");
      }
      companyStats = { jobCount: rows.length, countryCount: locs.size };
    }
    const { score: trustScore, signals: trustSignals } = computeTrustScore(
      job, companyStats, ai, salaryEur != null,
    );

    // STEP E — needs_review decision
    const flags: string[] = Array.isArray(ai.red_flags) ? ai.red_flags.filter((f: string) => f && f !== "none") : [];
    let needs_review: boolean;
    if ((autonomy?.autonomy_level ?? 0) === 0) {
      needs_review = true;
    } else if (aiConfidence >= (autonomy?.auto_publish_threshold ?? 90) && trustScore >= 50) {
      needs_review = false;
    } else if (trustScore < 30) {
      needs_review = true;
    } else if (flags.length > 0) {
      needs_review = true;
    } else {
      needs_review = aiConfidence < (autonomy?.auto_publish_threshold ?? 90);
    }

    // STEP F — Data completeness transparency
    const completeness = computeCompleteness(job, langs, skillLevel, salaryEur);
    if (completeness.label === "partial") {
      notes.push("Některé informace chybí (popis/plat). Scoring je orientační.");
    } else if (completeness.label === "sparse") {
      notes.push("Velmi málo informací. Doporučujeme ověřit na originálu.");
    }
    // Carry through ingest-time hints (workday limited / detail fetch failed)
    const ingestHint = job.raw_data?.archiles_hint;
    if (ingestHint) notes.push(String(ingestHint));

    const updatePayload: Record<string, unknown> = {
      region,
      salary_normalized_eur: salaryEur,
      language_requirements: langs,
      expat_openness: expatOpenness,
      skill_level: skillLevel,
      trust_score: trustScore,
      trust_signals: trustSignals,
      archiles_confidence: aiConfidence,
      archiles_notes: notes.length > 0 ? notes.join(" | ") : null,
      needs_review,
      data_completeness: completeness.label,
      enriched_at: new Date().toISOString(),
    };
    if (titleCs) updatePayload.title_cs = titleCs;
    if (summaryCs) updatePayload.summary_cs = summaryCs;
    if (resolvedCountryChange) {
      updatePayload.country = resolvedCountryChange;
    }
    // Persist backfilled description / raw_data from late Greenhouse detail refetch.
    if (lateDetail?.description) {
      updatePayload.description = job.description;
      updatePayload.raw_data = job.raw_data;
    }
    // Category & is_seasonal only if confident
    if (aiConfidence > 70 && ai.category_suggestion) {
      updatePayload.category = String(ai.category_suggestion);
      // Map detailed category → display_category for UI grouping
      const catMap: Record<string, string> = {
        gastronomy: "hospitality", construction: "construction", it: "tech",
        healthcare: "healthcare", agriculture: "agriculture", skiresort: "ski_resort",
        aupair: "aupair", marine: "maritime", logistics: "logistics", office: "office",
        manufacturing: "manufacturing", transport: "logistics", sales: "sales",
        education: "education",
      };
      updatePayload.display_category = catMap[String(ai.category_suggestion).toLowerCase()] ?? "other";
    }
    // Title-based fallback: when AI returned "other" / unsure and we lack a description,
    // try to infer category from the job title (German/Swedish/English keywords).
    if (!updatePayload.display_category || updatePayload.display_category === "other") {
      const titleCat = categorizeFromTitle(job.title);
      if (titleCat) {
        updatePayload.display_category = titleCat;
        notes.push(`Category inferred from title: ${titleCat}`);
      }
    }
    if (aiConfidence > 70 && (ai.is_seasonal === true || ai.is_seasonal === false)) {
      updatePayload.is_seasonal = ai.is_seasonal;
    }
    // STEP F.1 — Estimated salary fallback when source data has no salary.
    // Used by matching/filtering via COALESCE(salary_normalized_eur, salary_estimated_eur).
    // ALWAYS flagged transparently — never presented as a confirmed salary in UI.
    if (salaryEur == null) {
      const effCountry = (updatePayload.country as string | undefined) ?? job.country ?? null;
      const effCat = (updatePayload.display_category as string | undefined) ?? job.display_category ?? null;
      const est = estimateSalaryEur(effCountry, effCat, countryIndex);
      if (est != null) {
        updatePayload.salary_estimated_eur = est;
        updatePayload.salary_is_estimated = true;
        notes.push(`Salary estimated ~${est} EUR/mo from ${effCountry} avg × ${effCat ?? "other"} modifier (source had none).`);
      } else {
        updatePayload.salary_estimated_eur = null;
        updatePayload.salary_is_estimated = false;
      }
    } else {
      updatePayload.salary_estimated_eur = null;
      updatePayload.salary_is_estimated = false;
    }

    // positions_available — default 1, accept positive integers only
    const pos = Number(ai.positions_available);
    if (Number.isFinite(pos) && pos >= 1 && pos <= 500) {
      updatePayload.positions_available = Math.floor(pos);
    } else {
      updatePayload.positions_available = 1;
    }

    const fullResult = { ...updatePayload, ai_raw: ai, ms: Date.now() - started };

    if (!testMode) {
      const { error: upErr } = await supabase
        .from("public_jobs")
        .update(updatePayload)
        .eq("id", job.id);
      if (upErr) throw upErr;

      await supabase.from("archiles_decisions").insert({
        job_id: job.id,
        decision_type: "enrichment",
        archiles_choice: updatePayload,
        confidence: aiConfidence,
      });
    }

    return { ok: true, needs_review, result: fullResult, ms: Date.now() - started };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, needs_review: true, error: msg, ms: Date.now() - started };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  let body: { job_ids?: string[]; batch_size?: number; test_mode?: boolean } = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* empty */ }
  }
  const testMode = !!body.test_mode;
  const batchSize = Math.min(Math.max(body.batch_size ?? 50, 1), 50);

  // Load jobs
  let jobs: any[] = [];
  if (Array.isArray(body.job_ids) && body.job_ids.length > 0) {
    const { data, error } = await supabase
      .from("public_jobs")
      .select("*")
      .in("id", body.job_ids);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }
    jobs = data ?? [];
  } else {
    const { data, error } = await supabase
      .from("public_jobs")
      .select("*")
      .is("enriched_at", null)
      .limit(batchSize);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }
    jobs = data ?? [];
  }

  // Load country_context + autonomy
  const { data: countries } = await supabase.from("country_context").select("country_code, country_name, region");
  const countryIndex = new Map<string, any>();
  for (const c of countries ?? []) {
    countryIndex.set(String(c.country_name).toLowerCase(), c);
    countryIndex.set(String(c.country_code).toLowerCase(), c);
  }
  const { data: autonomyRow } = await supabase.from("archiles_autonomy").select("*").eq("id", 1).maybeSingle();

  const results: any[] = [];
  let succeeded = 0, failed = 0, requiresReview = 0;

  for (const job of jobs) {
    const r = await enrichJob(supabase, job, countryIndex, autonomyRow, lovableApiKey, testMode);
    if (r.ok) {
      succeeded++;
      if (r.needs_review) requiresReview++;
    } else {
      failed++;
    }
    results.push({
      job_id: job.id,
      title: job.title,
      source_portal: job.source_portal,
      country: job.country,
      ok: r.ok,
      ms: r.ms,
      needs_review: r.needs_review,
      error: r.error,
      result: testMode ? r.result : undefined,
    });
  }

  return new Response(JSON.stringify({
    processed: jobs.length,
    succeeded,
    failed,
    requires_review: requiresReview,
    test_mode: testMode,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
});