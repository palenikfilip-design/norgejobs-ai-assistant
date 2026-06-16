// Catalog-based job matching: reads from public_jobs (Archiles catalog),
// pre-filters by preset hard criteria, then AI-scores against avatar + preset.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hasBudgetRemaining, logAiCall, BUDGET_BLOCKED_MESSAGE_CS } from "../_shared/aiBudget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CandidateJob {
  id: string;
  source_portal: string;
  external_id: string | null;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  region: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  salary_normalized_eur: number | null;
  salary_display: string | null;
  url: string;
  job_type: string | null;
  category: string | null;
  is_seasonal: boolean | null;
  description: string | null;
  trust_score: number;
  data_completeness: string;
}

function rowToCandidate(j: any): CandidateJob {
  const minN = j.salary_min != null ? Number(j.salary_min) : null;
  const maxN = j.salary_max != null ? Number(j.salary_max) : null;
  let salaryDisplay: string | null = j.salary ?? null;
  if (!salaryDisplay && (minN || maxN)) {
    const cur = j.currency ?? "";
    salaryDisplay = minN && maxN ? `${minN}–${maxN} ${cur}`.trim()
      : minN ? `Od ${minN} ${cur}`.trim()
      : `Do ${maxN} ${cur}`.trim();
  }
  return {
    id: j.id,
    source_portal: j.source_portal,
    external_id: j.external_id ?? null,
    title: j.title,
    company: j.company ?? null,
    location: j.location ?? null,
    country: j.country ?? null,
    region: j.region ?? null,
    salary_min: minN,
    salary_max: maxN,
    currency: j.currency ?? null,
    salary_normalized_eur: j.salary_normalized_eur ?? null,
    salary_display: salaryDisplay,
    url: j.url,
    job_type: j.job_type ?? null,
    category: j.category ?? null,
    is_seasonal: j.is_seasonal ?? null,
    description: j.description ?? null,
    trust_score: j.trust_score ?? 50,
    data_completeness: j.data_completeness ?? "unknown",
  };
}

async function fetchCandidates(
  supabase: any,
  preset: any,
  opts: { includeSparse: boolean; limit: number },
): Promise<CandidateJob[]> {
  let q = supabase
    .from("public_jobs")
    .select(
      "id,source_portal,external_id,title,company,location,country,region,salary,salary_min,salary_max,currency,salary_normalized_eur,url,job_type,category,is_seasonal,description,trust_score,data_completeness",
    )
    .not("enriched_at", "is", null)
    .order("trust_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit);

  if (opts.includeSparse) {
    q = q.in("data_completeness", ["complete", "partial", "sparse"]);
  } else {
    q = q.in("data_completeness", ["complete", "partial"]);
  }

  const countries: string[] = Array.isArray(preset?.preferred_countries)
    ? preset.preferred_countries.filter((c: unknown) => typeof c === "string" && c.length > 0)
    : [];
  if (countries.length > 0) {
    // Allow exact country match OR "Multiple" / "Remote" buckets
    const orParts = [
      `country.in.(${countries.map((c) => `"${c.replace(/"/g, "")}"`).join(",")})`,
      `country.eq.Multiple`,
      `country.ilike.%Remote%`,
    ];
    q = q.or(orParts.join(","));
  }

  const salaryMin = Number(preset?.salary_min ?? 0);
  if (salaryMin > 0) {
    // Don't exclude unknown salary (NULL) — include with 80% tolerance threshold
    q = q.or(`salary_normalized_eur.is.null,salary_normalized_eur.gte.${Math.round(salaryMin * 0.8)}`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("fetchCandidates error:", error.message);
    return [];
  }
  return (data ?? []).map(rowToCandidate);
}

