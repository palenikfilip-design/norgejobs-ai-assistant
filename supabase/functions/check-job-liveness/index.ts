// Liveness check for public_jobs via each portal's own detail API.
// Rules: ONLY HTTP 404/410 deactivates (is_active=false, soft). Network errors,
// timeouts, 5xx, 403, 429 etc. just bump last_liveness_check. Never deletes.
// Body: { ids?: string[] } — explicit rows; otherwise the 200 active rows with
// the oldest (or missing) last_liveness_check. Max 200 rows per invocation.
// Not scheduled on purpose — invoke manually until results are validated.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BATCH = 200;
const CONCURRENCY = 4;
const DELAY_MS = 150;
const TIMEOUT_MS = 8000;
const UA = "Mozilla/5.0 (compatible; LeslieBot/1.0; +https://leslie.app)";

type Row = { id: string; source_portal: string; external_id: string | null; url: string };

function b64url(s: string) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Returns the API URL (+ headers) to probe, and the method label for reporting. */
export function probeFor(r: Row): { url: string; headers: Record<string, string>; method: string } {
  const p = r.source_portal ?? "";
  const ext = r.external_id ?? "";
  if (p === "portal:Arbeitsagentur DE" && ext) {
    return {
      url: `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/${b64url(ext)}`,
      headers: { "X-API-Key": "jobboerse-jobsuche" }, method: "arbeitsagentur_v4_jobdetails",
    };
  }
  if (p.startsWith("portal:Arbetsförmedlingen") && ext) {
    return { url: `https://jobsearch.api.jobtechdev.se/ad/${encodeURIComponent(ext)}`, headers: {}, method: "jobtech_ad_api" };
  }
  if (p.startsWith("greenhouse:") && ext) {
    return { url: `https://boards-api.greenhouse.io/v1/boards/${p.slice(11)}/jobs/${encodeURIComponent(ext)}`, headers: {}, method: "greenhouse_api" };
  }
  if (p.startsWith("lever:") && ext) {
    return { url: `https://api.lever.co/v0/postings/${p.slice(6)}/${encodeURIComponent(ext)}`, headers: {}, method: "lever_api" };
  }
  if (p.startsWith("smartrecruiters:") && ext) {
    return { url: `https://api.smartrecruiters.com/v1/companies/${p.slice(16)}/postings/${encodeURIComponent(ext)}`, headers: {}, method: "smartrecruiters_api" };
  }
  // Workday, Arbeitnow, RSS, The Muse, Remotive, custom scrapers: the job URL itself.
  return { url: r.url, headers: {}, method: "job_url" };
}

async function probe(r: Row): Promise<{ status: number | null; method: string; error?: string }> {
  const { url, headers, method } = probeFor(r);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "GET", redirect: "follow", signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json, text/html;q=0.9", ...headers },
    });
    await resp.body?.cancel().catch(() => {});
    return { status: resp.status, method };
  } catch (e) {
    return { status: null, method, error: e instanceof Error ? e.name : "error" };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = Date.now();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let body: { ids?: unknown } = {};
  try { body = await req.json(); } catch { /* empty ok */ }
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, BATCH) : null;

  let q = supabase.from("public_jobs").select("id,source_portal,external_id,url").eq("is_active", true);
  q = ids ? q.in("id", ids) : q.order("last_liveness_check", { ascending: true, nullsFirst: true }).limit(BATCH);
  const { data, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const rows = (data ?? []) as Row[];

  const results: Array<{ id: string; source: string; method: string; status: number | null; deactivated: boolean; reason: string | null }> = [];
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const r = rows[cursor++];
      const res = await probe(r);
      const dead = res.status === 404 || res.status === 410;
      const reason = dead ? `http_${res.status}:${res.method}` : null;
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { last_liveness_check: now };
      if (dead) Object.assign(patch, { is_active: false, deactivated_at: now, deactivation_reason: reason });
      const { error: upErr } = await supabase.from("public_jobs").update(patch).eq("id", r.id);
      if (upErr) console.error("update failed", r.id, upErr.message);
      results.push({ id: r.id, source: r.source_portal, method: res.method, status: res.status, deactivated: dead && !upErr, reason });
      await new Promise((ok) => setTimeout(ok, DELAY_MS));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

  const bySource: Record<string, { checked: number; deactivated: number; statuses: Record<string, number> }> = {};
  for (const r of results) {
    const s = (bySource[r.source] ??= { checked: 0, deactivated: 0, statuses: {} });
    s.checked++;
    if (r.deactivated) s.deactivated++;
    const k = r.status == null ? "network_error" : String(r.status);
    s.statuses[k] = (s.statuses[k] ?? 0) + 1;
  }
  const out = {
    checked: results.length,
    deactivated: results.filter((r) => r.deactivated).length,
    by_source: bySource,
    duration_ms: Date.now() - started,
  };
  console.log("check-job-liveness:", JSON.stringify(out));
  return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
