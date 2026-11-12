import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { publicLogoPath } from "./access.ts";

const Body = z.object({ slug: z.string().min(1).max(255).regex(/^[a-zA-Z0-9-]+$/) });
// Intentionally public: accepts only a company slug, never an arbitrary storage path.
Deno.serve(async (req) => {
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return reply({ error: "Invalid company slug" }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply({ error: "Logo service unavailable" }, 503);
    const db = createClient(url, key);
    const { data, error } = await db.from("companies").select("logo_url").eq("slug", parsed.data.slug).eq("status", "active").not("approved_at", "is", null).maybeSingle();
    if (error) return reply({ error: "Logo service unavailable" }, 503);
    if (!data) return reply({ error: "Company not found" }, 404);
    const path = publicLogoPath(data.logo_url);
    if (!path) return reply({ signedUrl: null });
    const signed = await db.storage.from("company-logos").createSignedUrl(path, 3600);
    if (signed.error) return reply({ error: "Logo unavailable" }, 404);
    return reply({ signedUrl: signed.data.signedUrl });
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
});