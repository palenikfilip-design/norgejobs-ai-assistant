// Live job matching: fetches MPSV (CZ) + NAV (NO) public APIs and AI-scores
// each job against the user's avatar. No job content is stored in our DB.

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

async function fetchMpsv(limit = 50): Promise<NormalizedJob[]> {
  try {
    const r = await fetch(
      `https://data.mpsv.cz/api/v1/volna-mista?pocet=${limit}`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return [];
    const data = await r.json();
    const items = data?.polozky ?? [];
    return items.map((j: any): NormalizedJob => {
      const id = j?.id ?? j?.referenceniCislo ?? crypto.randomUUID();
      const title =
        j?.profese?.nazev ?? j?.nazevPracovnihoMista ?? "Volné místo";
      const company =
        j?.zamestnavatel?.nazev ?? j?.kontaktniOsoba?.zamestnavatel ?? null;
      const city =
        j?.pracoviste?.[0]?.adresa?.obec ??
        j?.mistoVykonuPrace?.[0]?.obec ??
        null;
      const min = j?.mesicniMzdaOd ?? j?.mzdaOd ?? null;
      const max = j?.mesicniMzdaDo ?? j?.mzdaDo ?? null;
      return {
        source_portal: "mpsv.cz",
        external_id: String(id),
        title,
        company,
        location: city,
        country: "CZ",
        salary_min: min ? Number(min) : null,
        salary_max: max ? Number(max) : null,
        currency: "CZK",
        url: `https://www.uradprace.cz/web/cz/volna-mista-detail?id=${id}`,
        job_type: null,
      };
    });
  } catch (e) {
    console.error("MPSV fetch failed:", e);
    return [];
  }
}

async function fetchNav(limit = 50): Promise<NormalizedJob[]> {
  try {
    const r = await fetch(
      `https://arbeidsplassen.nav.no/public-feed/api/v1/ads?size=${limit}`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return [];
    const data = await r.json();
    const items = data?.content ?? [];
    return items.map((j: any): NormalizedJob => {
      const id = j?.uuid ?? j?.id ?? crypto.randomUUID();
      return {
        source_portal: "nav.no",
        external_id: String(id),
        title: j?.title ?? "Stilling",
        company: j?.employer?.name ?? null,
        location:
          j?.locations?.[0]?.city ??
          j?.locations?.[0]?.municipal ??
          j?.locations?.[0]?.country ??
          null,
        country: "NO",
        salary_min: null,
        salary_max: null,
        currency: "NOK",
        url: `https://arbeidsplassen.nav.no/stillinger/stilling/${id}`,
        job_type: j?.jobtitle ?? null,
      };
    });
  } catch (e) {
    console.error("NAV fetch failed:", e);
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
    const wantNav = !sources || sources.includes("nav.no");

    const [mpsv, nav] = await Promise.all([
      wantMpsv ? fetchMpsv(50) : Promise.resolve([]),
      wantNav ? fetchNav(50) : Promise.resolve([]),
    ]);

    const allJobs = [...mpsv, ...nav];
    if (allJobs.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
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
      .filter((m) => m.score >= 60)
      .sort((a, b) => b.score - a.score);

    return new Response(
      JSON.stringify({ matches, total_fetched: allJobs.length }),
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