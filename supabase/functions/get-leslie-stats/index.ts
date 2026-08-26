import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=900, s-maxage=900",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TTL_MS = 5 * 60 * 1000;
const QUERY_TIMEOUT_MS = 6000;
let cache: { data: unknown; expires: number } | null = null;

/** Never let a hanging DB call block the response. */
const withTimeout = async <T>(p: PromiseLike<T>, ms = QUERY_TIMEOUT_MS): Promise<T> => {
  let timer: number | undefined;
  try {
    return await Promise.race([
      p as Promise<T>,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("db_timeout")), ms) as unknown as number;
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

type LeslieStats = {
  active_companies?: number;
  countries_covered?: number;
  total_active_jobs?: number;
  quality_active_jobs?: number;
  computed_at?: string | null;
  last_ingest_run?: string | null;
  from_snapshot?: boolean;
};

type LeslieStatsSnapshot = {
  total_active_jobs: number;
  fully_enriched: number;
  employers: number;
  countries: number;
  updated_at: string;
};

const errorMessage = (error: unknown) => {
  if (!error) return "unknown";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "unknown");
  }
  return JSON.stringify(error);
};

const snapshotToStats = (snapshot: LeslieStatsSnapshot): LeslieStats => ({
  total_active_jobs: snapshot.total_active_jobs,
  quality_active_jobs: snapshot.fully_enriched,
  active_companies: snapshot.employers,
  countries_covered: snapshot.countries,
  computed_at: snapshot.updated_at,
  last_ingest_run: snapshot.updated_at,
  from_snapshot: true,
});

const persistSnapshot = async (supabase: ReturnType<typeof createClient>, stats: LeslieStats) => {
  const { error } = await supabase
    .from("leslie_stats_snapshot")
    .upsert(
      {
        id: true,
        total_active_jobs: stats.total_active_jobs ?? 0,
        fully_enriched: stats.quality_active_jobs ?? 0,
        employers: stats.active_companies ?? 0,
        countries: stats.countries_covered ?? 0,
        updated_at: stats.computed_at ?? new Date().toISOString(),
      },
      { onConflict: "id" },
    );

  if (error) {
    console.warn("leslie_stats_snapshot upsert warning:", errorMessage(error));
  }
};

const readSnapshot = async (supabase: ReturnType<typeof createClient>) => {
  const { data, error } = await supabase
    .from("leslie_stats_snapshot")
    .select("total_active_jobs, fully_enriched, employers, countries, updated_at")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    console.error("leslie_stats_snapshot fallback error:", errorMessage(error));
    return null;
  }

  return snapshotToStats(data as LeslieStatsSnapshot);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    if (cache && cache.expires > Date.now()) {
      return new Response(JSON.stringify(cache.data), { headers, status: 200 });
    }
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return new Response(JSON.stringify({ fallback: true, error: "config" }), { headers, status: 200 });
    }
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from("leslie_stats").select("*").maybeSingle();
    if (error) {
      console.error("leslie_stats query error:", errorMessage(error));
      const snapshot = await readSnapshot(supabase);
      if (snapshot) {
        cache = { data: snapshot, expires: Date.now() + TTL_MS };
        return new Response(JSON.stringify(snapshot), { headers, status: 200 });
      }
      return new Response(JSON.stringify({ fallback: true, error: errorMessage(error) }), { headers, status: 200 });
    }
    const payload = (data ?? {}) as LeslieStats;
    await persistSnapshot(supabase, payload);
    cache = { data: payload, expires: Date.now() + TTL_MS };
    return new Response(JSON.stringify(payload), { headers, status: 200 });
  } catch (e) {
    console.error("get-leslie-stats unhandled:", e);
    return new Response(JSON.stringify({ fallback: true, error: String(e?.message ?? e) }), { headers, status: 200 });
  }
});