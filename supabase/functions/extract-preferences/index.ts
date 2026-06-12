// Extracts structured info from a short conversation and routes it into:
//   - profiles (AVATAR — stable identity: languages, profession, etc.)
//   - user_presets (PRESET — current search intent: countries, salary, seasonal, …)
// Falls back to also merging into profiles.avatar_json for legacy/back-compat.

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

async function extractPreferences(messages: ChatMessage[], apiKey: string, supabase: any): Promise<Extracted> {
  const convo = messages
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Leslie"}: ${m.content}`)
    .join("\n");

  const prompt = `Extract any new job preferences from this conversation. Return ONLY JSON with these keys (omit if not mentioned): {target_countries: [], job_categories: [], languages_spoken: [], min_salary: null, accommodation_needed: null, seasonal_preference: null, additional_notes: ''}. Conversation:\n${convo}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error:", resp.status, t.slice(0, 300));
    throw new Error(`ai_${resp.status}`);
  }

  const data = await resp.json();
  try {
    const { logAiCall } = await import("../_shared/aiBudget.ts");
    await logAiCall(supabase, {
      function_name: "extract-preferences",
      model: "google/gemini-2.5-flash",
      usage: data?.usage ?? null,
    });
  } catch { /* best-effort */ }
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Extracted;
  } catch (e) {
    console.warn("Could not parse AI JSON:", e);
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

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

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { hasBudgetRemaining } = await import("../_shared/aiBudget.ts");
    const budget = await hasBudgetRemaining(admin);
    if (!budget.ok) {
      return new Response(JSON.stringify({ extracted: {}, budget_blocked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const extracted = await extractPreferences(messages, apiKey, admin);

    // Determine routing classification for admin observability log
    const hasIdentity = Array.isArray(extracted.languages_spoken) && extracted.languages_spoken.length > 0;
    const hasSearch = !!(
      (Array.isArray(extracted.target_countries) && extracted.target_countries.length > 0) ||
      (typeof extracted.min_salary === "number" && extracted.min_salary > 0) ||
      typeof extracted.accommodation_needed === "boolean" ||
      (typeof extracted.seasonal_preference === "string" && extracted.seasonal_preference) ||
      (Array.isArray(extracted.job_categories) && extracted.job_categories.length > 0)
    );
    const routedTo = hasIdentity && hasSearch ? "both" : hasIdentity ? "avatar" : hasSearch ? "preset" : "none";
    const extractedKeys = Object.keys(extracted).filter((k) => {
      const v = (extracted as Record<string, unknown>)[k];
      if (v === null || v === undefined) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "string") return v.trim().length > 0;
      return true;
    });
    const confidence = extractedKeys.length >= 2 ? "high" : "low";
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

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

    // --- Route SEARCH-INTENT fields into the user's active preset ---
    // Identity fields (languages_spoken) stay on the profile/avatar.
    // Search fields (countries, min_salary, accommodation, seasonal) update the active preset.
    try {
      let { data: presetRow } = await admin
        .from("user_presets")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      // Auto-create a first preset if user has none yet
      if (!presetRow) {
        const { data: created } = await admin
          .from("user_presets")
          .insert({
            user_id: userId,
            name: "Můj první preset",
            active: true,
            preferred_countries: extracted.target_countries ?? [],
            salary_min: extracted.min_salary ?? 0,
            salary_max: 0,
            housing_preference: extracted.accommodation_needed ?? false,
            language_requirements: extracted.languages_spoken ?? [],
            seasonal_preference:
              typeof extracted.seasonal_preference === "string"
                ? mapSeasonal(extracted.seasonal_preference)
                : "any",
            last_used_at: new Date().toISOString(),
          })
          .select("*")
          .maybeSingle();
        presetRow = created;
      } else {
        const patch: Record<string, unknown> = {};
        if (Array.isArray(extracted.target_countries) && extracted.target_countries.length > 0) {
          const existingCountries = Array.isArray(presetRow.preferred_countries)
            ? (presetRow.preferred_countries as string[])
            : [];
          patch.preferred_countries = Array.from(
            new Set([...existingCountries, ...extracted.target_countries]),
          );
        }
        if (typeof extracted.min_salary === "number" && extracted.min_salary > 0) {
          patch.salary_min = extracted.min_salary;
        }
        if (typeof extracted.accommodation_needed === "boolean") {
          patch.housing_preference = extracted.accommodation_needed;
        }
        if (typeof extracted.seasonal_preference === "string" && extracted.seasonal_preference) {
          patch.seasonal_preference = mapSeasonal(extracted.seasonal_preference);
        }
        if (Array.isArray(extracted.languages_spoken) && extracted.languages_spoken.length > 0) {
          const existingLangs = Array.isArray(presetRow.language_requirements)
            ? (presetRow.language_requirements as string[])
            : [];
          patch.language_requirements = Array.from(
            new Set([...existingLangs, ...extracted.languages_spoken]),
          );
        }
        patch.last_used_at = new Date().toISOString();
        if (Object.keys(patch).length > 0) {
          await admin.from("user_presets").update(patch).eq("id", presetRow.id);
        }
      }
    } catch (presetErr) {
      console.warn("preset routing failed (non-fatal):", presetErr);
    }

    // Log extraction for admin dashboard (non-fatal)
    try {
      await admin.from("chat_extractions").insert({
        user_id: userId,
        raw_message: lastUserMsg.slice(0, 2000),
        extracted_data: extracted as unknown as Record<string, unknown>,
        routed_to: routedTo,
        confidence,
      });
    } catch (logErr) {
      console.warn("chat_extractions log failed (non-fatal):", logErr);
    }

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

function mapSeasonal(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("permanent") || s.includes("trval")) return "permanent";
  if (s.includes("summer") || s.includes("letn")) return "summer";
  if (s.includes("winter") || s.includes("zimn")) return "winter";
  return "any";
}