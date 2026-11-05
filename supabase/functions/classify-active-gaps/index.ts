// Targeted classification pass for ACTIVE, already-enriched jobs that are
// missing skill_class and/or foreigner_friendly.
//
// mode "regex": cheap regex classifier only, no AI.
// mode "ai":    small AI call (title + first ~300 chars of description) that
//               returns ONLY {skill_class, foreigner_signals}.
// mode "count": report queue sizes + cost estimate, no writes.
//
// Writes ONLY skill_class, foreigner_signals, foreigner_friendly. Never touches
// enriched_at or any other field. AI-processed rows always get skill_class
// (incl. "unknown") and foreigner_signals ({} when none) so they leave the
// queue — idempotent re-runs never pay twice. Respects the daily AI budget.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { classifyJobSkill } from "../_shared/skillFilter.ts";
import { estimateCost, hasBudgetRemaining, logAiCall } from "../_shared/aiBudget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MODEL = "google/gemini-3.1-flash-lite";
const SIGNAL_KEYS = ["language_ok", "accommodation", "hires_foreign", "international_agency", "requires_local_language"];

const LANG_OK_RE = /\b(english is enough|english speaking|no german (?:required|needed)|keine deutschkenntnisse|deutschkenntnisse (?:nicht|keine) (?:erforderlich|notwendig)|no swedish (?:required|needed)|basic (?:german|english) (?:is )?(?:sufficient|enough))\b/i;
const ACCOM_RE = /\b(accommodation (?:provided|included|available)|free (?:housing|accommodation)|staff accommodation|unterkunft (?:wird )?(?:gestellt|vorhanden|inklusive)|personalunterkunft|mitarbeiterunterkunft|boende ingår|ubytování zdarma)\b/i;
const FOREIGN_RE = /\b(visa sponsorship|relocation (?:support|package|assistance)|we sponsor visas|international applicants welcome|eu citizens welcome)\b/i;
const LOCAL_LANG_RE = /\b(fließende?n? deutschkenntnisse|sehr gute deutschkenntnisse|deutsch (?:fließend|verhandlungssicher)|verhandlungssicheres? deutsch|fluent (?:in )?(?:german|swedish|norwegian|french|dutch)|flytande svenska|svenska i tal och skrift|goda kunskaper i svenska|français courant)\b/i;

function deriveFriendly(s: Record<string, boolean>): boolean | null {
  if (s.language_ok || s.accommodation || s.hires_foreign || s.international_agency) return true;
  if (s.requires_local_language) return false;
  return null;
}

