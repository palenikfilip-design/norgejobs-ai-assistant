import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tier → minimum interval before next run
const TIER_INTERVAL_MS: Record<number, number> = {
  1: 60 * 60 * 1000,        // hourly
  2: 4 * 60 * 60 * 1000,    // every 4 hours
  3: 24 * 60 * 60 * 1000,   // daily
};

type SourceType =
  | "portal_api"
  | "ats_greenhouse"
  | "ats_lever"
  | "ats_smartrecruiters"
  | "ats_workday"
  | "ats_personio"
  | "rss_feed";

interface JobSource {
  id: string;
  name: string;
  source_type: SourceType;
  tier: number;
  config: Record<string, any>;
  country: string | null;
  sector: string | null;
  last_run_at: string | null;
}

interface NormalizedJob {
  external_id: string | null;
  source_portal: string;
  source_id: string;
  title: string;
  company: string | null;
  description: string | null;
  location: string | null;
  country: string | null;
  url: string;
  job_type: null;
  salary_min: null;
  salary_max: null;
  currency: null;
  posted_at: string | null;
  raw_data: Record<string, unknown>;
  fetched_at: string;
}

const nowIso = () => new Date().toISOString();

function getByPath(obj: any, path: string): any {
  if (!path) return undefined;
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function fetchText(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// ---------- ADAPTERS ----------

async function adapterGreenhouse(s: JobSource): Promise<NormalizedJob[]> {
  const company = String(s.config.company ?? "");
  if (!company) throw new Error("greenhouse: missing config.company");
  const data = await fetchJson(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs`,
  );
  const items: any[] = Array.isArray(data?.jobs) ? data.jobs : [];
  return items.filter((it) => it?.title && it?.absolute_url).map((it) => ({
    external_id: it.id != null ? String(it.id) : null,
    source_portal: `greenhouse:${company}`,
    source_id: s.id,
    title: String(it.title),
    company: s.name,
    description: null,
    location: it.location?.name ?? null,
    country: s.country,
    url: String(it.absolute_url),
    job_type: null, salary_min: null, salary_max: null, currency: null,
    posted_at: it.updated_at ?? null,
    raw_data: {},
    fetched_at: nowIso(),
  }));
}

async function adapterLever(s: JobSource): Promise<NormalizedJob[]> {
  const company = String(s.config.company ?? "");
  if (!company) throw new Error("lever: missing config.company");
  const data = await fetchJson(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`,
  );
  const items: any[] = Array.isArray(data) ? data : [];
  return items.filter((it) => it?.text && it?.hostedUrl).map((it) => ({
    external_id: it.id ? String(it.id) : null,
    source_portal: `lever:${company}`,
    source_id: s.id,
    title: String(it.text),
    company: s.name,
    description: it.descriptionPlain ?? null,
    location: it.categories?.location ?? null,
    country: s.country,
    url: String(it.hostedUrl),
    job_type: null, salary_min: null, salary_max: null, currency: null,
    posted_at: it.createdAt ? new Date(it.createdAt).toISOString() : null,
    raw_data: {},
    fetched_at: nowIso(),
  }));
}

async function adapterSmartRecruiters(s: JobSource): Promise<NormalizedJob[]> {
  const company = String(s.config.company ?? "");
  if (!company) throw new Error("smartrecruiters: missing config.company");
  const data = await fetchJson(
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings`,
  );
  const items: any[] = Array.isArray(data?.content) ? data.content : [];
  return items.filter((it) => it?.name && it?.id).map((it) => ({
    external_id: String(it.id),
    source_portal: `smartrecruiters:${company}`,
    source_id: s.id,
    title: String(it.name),
    company: s.name,
    description: null,
    location: it.location?.city ?? null,
    country: s.country ?? it.location?.country ?? null,
    url: `https://jobs.smartrecruiters.com/${company}/${it.id}`,
    job_type: null, salary_min: null, salary_max: null, currency: null,
    posted_at: it.releasedDate ?? null,
    raw_data: {},
    fetched_at: nowIso(),
  }));
}

