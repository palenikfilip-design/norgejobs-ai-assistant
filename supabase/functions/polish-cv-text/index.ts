import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hasBudgetRemaining, logAiCall, BUDGET_BLOCKED_MESSAGE_CS } from "../_shared/aiBudget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_MONTHLY_LIMIT = 10;

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
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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
    const { text, kind = "summary", language = "cs" } = body as {
      text?: string; kind?: "summary" | "work" | "headline"; language?: string;
    };
    if (!text || typeof text !== "string" || text.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Text is too short" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: access } = await admin.from("user_access").select("*").eq("user_id", userId).maybeSingle();
    const isPremium = !!access?.is_premium;

    // Reuse cover_letter monthly window as a cheap per-user polish counter.
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    let used = access?.cover_letters_used_this_month ?? 0;
    if (!access?.cover_letter_month_reset || access.cover_letter_month_reset < monthStart) {
      used = 0;
    }
    if (!isPremium && used >= FREE_MONTHLY_LIMIT + 3) {
      return new Response(JSON.stringify({
        error: "limit_reached",
        message: "Free monthly AI limit reached.",
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const budget = await hasBudgetRemaining(admin);
    if (!budget.ok) {
      return new Response(JSON.stringify({ error: "budget_blocked", message: BUDGET_BLOCKED_MESSAGE_CS }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langMap: Record<string, string> = {
      cs: "Czech", sk: "Slovak", en: "English", de: "German", pl: "Polish",
    };
    const langName = langMap[language] || "Czech";

    const kindGuidance: Record<string, string> = {
      summary: "Rewrite this CV summary so it's concise (max 3 sentences), professional, and highlights strengths. Do NOT fabricate experience or skills.",
      work: "Rewrite this job description as 2-4 short action-oriented bullet-style sentences. Focus on responsibilities and impact. Do NOT invent achievements or numbers.",
      headline: "Rewrite this CV headline as a single short professional title (max 10 words). Do NOT invent seniority.",
    };
    const guidance = kindGuidance[kind] || kindGuidance.summary;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        messages: [
          { role: "system", content: `You polish CV text in ${langName}. ${guidance} Output ONLY the improved text, no commentary, no quotes, no markdown.` },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }
    const data = await response.json();
    await logAiCall(admin, {
      function_name: "polish-cv-text",
      model: "google/gemini-3.1-flash-lite-preview",
      usage: data?.usage ?? null,
    });
    const polished = (data.choices?.[0]?.message?.content || "").trim().replace(/^["'`]+|["'`]+$/g, "");

    if (!isPremium) {
      await admin.from("user_access").update({
        cover_letters_used_this_month: used + 1,
        cover_letter_month_reset: monthStart,
      }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({ polished, isPremium }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Polish error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});