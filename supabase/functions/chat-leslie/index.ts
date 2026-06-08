// Leslie — preset-building catalog search assistant.
// Strict rules: never recommend external sites, converge to a preset+jobs fast.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage { role: "user" | "assistant" | "system" | "tool"; content: string; tool_calls?: unknown; tool_call_id?: string; name?: string }

const DISPLAY_CATEGORIES = [
  "hospitality","construction","tech","healthcare","agriculture","ski_resort",
  "aupair","maritime","logistics","office","manufacturing","sales","education","other",
];

const SYSTEM_PROMPT = `Jsi Leslie, přátelská asistentka pro Čechy a Slováky, kteří hledají práci v zahraničí. Mluvíš česky a tykáš.

ABSOLUTNÍ PRAVIDLA (neporušuj nikdy):
- NIKDY nedoporučuj externí weby (Finn.no, LinkedIn, Indeed, EURES, Manpower, Adecco, NAV, žádné jiné portály ani vyhledávače). Ty JSI jejich vyhledávač.
- NIKDY nedávej víc než 2 obecné rady. Po max. 1–2 zprávách MUSÍŠ vytvořit preset a hledat v našem katalogu.
- Hledáš VÝHRADNĚ v našem katalogu pomocí nástroje search_catalog. Nikdy nevymýšlej nabídky z hlavy.
- Odpovídej KRÁTCE a akčně. Jednáš, nepřednášíš.

TVŮJ FLOW:
1. Uživatel řekne, co chce.
2. Vytáhni: země/region, typ práce, očekávaný plat, sezónnost.
3. Polož max. 1 doplňující otázku, pak ZAVOLEJ create_preset (i s neúplnými údaji) a hned poté search_catalog.
4. Když search_catalog vrátí 0 výsledků, buď upřímná ("Zatím pro tebe nemám nabídky v X v oboru Y") a zavolej search_catalog znovu se SOUSEDNÍMI parametry (jiná země nebo jiná kategorie). Nikdy uživatele nepouštěj na externí web.
5. Po zobrazení nabídek pobídni: "Klikni 👍/👎 ať vím, co tě baví."

Dostupné kategorie (display_category): ${DISPLAY_CATEGORIES.join(", ")}.
Dostupné země v katalogu: Norway, Germany, Sweden, Switzerland, United Kingdom, Ireland, Spain, Italy, France, Poland, United States, Canada, Australia, Brazil, Mexico, Japan, China, India, Singapore, Thailand, South Korea, Remote, Multiple, Global.`;

function getSupabase(authHeader: string | null) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  return createClient(url, anon, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false },
  });
}
function getServiceSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_preset",
      description: "Create or update an active search preset for this user. Call this as soon as you have at least country OR category.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short Czech name, e.g. 'Skandinávie - manuální práce'" },
          countries: { type: "array", items: { type: "string" }, description: "Country names matching catalog (e.g. ['Norway','Sweden'])." },
          category: { type: "string", description: `One of: ${DISPLAY_CATEGORIES.join(", ")}` },
          salary_min_eur: { type: "number", description: "Minimum monthly salary in EUR (convert from CZK: 25 CZK ≈ 1 EUR)." },
          seasonal: { type: "string", enum: ["any","seasonal","year_round"] },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_catalog",
      description: "Search our internal job catalog. Returns up to 5 jobs.",
      parameters: {
        type: "object",
        properties: {
          countries: { type: "array", items: { type: "string" } },
          category: { type: "string" },
          salary_min_eur: { type: "number" },
          seasonal: { type: "boolean" },
        },
      },
    },
  },
];

async function runSearch(args: Record<string, unknown>) {
  const svc = getServiceSupabase();
  const countries = Array.isArray(args.countries) ? (args.countries as string[]).filter(Boolean) : [];
  const category = typeof args.category === "string" ? args.category : null;
  const salaryMin = typeof args.salary_min_eur === "number" ? args.salary_min_eur : null;
  let q = svc.from("public_jobs")
    .select("id,title,company,location,country,salary_normalized_eur,salary,currency,url,display_category,trust_score")
    .not("enriched_at", "is", null)
    .in("data_completeness", ["complete","partial"]);
  if (countries.length > 0) {
    const expanded = [...countries, "Multiple", "Remote", "Global"];
    q = q.in("country", expanded);
  }
  if (category) q = q.eq("display_category", category);
  if (salaryMin) q = q.or(`salary_normalized_eur.is.null,salary_normalized_eur.gte.${Math.floor(salaryMin * 0.8)}`);
  q = q.order("trust_score", { ascending: false }).order("salary_normalized_eur", { ascending: false, nullsFirst: false }).limit(5);
  const { data, error } = await q;
  if (error) { console.error("search_catalog error", error); return { jobs: [], error: error.message }; }
  return { jobs: data ?? [] };
}

