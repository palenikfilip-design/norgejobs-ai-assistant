// Self-driving liveness check for public_jobs via each portal's own detail API.
// Rules: ONLY HTTP 404/410 deactivates (is_active=false, soft). 400, 403, 5xx,
// network errors = inconclusive → only bump last_liveness_check. Never deletes.
// 429 → exponential per-source backoff (source skipped until backoff_until,
// per-request delay doubled). Scheduled by pg_cron every 5 min; a DB lease
// guarantees single flight. Picks active rows never checked or checked > 3 days
// ago (NULLs first), so after the backlog it keeps re-checking every ~3–4 days.
// Batch size adapts (stored in liveness_state): grows when runs finish fast.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MIN_BATCH = 200;
const MAX_BATCH = 1000; // PostgREST row cap per select
const CONCURRENCY = 10;
const DEFAULT_DELAY_MS = 100;
const MAX_DELAY_MS = 10_000;
const TIMEOUT_MS = 8000;
const TIME_BUDGET_MS = 100_000;
const LEASE_SECONDS = 240;
const RECHECK_DAYS = 3;
const UA = "Mozilla/5.0 (compatible; LeslieBot/1.0; +https://leslie.app)";

type Row = { id: string; source_portal: string; external_id: string | null; url: string };
type Backoff = { source_portal: string; consecutive_429: number; delay_ms: number; backoff_until: string | null };

function b64url(s: string) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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
  return { url: r.url, headers: {}, method: "job_url" };
}

