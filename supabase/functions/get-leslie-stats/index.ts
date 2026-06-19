import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=900, s-maxage=900",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return new Response(JSON.stringify({ fallback: true, error: "config" }), { headers, status: 200 });
    }
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from("leslie_stats").select("*").maybeSingle();
    if (error) {
      console.error("leslie_stats query error:", error.message);
      return new Response(JSON.stringify({ fallback: true, error: error.message }), { headers, status: 200 });
    }
    return new Response(JSON.stringify(data ?? {}), { headers, status: 200 });
  } catch (e) {
    console.error("get-leslie-stats unhandled:", e);
    return new Response(JSON.stringify({ fallback: true, error: String(e?.message ?? e) }), { headers, status: 200 });
  }
});