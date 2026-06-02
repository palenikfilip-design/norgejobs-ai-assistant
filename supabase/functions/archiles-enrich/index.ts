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
  companyMultiCount: number,
  aiResult: any,
  salaryParsed: boolean,
): { score: number; signals: Record<string, unknown> } {
  const signals: Record<string, unknown> = { base: 50 };
  let score = 50;

  if (job.company && String(job.company).trim()) { score += 10; signals.has_company = 10; }
  if (companyMultiCount >= 3) { score += 5; signals.multi_job_employer = 5; }

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

async function callArchilesAi(job: any, lovableApiKey: string): Promise<any> {
  const description = (job.description || "").slice(0, 2000);
  const prompt = `You are Archiles, a job librarian. Analyze this job posting and extract structured metadata.

Job:
- Title: ${job.title}
- Location: ${job.location ?? ""}, ${job.country ?? ""}
- Company: ${job.company ?? ""}
- Description: ${description}
- Source: ${job.source_portal ?? ""}

Return ONLY valid JSON with these fields:
{
  "language_requirements": ["en", "no", "de", ...],
  "expat_openness": "high" | "medium" | "low" | "unknown",
  "skill_level": "entry" | "mid" | "senior" | "any" | "unknown",
  "category_suggestion": "Gastronomy" | "Construction" | "IT" | "Healthcare" | "Agriculture" | "SkiResort" | "AuPair" | "Marine" | "Logistics" | "Office" | "Manufacturing" | "Transport" | "Sales" | "Education" | "Other",
  "is_seasonal": true | false | null,
  "description_quality": "high" | "medium" | "low",
  "red_flags": ["upfront_payment", "no_contract_info", "vague_description", "too_good_to_be_true", "missing_employer_info", "none"],
  "confidence": 0-100
}

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

    const langs: string[] = (Array.isArray(ai.language_requirements) ? ai.language_requirements : [])
      .map((l: string) => normalizeLangCode(l))
      .filter((l: string | null): l is string => l !== null)
      .slice(0, 3);

    const expatOpenness = ["high","medium","low","unknown"].includes(ai.expat_openness) ? ai.expat_openness : "unknown";
    const skillLevel = ["entry","mid","senior","any","unknown"].includes(ai.skill_level) ? ai.skill_level : "unknown";

    // STEP D — Trust score
    let companyCount = 0;
    if (job.company) {
      const { count } = await supabase
        .from("public_jobs")
        .select("id", { head: true, count: "exact" })
        .eq("company", job.company);
      companyCount = count ?? 0;
    }
    const { score: trustScore, signals: trustSignals } = computeTrustScore(
      job, companyCount, ai, salaryEur != null,
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
      enriched_at: new Date().toISOString(),
    };
    // Category & is_seasonal only if confident
    if (aiConfidence > 70 && ai.category_suggestion) {
      updatePayload.category = String(ai.category_suggestion);
    }
    if (aiConfidence > 70 && (ai.is_seasonal === true || ai.is_seasonal === false)) {
      updatePayload.is_seasonal = ai.is_seasonal;
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