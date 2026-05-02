import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_ITEMS_PER_RUN = 2000;

interface JobstreamItem {
  id?: string;
  headline?: string;
  webpage_url?: string;
  application_deadline?: string;
  publication_date?: string;
  salary_description?: string | null;
  workplace_address?: {
    municipality?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  employer?: { name?: string | null } | null;
  description?: { text?: string | null } | null;
  removed?: boolean;
}

async function ingestSweden(supabase: ReturnType<typeof createClient>) {
  const started = Date.now();
  const source = "arbetsformedlingen.se";

  // Read last_run_at
  const { data: stateRow } = await supabase
    .from("ingest_state")
    .select("last_run_at")
    .eq("source", source)
    .maybeSingle();

  const defaultSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since = stateRow?.last_run_at
    ? new Date(stateRow.last_run_at as string)
    : defaultSince;
  const sinceIso = since.toISOString();

  const url = `https://jobstream.api.jobtechdev.se/stream?date=${encodeURIComponent(
    sinceIso,
  )}`;

  console.log(`[ingest-jobs] Sweden stream since=${sinceIso}`);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`jobstream HTTP ${res.status}`);
  }

  const items = (await res.json()) as JobstreamItem[];
  if (!Array.isArray(items)) {
    throw new Error("jobstream response not an array");
  }

  const total = items.length;
  const capped = items.slice(0, MAX_ITEMS_PER_RUN);
  const skippedByCap = Math.max(0, total - capped.length);

  let added = 0;
  let skipped = skippedByCap;

  // Map and upsert in chunks
  const rows = capped
    .filter((it) => !it.removed && it.webpage_url && it.headline)
    .map((it) => {
      const loc =
        it.workplace_address?.municipality ||
        it.workplace_address?.city ||
        null;
      return {
        external_id: it.id ?? null,
        source_portal: source,
        title: it.headline as string,
        company: it.employer?.name ?? null,
        description: it.description?.text ?? null,
        location: loc,
        country: "Sweden",
        url: it.webpage_url as string,
        job_type: null,
        salary_min: null,
        salary_max: null,
        currency: it.salary_description ? "SEK" : null,
        posted_at: it.publication_date ?? null,
        raw_data: { salary_description: it.salary_description ?? null },
        fetched_at: new Date().toISOString(),
      };
    });

  skipped += capped.length - rows.length;

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("public_jobs")
      .upsert(chunk, {
        onConflict: "source_portal,external_id",
        ignoreDuplicates: false,
        count: "exact",
      });
    if (error) {
      console.error("[ingest-jobs] upsert error", error);
      throw error;
    }
    added += count ?? chunk.length;
  }

  // Update state
  await supabase.from("ingest_state").upsert(
    {
      source,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source" },
  );

  const duration = Date.now() - started;
  await supabase.from("ingest_logs").insert({
    source,
    status: "success",
    jobs_added: added,
    jobs_skipped: skipped,
    duration_ms: duration,
  });

  return { source, total, added, skipped, duration_ms: duration, since: sinceIso };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const result = await ingestSweden(supabase);
    return new Response(JSON.stringify({ ok: true, results: [result] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ingest-jobs] failed", msg);
    await supabase.from("ingest_logs").insert({
      source: "arbetsformedlingen.se",
      status: "error",
      error_message: msg,
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});