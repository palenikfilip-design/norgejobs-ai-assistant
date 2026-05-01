// Live job matching: fetches MPSV (CZ) + Remotive + The Muse public APIs
// and AI-scores each job against the user's avatar. No job content is stored.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NormalizedJob {
  source_portal: string;
  external_id: string;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  url: string;
  job_type: string | null;
  salary_display?: string | null;
}

async function fetchMpsv(limit = 200): Promise<NormalizedJob[]> {
  try {
    console.log("Starting MPSV fetch");
    // The full JSON is ~175MB. Use HTTP Range to grab only the first chunk
    // and parse complete top-level objects out of it via brace counting.
    const r = await fetch(
      "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json",
      {
        headers: {
          Accept: "application/json",
          Range: "bytes=0-524287", // first 512 KB
        },
      },
    );
    console.log("MPSV status:", r.status);
    if (!r.ok && r.status !== 206) return [];
    const text = await r.text();
    console.log("MPSV chars:", text.length);

    // Find start of array
    const arrStart = text.indexOf("[");
    const items: any[] = [];
    if (arrStart >= 0) {
      let depth = 0;
      let inStr = false;
      let escape = false;
      let objStart = -1;
      for (let i = arrStart + 1; i < text.length && items.length < limit; i++) {
        const ch = text.charCodeAt(i);
        if (inStr) {
          if (escape) escape = false;
          else if (ch === 92) escape = true; // \
          else if (ch === 34) inStr = false; // "
          continue;
        }
        if (ch === 34) { inStr = true; continue; }
        if (ch === 123) { // {
          if (depth === 0) objStart = i;
          depth++;
        } else if (ch === 125) { // }
          depth--;
          if (depth === 0 && objStart >= 0) {
            try {
              items.push(JSON.parse(text.slice(objStart, i + 1)));
            } catch (_e) {
              // truncated last object — stop
              break;
            }
            objStart = -1;
          }
        }
      }
    }
    console.log("MPSV objects parsed:", items.length);
    if (items[0]) {
      console.log("MPSV body[0..500]:", JSON.stringify(items[0]).slice(0, 500));
    }

    const mapped: NormalizedJob[] = [];
    for (const j of items) {
      const id = j?.id ?? j?.referencniCislo ?? j?.portalId ?? crypto.randomUUID();
      const title =
        j?.nazevPracovnihoMista ??
        j?.NAZEV_PRACOVNIHO_MISTA ??
        j?.pozadovanaProfese?.cs ??
        j?.profese?.nazev ??
        "Volné místo";

      // Location: require OBEC; combine with OKRES if present
      const obecRaw = j?.OBEC ?? j?.pracoviste?.[0]?.adresa?.obec ?? j?.mistoVykonuPrace?.[0]?.obec ?? null;
      const okresRaw = j?.OKRES ?? j?.pracoviste?.[0]?.adresa?.okres ?? null;
      const obec = obecRaw && String(obecRaw).trim() ? String(obecRaw).trim() : null;
      const okres = okresRaw && String(okresRaw).trim() ? String(okresRaw).trim() : null;
      if (!obec) continue; // skip job entirely if no OBEC
      const location = okres ? `${obec}, ${okres}` : obec;

      const company = j?.NAZEV_ZAMESTNAVATELE ?? j?.zamestnavatel?.nazev ?? null;

      // Salary: try MZDA_OD/DO, then MINIMALNI_MZDA, then MZDOVE_PODMINKY
      const candMin = j?.MZDA_OD ?? j?.mesicniMzdaOd ?? j?.mzdaOd ?? j?.MINIMALNI_MZDA ?? null;
      const candMax = j?.MZDA_DO ?? j?.mesicniMzdaDo ?? j?.mzdaDo ?? null;
      let minN = candMin != null ? Number(candMin) : null;
      let maxN = candMax != null ? Number(candMax) : null;
      if (!minN || minN <= 0) minN = null;
      if (!maxN || maxN <= 0) maxN = null;
      // Try MZDOVE_PODMINKY string fallback
      if (minN == null && maxN == null && typeof j?.MZDOVE_PODMINKY === "string") {
        const nums = (j.MZDOVE_PODMINKY.match(/\d[\d\s]*/g) ?? [])
          .map((s: string) => Number(s.replace(/\s/g, "")))
          .filter((n: number) => !isNaN(n) && n > 100);
        if (nums.length > 0) {
          minN = nums[0];
          maxN = nums[1] ?? nums[0];
        }
      }
      const hasSalary = (minN != null && minN > 0) || (maxN != null && maxN > 0);
      const fmt = (n: number) => new Intl.NumberFormat("cs-CZ").format(n);
      let salaryDisplay: string | null = null;
      if (minN && maxN && minN > 0 && maxN > 0) {
        salaryDisplay = `${fmt(minN)} – ${fmt(maxN)} Kč/měs`;
      } else if (minN && minN > 0) {
        salaryDisplay = `Od ${fmt(minN)} Kč/měs`;
      } else if (maxN && maxN > 0) {
        salaryDisplay = `Do ${fmt(maxN)} Kč/měs`;
      }

      // URL: prefer detail URL, otherwise construct uradprace.cz detail URL with ID
      const detailUrl =
        j?.URL_DETAILU_VOLNEHO_MISTA ??
        j?.urlDetailu ??
        null;
      let url: string;
      if (detailUrl && /^https?:\/\//i.test(detailUrl) && !/lovableproject\.com/i.test(detailUrl)) {
        url = detailUrl;
      } else {
        url = `https://www.uradprace.cz/web/cz/volna-mista-vpm?id=${encodeURIComponent(String(id))}`;
      }

      mapped.push({
        source_portal: "mpsv.cz",
        external_id: String(id),
        title,
        company,
        location,
        country: "Czech Republic",
        salary_min: hasSalary ? minN : null,
        salary_max: hasSalary ? maxN : null,
        currency: hasSalary ? "CZK" : null,
        url,
        job_type: null,
        salary_display: salaryDisplay,
      });
    }
    console.log("MPSV jobs count:", mapped.length);
    console.log("MPSV first 3 mapped:", JSON.stringify(mapped.slice(0, 3), null, 2));
    return mapped;
  } catch (e) {
    console.error("MPSV fetch failed:", e);
    return [];
  }
}