async function adapterWorkday(s: JobSource): Promise<NormalizedJob[]> {
  const tenant = String(s.config.tenant ?? "");
  const wdRaw = String(s.config.wd ?? "");
  const wd = wdRaw.replace(/^wd/i, "");
  const site = String(s.config.site ?? "");
  if (!tenant || !wd || !site) throw new Error("workday: missing tenant/wd/site");
  const url = `https://${tenant}.wd${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  const data = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
  });
  const items: any[] = Array.isArray(data?.jobPostings) ? data.jobPostings : [];
  return items.filter((it) => it?.title && it?.externalPath).map((it) => ({
    external_id: it.bulletFields?.[0] ?? it.externalPath ?? null,
    source_portal: `workday:${tenant}`,
    source_id: s.id,
    title: String(it.title),
    company: s.name,
    description: null,
    location: it.locationsText ?? null,
    country: s.country,
    url: `https://${tenant}.wd${wd}.myworkdayjobs.com${it.externalPath}`,
    job_type: null, salary_min: null, salary_max: null, currency: null,
    posted_at: it.postedOn ?? null,
    raw_data: {},
    fetched_at: nowIso(),
  }));
}

async function adapterPersonio(s: JobSource): Promise<NormalizedJob[]> {
  const company = String(s.config.company ?? "");
  if (!company) throw new Error("personio: missing config.company");
  const xml = await fetchText(`https://${company}.jobs.personio.com/xml`);
  const positions = [...xml.matchAll(/<position[\s\S]*?<\/position>/g)].map((m) => m[0]);
  const get = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    if (!m) return null;
    return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  };
  return positions.map((p) => {
    const id = get(p, "id");
    const name = get(p, "name") ?? "";
    const office = get(p, "office");
    const url = id ? `https://${company}.jobs.personio.com/job/${id}` : null;
    return {
      external_id: id,
      source_portal: `personio:${company}`,
      source_id: s.id,
      title: name,
      company: s.name,
      description: get(p, "jobDescriptions"),
      location: office,
      country: s.country,
      url: url ?? "",
      job_type: null, salary_min: null, salary_max: null, currency: null,
      posted_at: get(p, "createdAt"),
      raw_data: {},
      fetched_at: nowIso(),
    } as NormalizedJob;
  }).filter((j) => j.title && j.url);
}

async function adapterRssFeed(s: JobSource): Promise<NormalizedJob[]> {
  const url = String(s.config.url ?? "");
  if (!url) throw new Error("rss_feed: missing config.url");
  const xml = await fetchText(url);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const get = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    if (!m) return null;
    return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  };
  return items.map((it) => {
    const link = get(it, "link") ?? "";
    return {
      external_id: get(it, "guid") ?? link,
      source_portal: `rss:${s.name}`,
      source_id: s.id,
      title: get(it, "title") ?? "",
      company: s.name,
      description: get(it, "description"),
      location: null,
      country: s.country,
      url: link,
      job_type: null, salary_min: null, salary_max: null, currency: null,
      posted_at: get(it, "pubDate"),
      raw_data: {},
      fetched_at: nowIso(),
    } as NormalizedJob;
  }).filter((j) => j.title && j.url);
}

async function adapterPortalApi(s: JobSource): Promise<NormalizedJob[]> {
  const url = String(s.config.url ?? "");
  if (!url) throw new Error("portal_api: missing config.url");
  if (s.config.token_required && !s.config.token) {
    throw new Error("portal_api: token_required but no config.token set");
  }
  const headers: Record<string, string> = { ...(s.config.headers ?? {}) };
  if (s.config.token) headers["Authorization"] = `Bearer ${s.config.token}`;
  const data = await fetchJson(url, { headers });

  const path = String(s.config.json_path ?? "");
  let items: any[] = [];
  const candidate = path ? getByPath(data, path) : data;
  if (Array.isArray(candidate)) items = candidate;
  else if (Array.isArray(data)) items = data;
  else if (Array.isArray(data?.content)) items = data.content;
  else if (Array.isArray(data?.items)) items = data.items;
  else if (Array.isArray(data?.jobs)) items = data.jobs;

  const fm = (s.config.field_map ?? {}) as Record<string, string>;
  const portal = `portal:${s.name}`;
  return items.map((it) => {
    const title = (fm.title ? getByPath(it, fm.title) : it.title) ?? "";
    const url = (fm.url ? getByPath(it, fm.url) : it.url) ?? "";
    const location = fm.location ? getByPath(it, fm.location) : null;
    const ext = (fm.id ? getByPath(it, fm.id) : it.id ?? null);
    return {
      external_id: ext != null ? String(ext) : (url || null),
      source_portal: portal,
      source_id: s.id,
      title: String(title),
      company: s.name,
      description: null,
      location: location ? String(location) : null,
      country: s.country,
      url: String(url),
      job_type: null, salary_min: null, salary_max: null, currency: null,
      posted_at: null,
      raw_data: {},
      fetched_at: nowIso(),
    } as NormalizedJob;
  }).filter((j) => j.title && j.url);
}

