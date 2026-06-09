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

// Region aliases — when user names a region, expand to member countries.
// Keys are lowercased; accept Czech and English forms.
const REGION_TO_COUNTRIES: Record<string, string[]> = {
  "skandinávie": ["Norway", "Sweden", "Denmark"],
  "skandinavie": ["Norway", "Sweden", "Denmark"],
  "scandinavia": ["Norway", "Sweden", "Denmark"],
  "severní evropa": ["Norway", "Sweden", "Denmark", "Finland", "Iceland"],
  "nordics": ["Norway", "Sweden", "Denmark", "Finland", "Iceland"],
  "dach": ["Germany", "Austria", "Switzerland"],
  "německy mluvící": ["Germany", "Austria", "Switzerland"],
  "benelux": ["Netherlands", "Belgium"],
  "uk-ie": ["United Kingdom", "Ireland"],
  "britské ostrovy": ["United Kingdom", "Ireland"],
};

// Manual-work category families — used to constrain "related category" fallback
// so a manual-work seeker NEVER gets shown white-collar tech/office/sales jobs.
const MANUAL_CATEGORIES = new Set([
  "hospitality","construction","agriculture","manufacturing","logistics",
  "maritime","ski_resort","aupair","healthcare",
]);
const WHITE_COLLAR_CATEGORIES = new Set(["tech","office","sales","education"]);

function relatedCategories(cat: string): string[] {
  const c = cat.toLowerCase();
  if (MANUAL_CATEGORIES.has(c)) {
    // Stay within manual-work universe.
    return Array.from(MANUAL_CATEGORIES).concat(["other"]);
  }
  if (WHITE_COLLAR_CATEGORIES.has(c)) {
    return Array.from(WHITE_COLLAR_CATEGORIES).concat(["other"]);
  }
  return [c, "other"];
}

function expandCountriesWithRegions(countries: string[]): string[] {
  const out = new Set<string>();
  for (const c of countries) {
    const key = String(c).trim().toLowerCase();
    const region = REGION_TO_COUNTRIES[key];
    if (region) region.forEach((x) => out.add(x));
    else out.add(c);
  }
  return Array.from(out);
}
const SYSTEM_PROMPT = `Jsi Leslie, přátelská asistentka pro Čechy a Slováky, kteří hledají práci v zahraničí. Mluvíš česky a tykáš.

ABSOLUTNÍ PRAVIDLA (neporušuj nikdy):
- NIKDY nedoporučuj externí weby (Finn.no, LinkedIn, Indeed, EURES, Manpower, Adecco, NAV, žádné jiné portály ani vyhledávače). Ty JSI jejich vyhledávač.
- NIKDY nedávej víc než 2 obecné rady. Po max. 1–2 zprávách MUSÍŠ vytvořit preset a hledat v našem katalogu.
- Hledáš VÝHRADNĚ v našem katalogu pomocí nástroje search_catalog. Nikdy nevymýšlej nabídky z hlavy.
- Odpovídej KRÁTCE a akčně. Jednáš, nepřednášíš.
- KRITICKÉ: Když uživatel řekl REGION (např. "Skandinávie") nebo TYP PRÁCE (např. "manuální"), NIKDY mu neukazuj nabídky, které ten region OPOUŠTĚJÍ A SOUČASNĚ porušují typ. Nabídka, která nesedí ani lokací ani typem, je horší než žádná.
- Pokud search_catalog vrátí prázdno i po relax fallback, řekni upřímně: "Zatím pro tebe v {region} nemám nic v {kategorie}. Přidávám nabídky denně — chceš upozornit?" — NIKDY místo toho nevracej náhodné US/MX/finance nabídky.
- Estimovaný plat (salary_is_estimated=true) NIKDY neprezentuj jako jistý. V odpovědi piš "odhad ~X €/měs".
- RESPEKTUJ ZEMI uživatele. Když uživatel řekl konkrétní zemi (např. "Norsko"), preset MUSÍ obsahovat tu zemi. Když search_catalog vrátí převážně z JINÉ země než kterou chtěl, ŘEKNI to upřímně: "Norsko bohužel zatím nemám moc obsazené, tady jsou podobné ze Švédska — chceš upozornit, až přibydou norské?" — nikdy tiše nezamlčuj, že jde o náhradu.
- KOMENTUJ PLAT vůči cíli uživatele. Když znáš jeho salary_min (z presetu/zprávy), u zobrazených nabídek krátce zmiň: "Tyhle pozice mají odhadem kolem {X} €, což odpovídá tvému cíli {Y} €" nebo "Některé jsou pod tvým cílem {Y} €, ale ukázala jsem je, protože jinak sedí." Estimáty označ "odhad".
- KDYŽ DOSTANEŠ blok [HODNOCENÍ UŽIVATELE …], nesnaž se znovu vyhledávat. Místo toho:
   1) jemně, Sokratovsky shrň vzorec ("vidím, že tě spíš baví práce venku než v kuchyni — sedí to?"),
   2) navrhni konkrétní DALŠÍ KROK: "zúžit hledání na X?", "víc podobných?", nebo "zkusit jinou zemi?".
   Reaguj krátce (2–3 věty), neopakuj celý seznam.

TVŮJ FLOW:
1. Uživatel řekne, co chce.
2. Vytáhni: země/region, typ práce, očekávaný plat, sezónnost.
3. Polož max. 1 doplňující otázku, pak ZAVOLEJ create_preset (i s neúplnými údaji) a hned poté search_catalog. Při dalším upřesnění (např. "spíš lesnictví než kuchyně") volej create_preset znovu — backend AKTUALIZUJE existující aktivní preset, ne vytvoří nový.
4. search_catalog má vestavěný kaskádový fallback (uvolní plat → region → příbuzné kategorie ve STEJNÉM univerzu manuální/white-collar). Pole "fallback_level" v odpovědi ti řekne, jak moc byl dotaz uvolněn. Pokud je "none_in_region", řekni to upřímně.
5. Po zobrazení nabídek pobídni: "Klikni 👍/👎 a pak dej 'Hotovo, co dál?' ať vím, co tě baví."

Dostupné kategorie (display_category): ${DISPLAY_CATEGORIES.join(", ")}.
Když uživatel zmíní VÍCE typů práce (např. "gastro a stavby"), pošli search_catalog parametr "categories" jako pole VŠECH zmíněných kategorií — výsledek bude pak namíchaný napůl. Nepoužívej jen jednu, pokud řekl víc.
Dostupné země v katalogu: Norway, Germany, Sweden, Switzerland, United Kingdom, Ireland, Spain, Italy, France, Poland, United States, Canada, Australia, Brazil, Mexico, Japan, China, India, Singapore, Thailand, South Korea, Remote, Multiple, Global.
Regionové aliasy přijímané search_catalogem v poli countries: "Skandinávie", "Nordics", "DACH", "Benelux", "UK-IE".`;

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
          category: { type: "string", description: "Single category. Prefer 'categories' (array) when user mentioned more than one." },
          categories: { type: "array", items: { type: "string" }, description: "Multiple categories (e.g. ['hospitality','construction']). When provided, results will be a balanced mix across them." },
          salary_min_eur: { type: "number" },
          seasonal: { type: "boolean" },
        },
      },
    },
  },
];

