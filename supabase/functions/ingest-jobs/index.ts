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
  // MPSV publishes daily JSON dumps. Try last 7 days, take first available.
  const today = new Date();
  let data: any = null;
  for (let offset = 0; offset < 7 && !data; offset++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - offset);
    const dateStr = d.toISOString().slice(0, 10);
    const url = `https://data.mpsv.cz/od/soubory/volna-mista-prirustek/volna-mista-prirustek-${dateStr}.json`;
    const res = await fetch(url);
    if (res.ok) data = await res.json();
  }
  if (!data) throw new Error("MPSV: no recent daily file found");
  const items = (data?.polozky ?? []).slice(0, 200);
  return items
    .map((j: any): NormalizedJob | null => {
      const portalId = j?.portalId ?? j?.id;
      if (!portalId) return null;
      const url = `https://www.uradprace.cz/web/cz/volna-mista-v-cr?portalId=${portalId}`;
      const profese = j?.pozadovanaProfese?.cs ?? "Volné místo";
      return {
        source_portal: "mpsv.cz",
        external_id: String(portalId),
        title: profese,
        company: j?.zamestnavatel?.nazev ?? null,
        location: j?.mistoVykonuPrace?.obec?.nazev ?? j?.mistoVykonuPrace?.adresa ?? null,
        country: "Czech Republic",
        salary_min: typeof j?.mesicniMzdaOd === "number" ? j.mesicniMzdaOd : null,
        salary_max: typeof j?.mesicniMzdaDo === "number" ? j.mesicniMzdaDo : null,
        currency: "CZK",
        description: j?.poznamka ?? j?.dalsiInformace ?? null,
        url,
        job_type: typeof j?.pocetHodinTydne === "number" && j.pocetHodinTydne >= 35 ? "Full-time" : "Part-time",
        raw_data: j,
        posted_at: j?.datumVlozeni ?? null,
      };
    })
    .filter((x: NormalizedJob | null): x is NormalizedJob => !!x);
}

async function fetchNAV(): Promise<NormalizedJob[]> {
  // New NAV stilling-feed (May 2025+) requires a Bearer token. Optional: NAV_FEED_TOKEN secret.
  const token = Deno.env.get("NAV_FEED_TOKEN");
  if (!token) throw new Error("NAV: NAV_FEED_TOKEN secret not configured (skipping)");
  const res = await fetch("https://pam-stilling-feed.nav.no/api/v1/feed?size=100", {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`NAV ${res.status}`);
  const data = await res.json();
  const items = data?.items ?? data?.content ?? [];
  return items
    .map((j: any): NormalizedJob | null => {
      const id = j?.id ?? j?.uuid;
      const url = j?.url ?? j?.source_url ?? (id ? `https://arbeidsplassen.nav.no/stillinger/stilling/${id}` : null);
      if (!url) return null;
      return {
        source_portal: "nav.no",
        external_id: id ?? null,
        title: j?.title ?? "Untitled",
        company: j?.employer?.name ?? null,
        location: j?.location?.municipal ?? j?.locationList?.[0]?.municipal ?? null,
        country: "Norway",
        salary_min: null,
        salary_max: null,
        currency: "NOK",
        description: j?.description ?? null,
        url,
        job_type: j?.engagementType ?? j?.engagementtype ?? null,
        raw_data: j,
        posted_at: j?.published ?? null,
      };
    })
    .filter((x: NormalizedJob | null): x is NormalizedJob => !!x);
}

async function fetchEURES(): Promise<NormalizedJob[]> {
  // EURES public search endpoint (POST). Reverse-engineered, may change.
  const res = await fetch("https://europa.eu/eures/eures-apps/searchengine/page/jv-search-api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ resultsPerPage: 100, page: 1, sortOrder: "BEST_MATCH_DESC" }),
  });
  if (!res.ok) throw new Error(`EURES ${res.status}`);
  const data = await res.json();
  const items = data?.jvs ?? data?.data?.jvs ?? data?.jobVacancies ?? [];
  return items
    .map((j: any): NormalizedJob | null => {
      const handle = j?.handle ?? j?.id;
      const url = handle ? `https://europa.eu/eures/portal/jv-se/jv-details/${handle}` : null;
      if (!url) return null;
      return {
        source_portal: "eures.ec.europa.eu",
        external_id: handle ? String(handle) : null,
        title: j?.title ?? "Untitled",
        company: j?.employer?.name ?? null,
        location: j?.locations?.[0]?.city ?? j?.location?.city ?? null,
        country: j?.locations?.[0]?.countryCode ?? j?.location?.countryCode ?? null,
        salary_min: j?.wage?.amountMin ?? null,
        salary_max: j?.wage?.amountMax ?? null,
        currency: j?.wage?.currency ?? "EUR",
        description: j?.description ?? j?.summary ?? null,
        url,
        job_type: j?.positionScheduleCodes?.[0] ?? null,
        raw_data: j,
        posted_at: j?.datePublished ?? null,
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
      const { data: ok } = await adminClient.rpc("verify_ingest_cron_secret" as any, { _provided: cronSecret });
      if (ok === true) isCron = true;
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