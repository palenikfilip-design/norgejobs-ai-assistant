// Archiles — admin assistant. Uses Lovable AI Gateway with function calling.
// Read-only data access to the Leslie catalog + admin-only persistence.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "palenik.filip@gmail.com";

const SYSTEM_PROMPT = `You are Archiles, the librarian AI for Leslie. You help the admin (Filip) manage the job catalog. You have access to:
- public_jobs (the entire catalog)
- job_sources (configured data sources)
- archiles_decisions (your past decisions and admin corrections)
- country_context (economic/cultural data)
- ingest_logs (data ingestion history)

Your role:
- Answer questions about catalog state.
- Suggest new sources to add.
- Investigate problems (why is source X failing? why is trust score low for company Y?).
- Propose improvements.
- Execute administrative tasks ONLY when admin approves.

Tone: Professional but warm. Concise. Use Czech if admin writes Czech, English otherwise.

When suggesting actions, ALWAYS present them as recommendations and wait for admin approval. Never auto-execute.
When you don't know something, say so. Better than guessing.
Use tools to fetch fresh data — do not invent numbers.`;

const WHITELIST_COLS = new Set([
  "title", "company", "country", "source_portal", "trust_score", "data_completeness",
  "needs_review", "is_active", "enriched_at", "salary_normalized_eur",
  "expat_openness", "skill_level", "category", "archiles_confidence",
]);
const WHITELIST_OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"]);

const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_catalog",
      description: "Run a safe filtered query against public_jobs. Returns up to 50 sample rows or aggregate count.",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "array",
            description: "Array of {column, op, value} predicates.",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                op: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"] },
                value: {},
              },
              required: ["column", "op", "value"],
            },
          },
          select: { type: "string", description: "Comma-separated columns (whitelisted)", default: "id,title,company,country,source_portal,trust_score" },
          limit: { type: "number", default: 20, maximum: 100 },
          count_only: { type: "boolean", default: false },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_source_health",
      description: "Compute stats for one job_source.",
      parameters: {
        type: "object",
        properties: { source_id: { type: "string" } },
        required: ["source_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_duplicates",
      description: "Find likely duplicate jobs grouped by lowercased title+company.",
      parameters: { type: "object", properties: { limit: { type: "number", default: 20 } } },
    },
  },
  {
    type: "function",
    function: {
      name: "explain_decision",
      description: "Return enrichment data + Archiles' notes for a specific job.",
      parameters: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_sources",
      description: "List configured job sources.",
      parameters: { type: "object", properties: { only_active: { type: "boolean", default: false } } },
    },
  },
];