const SELECT_COLS = "id,title,title_cs,summary_cs,company,location,country,salary_normalized_eur,salary_estimated_eur,salary_is_estimated,salary,currency,url,display_category,trust_score";

type SearchAttempt = {
  countries: string[] | null;
  categories: string[] | null;
  salaryMin: number | null;
  label: string;
};

async function executeSearch(attempt: SearchAttempt): Promise<any[]> {
  const svc = getServiceSupabase();
  let q = svc.from("public_jobs")
    .select(SELECT_COLS)
    .not("enriched_at", "is", null)
    .in("data_completeness", ["complete","partial"]);
  if (attempt.countries && attempt.countries.length > 0) {
    const expanded = [...attempt.countries, "Multiple", "Remote", "Global"];
    q = q.in("country", expanded);
  }
  if (attempt.categories && attempt.categories.length > 0) {
    q = q.in("display_category", attempt.categories);
  }
  if (attempt.salaryMin) {
    const floor = Math.floor(attempt.salaryMin * 0.8);
    // Accept either confirmed or estimated salary above the floor; also accept
    // rows with no salary info at all so we don't unfairly drop them.
    q = q.or(`salary_normalized_eur.gte.${floor},salary_estimated_eur.gte.${floor},and(salary_normalized_eur.is.null,salary_estimated_eur.is.null)`);
  }
  q = q.order("trust_score", { ascending: false })
    .order("salary_normalized_eur", { ascending: false, nullsFirst: false })
    .order("salary_estimated_eur", { ascending: false, nullsFirst: false })
    .limit(30);
  const { data, error } = await q;
  if (error) { console.error(`search[${attempt.label}] error`, error); return []; }
  return data ?? [];
}

