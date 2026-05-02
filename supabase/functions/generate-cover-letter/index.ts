import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_MONTHLY_LIMIT = 3;

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

    // Identify user from JWT
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
    const { jobTitle, company, location, language = "cs", jobId } = body;

    // Service-role client for usage tracking + profile fetch
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user profile (avatar_json) and access record
    const [{ data: profile }, { data: access }] = await Promise.all([
      admin.from("profiles").select("avatar_json,full_name,languages,skills,work_experience,profession,country").eq("user_id", userId).maybeSingle(),
      admin.from("user_access").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const isPremium = !!access?.is_premium;

    // Reset monthly counter if new month
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    let used = access?.cover_letters_used_this_month ?? 0;
    if (!access?.cover_letter_month_reset || access.cover_letter_month_reset < monthStart) {
      used = 0;
      await admin.from("user_access").update({
        cover_letters_used_this_month: 0,
        cover_letter_month_reset: monthStart,
      }).eq("user_id", userId);
    }

    if (!isPremium && used >= FREE_MONTHLY_LIMIT) {
      return new Response(JSON.stringify({
        error: "limit_reached",
        message: "Free users get 3 cover letters per month. Upgrade to Pro for unlimited.",
        used, limit: FREE_MONTHLY_LIMIT,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langMap: Record<string, string> = {
      cs: "Czech", sk: "Slovak", en: "English", de: "German", pl: "Polish",
    };
    const langName = langMap[language] || "Czech";

    const avatarSummary = JSON.stringify({
      name: profile?.full_name,
      profession: profile?.profession,
      experience: profile?.work_experience,
      skills: profile?.skills,
      languages: profile?.languages,
      country: profile?.country,
      avatar: profile?.avatar_json ?? {},
    });

    const systemPrompt = `You are a professional cover letter writer. Write a personalized cover letter in ${langName}. Tone: professional but warm. Length: strictly 200-250 words. Do not fabricate any experience, qualifications, or skills not mentioned about the applicant. Address the hiring manager directly.`;

    const userPrompt = `Write a personalized cover letter in ${langName} for this job application.
Job: ${jobTitle} at ${company || "the employer"} in ${location || "the listed location"}.
About the applicant: ${avatarSummary}
Length: 200-250 words. Do not fabricate experience.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
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
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Unable to generate cover letter.";

    // Increment usage (free users only)
    if (!isPremium) {
      await admin.from("user_access").update({
        cover_letters_used_this_month: used + 1,
      }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({
      coverLetter: content,
      used: isPremium ? null : used + 1,
      limit: isPremium ? null : FREE_MONTHLY_LIMIT,
      isPremium,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Cover letter error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
