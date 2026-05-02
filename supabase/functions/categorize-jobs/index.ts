import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "Gastronomy",
  "Construction",
  "IT",
  "Healthcare",
  "Agriculture",
  "SkiResort",
  "AuPair",
  "Marine",
  "Logistics",
  "Office",
  "Manufacturing",
  "Other",
] as const;

const BATCH_SIZE = 20;
const MAX_JOBS_PER_RUN = 400; // 20 batches per cron tick

interface JobRow {
  id: string;
  title: string;
  location: string | null;
}

async function classifyBatch(jobs: JobRow[]): Promise<string[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not set");

  const lines = jobs
    .map((j, i) => `[${i + 1}] ${j.title} - ${j.location ?? ""}`)
    .join("\n");

  const prompt = `Categorize each job into ONE of: ${CATEGORIES.join(", ")}. Return JSON array same length as input.\n\nJobs:\n${lines}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            'You are a job classifier. Reply ONLY with a JSON object: {"categories":["Cat1","Cat2",...]} — same length as input, values strictly from the allowed list.',
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  let parsed: { categories?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned non-JSON content");
  }

  const arr = Array.isArray(parsed.categories) ? parsed.categories : [];
  const valid = new Set<string>(CATEGORIES);
  return jobs.map((_, i) => {
    const c = String(arr[i] ?? "Other");
    return valid.has(c) ? c : "Other";
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const started = Date.now();
  let totalUpdated = 0;
  let batches = 0;
  const errors: string[] = [];

  try {
    const { data: jobs, error } = await supabase
      .from("public_jobs")
      .select("id, title, location")
      .is("category", null)
      .order("fetched_at", { ascending: false })
      .limit(MAX_JOBS_PER_RUN);

    if (error) throw error;
    const rows = (jobs ?? []) as JobRow[];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      try {
        const cats = await classifyBatch(chunk);
        // Update one row at a time (small batches, fine for now)
        const updates = chunk.map((j, idx) =>
          supabase
            .from("public_jobs")
            .update({ category: cats[idx] })
            .eq("id", j.id),
        );
        const results = await Promise.all(updates);
        for (const r of results) {
          if (r.error) errors.push(r.error.message);
          else totalUpdated++;
        }
        batches++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[categorize-jobs] batch failed", msg);
        errors.push(msg);
      }
    }

    const duration = Date.now() - started;
    await supabase.from("ingest_logs").insert({
      source: "categorize-jobs",
      status: errors.length ? "partial" : "success",
      jobs_added: totalUpdated,
      jobs_skipped: rows.length - totalUpdated,
      duration_ms: duration,
      error_message: errors.length ? errors.slice(0, 5).join(" | ") : null,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        scanned: rows.length,
        updated: totalUpdated,
        batches,
        errors: errors.length,
        duration_ms: duration,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[categorize-jobs] failed", msg);
    await supabase.from("ingest_logs").insert({
      source: "categorize-jobs",
      status: "error",
      error_message: msg,
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});