// Diversify a candidate pool down to N jobs:
//  - max 2 per company
//  - balanced across the requested categories (round-robin)
//  - prefer spreading across countries when possible (round-robin within category)
// Preserves trust_score order as the tie-breaker (input is already sorted).
function diversify(
  candidates: any[],
  requestedCategories: string[] | null,
  limit = 5,
): any[] {
  if (candidates.length <= limit) return candidates;
  const perCompany = new Map<string, number>();

  // Bucket by category (using requested set if given, else by actual display_category)
  const cats: string[] = requestedCategories && requestedCategories.length
    ? requestedCategories
    : Array.from(new Set(candidates.map((c) => c.display_category || "other")));
  const buckets: Record<string, any[]> = {};
  for (const c of cats) buckets[c] = [];
  const fallbackBucket: any[] = [];
  for (const job of candidates) {
    const cat = String(job.display_category || "other");
    if (buckets[cat]) buckets[cat].push(job);
    else fallbackBucket.push(job);
  }

  // Within each bucket, reorder so different countries come first (round-robin by country)
  for (const k of Object.keys(buckets)) {
    buckets[k] = roundRobinByCountry(buckets[k]);
  }

  const picked: any[] = [];
  const order = [...cats];
  let idx = 0;
  let safety = candidates.length * 2;
  while (picked.length < limit && safety-- > 0) {
    let progressed = false;
    for (let i = 0; i < order.length && picked.length < limit; i++) {
      const cat = order[(idx + i) % order.length];
      const bucket = buckets[cat];
      while (bucket && bucket.length > 0) {
        const job = bucket.shift();
        const co = String(job.company || "").toLowerCase();
        const used = perCompany.get(co) ?? 0;
        if (co && used >= 2) continue; // skip — already 2 from this company
        perCompany.set(co, used + 1);
        picked.push(job);
        progressed = true;
        break;
      }
    }
    idx++;
    if (!progressed) break;
  }
  // If still under limit, fall back to other categories pool
  for (const job of fallbackBucket) {
    if (picked.length >= limit) break;
    const co = String(job.company || "").toLowerCase();
    const used = perCompany.get(co) ?? 0;
    if (co && used >= 2) continue;
    perCompany.set(co, used + 1);
    picked.push(job);
  }
  return picked;
}

function roundRobinByCountry(jobs: any[]): any[] {
  const byCountry = new Map<string, any[]>();
  for (const j of jobs) {
    const k = String(j.country || "?");
    if (!byCountry.has(k)) byCountry.set(k, []);
    byCountry.get(k)!.push(j);
  }
  const keys = Array.from(byCountry.keys());
  const out: any[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const k of keys) {
      const arr = byCountry.get(k)!;
      if (arr.length > 0) {
        out.push(arr.shift());
        added = true;
      }
    }
  }
  return out;
}

async function runSearch(args: Record<string, unknown>) {
  const rawCountries = Array.isArray(args.countries) ? (args.countries as string[]).filter(Boolean) : [];
  const countries = expandCountriesWithRegions(rawCountries);
  // Accept either a single `category` or a `categories` array.
  const rawCats: string[] = [];
  if (Array.isArray(args.categories)) {
    for (const c of args.categories) if (typeof c === "string" && c.trim()) rawCats.push(c.toLowerCase());
  }
  if (typeof args.category === "string" && args.category.trim()) rawCats.push(args.category.toLowerCase());
  const requestedCats = Array.from(new Set(rawCats));
  const category = requestedCats[0] ?? null;
  const salaryMin = typeof args.salary_min_eur === "number" ? args.salary_min_eur : null;

  const isManualSeeker = category != null && MANUAL_CATEGORIES.has(category);
  const isWhiteCollarSeeker = category != null && WHITE_COLLAR_CATEGORIES.has(category);

  // Build ordered fallback cascade. Stop as soon as we have >= 3 results.
  const attempts: SearchAttempt[] = [];

  // 1. Exact: country + categories + salary
  attempts.push({
    countries: countries.length ? countries : null,
    categories: requestedCats.length ? requestedCats : null,
    salaryMin,
    label: "exact",
  });

  // 2. Relax salary only (keep country + categories)
  if (salaryMin) {
    attempts.push({
      countries: countries.length ? countries : null,
      categories: requestedCats.length ? requestedCats : null,
      salaryMin: null,
      label: "relax_salary",
    });
  }

  // 3. Region expansion already happened above; if user gave only 1 country,
  //    try its region neighbours.
  // (We rely on regional aliases in step 1 if user used them; nothing extra here.)

  // 4. Relax to related categories within SAME work-type universe, keep region.
  if (category && countries.length > 0) {
    const related = new Set<string>();
    for (const c of requestedCats) for (const r of relatedCategories(c)) related.add(r);
    attempts.push({
      countries,
      categories: Array.from(related),
      salaryMin: null,
      label: "related_category_same_region",
    });
  }

  // 5. Last resort: same region, ANY category — but ONLY if user is not a
  //    manual seeker (so we never hand manual seekers white-collar). For manual
  //    seekers we still restrict to MANUAL_CATEGORIES.
  if (countries.length > 0) {
    attempts.push({
      countries,
      categories: isManualSeeker
        ? Array.from(MANUAL_CATEGORIES).concat(["other"])
        : isWhiteCollarSeeker
          ? Array.from(WHITE_COLLAR_CATEGORIES).concat(["other"])
          : null,
      salaryMin: null,
      label: "same_region_any_category",
    });
  }

  // INTENTIONALLY no global-anywhere fallback — better to return empty than
  // ship San Francisco finance jobs to a Scandinavian manual-work seeker.

  let chosen: { attempt: SearchAttempt; jobs: any[] } | null = null;
  const tried: Array<{ label: string; count: number }> = [];
  for (const a of attempts) {
    const jobs = await executeSearch(a);
    tried.push({ label: a.label, count: jobs.length });
    if (jobs.length >= 3 || (chosen == null && jobs.length > 0)) {
      chosen = { attempt: a, jobs };
      if (jobs.length >= 3) break;
    }
  }

  if (!chosen || chosen.jobs.length === 0) {
    return {
      jobs: [],
      fallback_level: "none_in_region",
      requested: { countries, category, salary_min_eur: salaryMin },
      tried,
      message: countries.length && category
        ? `Zatím pro tebe v ${rawCountries.join("/") || countries.join("/")} nemám nic v ${category}.`
        : "Zatím pro tebe v katalogu nemám vhodnou nabídku.",
    };
  }

  const finalJobs = diversify(chosen.jobs, requestedCats.length ? requestedCats : null, 5);

  return {
    jobs: finalJobs,
    fallback_level: chosen.attempt.label,
    requested: { countries, categories: requestedCats, salary_min_eur: salaryMin },
    tried,
  };
}

