// One-shot backfill: populate public_jobs.skill_class for rows where it IS NULL
// using the cheap regex classifier only. Rows that resolve to "unknown" are
// LEFT as skill_class=NULL — they can be handled later by the AI enrichment
// pass (archiles-enrich) within the daily $3 budget.
//
// SAFE: does NOT touch enriched_at, does NOT re-enrich other fields, does NOT
// call AI. Idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { classifyJobSkill } from "../_shared/skillFilter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { batch_size?: number; max_batches?: number; dry_run?: boolean } = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { /* noop */ } }
  const batchSize = Math.min(Math.max(body.batch_size ?? 500, 50), 2000);
  const maxBatches = Math.min(Math.max(body.max_batches ?? 40, 1), 200);
  const dryRun = !!body.dry_run;

  const counts = { manual: 0, skilled: 0, management: 0, unknown_left_null: 0 };
  let scanned = 0;
  let batches = 0;
  let cursor: string | null = null;

  while (batches < maxBatches) {
    let q = supabase
      .from("public_jobs")
      .select("id,title,category,display_category")
      .is("skill_class", null)
      .order("id", { ascending: true })
      .limit(batchSize);
    if (cursor) q = q.gt("id", cursor);
    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message, counts, scanned, batches }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }
    const rows = data ?? [];
    if (rows.length === 0) break;
    batches++;
    scanned += rows.length;
    cursor = (rows[rows.length - 1] as any).id;

    const buckets: Record<"manual"|"skilled"|"management", string[]> = { manual: [], skilled: [], management: [] };
    for (const r of rows) {
      const cls = classifyJobSkill(r as any);
      if (cls === "unknown") { counts.unknown_left_null++; continue; }
      buckets[cls].push((r as any).id);
      counts[cls]++;
    }

    if (!dryRun) {
      for (const cls of ["manual","skilled","management"] as const) {
        const ids = buckets[cls];
        if (ids.length === 0) continue;
        // Chunked update to keep the IN () list small.
        const CHUNK = 200;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const slice = ids.slice(i, i + CHUNK);
          const { error: uErr } = await supabase
            .from("public_jobs")
            .update({ skill_class: cls })
            .in("id", slice);
          if (uErr) {
            return new Response(JSON.stringify({ error: uErr.message, counts, scanned, batches }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
            });
          }
        }
      }
    }

  }

  // Final ai-queue estimate — rows still NULL after regex pass.
  const { count: stillNull } = await supabase
    .from("public_jobs")
    .select("id", { count: "exact", head: true })
    .is("skill_class", null);

  return new Response(JSON.stringify({
    ok: true,
    dry_run: dryRun,
    scanned,
    batches,
    counts,
    still_null_after_regex: stillNull ?? null,
    note: "Rows classified via regex only. Remaining NULLs will be resolved by archiles-enrich AI on next enrichment pass (within daily $3 budget).",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
});