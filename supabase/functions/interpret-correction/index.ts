// interpret-correction — turn a plain-language user correction into structured
// operations against their learning profile + active preset. Explicit text
// instructions OVERRIDE inferred behavioral signals (Socrates principle).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hasBudgetRemaining, logAiCall, BUDGET_BLOCKED_MESSAGE_CS } from "../_shared/aiBudget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM = `Jsi Leslie, asistentka pro hledání práce. Uživatel ti česky napsal korekci toho, co sis o něm myslela.
Tvůj úkol: převeď to na konkrétní operace v JSON formátu a krátce potvrď, co jsi změnila.

DŮLEŽITÉ (princip Sokrata): explicitní textová instrukce uživatele VŽDY přebíjí naučené chování z kliků/swipů.
Když řekne "zajímá mě hlavně Norsko", zúžíš preset na Norsko, i kdyby předtím klikal na švédské nabídky.
Když řekne "neřeš lodě, dislike byl kvůli lokaci", odstraníš lodě jako negativní signál (mute maritime).

Vrať VÝHRADNĚ validní JSON ve tvaru:
{
  "operations": [
    {"type":"mute_learned","key":"preferredJobType|preferredEnvironment|preferredShiftType|stressTolerance|isolationPreference|preferredSalary"},
    {"type":"set_learned","key":"...","value": <string|number|{min,max}>},
    {"type":"set_preset_countries","countries":["Norway"]},
    {"type":"set_preset_salary_min_eur","value": 2500},
    {"type":"set_preset_category","category":"hospitality|construction|tech|healthcare|agriculture|ski_resort|aupair|maritime|logistics|office|manufacturing|sales|education|other"},
    {"type":"clear_negative_category","category":"maritime"}
  ],
  "assistant_message_cs": "Rozumím — ... Změnila jsem to."
}
Pokud uživatel jen kecá a nedá se z toho nic vyvodit, vrať prázdné operations[] a zdvořilou odpověď.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const text: string = String(body?.text ?? "").trim();
    const currentProfile = body?.current_profile ?? null;
    if (text.length < 3) {
      return new Response(JSON.stringify({ error: "Text is too short" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const budget = await hasBudgetRemaining(admin);
    if (!budget.ok) {
      return new Response(JSON.stringify({ blocked: true, message: BUDGET_BLOCKED_MESSAGE_CS }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const userMsg = `Korekce: """${text}"""\n\nCo si zatím Leslie myslí (JSON, smí být null):\n${JSON.stringify(currentProfile)}`;
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("AI gateway error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: `AI gateway ${aiResp.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiResp.json();
    await logAiCall(admin, { function_name: "interpret-correction", model: MODEL, usage: aiJson?.usage ?? null });
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { operations?: unknown[]; assistant_message_cs?: string } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const operations = Array.isArray(parsed.operations) ? parsed.operations : [];
    const assistant = parsed.assistant_message_cs || "Rozumím, upravila jsem to.";

    // Apply operations — scoped to this user.
    // 1. Load existing overrides / muted
    const { data: prof } = await admin
      .from("user_preference_profile")
      .select("overrides, muted, user_corrections")
      .eq("user_id", userId)
      .maybeSingle();
    const overrides: Record<string, unknown> = (prof?.overrides as Record<string, unknown>) ?? {};
    const muted: string[] = Array.isArray(prof?.muted) ? prof.muted as string[] : [];
    const corrections: unknown[] = Array.isArray(prof?.user_corrections) ? prof.user_corrections as unknown[] : [];
    corrections.push({ text, at: new Date().toISOString(), ops: operations });

    const applied: string[] = [];
    for (const op of operations as Array<Record<string, unknown>>) {
      const t = String(op.type);
      if (t === "mute_learned" && typeof op.key === "string") {
        if (!muted.includes(op.key)) muted.push(op.key);
        delete overrides[op.key];
        applied.push(`mute:${op.key}`);
      } else if (t === "set_learned" && typeof op.key === "string") {
        overrides[op.key] = op.value;
        const idx = muted.indexOf(op.key);
        if (idx >= 0) muted.splice(idx, 1);
        applied.push(`set:${op.key}`);
      } else if (t === "set_preset_countries" && Array.isArray(op.countries)) {
        await admin
          .from("user_presets")
          .update({ preferred_countries: op.countries as never })
          .eq("user_id", userId)
          .eq("active", true);
        applied.push("preset_countries");
      } else if (t === "set_preset_salary_min_eur" && typeof op.value === "number") {
        await admin
          .from("user_presets")
          .update({ salary_min: op.value })
          .eq("user_id", userId)
          .eq("active", true);
        applied.push("preset_salary");
      } else if (t === "clear_negative_category" && typeof op.category === "string") {
        // Wipe behavioral signals on jobs of this display_category so the
        // mute is not immediately re-learned.
        const { data: catJobs } = await admin
          .from("public_jobs")
          .select("id")
          .eq("display_category", op.category)
          .limit(500);
        const ids = (catJobs ?? []).map((j) => j.id);
        if (ids.length) {
          await admin
            .from("user_job_interactions")
            .delete()
            .eq("user_id", userId)
            .in("action_type", ["reject", "click", "view"])
            .in("job_id", ids);
          await admin
            .from("job_preferences")
            .delete()
            .eq("user_id", userId)
            .eq("category", "not_interested")
            .in("job_id", ids);
        }
        applied.push(`clear_neg:${op.category}`);
      }
    }

    await admin
      .from("user_preference_profile")
      .upsert(
        {
          user_id: userId,
          overrides: overrides as never,
          muted: muted as never,
          user_corrections: corrections as never,
        },
        { onConflict: "user_id" },
      );

    return new Response(
      JSON.stringify({ assistant_message_cs: assistant, applied, operations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("interpret-correction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});