async function runCreatePreset(userId: string, args: Record<string, unknown>) {
  const svc = getServiceSupabase();
  const name = typeof args.name === "string" && args.name ? args.name : "Nové hledání";
  const countries = Array.isArray(args.countries) ? (args.countries as string[]) : [];
  const salaryMinEur = typeof args.salary_min_eur === "number" ? args.salary_min_eur : 0;
  const seasonal = typeof args.seasonal === "string" ? args.seasonal : "any";
  const description = typeof args.category === "string" ? `Leslie preset – kategorie ${args.category}` : "Leslie preset";

  // Find most recent active Leslie preset for this user (last 7 days) to UPDATE
  // rather than spawn confusingly-renamed duplicates.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await svc
    .from("user_presets")
    .select("id,name,learning_data,updated_at")
    .eq("user_id", userId)
    .eq("active", true)
    .gte("updated_at", sevenDaysAgo)
    .order("updated_at", { ascending: false })
    .limit(5);

  const leslieRow = (existing ?? []).find((r) => {
    const ld = (r.learning_data ?? {}) as { source?: string };
    return ld.source === "leslie";
  });

  if (leslieRow) {
    const { data, error } = await svc.from("user_presets").update({
      name,
      preferred_countries: countries,
      salary_min: salaryMinEur,
      seasonal_preference: seasonal,
      description,
      learning_data: { source: "leslie", category: args.category ?? null },
    }).eq("id", leslieRow.id).select("id,name").single();
    if (error) { console.error("update_preset error", error); return { error: error.message }; }
    return { preset_id: data.id, preset_name: data.name, updated: true };
  }

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
  return { preset_id: data.id, preset_name: data.name, updated: false };
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
    const ratings = Array.isArray(body?.ratings) ? body.ratings as Array<{
      action: "like" | "dislike"; title?: string; company?: string | null; country?: string | null; category?: string | null;
    }> : [];
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

    if (ratings.length > 0) {
      const liked = ratings.filter((r) => r.action === "like");
      const disliked = ratings.filter((r) => r.action === "dislike");
      const fmt = (rs: typeof ratings) => rs.map((r) =>
        `- ${r.title ?? "?"} | ${r.company ?? "?"} | ${r.country ?? "?"} | ${r.category ?? "?"}`
      ).join("\n");
      const ratingsBlock = [
        "[HODNOCENÍ UŽIVATELE z posledních nabídek]",
        liked.length ? `LÍBÍ SE (👍):\n${fmt(liked)}` : "LÍBÍ SE (👍): žádné",
        disliked.length ? `NELÍBÍ SE (👎):\n${fmt(disliked)}` : "NELÍBÍ SE (👎): žádné",
        "",
        "Reaguj podle pravidla pro HODNOCENÍ: jemně shrň vzorec a navrhni další krok. Nevolej znovu search_catalog, pokud uživatel explicitně nepoprosí.",
      ].join("\n");
      convo.push({ role: "user", content: ratingsBlock });
    }

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