async function fetchRemotive(limit = 100): Promise<NormalizedJob[]> {
  try {
    console.log("Starting Remotive fetch");
    const r = await fetch(
      `https://remotive.com/api/remote-jobs?limit=${limit}`,
      { headers: { Accept: "application/json" } },
    );
    const text = await r.text();
    console.log("Remotive status:", r.status, "body[0..500]:", text.slice(0, 500));
    if (!r.ok) return [];
    const data = JSON.parse(text);
    const items: any[] = data?.jobs ?? [];
    const mapped = items.map((j: any): NormalizedJob => {
      const id = j?.id ?? crypto.randomUUID();
      const salaryStr: string | null = j?.salary || null;
      const nums = salaryStr
        ? (salaryStr.match(/\d[\d,\.]*/g) ?? []).map((n) => Number(n.replace(/,/g, "")))
        : [];
      const currency = salaryStr
        ? /eur|€/i.test(salaryStr)
          ? "EUR"
          : /\$|usd/i.test(salaryStr)
            ? "USD"
            : null
        : null;
      return {
        source_portal: "remotive.com",
        external_id: String(id),
        title: j?.title ?? "Remote Job",
        company: j?.company_name ?? null,
        location: j?.candidate_required_location ?? null,
        country: "Remote / Global",
        salary_min: nums[0] ?? null,
        salary_max: nums[1] ?? nums[0] ?? null,
        currency,
        url: j?.url ?? "https://remotive.com",
        job_type: j?.job_type ?? null,
      };
    });
    console.log("Remotive jobs count:", mapped.length);
    return mapped;
  } catch (e) {
    console.error("Remotive fetch failed:", e);
    return [];
  }
}

