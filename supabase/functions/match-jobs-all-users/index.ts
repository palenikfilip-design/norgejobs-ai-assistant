import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, avatar_json, needs_rescore");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eligible = (profiles ?? []).filter((p: any) => {
    const av = p.avatar_json;
    return av && typeof av === "object" && Object.keys(av).length > 0;
  });

  let usersScored = 0;
  let newMatches = 0;

  for (const p of eligible) {
    try {
      // Cache: skip when user has fresh active matches and avatar hasn't changed
      if (!p.needs_rescore) {
        const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from("cached_matches")
          .select("id", { count: "exact", head: true })
          .eq("user_id", p.user_id)
          .eq("is_active", true)
          .gte("scored_at", cutoff);
        if ((count ?? 0) > 0) {
          continue;
        }
      }

      const r = await fetch(`${SUPABASE_URL}/functions/v1/match-jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatar: p.avatar_json, language: "cs" }),
      });
      if (!r.ok) {
        console.error(`match-jobs failed for ${p.user_id}:`, r.status);
        continue;
      }
      const data = await r.json();
      const matches = Array.isArray(data?.matches) ? data.matches : [];
      if (matches.length === 0) {
        usersScored++;
        continue;
      }

      // Deactivate previous matches
      await supabase
        .from("cached_matches")
        .update({ is_active: false })
        .eq("user_id", p.user_id);

      const rows = matches.map((m: any) => ({
        user_id: p.user_id,
        job_title: m.title ?? "",
        job_location: m.location ?? null,
        job_country: m.country ?? null,
        job_salary: m.salary_display ?? null,
        job_url: m.url,
        source_portal: m.source_portal ?? null,
        score: m.score ?? 0,
        reasons: m.reasons ?? [],
        is_active: true,
        category: m.category ?? null,
        is_seasonal: m.is_seasonal ?? null,
        score_dimensions: m.dimensions ?? {},
        warnings: m.warnings ?? [],
        company_signal: m.company_signal ?? "unknown",
        scored_at: new Date().toISOString(),
      }));

      const { error: insErr } = await supabase
        .from("cached_matches")
        .upsert(rows, { onConflict: "user_id,job_url" });
      if (insErr) {
        console.error(`insert failed for ${p.user_id}:`, insErr.message);
        continue;
      }
      if (p.needs_rescore) {
        await supabase.from("profiles").update({ needs_rescore: false }).eq("user_id", p.user_id);
      }
      usersScored++;
      newMatches += rows.length;
    } catch (e) {
      console.error(`error for user ${p.user_id}:`, e);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      summary: `Scored ${usersScored} users, ${newMatches} new matches added`,
      users_scored: usersScored,
      new_matches: newMatches,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});