async function runTool(name: string, args: any, admin: any) {
  try {
    if (name === "query_catalog") {
      const filters = Array.isArray(args.filters) ? args.filters : [];
      const select = typeof args.select === "string" ? args.select : "id,title,company,country,source_portal,trust_score";
      const limit = Math.min(Number(args.limit ?? 20), 100);
      let q = admin.from("public_jobs").select(select, { count: "exact" });
      for (const f of filters) {
        if (!WHITELIST_COLS.has(f.column) || !WHITELIST_OPS.has(f.op)) {
          return { error: `Column or operator not allowed: ${f.column} ${f.op}` };
        }
        // @ts-ignore dynamic
        q = q[f.op](f.column, f.value);
      }
      if (args.count_only) {
        const { count, error } = await q.range(0, 0);
        if (error) return { error: error.message };
        return { count };
      }
      const { data, count, error } = await q.limit(limit);
      if (error) return { error: error.message };
      return { count, sample: data };
    }
    if (name === "analyze_source_health") {
      const id = args.source_id;
      const { data: src } = await admin.from("job_sources").select("*").eq("id", id).maybeSingle();
      if (!src) return { error: "source not found" };
      const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { count: jobs30 } = await admin.from("public_jobs").select("id", { count: "exact", head: true }).eq("source_id", id).gte("created_at", since30);
      const { data: trustRows } = await admin.from("public_jobs").select("trust_score, data_completeness").eq("source_id", id).not("enriched_at", "is", null).limit(500);
      const scores = (trustRows ?? []).map((r: any) => r.trust_score ?? 0);
      const completes = (trustRows ?? []).map((r: any) => r.data_completeness);
      const { data: logs } = await admin.from("ingest_logs").select("status, created_at").eq("source", src.name).order("created_at", { ascending: false }).limit(20);
      const errors = (logs ?? []).filter((l: any) => l.status === "error").length;
      return {
        source: { id: src.id, name: src.name, type: src.source_type, is_active: src.is_active, last_run_at: src.last_run_at, last_run_status: src.last_run_status },
        jobs_added_30d: jobs30 ?? 0,
        avg_trust_score: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null,
        completeness_dist: completes.reduce((acc: any, c: string) => { acc[c] = (acc[c] ?? 0) + 1; return acc; }, {}),
        recent_errors: errors,
      };
    }
    if (name === "find_duplicates") {
      const limit = Math.min(Number(args.limit ?? 20), 50);
      const { data } = await admin.from("public_jobs").select("id, title, company, country").limit(2000);
      const groups = new Map<string, any[]>();
      (data ?? []).forEach((r: any) => {
        const k = `${(r.title ?? "").toLowerCase().trim()}|${(r.company ?? "").toLowerCase().trim()}`;
        if (!k.startsWith("|")) {
          const arr = groups.get(k) ?? [];
          arr.push(r);
          groups.set(k, arr);
        }
      });
      const dups = Array.from(groups.entries()).filter(([, v]) => v.length > 1).slice(0, limit).map(([k, v]) => ({ key: k, count: v.length, ids: v.map((x: any) => x.id) }));
      return { groups: dups };
    }
    if (name === "explain_decision") {
      const { data: job } = await admin.from("public_jobs").select("*").eq("id", args.job_id).maybeSingle();
      if (!job) return { error: "job not found" };
      const { data: dec } = await admin.from("archiles_decisions").select("*").eq("job_id", args.job_id).order("created_at", { ascending: false }).limit(5);
      return { job, decisions: dec };
    }
    if (name === "list_sources") {
      let q = admin.from("job_sources").select("id, name, source_type, tier, country, is_active, last_run_status, jobs_added_total");
      if (args.only_active) q = q.eq("is_active", true);
      const { data } = await q.order("name");
      return { sources: data };
    }
    return { error: `Unknown tool: ${name}` };
  } catch (e: any) {
    return { error: e.message ?? String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user || userData.user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const adminId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const incoming = Array.isArray(body?.messages) ? body.messages : [];
    const lastUser = [...incoming].reverse().find((m: any) => m.role === "user");

    // Build OpenAI-style message list
    const chatMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...incoming.slice(-20).map((m: any) => ({ role: m.role, content: m.content ?? "" })),
    ];

    // Allow up to 4 tool loops
    let finalReply = "";
    let toolCallsLog: any[] = [];
    for (let i = 0; i < 4; i++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: chatMessages,
          tools: TOOLS,
        }),
      });
      if (!aiResp.ok) {
        const txt = await aiResp.text();
        return new Response(JSON.stringify({ error: "AI gateway error", details: txt.slice(0, 500) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const ai = await aiResp.json();
      const choice = ai.choices?.[0]?.message;
      if (!choice) break;
      const calls = choice.tool_calls;
      if (calls && calls.length > 0) {
        chatMessages.push(choice);
        for (const c of calls) {
          const args = typeof c.function?.arguments === "string" ? JSON.parse(c.function.arguments || "{}") : (c.function?.arguments ?? {});
          const result = await runTool(c.function?.name, args, admin);
          toolCallsLog.push({ name: c.function?.name, args, result });
          chatMessages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result).slice(0, 8000) });
        }
        continue;
      }
      finalReply = choice.content ?? "";
      break;
    }

    // Persist
    if (lastUser) {
      await admin.from("archiles_chat_history").insert([
        { admin_id: adminId, message_role: "user", message_content: lastUser.content ?? "" },
        { admin_id: adminId, message_role: "assistant", message_content: finalReply, tool_calls: toolCallsLog },
      ]);
    }

    return new Response(JSON.stringify({ reply: finalReply, tool_calls: toolCallsLog }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});