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
}

async function fetchMpsv(limit = 200): Promise<NormalizedJob[]> {
  try {
    console.log("Starting MPSV fetch");
    // The full JSON is ~175MB. Stream it and parse only the first N objects
    // by scanning brace boundaries to avoid OOM in the edge runtime.
    const r = await fetch(
      "https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json",
      { headers: { Accept: "application/json" } },
    );
    console.log("MPSV status:", r.status);
    if (!r.ok || !r.body) return [];

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    const items: any[] = [];
    let buf = "";
    let started = false;
    let depth = 0;
    let inStr = false;
    let escape = false;
    let objStart = -1;
    let totalBytes = 0;
    const MAX_BYTES = 8 * 1024 * 1024; // hard safety cap

    outer: while (items.length < limit && totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      buf += decoder.decode(value, { stream: true });

      for (let i = 0; i < buf.length; i++) {
        const ch = buf[i];
        if (!started) {
          if (ch === "[") started = true;
          continue;
        }
        if (inStr) {
          if (escape) escape = false;
          else if (ch === "\\") escape = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === "{") {
          if (depth === 0) objStart = i;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && objStart >= 0) {
            const slice = buf.slice(objStart, i + 1);
            try {
              items.push(JSON.parse(slice));
            } catch (_e) { /* ignore malformed slice */ }
            objStart = -1;
            if (items.length >= limit) {
              try { await reader.cancel(); } catch (_e) { /* ignore */ }
              break outer;
            }
          }
        }
      }
      // Trim consumed prefix to keep buffer small
      if (depth === 0 && objStart < 0) {
        // keep tail (could be ", " separator)
        buf = buf.slice(-2);
      } else if (objStart > 0) {
        buf = buf.slice(objStart);
        objStart = 0;
      }
    }
    console.log("MPSV bytes read:", totalBytes, "objects parsed:", items.length);
    if (items[0]) {
      console.log("MPSV body[0..500]:", JSON.stringify(items[0]).slice(0, 500));
    }

    const mapped = items.map((j: any): NormalizedJob => {
      const id = j?.id ?? j?.referencniCislo ?? j?.portalId ?? crypto.randomUUID();
      const title =
        j?.nazevPracovnihoMista ??
        j?.NAZEV_PRACOVNIHO_MISTA ??
        j?.pozadovanaProfese?.cs ??
        j?.profese?.nazev ??
        "Volné místo";
      const location =
        j?.OBEC ??
        j?.pracoviste?.[0]?.adresa?.obec ??
        j?.mistoVykonuPrace?.[0]?.obec ??
        null;
      const company =
        j?.NAZEV_ZAMESTNAVATELE ??
        j?.zamestnavatel?.nazev ??
        null;
      const min = j?.MZDA_OD ?? j?.mesicniMzdaOd ?? j?.mzdaOd ?? null;
      const max = j?.MZDA_DO ?? j?.mesicniMzdaDo ?? j?.mzdaDo ?? null;
      return {
        source_portal: "mpsv.cz",
        external_id: String(id),
        title,
        company,
        location,
        country: "Czech Republic",
        salary_min: min ? Number(min) : null,
        salary_max: max ? Number(max) : null,
        currency: "CZK",
        url: `https://www.mpsv.cz/web/cz/detail-volneho-mista?id=${id}`,
        job_type: null,
      };
    });
    console.log("MPSV jobs count:", mapped.length);
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

async function batchScore(
  jobs: NormalizedJob[],
  avatar: unknown,
  apiKey: string,
): Promise<number[]> {
  if (jobs.length === 0) return [];

  const compactJobs = jobs.map((j, i) => ({
    i,
    title: j.title,
    location: j.location,
    country: j.country,
  }));

  const systemPrompt =
    "You score job-to-user match quality. Return only the tool call.";
  const userPrompt = `User avatar: ${JSON.stringify(avatar)}\n\nJobs (array of {i,title,location,country}):\n${JSON.stringify(compactJobs)}\n\nFor each job return a score 0-100 indicating how well it matches the user avatar.`;

  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "return_scores",
          description: "Return match scores for each job by index.",
          parameters: {
            type: "object",
            properties: {
              scores: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    i: { type: "integer" },
                    score: { type: "integer", minimum: 0, maximum: 100 },
                  },
                  required: ["i", "score"],
                  additionalProperties: false,
                },
              },
            },
            required: ["scores"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "return_scores" } },
  };

  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error:", resp.status, t);
    if (resp.status === 429) throw new Error("rate_limited");
    if (resp.status === 402) throw new Error("payment_required");
    throw new Error("ai_error");
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  const args = call?.function?.arguments
    ? JSON.parse(call.function.arguments)
    : null;
  const scores: number[] = new Array(jobs.length).fill(0);
  if (args?.scores) {
    for (const s of args.scores) {
      if (typeof s.i === "number" && s.i >= 0 && s.i < jobs.length) {
        scores[s.i] = Math.max(0, Math.min(100, Number(s.score) || 0));
      }
    }
  }
  return scores;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

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

    // Batch score in chunks of 25 to stay within model context
    const chunkSize = 25;
    const scores: number[] = [];
    for (let i = 0; i < allJobs.length; i += chunkSize) {
      const chunk = allJobs.slice(i, i + chunkSize);
      const s = await batchScore(chunk, avatar, apiKey);
      scores.push(...s);
    }

    const matches = allJobs
      .map((job, i) => ({ ...job, score: scores[i] ?? 0 }))
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
