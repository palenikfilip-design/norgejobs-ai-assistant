import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_USER_ID = "db1d3de1-3678-4c31-9416-98b88248ae29";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SECRET_VALUE = Deno.env.get("INGEST_CRON_SECRET");
    if (!SECRET_VALUE) throw new Error("INGEST_CRON_SECRET env not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await userClient.auth.getClaims(token);
    if (error || data?.claims?.sub !== ADMIN_USER_ID) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Try update existing secret, else create
    const { data: existing } = await supabase
      .schema("vault" as any)
      .from("secrets")
      .select("id")
      .eq("name", "INGEST_CRON_SECRET")
      .maybeSingle();

    if (existing?.id) {
      const { error: updErr } = await supabase.rpc("vault_update_secret" as any, {
        secret_id: existing.id, new_secret: SECRET_VALUE,
      });
      if (updErr) throw updErr;
    } else {
      const { error: createErr } = await supabase.rpc("vault_create_secret" as any, {
        new_secret: SECRET_VALUE, new_name: "INGEST_CRON_SECRET",
      });
      if (createErr) throw createErr;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});