async function probe(r: Row): Promise<{ status: number | null; method: string }> {
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
  } catch {
    return { status: null, method };
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = Date.now();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

  // Auth: cron secret or service-role bearer.
  const cronSecret = req.headers.get("x-cron-secret");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let authorized = bearer === serviceKey;
  if (!authorized && cronSecret) {
    const { data } = await supabase.rpc("verify_ingest_cron_secret", { _provided: cronSecret });
    authorized = data === true;
  }
  if (!authorized) return json({ error: "unauthorized" }, 401);

  // Single flight.
  const { data: leaseData, error: leaseErr } = await supabase.rpc("liveness_acquire_lease", { _seconds: LEASE_SECONDS });
  if (leaseErr) return json({ error: leaseErr.message }, 500);
  const leased = Array.isArray(leaseData) ? leaseData[0] : leaseData;
  if (leased == null) return json({ skipped: "another run holds the lease" });
  const batch = Math.min(MAX_BATCH, Math.max(MIN_BATCH, Number(leased) || 500));

  const releaseLease = () => supabase.from("liveness_state").update({ lease_until: null, updated_at: new Date().toISOString() }).eq("id", 1);

  try {
    // Per-source backoff state.
    const { data: boData } = await supabase.from("liveness_source_backoff").select("source_portal,consecutive_429,delay_ms,backoff_until");
    const backoff = new Map<string, Backoff>(((boData ?? []) as Backoff[]).map((b) => [b.source_portal, b]));
    const nowIso = new Date().toISOString();
    const blocked = [...backoff.values()].filter((b) => b.backoff_until && b.backoff_until > nowIso).map((b) => b.source_portal);

    const cutoff = new Date(Date.now() - RECHECK_DAYS * 86400_000).toISOString();
    let q = supabase.from("public_jobs").select("id,source_portal,external_id,url")
      .eq("is_active", true)
      .or(`last_liveness_check.is.null,last_liveness_check.lt.${cutoff}`);
    if (blocked.length) q = q.not("source_portal", "in", `(${blocked.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",")})`);
    const { data, error } = await q.order("last_liveness_check", { ascending: true, nullsFirst: true }).limit(batch);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];

    const nextAt = new Map<string, number>();
    const hit429 = new Set<string>();
    const touched = new Set<string>();
    const okIds: string[] = [];
    const deadByReason = new Map<string, string[]>();
    const bySource: Record<string, { checked: number; deactivated: number; inconclusive: number; statuses: Record<string, number> }> = {};
    let cursor = 0;
    let budgetHit = false;

    async function worker() {
      while (cursor < rows.length) {
        if (Date.now() - started > TIME_BUDGET_MS) { budgetHit = true; return; }
        const r = rows[cursor++];
        const src = r.source_portal;
        if (hit429.has(src)) continue; // leave unchecked; retried after backoff
        const delay = backoff.get(src)?.delay_ms ?? DEFAULT_DELAY_MS;
        const wait = (nextAt.get(src) ?? 0) - Date.now();
        nextAt.set(src, Math.max(Date.now(), nextAt.get(src) ?? 0) + delay);
        if (wait > 0) await sleep(wait);
        const res = await probe(r);
        touched.add(src);
        const s = (bySource[src] ??= { checked: 0, deactivated: 0, inconclusive: 0, statuses: {} });
        const k = res.status == null ? "network_error" : String(res.status);
        s.statuses[k] = (s.statuses[k] ?? 0) + 1;
        if (res.status === 429) { hit429.add(src); continue; } // not marked checked
        s.checked++;
        if (res.status === 404 || res.status === 410) {
          const reason = `http_${res.status}:${res.method}`;
          (deadByReason.get(reason) ?? deadByReason.set(reason, []).get(reason)!).push(r.id);
          s.deactivated++;
        } else {
          okIds.push(r.id);
          if (res.status == null || res.status === 400 || res.status === 403 || res.status >= 500) s.inconclusive++;
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

    // Persist in chunks.
    const now = new Date().toISOString();
    for (let i = 0; i < okIds.length; i += 200) {
      const { error: e } = await supabase.from("public_jobs").update({ last_liveness_check: now }).in("id", okIds.slice(i, i + 200));
      if (e) console.error("bump failed", e.message);
    }
    let deactivated = 0;
    for (const [reason, ids] of deadByReason) {
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error: e } = await supabase.from("public_jobs")
          .update({ is_active: false, deactivated_at: now, deactivation_reason: reason, last_liveness_check: now })
          .in("id", chunk);
        if (e) console.error("deactivate failed", e.message); else deactivated += chunk.length;
      }
    }

    // Update per-source backoff.
    const boUpserts: Array<Record<string, unknown>> = [];
    for (const src of hit429) {
      const prev = backoff.get(src);
      const n = (prev?.consecutive_429 ?? 0) + 1;
      const minutes = Math.min(60, 2 ** n);
      boUpserts.push({
        source_portal: src, consecutive_429: n,
        delay_ms: Math.min(MAX_DELAY_MS, Math.max(DEFAULT_DELAY_MS, (prev?.delay_ms ?? DEFAULT_DELAY_MS) * 2)),
        backoff_until: new Date(Date.now() + minutes * 60_000).toISOString(), updated_at: now,
      });
    }
    for (const src of touched) {
      if (hit429.has(src)) continue;
      const prev = backoff.get(src);
      if (prev && (prev.consecutive_429 > 0 || prev.delay_ms > DEFAULT_DELAY_MS)) {
        boUpserts.push({
          source_portal: src, consecutive_429: 0,
          delay_ms: Math.max(DEFAULT_DELAY_MS, Math.round(prev.delay_ms * 0.75)), backoff_until: null, updated_at: now,
        });
      }
    }
    if (boUpserts.length) await supabase.from("liveness_source_backoff").upsert(boUpserts);

    // Adapt batch size.
    const duration = Date.now() - started;
    let newBatch = batch;
    if (budgetHit) newBatch = Math.max(MIN_BATCH, Math.round(batch * 0.75));
    else if (rows.length >= batch && duration < 50_000) newBatch = Math.min(MAX_BATCH, Math.round(batch * 1.25));
    await supabase.from("liveness_state").update({ batch_size: newBatch, lease_until: null, updated_at: now }).eq("id", 1);

    const checked = okIds.length + deactivated;
    const inconclusive = Object.values(bySource).reduce((a, s) => a + s.inconclusive, 0);
    const note = [budgetHit ? "time_budget_hit" : null, hit429.size ? `429:${[...hit429].join("|")}` : null, blocked.length ? `skipped_backoff:${blocked.length}` : null].filter(Boolean).join("; ") || null;
    await supabase.from("liveness_runs").insert({ duration_ms: duration, batch_size: batch, checked, deactivated, inconclusive, by_source: bySource, note });

    const out = { batch, next_batch: newBatch, selected: rows.length, checked, deactivated, inconclusive, duration_ms: duration, note, by_source: bySource };
    console.log("check-job-liveness:", JSON.stringify({ ...out, by_source: undefined }));
    return json(out);
  } catch (e) {
    await releaseLease();
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