async function fetchMuse(): Promise<NormalizedJob[]> {
  try {
    console.log("Starting The Muse fetch");
    const url =
      "https://www.themuse.com/api/public/jobs?page=1&level=Entry+Level&level=Mid+Level&location=Flexible+%2F+Remote&descending=true";
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await r.text();
    console.log("Muse status:", r.status, "body[0..500]:", text.slice(0, 500));
    if (!r.ok) return [];
    const data = JSON.parse(text);
    const items: any[] = data?.results ?? [];
    const mapped = items.map((j: any): NormalizedJob => {
      const id = j?.id ?? j?.short_name ?? crypto.randomUUID();
      return {
        source_portal: "themuse.com",
        external_id: String(id),
        title: j?.name ?? "Job",
        company: j?.company?.name ?? null,
        location: j?.locations?.[0]?.name ?? null,
        country: "Global",
        salary_min: null,
        salary_max: null,
        currency: null,
        url: j?.refs?.landing_page ?? "https://www.themuse.com",
        job_type: j?.type ?? null,
      };
    });
    console.log("Muse jobs count:", mapped.length);
    return mapped;
  } catch (e) {
    console.error("Muse fetch failed:", e);
    return [];
  }
}

interface ScoreResult {
  score: number;
  reasons: string[];
}

async function scoreJobWithClaude(
  job: NormalizedJob,
  avatar: unknown,
  apiKey: string,
): Promise<ScoreResult> {
  const salaryStr =
    job.salary_min || job.salary_max
      ? `${job.salary_min ?? "?"}–${job.salary_max ?? "?"} ${job.currency ?? ""}`.trim()
      : "unknown";
  const prompt = `Score 0-100 how this job matches user. Return ONLY JSON: {"score": <number>, "reasons": [<max 3 short Czech reasons>]}.\n\nJob: ${job.title} in ${job.location ?? "unknown"}, ${job.country ?? "unknown"}. Salary: ${salaryStr}.\nUser preferences: ${JSON.stringify(avatar)}`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Claude error:", resp.status, t.slice(0, 300));
      if (resp.status === 429) throw new Error("rate_limited");
      if (resp.status === 401 || resp.status === 403) throw new Error("ai_error");
      return { score: 50, reasons: [] };
    }

    const data = await resp.json();
    const text: string = data?.content?.[0]?.text ?? "";
    // Extract first JSON object from text
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { score: 50, reasons: [] };
    const parsed = JSON.parse(match[0]);
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.slice(0, 3).map((r: unknown) => String(r))
      : [];
    return { score, reasons };
  } catch (e) {
    if (e instanceof Error && e.message === "rate_limited") throw e;
    console.error("scoreJobWithClaude failed:", e);
    return { score: 50, reasons: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

    const { avatar, sources } = await req.json().catch(() => ({}));
    if (!avatar || typeof avatar !== "object") {
      return new Response(JSON.stringify({ error: "avatar required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wantMpsv = !sources || sources.includes("mpsv.cz");
    const wantRemotive = !sources || sources.includes("remotive.com");
    const wantMuse = !sources || sources.includes("themuse.com");

    const [mpsv, remotive, muse] = await Promise.all([
      wantMpsv ? fetchMpsv(200) : Promise.resolve([]),
      wantRemotive ? fetchRemotive(100) : Promise.resolve([]),
      wantMuse ? fetchMuse() : Promise.resolve([]),
    ]);

    const allJobs = [...mpsv, ...remotive, ...muse];
    console.log("Total jobs before scoring:", allJobs.length);

    const debug = {
      mpsv_raw_job_count: mpsv.length,
      remotive_raw_job_count: remotive.length,
      themuse_raw_job_count: muse.length,
      total_before_scoring: allJobs.length,
    };

    if (allJobs.length === 0) {
      return new Response(JSON.stringify({ matches: [], debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Score at most 30 jobs per call with Claude Haiku 4.5
    const toScore = allJobs.slice(0, 30);
    const results = await Promise.all(
      toScore.map((j) => scoreJobWithClaude(j, avatar, apiKey)),
    );

    const matches = toScore
      .map((job, i) => ({
        ...job,
        score: results[i]?.score ?? 50,
        reasons: results[i]?.reasons ?? [],
      }))
      .filter((m) => m.score >= 50)
      .sort((a, b) => b.score - a.score);
    console.log("Total jobs after scoring (above 50):", matches.length);

    return new Response(
      JSON.stringify({
        matches,
        total_fetched: allJobs.length,
        debug: { ...debug, total_after_scoring: matches.length },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status =
      msg === "rate_limited" ? 429 : msg === "payment_required" ? 402 : 500;
    console.error("match-jobs error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
