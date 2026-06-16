// Targeted Czech-translation backfill for public_jobs rows that were enriched
// before title_cs/summary_cs were generated reliably (e.g. Airbnb / multi-country
// Greenhouse postings). Cheap flash-lite call, respects daily AI budget.
//
// IMPORTANT: Only touches rows WHERE title_cs IS NULL. Never resets translations
// that already exist — that would balloon AI spend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hasBudgetRemaining, logAiCall } from "../_shared/aiBudget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash-lite";

async function translateOne(
  apiKey: string,
  supabase: any,
  job: { id: string; title: string; description: string | null; country: string | null; company: string | null },
): Promise<{ title_cs: string | null; summary_cs: string | null } | null> {
  const descSnippet = (job.description ?? "").slice(0, 800);
  const prompt = `Translate / adapt this job posting to natural Czech for a Czech-speaking job seeker.

Return ONLY valid JSON:
{"title_cs": "<short natural Czech title, max 80 chars; if title already Czech, copy verbatim>",
 "summary_cs": "<1-2 Czech sentences summarizing what the job involves, max 240 chars>"}

If you cannot produce a faithful Czech version, use null for that field.

JOB: ${job.title} @ ${job.company ?? "?"} (${job.country ?? "?"})
DESCRIPTION: ${descSnippet || "(none)"}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("translate err", resp.status, t.slice(0, 160));
      return null;
    }
    const data = await resp.json();
    await logAiCall(supabase, { function_name: "backfill-cs-translations", model: MODEL, usage: data?.usage ?? null });
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    const title_cs = typeof parsed.title_cs === "string" && parsed.title_cs.trim()
      ? parsed.title_cs.trim().slice(0, 120) : null;
    const summary_cs = typeof parsed.summary_cs === "string" && parsed.summary_cs.trim()
      ? parsed.summary_cs.trim().slice(0, 400) : null;
    return { title_cs, summary_cs };
  } catch (e) {
    console.error("translate exception", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }

  let body: { batch_size?: number } = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { /* empty */ } }
  const batchSize = Math.min(Math.max(body.batch_size ?? 40, 1), 100);

  const { data: jobs, error } = await supabase
    .from("public_jobs")
    .select("id,title,description,country,company")
    .is("title_cs", null)
    .not("enriched_at", "is", null)
    .in("data_completeness", ["complete", "partial"])
    .order("trust_score", { ascending: false })
    .limit(batchSize);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }

  let updated = 0, failed = 0, budgetHalted = false;
  for (const j of jobs ?? []) {
    const b = await hasBudgetRemaining(supabase);
    if (!b.ok) { budgetHalted = true; break; }
    const r = await translateOne(apiKey, supabase, j as any);
    if (!r || (!r.title_cs && !r.summary_cs)) { failed++; continue; }
    const patch: Record<string, unknown> = {};
    if (r.title_cs) patch.title_cs = r.title_cs;
    if (r.summary_cs) patch.summary_cs = r.summary_cs;
    const { error: upErr } = await supabase.from("public_jobs").update(patch).eq("id", j.id);
    if (upErr) failed++; else updated++;
  }

  return new Response(JSON.stringify({
    requested: jobs?.length ?? 0,
    updated,
    failed,
    budget_halted: budgetHalted,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
});