function regexSignals(text: string): Record<string, boolean> {
  const s: Record<string, boolean> = {};
  if (LANG_OK_RE.test(text)) s.language_ok = true;
  if (ACCOM_RE.test(text)) s.accommodation = true;
  if (FOREIGN_RE.test(text)) s.hires_foreign = true;
  if (LOCAL_LANG_RE.test(text)) s.requires_local_language = true;
  return s;
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

// Queue: active + enriched + (skill_class null OR (foreigner_friendly null AND foreigner_signals null))
function baseQuery(supabase: any, cols: string, opts?: Record<string, unknown>) {
  return supabase.from("public_jobs").select(cols, opts)
    .eq("is_active", true).not("enriched_at", "is", null)
    .or("skill_class.is.null,and(foreigner_friendly.is.null,foreigner_signals.is.null)");
}

async function callAi(job: any, key: string) {
  const desc = String(job.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  const prompt = `Classify this job. Return ONLY JSON: {"skill_class":"manual"|"skilled"|"management"|"unknown","foreigner_signals":{"language_ok":bool,"accommodation":bool,"hires_foreign":bool,"international_agency":bool,"requires_local_language":bool}}
skill_class: manual = physical/entry-level, no formal qualification; skilled = needs professional qualification/degree; management = leads people/unit; unknown = cannot tell.
foreigner_signals: true only with clear evidence (language_ok = local language not required / English OK; accommodation = housing provided; hires_foreign = welcomes foreign workers; international_agency = recruits internationally; requires_local_language = fluent local language mandatory).
Title: ${job.title}
Description: ${desc}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "raw" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } }),
  });
  if (!res.ok) {
    const t = await res.text();
    const err: any = new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const content = String(data?.choices?.[0]?.message?.content ?? "{}").replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return { parsed: JSON.parse(content), usage: data?.usage ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: { mode?: string; batch_size?: number } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const mode = body.mode ?? "count";

  if (mode === "count") {
    const { count } = await baseQuery(supabase, "id", { count: "exact", head: true });
    const n = count ?? 0;
    const perCall = estimateCost(MODEL, 380, 60);
    return json({ queue: n, est_cost_per_call_usd: perCall, est_total_usd: +(n * perCall).toFixed(4) });
  }

  if (mode === "regex") {
    const stats = { scanned: 0, skill_set: 0, foreigner_set: 0 };
    let cursor: string | null = null;
    const t0 = Date.now();
    for (let i = 0; i < 40 && Date.now() - t0 < 100_000; i++) {
      let q = baseQuery(supabase, "id,title,category,display_category,description,skill_class,foreigner_friendly,foreigner_signals")
        .order("id").limit(500);
      if (cursor) q = q.gt("id", cursor);
      const { data, error } = await q;
      if (error) return json({ error: error.message, stats }, 500);
      if (!data?.length) break;
      cursor = data[data.length - 1].id;
      stats.scanned += data.length;
      for (const r of data) {
        const upd: Record<string, unknown> = {};
        if (!r.skill_class) {
          const c = classifyJobSkill(r);
          if (c !== "unknown") { upd.skill_class = c; stats.skill_set++; }
        }
        if (r.foreigner_friendly == null && r.foreigner_signals == null) {
          const s = regexSignals(`${r.title ?? ""} ${r.description ?? ""}`);
          const f = deriveFriendly(s);
          if (f !== null) { upd.foreigner_signals = s; upd.foreigner_friendly = f; stats.foreigner_set++; }
        }
        if (Object.keys(upd).length) {
          const { error: uErr } = await supabase.from("public_jobs").update(upd).eq("id", r.id);
          if (uErr) return json({ error: uErr.message, stats }, 500);
        }
      }
    }
    return json({ ok: true, mode, stats });
  }

  if (mode === "ai") {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "LOVABLE_API_KEY missing" }, 500);
    const batch = Math.min(Math.max(body.batch_size ?? 300, 1), 600);
    const { data: rows, error } = await baseQuery(supabase, "id,title,description,skill_class,foreigner_friendly,foreigner_signals")
      .order("id").limit(batch);
    if (error) return json({ error: error.message }, 500);
    const stats = { processed: 0, failed: 0, cost_usd: 0, halted: null as string | null };
    const started = Date.now();
    const queue = [...(rows ?? [])];
    const worker = async () => {
      while (queue.length && !stats.halted && Date.now() - started < 120_000) {
        const b = await hasBudgetRemaining(supabase);
        if (!b.ok) { stats.halted = `daily_budget ${b.spent.toFixed(3)}/${b.limit}`; return; }
        const r = queue.shift()!;
        try {
          const { parsed, usage } = await callAi(r, key);
          stats.cost_usd += await logAiCall(supabase, { function_name: "classify-active-gaps", model: MODEL, usage });
          const upd: Record<string, unknown> = {};
          if (!r.skill_class) {
            const c = String(parsed.skill_class ?? "").toLowerCase();
            upd.skill_class = ["manual", "skilled", "management"].includes(c) ? c : "unknown";
          }
          if (r.foreigner_friendly == null && r.foreigner_signals == null) {
            const s: Record<string, boolean> = {};
            for (const k of SIGNAL_KEYS) if (parsed?.foreigner_signals?.[k] === true) s[k] = true;
            upd.foreigner_signals = s;
            upd.foreigner_friendly = deriveFriendly(s);
          }
          await supabase.from("public_jobs").update(upd).eq("id", r.id);
          stats.processed++;
        } catch (e: any) {
          stats.failed++;
          if (e?.status === 402 || e?.status === 403) stats.halted = String(e.message);
          else if (e?.status === 429) { stats.halted = "rate_limited"; }
        }
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    return json({ ok: true, mode, ...stats, cost_usd: +stats.cost_usd.toFixed(5), ms: Date.now() - started });
  }
  return json({ error: "unknown mode" }, 400);
});