const ADAPTERS: Record<SourceType, (s: JobSource) => Promise<NormalizedJob[]>> = {
  portal_api: adapterPortalApi,
  ats_greenhouse: adapterGreenhouse,
  ats_lever: adapterLever,
  ats_smartrecruiters: adapterSmartRecruiters,
  ats_workday: adapterWorkday,
  ats_personio: adapterPersonio,
  rss_feed: adapterRssFeed,
};

async function runSource(supabase: ReturnType<typeof createClient>, s: JobSource) {
  const started = Date.now();
  try {
    const adapter = ADAPTERS[s.source_type];
    if (!adapter) throw new Error(`unknown source_type: ${s.source_type}`);
    const rows = await adapter(s);

    let added = 0;
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error: upErr, count } = await supabase
        .from("public_jobs")
        .upsert(chunk, {
          onConflict: "source_portal,external_id",
          ignoreDuplicates: false,
          count: "exact",
        });
      if (upErr) throw upErr;
      added += count ?? chunk.length;
    }

    const duration = Date.now() - started;
    await supabase.rpc; // no-op to keep types
    await supabase
      .from("job_sources")
      .update({
        last_run_at: nowIso(),
        last_run_status: "success",
        last_error: null,
        jobs_added_total: (await getCurrentTotal(supabase, s.id)) + added,
      })
      .eq("id", s.id);

    await supabase.from("ingest_logs").insert({
      source: `${s.source_type}:${s.name}`,
      status: "success",
      jobs_added: added,
      jobs_skipped: rows.length - added,
      duration_ms: duration,
    });

    return { id: s.id, name: s.name, total: rows.length, added, duration_ms: duration };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ingest-jobs] ${s.name} failed`, msg);
    await supabase.from("job_sources").update({
      last_run_at: nowIso(),
      last_run_status: "error",
      last_error: msg,
    }).eq("id", s.id);
    await supabase.from("ingest_logs").insert({
      source: `${s.source_type}:${s.name}`,
      status: "error",
      error_message: msg,
    });
    return { id: s.id, name: s.name, error: msg };
  }
}

async function getCurrentTotal(supabase: ReturnType<typeof createClient>, id: string): Promise<number> {
  const { data } = await supabase.from("job_sources").select("jobs_added_total").eq("id", id).maybeSingle();
  return Number((data as any)?.jobs_added_total ?? 0);
}

function isDue(s: JobSource): boolean {
  if (!s.last_run_at) return true;
  const interval = TIER_INTERVAL_MS[s.tier] ?? TIER_INTERVAL_MS[2];
  return Date.now() - new Date(s.last_run_at).getTime() >= interval;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional body: { source_id?: string, force?: boolean }
  let body: { source_id?: string; force?: boolean } = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* empty body ok */ }
  }

  let query = supabase
    .from("job_sources")
    .select("id, name, source_type, tier, config, country, sector, last_run_at")
    .eq("is_active", true);
  if (body.source_id) query = query.eq("id", body.source_id);

  const { data: sources, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const all = (sources ?? []) as JobSource[];
  const due = body.force || body.source_id ? all : all.filter(isDue);

  const results: any[] = [];
  for (const s of due) {
    results.push(await runSource(supabase, s));
  }

  const errors = results.filter((r) => r.error);
  return new Response(JSON.stringify({
    ok: errors.length === 0,
    checked: all.length,
    ran: due.length,
    results,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: errors.length === 0 ? 200 : 207,
  });
});
  const started = Date.now();
  const source = "arbetsformedlingen.se";

  // Read last_run_at
  const { data: stateRow } = await supabase
    .from("ingest_state")
    .select("last_run_at")
    .eq("source", source)
    .maybeSingle();

  const defaultSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since = stateRow?.last_run_at
    ? new Date(stateRow.last_run_at as string)
    : defaultSince;
  const sinceIso = since.toISOString();

  const url = `https://jobstream.api.jobtechdev.se/stream?date=${encodeURIComponent(
    sinceIso,
  )}`;

  console.log(`[ingest-jobs] Sweden stream since=${sinceIso}`);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`jobstream HTTP ${res.status}`);
  }

  const items = (await res.json()) as JobstreamItem[];
  if (!Array.isArray(items)) {
    throw new Error("jobstream response not an array");
  }

  const total = items.length;
  const capped = items.slice(0, MAX_ITEMS_PER_RUN);
  const skippedByCap = Math.max(0, total - capped.length);

  let added = 0;
  let skipped = skippedByCap;

  // Map and upsert in chunks
  const rows = capped
    .filter((it) => !it.removed && it.webpage_url && it.headline)
    .map((it) => {
      const loc =
        it.workplace_address?.municipality ||
        it.workplace_address?.city ||
        null;
      return {
        external_id: it.id ?? null,
        source_portal: source,
        title: it.headline as string,
        company: it.employer?.name ?? null,
        description: it.description?.text ?? null,
        location: loc,
        country: "Sweden",
        url: it.webpage_url as string,
        job_type: null,
        salary_min: null,
        salary_max: null,
        currency: it.salary_description ? "SEK" : null,
        posted_at: it.publication_date ?? null,
        raw_data: { salary_description: it.salary_description ?? null },
        fetched_at: new Date().toISOString(),
      };
    });

  skipped += capped.length - rows.length;

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("public_jobs")
      .upsert(chunk, {
        onConflict: "source_portal,external_id",
        ignoreDuplicates: false,
        count: "exact",
      });
    if (error) {
      console.error("[ingest-jobs] upsert error", error);
      throw error;
    }
    added += count ?? chunk.length;
  }

  // Update state
  await supabase.from("ingest_state").upsert(
    {
      source,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source" },
  );

  const duration = Date.now() - started;
  await supabase.from("ingest_logs").insert({
    source,
    status: "success",
    jobs_added: added,
    jobs_skipped: skipped,
    duration_ms: duration,
  });

  return { source, total, added, skipped, duration_ms: duration, since: sinceIso };
}

async function ingestSwitzerland(supabase: ReturnType<typeof createClient>) {
  const started = Date.now();
  const source = "job-room.ch";
  const PAGE_SIZE = 100;
  const MAX_PAGES = Math.ceil(MAX_ITEMS_PER_RUN / PAGE_SIZE);

  let collected: JobRoomItem[] = [];
  let total = 0;
  let pages = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `https://www.job-room.ch/api/external/joboffers?page=${page}&size=${PAGE_SIZE}`;
    console.log(`[ingest-jobs] CH page=${page}`);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`job-room HTTP ${res.status}`);
    const body = await res.json();
    // API may return { content: [...], totalElements } or a bare array
    const items: JobRoomItem[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.content)
        ? body.content
        : Array.isArray(body?.items)
          ? body.items
          : [];
    pages++;
    total += items.length;
    collected = collected.concat(items);
    if (items.length < PAGE_SIZE) break; // last page
    if (collected.length >= MAX_ITEMS_PER_RUN) break;
  }

  const capped = collected.slice(0, MAX_ITEMS_PER_RUN);
  const skippedByCap = Math.max(0, collected.length - capped.length);

  let added = 0;
  let skipped = skippedByCap;

  const rows = capped
    .filter((it) => it.title && (it.detailUrl || it.id !== undefined))
    .map((it) => {
      const id = it.id !== undefined ? String(it.id) : null;
      const url =
        it.detailUrl || (id ? `https://www.job-room.ch/joboffers/${id}` : null);
      return {
        external_id: id,
        source_portal: source,
        title: it.title as string,
        company: it.company?.name ?? null,
        description: it.description ?? null,
        location: it.workLocation?.city ?? null,
        country: "Switzerland",
        url: url as string,
        job_type: null,
        salary_min: null,
        salary_max: null,
        currency: null,
        posted_at: it.publicationStartDate ?? null,
        raw_data: {},
        fetched_at: new Date().toISOString(),
      };
    })
    .filter((r) => r.url);

  skipped += capped.length - rows.length;

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("public_jobs")
      .upsert(chunk, {
        onConflict: "source_portal,external_id",
        ignoreDuplicates: false,
        count: "exact",
      });
    if (error) {
      console.error("[ingest-jobs] CH upsert error", error);
      throw error;
    }
    added += count ?? chunk.length;
  }

  await supabase.from("ingest_state").upsert(
    {
      source,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source" },
  );

  const duration = Date.now() - started;
  await supabase.from("ingest_logs").insert({
    source,
    status: "success",
    jobs_added: added,
    jobs_skipped: skipped,
    duration_ms: duration,
  });

  return { source, total, pages, added, skipped, duration_ms: duration };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: unknown[] = [];
  const errors: { source: string; error: string }[] = [];

  for (const [source, fn] of [
    ["arbetsformedlingen.se", ingestSweden],
    ["job-room.ch", ingestSwitzerland],
  ] as const) {
    try {
      results.push(await fn(supabase));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ingest-jobs] ${source} failed`, msg);
      errors.push({ source, error: msg });
      await supabase.from("ingest_logs").insert({
        source,
        status: "error",
        error_message: msg,
      });
    }
  }

  const ok = errors.length === 0;
  return new Response(JSON.stringify({ ok, results, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: ok ? 200 : 207,
  });
});