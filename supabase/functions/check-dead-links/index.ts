// Periodically deactivates rows in cached_matches and public_jobs whose
// job_url no longer responds (HTTP >= 400 or network error / timeout).
// Designed to be run from pg_cron on a weekly schedule.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_RUN = 200;
const REQUEST_TIMEOUT_MS = 5000;

async function isDead(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "LeslieAI-LinkChecker/1.0" },
      });
    } catch (_headErr) {
      // Some servers reject HEAD — fall back to GET (still aborted by timeout)
      resp = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "LeslieAI-LinkChecker/1.0" },
      });
    } finally {
      clearTimeout(timer);
    }
    return resp.status >= 400;
  } catch {
    return true; // network error / timeout / DNS — treat as dead
  }
}

async function checkBatch(
  supabase: ReturnType<typeof createClient>,
  table: "cached_matches" | "public_jobs",
  urlColumn: string,
): Promise<{ checked: number; deactivated: number }> {
  const query =
    table === "cached_matches"
      ? supabase
          .from(table)
          .select(`id, ${urlColumn}`)
          .eq("is_active", true)
          .limit(MAX_PER_RUN)
      : supabase.from(table).select(`id, ${urlColumn}`).limit(MAX_PER_RUN);

  const { data, error } = await query;
  if (error) {
    console.error(`Failed to load ${table}:`, error.message);
    return { checked: 0, deactivated: 0 };
  }

  const rows = (data ?? []) as Array<Record<string, string>>;
  let deactivated = 0;
  const concurrency = 10;
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const idx = cursor++;
      const row = rows[idx];
      const url = row[urlColumn];
      if (!url) continue;
      const dead = await isDead(url);
      if (!dead) continue;
      if (table === "cached_matches") {
        const { error: upErr } = await supabase
          .from(table)
          .update({ is_active: false })
          .eq("id", row.id);
        if (!upErr) deactivated++;
        else console.error("update cached_matches failed:", upErr.message);
      } else {
        // public_jobs has no is_active column — delete the dead row.
        const { error: delErr } = await supabase
          .from(table)
          .delete()
          .eq("id", row.id);
        if (!delErr) deactivated++;
        else console.error("delete public_jobs failed:", delErr.message);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()),
  );
  return { checked: rows.length, deactivated };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const cm = await checkBatch(supabase, "cached_matches", "job_url");
    const pj = await checkBatch(supabase, "public_jobs", "url");

    const result = {
      cached_matches: cm,
      public_jobs: pj,
      max_per_run: MAX_PER_RUN,
    };
    console.log("check-dead-links done:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("check-dead-links error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});