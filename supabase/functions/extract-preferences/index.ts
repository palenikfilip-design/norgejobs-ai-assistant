// Extracts structured job preferences from a short conversation,
// merges them into profiles.avatar_json (preserving existing keys),
// stamps preferences_updated_at, and sets needs_rescore = true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Extracted {
  target_countries?: string[];
  job_categories?: string[];
  languages_spoken?: string[];
  min_salary?: number | null;
  accommodation_needed?: boolean | null;
  seasonal_preference?: string | null;
  additional_notes?: string;
}

function unionArr(a: unknown, b: unknown): string[] {
  const arrA = Array.isArray(a) ? a.map(String) : [];
  const arrB = Array.isArray(b) ? b.map(String) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of [...arrA, ...arrB]) {
    const k = v.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v.trim());
  }
  return out;
}

function mergeAvatar(existing: Record<string, unknown>, incoming: Extracted): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing };

  if (incoming.target_countries !== undefined)
    merged.target_countries = unionArr(existing.target_countries, incoming.target_countries);
  if (incoming.job_categories !== undefined)
    merged.job_categories = unionArr(existing.job_categories, incoming.job_categories);
  if (incoming.languages_spoken !== undefined)
    merged.languages_spoken = unionArr(existing.languages_spoken, incoming.languages_spoken);

  if (incoming.min_salary !== undefined && incoming.min_salary !== null)
    merged.min_salary = incoming.min_salary;
  if (incoming.accommodation_needed !== undefined && incoming.accommodation_needed !== null)
    merged.accommodation_needed = incoming.accommodation_needed;
  if (incoming.seasonal_preference !== undefined && incoming.seasonal_preference !== null && incoming.seasonal_preference !== "")
    merged.seasonal_preference = incoming.seasonal_preference;

  if (incoming.additional_notes && incoming.additional_notes.trim()) {
    const prev = typeof existing.additional_notes === "string" ? existing.additional_notes : "";
    merged.additional_notes = prev
      ? `${prev}\n${incoming.additional_notes.trim()}`
      : incoming.additional_notes.trim();
  }

  return merged;
}

async function extractWithClaude(messages: ChatMessage[], apiKey: string): Promise<Extracted> {
  const convo = messages
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Leslie"}: ${m.content}`)
    .join("\n");

  const prompt = `Extract any new job preferences from this conversation. Return ONLY JSON with these keys (omit if not mentioned): {target_countries: [], job_categories: [], languages_spoken: [], min_salary: null, accommodation_needed: null, seasonal_preference: null, additional_notes: ''}. Conversation:\n${convo}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("Claude error:", resp.status, t.slice(0, 300));
    throw new Error(`claude_${resp.status}`);
  }

  const data = await resp.json();
  const text: string = data?.content?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Extracted;
  } catch (e) {
    console.warn("Could not parse Claude JSON:", e);
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller via JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = await extractWithClaude(messages, apiKey);

    // Read current avatar_json with service role (bypass RLS for cross-user safety isn't needed,
    // but service role guarantees we can read+write the row owned by userId)
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { data: prof, error: readErr } = await admin
      .from("profiles")
      .select("avatar_json")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) throw readErr;

    const existing =
      prof && typeof prof.avatar_json === "object" && prof.avatar_json !== null
        ? (prof.avatar_json as Record<string, unknown>)
        : {};
    const merged = mergeAvatar(existing, extracted);

    const { error: upErr } = await admin
      .from("profiles")
      .update({
        avatar_json: merged,
        preferences_updated_at: new Date().toISOString(),
        needs_rescore: true,
      })
      .eq("user_id", userId);
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ extracted, avatar_json: merged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("extract-preferences error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});