import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=900, s-maxage=900",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TTL_MS = 5 * 60 * 1000;
let cache: { data: unknown; expires: number } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    if (cache && cache.expires > Date.now()) {
      return new Response(JSON.stringify(cache.data), { headers, status: 200 });
    }
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
    const payload = data ?? {};
    cache = { data: payload, expires: Date.now() + TTL_MS };
    return new Response(JSON.stringify(payload), { headers, status: 200 });
  } catch (e) {
    console.error("get-leslie-stats unhandled:", e);
    return new Response(JSON.stringify({ fallback: true, error: String(e?.message ?? e) }), { headers, status: 200 });
  }
});