async function scoreJobWithAI(
  job: CandidateJob,
  avatar: unknown,
  preset: unknown,
  apiKey: string,
  supabase: any,
): Promise<{
  score: number;
  dimensions: Record<string, number>;
  reasons: string[];
  warnings: string[];
  company_signal: string;
}> {
  const salaryStr =
    job.salary_min || job.salary_max
      ? `${job.salary_min ?? "?"}–${job.salary_max ?? "?"} ${job.currency ?? ""}`.trim()
      : "unknown";
  const descSnippet = job.description ? job.description.slice(0, 600) : "(no description)";
  const prompt = `You are Leslie's job matching engine. Score this job across 5 dimensions (0-100 each) considering BOTH the user's avatar (stable identity) AND their current search preset (what they search for RIGHT NOW).

1. role_match: Does job role match user's job_categories?
2. location_match: Does location match user's target_countries? Bonus for exact city match.
3. seasonality_match: If user wants seasonal AND job is seasonal (or vice versa) = high. Mismatch = low.
4. language_match: Are user's languages_spoken sufficient for this job/country?
5. salary_match: Is salary at or above user's min_salary? Unknown salary = 50.

Calculate "overall" as weighted average: role 35%, location 25%, seasonality 15%, language 15%, salary 10%.

Provide 1-3 "reasons" (positive points, Czech, max 4 words each) and 0-2 "warnings" (concerns, Czech).

Add "company_signal": "established" | "growing" | "unknown" | "warning".

AVATAR: ${JSON.stringify(avatar)}
PRESET: ${JSON.stringify(preset ?? {})}
JOB: ${job.title} @ ${job.company ?? job.source_portal} in ${job.location ?? "?"}, ${job.country ?? "?"}. Salary: ${salaryStr}. Category: ${job.category ?? "?"}. Description: ${descSnippet}

Return ONLY valid JSON:
{"overall":<n>,"dimensions":{"role_match":<n>,"location_match":<n>,"seasonality_match":<n>,"language_match":<n>,"salary_match":<n>},"reasons":[<strings>],"warnings":[<strings>],"company_signal":"established|growing|unknown|warning"}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error:", resp.status, t.slice(0, 200));
      if (resp.status === 429) throw new Error("rate_limited");
      if (resp.status === 402) throw new Error("payment_required");
      return { score: 50, dimensions: {}, reasons: [], warnings: [], company_signal: "unknown" };
    }
    const data = await resp.json();
    await logAiCall(supabase, {
      function_name: "match-jobs",
      model: "google/gemini-2.5-flash-lite",
      usage: data?.usage ?? null,
    });
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { score: 50, dimensions: {}, reasons: [], warnings: [], company_signal: "unknown" };
    const parsed = JSON.parse(m[0]);
    const clamp = (n: unknown) => Math.round(Math.max(0, Math.min(100, Number(n) || 0)));
    const dimensions = {
      role_match: clamp(parsed.dimensions?.role_match),
      location_match: clamp(parsed.dimensions?.location_match),
      seasonality_match: clamp(parsed.dimensions?.seasonality_match),
      language_match: clamp(parsed.dimensions?.language_match),
      salary_match: clamp(parsed.dimensions?.salary_match),
    };
    let overall = clamp(parsed.overall);
    if (!overall) {
      overall = Math.round(
        dimensions.role_match * 0.35 +
          dimensions.location_match * 0.25 +
          dimensions.seasonality_match * 0.15 +
          dimensions.language_match * 0.15 +
          dimensions.salary_match * 0.1,
      );
    }
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 3).map(String) : [];
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 2).map(String) : [];
    const allowed = new Set(["established", "growing", "unknown", "warning"]);
    const signal = allowed.has(String(parsed.company_signal)) ? String(parsed.company_signal) : "unknown";
    return { score: overall, dimensions, reasons, warnings, company_signal: signal };
  } catch (e) {
    if (e instanceof Error && (e.message === "rate_limited" || e.message === "payment_required")) throw e;
    console.error("scoreJobWithAI failed:", e);
    return { score: 50, dimensions: {}, reasons: [], warnings: [], company_signal: "unknown" };
  }
}

const MAX_AI_SCORING = 50;
const SPARSE_FALLBACK_THRESHOLD = 10;
const SPARSE_SCORE_PENALTY = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { avatar, preset } = await req.json().catch(() => ({}));
    if (!avatar || typeof avatar !== "object") {
      return new Response(JSON.stringify({ error: "avatar required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard against fully-unconstrained searches that would scan the whole
    // 23k-job universe and time out. Require AT LEAST one country or one
    // job-type signal on either the preset or the avatar.
    const presetCountries: string[] = Array.isArray(preset?.preferred_countries)
      ? preset.preferred_countries.filter((c: unknown) => typeof c === "string" && c.trim().length > 0)
      : [];
    const avatarObj = avatar as Record<string, unknown>;
    const avatarCountries: string[] = Array.isArray(avatarObj.target_countries)
      ? (avatarObj.target_countries as unknown[]).filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      : Array.isArray(avatarObj.preferred_countries)
        ? (avatarObj.preferred_countries as unknown[]).filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        : [];
    const avatarCategories: string[] = Array.isArray(avatarObj.job_categories)
      ? (avatarObj.job_categories as unknown[]).filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      : [];
    const presetCategories: string[] = Array.isArray(preset?.job_categories)
      ? preset.job_categories.filter((c: unknown) => typeof c === "string" && c.trim().length > 0)
      : [];
    const hasAnyConstraint =
      presetCountries.length > 0 ||
      avatarCountries.length > 0 ||
      presetCategories.length > 0 ||
      avatarCategories.length > 0 ||
      (typeof avatarObj.profession === "string" && avatarObj.profession.trim().length > 0);
    if (!hasAnyConstraint) {
      return new Response(
        JSON.stringify({
          matches: [],
          empty_preset: true,
          message: "Doplň prosím alespoň zemi nebo typ práce do svého presetu — bez toho ti Leslie neumí najít relevantní nabídky.",
          debug: { reason: "no_country_no_category", source: "public_jobs" },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 1) Pull quality candidates (complete + partial)
    let candidates = await fetchCandidates(supabase, preset ?? {}, { includeSparse: false, limit: 100 });
    let sparseFallbackUsed = false;
    const sparseIds = new Set<string>();

    // 5) Sparse fallback if too few candidates
    if (candidates.length < SPARSE_FALLBACK_THRESHOLD) {
      sparseFallbackUsed = true;
      const withSparse = await fetchCandidates(supabase, preset ?? {}, { includeSparse: true, limit: 100 });
      const existing = new Set(candidates.map((c) => c.id));
      for (const c of withSparse) {
        if (!existing.has(c.id)) {
          candidates.push(c);
          if (c.data_completeness === "sparse") sparseIds.add(c.id);
        }
      }
    }

    const candidateCount = candidates.length;
    const toScore = candidates.slice(0, MAX_AI_SCORING);

    if (toScore.length === 0) {
      return new Response(
        JSON.stringify({
          matches: [],
          debug: { candidate_count: 0, scored_count: 0, sparse_fallback_used: sparseFallbackUsed, source: "public_jobs" },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const budget = await hasBudgetRemaining(supabase);
    if (!budget.ok) {
      return new Response(
        JSON.stringify({ matches: [], budget_blocked: true, message: BUDGET_BLOCKED_MESSAGE_CS }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const results = await Promise.all(
      toScore.map((j) => scoreJobWithAI(j, avatar, preset ?? null, apiKey, supabase)),
    );

    const matches = toScore
      .map((job, i) => {
        const r = results[i] ?? { score: 50, dimensions: {}, reasons: [], warnings: [], company_signal: "unknown" };
        const isSparse = sparseIds.has(job.id);
        const score = Math.max(0, Math.min(100, r.score - (isSparse ? SPARSE_SCORE_PENALTY : 0)));
        const warnings = [...r.warnings];
        if (isSparse) warnings.unshift("Omezené informace");
        return {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          country: job.country,
          salary_display: job.salary_display,
          url: job.url,
          source_portal: job.source_portal,
          score,
          reasons: r.reasons,
          dimensions: r.dimensions,
          warnings,
          company_signal: r.company_signal,
          category: job.category,
          is_seasonal: job.is_seasonal,
          data_completeness: job.data_completeness,
          limited_info: isSparse,
        };
      })
      .filter((m) => m.score >= 50)
      .sort((a, b) => b.score - a.score);

    return new Response(
      JSON.stringify({
        matches,
        total_fetched: candidateCount,
        debug: {
          source: "public_jobs",
          candidate_count: candidateCount,
          scored_count: toScore.length,
          matches_above_50: matches.length,
          sparse_fallback_used: sparseFallbackUsed,
          sparse_in_pool: sparseIds.size,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "rate_limited" ? 429 : msg === "payment_required" ? 402 : 500;
    console.error("match-jobs error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});