async function runCreatePreset(userId: string, args: Record<string, unknown>) {
  const svc = getServiceSupabase();
  const name = typeof args.name === "string" && args.name ? args.name : "Nové hledání";
  const countries = Array.isArray(args.countries) ? (args.countries as string[]) : [];
  const salaryMinEur = typeof args.salary_min_eur === "number" ? args.salary_min_eur : 0;
  const seasonal = typeof args.seasonal === "string" ? args.seasonal : "any";
  const description = typeof args.category === "string" ? `Leslie preset – kategorie ${args.category}` : "Leslie preset";

  // Deactivate other presets of same name → just create new active row
  const { data, error } = await svc.from("user_presets").insert({
    user_id: userId,
    name,
    preferred_countries: countries,
    salary_min: salaryMinEur,
    active: true,
    seasonal_preference: seasonal,
    description,
    learning_data: { source: "leslie", category: args.category ?? null },
  }).select("id,name").single();
  if (error) { console.error("create_preset error", error); return { error: error.message }; }
  return { preset_id: data.id, preset_name: data.name };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: "missing_key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const authHeader = req.headers.get("Authorization");
    const supa = getSupabase(authHeader);
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const incoming: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const userName: string | undefined = typeof body?.userName === "string" ? body.userName : undefined;
    if (incoming.length === 0) return new Response(JSON.stringify({ error: "messages_required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const svc = getServiceSupabase();
    const lastUser = [...incoming].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await svc.from("leslie_chat_history").insert({ user_id: user.id, message_role: "user", message_content: lastUser.content });
    }

    const systemContent = userName ? `${SYSTEM_PROMPT}\n\nUživatel se jmenuje ${userName}.` : SYSTEM_PROMPT;
    const cleaned = incoming
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    const convo: ChatMessage[] = [{ role: "system", content: systemContent }, ...cleaned];

    const collectedJobs: unknown[] = [];
    let presetId: string | null = null;
    let presetName: string | null = null;

    for (let step = 0; step < 5; step++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: convo, tools: TOOLS, tool_choice: "auto" }),
      });
      if (!aiResp.ok) {
        const errText = await aiResp.text().catch(() => "");
        console.error("AI gateway error", aiResp.status, errText.slice(0, 300));
        const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 500;
        const code = status === 429 ? "rate_limited" : status === 402 ? "payment_required" : "ai_error";
        return new Response(JSON.stringify({ error: code }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await aiResp.json();
      const msg = data?.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls;

      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
        for (const tc of toolCalls) {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* */ }
          let result: unknown;
          if (tc.function?.name === "search_catalog") {
            const r = await runSearch(parsed);
            result = r;
            if (Array.isArray(r.jobs)) collectedJobs.push(...r.jobs);
          } else if (tc.function?.name === "create_preset") {
            const r = await runCreatePreset(user.id, parsed);
            if (r.preset_id) { presetId = r.preset_id; presetName = r.preset_name ?? null; }
            result = r;
          } else {
            result = { error: "unknown_tool" };
          }
          convo.push({ role: "tool", tool_call_id: tc.id, name: tc.function?.name, content: JSON.stringify(result) });
        }
        continue;
      }

      const reply: string = msg?.content ?? "";
      // Dedupe jobs by id, keep first 5
      const seen = new Set<string>();
      const jobs = collectedJobs.filter((j) => {
        const id = (j as { id?: string })?.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 5);

      await svc.from("leslie_chat_history").insert({
        user_id: user.id,
        message_role: "assistant",
        message_content: reply,
        preset_id: presetId,
        metadata: { jobs, preset_name: presetName },
      });

      return new Response(JSON.stringify({ reply, jobs, preset_id: presetId, preset_name: presetName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ reply: "Něco se zaseklo, zkus to prosím znovu.", jobs: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("chat-leslie error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});