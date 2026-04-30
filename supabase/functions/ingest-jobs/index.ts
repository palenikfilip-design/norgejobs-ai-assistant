import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_USER_ID = "db1d3de1-3678-4c31-9416-98b88248ae29"; // palenik.filip@gmail.com

interface NormalizedJob {
  source_portal: string;
  external_id: string | null;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  description: string | null;
  url: string;
  job_type: string | null;
  raw_data: unknown;
  posted_at: string | null;
}

async function fetchMPSV(): Promise<NormalizedJob[]> {
  const res = await fetch("https://data.mpsv.cz/api/v1/volna-mista?pocet=100", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`MPSV ${res.status}`);
  const data = await res.json();
  const items = data?.polozky ?? data?.items ?? [];
  return items
    .map((j: any): NormalizedJob | null => {
      const url = j?.url ?? j?.urlMistaVykonuPrace ?? (j?.id ? `https://www.mpsv.cz/web/cz/volna-mista/${j.id}` : null);
      if (!url) return null;
      const mzda = j?.mzdaOd ?? j?.mzda ?? null;
      return {
        source_portal: "mpsv.cz",
        external_id: j?.id ? String(j.id) : null,
        title: j?.profese?.nazev ?? j?.nazev ?? "Bez názvu",
        company: j?.zamestnavatel?.nazev ?? null,
        location: j?.mistoVykonuPrace?.obec ?? j?.obec ?? null,
        country: "Czech Republic",
        salary_min: typeof j?.mzdaOd === "number" ? j.mzdaOd : (typeof mzda === "number" ? mzda : null),
        salary_max: typeof j?.mzdaDo === "number" ? j.mzdaDo : null,
        currency: "CZK",
        description: j?.popis ?? null,
        url,
        job_type: j?.druhPracovnihoPomeru?.nazev ?? null,
        raw_data: j,
        posted_at: j?.datumZverejneni ?? null,
      };
    })
    .filter((x: NormalizedJob | null): x is NormalizedJob => !!x);
}

async function fetchNAV(): Promise<NormalizedJob[]> {
  const res = await fetch("https://arbeidsplassen.nav.no/public-feed/api/v1/ads?size=100", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`NAV ${res.status}`);
  const data = await res.json();
  const items = data?.content ?? [];
  return items
    .map((j: any): NormalizedJob | null => {
      const url = j?.source_url ?? j?.sourceurl ?? (j?.uuid ? `https://arbeidsplassen.nav.no/stillinger/stilling/${j.uuid}` : null);
      if (!url) return null;
      return {
        source_portal: "nav.no",
        external_id: j?.uuid ?? null,
        title: j?.title ?? "Untitled",
        company: j?.employer?.name ?? null,
        location: j?.locationList?.[0]?.municipal ?? j?.municipal ?? null,
        country: "Norway",
        salary_min: null,
        salary_max: null,
        currency: "NOK",
        description: j?.description ?? null,
        url,
        job_type: j?.engagementtype ?? null,
        raw_data: j,
        posted_at: j?.published ?? null,
      };
    })
    .filter((x: NormalizedJob | null): x is NormalizedJob => !!x);
}

async function fetchEURES(): Promise<NormalizedJob[]> {
  const res = await fetch(
    "https://eures.ec.europa.eu/eures-jobs-search-api/api/v1/page-job-search/1?dataSetRequest.pageSize=100",
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`EURES ${res.status}`);
  const data = await res.json();
  const items = data?.data?.jobVacancies ?? data?.jobVacancies ?? [];
  return items
    .map((j: any): NormalizedJob | null => {
      const handle = j?.jobVacancy?.handle ?? j?.handle;
      const url = handle ? `https://eures.ec.europa.eu/portal/jv-se/jv-details/${handle}` : null;
      if (!url) return null;
      const v = j?.jobVacancy ?? j;
      return {
        source_portal: "eures.ec.europa.eu",
        external_id: handle ?? null,
        title: v?.title ?? "Untitled",
        company: v?.employer?.name ?? null,
        location: v?.locations?.[0]?.city ?? null,
        country: v?.locations?.[0]?.countryName ?? v?.locations?.[0]?.country ?? null,
        salary_min: v?.wage?.amountMin ?? null,
        salary_max: v?.wage?.amountMax ?? null,
        currency: v?.wage?.currency ?? "EUR",
        description: v?.description ?? v?.summary ?? null,
        url,
        job_type: v?.positionScheduleCodes?.[0] ?? null,
        raw_data: j,
        posted_at: v?.datePublished ?? null,
      };
    })
    .filter((x: NormalizedJob | null): x is NormalizedJob => !!x);
}

async function ingestSource(
  supabase: ReturnType<typeof createClient>,
  name: string,
  fetcher: () => Promise<NormalizedJob[]>,
) {
  const start = Date.now();
  try {
    const jobs = await fetcher();
    if (!jobs.length) {
      await supabase.from("ingest_logs").insert({
        source: name, status: "success", jobs_added: 0, jobs_skipped: 0, duration_ms: Date.now() - start,
      });
      return { source: name, added: 0, skipped: 0 };
    }

    // Get existing URLs to dedupe
    const urls = jobs.map((j) => j.url);
    const { data: existing } = await supabase
      .from("public_jobs")
      .select("url")
      .in("url", urls);
    const existingSet = new Set((existing ?? []).map((r: any) => r.url));
    const fresh = jobs.filter((j) => !existingSet.has(j.url));
    const skipped = jobs.length - fresh.length;

    let added = 0;
    if (fresh.length) {
      // Insert in chunks of 100
      for (let i = 0; i < fresh.length; i += 100) {
        const chunk = fresh.slice(i, i + 100);
        const { error, count } = await supabase
          .from("public_jobs")
          .insert(chunk, { count: "exact" });
        if (error) {
          console.error(`${name} insert error:`, error);
        } else {
          added += count ?? chunk.length;
        }
      }
    }

    await supabase.from("ingest_logs").insert({
      source: name, status: "success", jobs_added: added, jobs_skipped: skipped, duration_ms: Date.now() - start,
    });
    return { source: name, added, skipped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${name} failed:`, msg);
    await supabase.from("ingest_logs").insert({
      source: name, status: "error", error_message: msg, duration_ms: Date.now() - start,
    });
    return { source: name, added: 0, skipped: 0, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: cron uses x-cron-secret matching vault secret; admin uses JWT
    const cronSecret = req.headers.get("x-cron-secret");
    let isCron = false;
    if (cronSecret) {
      const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: secretRow } = await adminClient
        .schema("vault" as any)
        .from("decrypted_secrets" as any)
        .select("decrypted_secret")
        .eq("name", "INGEST_CRON_SECRET")
        .maybeSingle();
      const expected = (secretRow as any)?.decrypted_secret as string | undefined;
      if (expected && cronSecret === expected) isCron = true;
    }

    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await userClient.auth.getClaims(token);
      if (error || !data?.claims || data.claims.sub !== ADMIN_USER_ID) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const results = await Promise.all([
      ingestSource(supabase, "mpsv.cz", fetchMPSV),
      ingestSource(supabase, "nav.no", fetchNAV),
      ingestSource(supabase, "eures.ec.europa.eu", fetchEURES),
    ]);

    const { count: total } = await supabase
      .from("public_jobs")
      .select("*", { count: "exact", head: true });

    return new Response(JSON.stringify({ results, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ingest-jobs error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});