import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=900, s-maxage=900",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TTL_MS = 5 * 60 * 1000;
// Keep individual DB waits short – the whole request must answer well under the client cap.
const QUERY_TIMEOUT_MS = 4000;

/** Fresh cache (served without touching the DB while valid). */
let cache: { data: LeslieStats; expires: number } | null = null;
/** Last known good payload – never expires; served whenever the DB is unreachable. */
let lastGood: LeslieStats | null = null;

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
  active_sources?: number;
  active_companies?: number;
  countries_covered?: number;
  total_active_jobs?: number;
  quality_active_jobs?: number;
  total_positions?: number;
  quality_total_positions?: number;
  computed_at?: string | null;
  last_ingest_run?: string | null;
  from_snapshot?: boolean;
  stale?: boolean;
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

const hasNumbers = (s: LeslieStats | null | undefined): s is LeslieStats =>
  !!s && typeof s.total_active_jobs === "number" && s.total_active_jobs > 0;

const persistSnapshot = async (supabase: ReturnType<typeof createClient>, stats: LeslieStats) => {
  try {
    const { error } = await withTimeout(
      supabase
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
        ),
    );
    if (error) console.warn("leslie_stats_snapshot upsert warning:", errorMessage(error));
  } catch (e) {
    console.warn("leslie_stats_snapshot upsert skipped:", errorMessage(e));
  }
};

const readMatview = async (supabase: ReturnType<typeof createClient>): Promise<LeslieStats | null> => {
  try {
    const { data, error } = await withTimeout(supabase.from("leslie_stats").select("*").maybeSingle());
    if (error) {
      console.error("leslie_stats query error:", errorMessage(error));
      return null;
    }
    return hasNumbers(data as LeslieStats) ? (data as LeslieStats) : null;
  } catch (e) {
    console.error("leslie_stats query timeout:", errorMessage(e));
    return null;
  }
};

const readSnapshot = async (supabase: ReturnType<typeof createClient>): Promise<LeslieStats | null> => {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("leslie_stats_snapshot")
        .select("total_active_jobs, fully_enriched, employers, countries, updated_at")
        .eq("id", true)
        .maybeSingle(),
    );
    if (error || !data) {
      console.error("leslie_stats_snapshot fallback error:", errorMessage(error));
      return null;
    }
    return snapshotToStats(data as LeslieStatsSnapshot);
  } catch (e) {
    console.error("leslie_stats_snapshot fallback timeout:", errorMessage(e));
    return null;
  }
};

const respond = (body: unknown) => new Response(JSON.stringify(body), { headers, status: 200 });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    if (cache && cache.expires > Date.now()) return respond(cache.data);

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return respond(lastGood ? { ...lastGood, stale: true } : { fallback: true, error: "config" });
    }
    const supabase = createClient(url, key);

    // Query the matview and the snapshot in parallel so a dead DB costs at most one timeout window.
    const [matview, snapshot] = await Promise.all([readMatview(supabase), readSnapshot(supabase)]);

    if (matview) {
      lastGood = matview;
      cache = { data: matview, expires: Date.now() + TTL_MS };
      // Fire-and-forget: don't hold the response for the snapshot write.
      persistSnapshot(supabase, matview);
      return respond(matview);
    }

    if (snapshot) {
      lastGood = snapshot;
      // Short cache so we retry the matview soon.
      cache = { data: snapshot, expires: Date.now() + 60 * 1000 };
      return respond(snapshot);
    }

    if (lastGood) {
      return respond({ ...lastGood, stale: true });
    }

    return respond({ fallback: true, error: "db_timeout" });
  } catch (e) {
    console.error("get-leslie-stats unhandled:", e);
    if (lastGood) return respond({ ...lastGood, stale: true });
    return respond({ fallback: true, error: String((e as Error)?.message ?? e) });
  }
});
