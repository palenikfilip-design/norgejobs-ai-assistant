import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIER_INTERVAL_MS: Record<number, number> = {
  1: 60 * 60 * 1000,
  2: 4 * 60 * 60 * 1000,
  3: 24 * 60 * 60 * 1000,
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
  job_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  salary?: string | null;
  additional_locations?: string[];
  posted_at: string | null;
  raw_data: Record<string, unknown>;
  fetched_at: string;
}

const nowIso = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  // Decode entities FIRST so double-encoded content (e.g. Greenhouse returns
  // `&lt;p&gt;...`) is properly stripped of its tags afterwards.
  const decoded = String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

const SALARY_PATTERNS: RegExp[] = [
  /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:-|–|to)\s?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/i,
  /€\s?\d{1,3}(?:[.,]\d{3})*\s?(?:-|–|to)\s?€?\s?\d{1,3}(?:[.,]\d{3})*/i,
  /\d{2,3}(?:[.,]\d{3})*\s?(?:-|–|to)\s?\d{2,3}(?:[.,]\d{3})*\s?(?:CZK|Kč|kč)/i,
  /(?:NOK|kr)\s?\d{2,3}(?:[.,]?\d{3})*\s?(?:-|–|to)\s?(?:NOK|kr)?\s?\d{2,3}(?:[.,]?\d{3})*/i,
  /£\s?\d{1,3}(?:,\d{3})*\s?(?:-|–|to)\s?£?\s?\d{1,3}(?:,\d{3})*/i,
  /\d{2,3}(?:[.,]\d{3})*\s?(?:-|–|to)\s?\d{2,3}(?:[.,]\d{3})*\s?(?:EUR|euros?)\s*(?:\/|per)?\s*(?:month|měsíc|year|rok|hour|hodina)?/i,
];

function extractSalary(...sources: (string | null | undefined)[]): string | null {
  for (const src of sources) {
    if (!src) continue;
    const text = String(src);
    for (const re of SALARY_PATTERNS) {
      const m = text.match(re);
      if (m) return m[0].trim();
    }
  }
  return null;
}

/**
 * Detect if a location string spans multiple cities/countries.
 * Returns { country, additional } where country = "Multiple" if multi-location.
 */
function parseMultiLocation(location: string | null, defaultCountry: string | null):
  { country: string | null; additional: string[] } {
  if (!location) return { country: defaultCountry, additional: [] };
  const parts = location
    .split(/\s*(?:;|\/|&|\bor\b|\band\b|,)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return { country: "Multiple", additional: parts };
  }
  return { country: defaultCountry, additional: [] };
}

async function getExistingUrls(
  supabase: ReturnType<typeof createClient>,
  urls: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  if (urls.length === 0) return out;
  const CHUNK = 200;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const slice = urls.slice(i, i + CHUNK);
    const { data } = await supabase
      .from("public_jobs")
      .select("url")
      .in("url", slice);
    for (const r of (data ?? []) as any[]) {
      if (r?.url) out.add(String(r.url));
    }
  }
  return out;
}

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

async function adapterGreenhouse(s: JobSource): Promise<NormalizedJob[]> {
  const company = String(s.config.company ?? "");
  if (!company) throw new Error("greenhouse: missing config.company");
  const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs`);
  const items: any[] = Array.isArray(data?.jobs) ? data.jobs : [];
  return items.filter((it) => it?.title && it?.id != null).map((it) => {
    const id = String(it.id);
    const absolute = typeof it.absolute_url === "string" ? it.absolute_url : "";
    // Some companies (Stripe, etc.) return a search/listing URL in absolute_url that
    // doesn't deep-link to the actual job. Detect that and fall back to the canonical
    // Greenhouse-hosted board URL which always deep-links.
    const looksBroken =
      !absolute ||
      /\/jobs\/search\b/i.test(absolute) ||
      (!absolute.includes(id) && !/job-boards\.greenhouse\.io|boards\.greenhouse\.io/.test(absolute));
    const url = looksBroken
      ? `https://job-boards.greenhouse.io/${encodeURIComponent(company)}/jobs/${id}`
      : absolute;
    return {
      external_id: id,
      source_portal: `greenhouse:${company}`,
      source_id: s.id,
      title: String(it.title),
      company: s.name,
      description: null,
      location: it.location?.name ?? null,
      country: s.country,
      url,
      job_type: null, salary_min: null, salary_max: null, currency: null,
      posted_at: it.updated_at ?? null,
      raw_data: {},
      fetched_at: nowIso(),
    };
  });
}

async function adapterLever(s: JobSource): Promise<NormalizedJob[]> {
  const company = String(s.config.company ?? "");
  if (!company) throw new Error("lever: missing config.company");
  const data = await fetchJson(`https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`);
  const items: any[] = Array.isArray(data) ? data : [];
  return items.filter((it) => it?.text && it?.hostedUrl).map((it) => ({
    external_id: it.id ? String(it.id) : null,
    source_portal: `lever:${company}`,
    source_id: s.id,
    title: String(it.text),
    company: s.name,
    description: it.descriptionPlain ?? stripHtml(it.descriptionHtml ?? it.description ?? null),
    location: it.categories?.location ?? null,
    country: s.country,
    url: String(it.hostedUrl),
    job_type: null, salary_min: null, salary_max: null, currency: null,
    posted_at: it.createdAt ? new Date(it.createdAt).toISOString() : null,
    raw_data: {
      department: it.categories?.department ?? null,
      commitment: it.categories?.commitment ?? null,
    },
    fetched_at: nowIso(),
  }));
}

async function adapterSmartRecruiters(s: JobSource): Promise<NormalizedJob[]> {
  const company = String(s.config.company ?? "");
  if (!company) throw new Error("smartrecruiters: missing config.company");
  const data = await fetchJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings`);
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
  const wd = String(s.config.wd ?? "").replace(/^wd/i, "");
  const site = String(s.config.site ?? "");
  if (!tenant || !wd || !site) throw new Error("workday: missing tenant/wd/site");
  const url = `https://${tenant}.wd${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  const data = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
  });
  const items: any[] = Array.isArray(data?.jobPostings) ? data.jobPostings : [];
  return items.filter((it) => it?.title && it?.externalPath).map((it) => {
    // Workday detail pages are HTML and fragile — expand what list endpoint gives us.
    const bullets = Array.isArray(it.bulletFields) ? it.bulletFields : [];
    const summary = bullets.slice(1).join(" • ");
    return {
      external_id: bullets[0] ?? it.externalPath ?? null,
      source_portal: `workday:${tenant}`,
      source_id: s.id,
      title: String(it.title),
      company: s.name,
      description: summary || it.jobPostingInfo?.summary || null,
      location: it.locationsText ?? null,
      country: s.country,
      url: `https://${tenant}.wd${wd}.myworkdayjobs.com${it.externalPath}`,
      job_type: null, salary_min: null, salary_max: null, currency: null,
      posted_at: it.postedOn ?? null,
      raw_data: {
        workday_limited_data: true,
        bullet_fields: bullets,
        job_posting_info: it.jobPostingInfo ?? null,
      },
      fetched_at: nowIso(),
    };
  });
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
    const url = id ? `https://${company}.jobs.personio.com/job/${id}` : "";
    return {
      external_id: id,
      source_portal: `personio:${company}`,
      source_id: s.id,
      title: get(p, "name") ?? "",
      company: s.name,
      description: get(p, "jobDescriptions"),
      location: get(p, "office"),
      country: s.country,
      url,
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
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (compatible; LeslieBot/1.0; +https://leslie.app)",
    ...(s.config.headers ?? {}),
  };
  if (s.config.token) headers["Authorization"] = `Bearer ${s.config.token}`;
  const data = await fetchJson(url, { headers });

  const path = String(s.config.json_path ?? s.config.items_path ?? "");
  let items: any[] = [];
  const candidate = path ? getByPath(data, path) : data;
  if (Array.isArray(candidate)) items = candidate;
  else if (Array.isArray(data)) items = data;
  else if (Array.isArray(data?.content)) items = data.content;
  else if (Array.isArray(data?.items)) items = data.items;
  else if (Array.isArray(data?.jobs)) items = data.jobs;

  console.log(`[portal_api] ${s.name}: fetched ${items.length} raw items from ${url}`);

  const fm = (s.config.field_map ?? {}) as Record<string, string>;
  const urlTemplate = typeof s.config.url_template === "string" ? s.config.url_template : null;
  const companyField = fm.company ? String(fm.company) : null;
  const portal = `portal:${s.name}`;
  return items.map((it) => {
    const title = (fm.title ? getByPath(it, fm.title) : it.title) ?? "";
    let u = (fm.url ? getByPath(it, fm.url) : it.url) ?? "";
    if ((!u || String(u).trim() === "") && urlTemplate) {
      u = urlTemplate.replace(/\{([\w.]+)\}/g, (_m, k) => {
        const v = getByPath(it, k);
        return v != null ? String(v) : "";
      });
    }
    const location = fm.location ? getByPath(it, fm.location) : null;
    const ext = (fm.id ? getByPath(it, fm.id) : it.id ?? null);
    const company = companyField ? getByPath(it, companyField) : null;
    return {
      external_id: ext != null ? String(ext) : (u || null),
      source_portal: portal,
      source_id: s.id,
      title: String(title),
      company: company ? String(company) : s.name,
      description: null,
      location: location ? String(location) : null,
      country: s.country,
      url: String(u),
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

/**
 * Per-source detail fetchers — only called for NEW jobs (URL not in DB yet).
 * Mutates the job in place: description, salary, job_type, raw_data.
 * On failure: records archiles_notes, keeps list-level data.
 */
async function fetchDetailGreenhouse(s: JobSource, job: NormalizedJob & { salary?: string | null }): Promise<void> {
  const company = String(s.config.company ?? "");
  if (!company || !job.external_id) return;
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs/${encodeURIComponent(job.external_id)}`;
  try {
    const d = await fetchJson(url);
    job.description = stripHtml(d.content) ?? job.description;
    const dept = Array.isArray(d.departments) && d.departments[0]?.name ? d.departments[0].name : null;
    let salaryFromMeta: string | null = null;
    if (Array.isArray(d.metadata)) {
      for (const m of d.metadata) {
        const k = String(m?.name ?? "").toLowerCase();
        if (/(salary|compensation|pay)/.test(k) && m?.value) {
          salaryFromMeta = String(m.value);
          break;
        }
      }
    }
    (job as any).raw_data = { ...(job.raw_data ?? {}), department: dept, gh_metadata: d.metadata ?? null };
    job.salary = job.salary || salaryFromMeta;
  } catch (e) {
    (job as any).raw_data = { ...(job.raw_data ?? {}), detail_fetch_error: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchDetailSmartRecruiters(s: JobSource, job: NormalizedJob & { salary?: string | null }): Promise<void> {
  const company = String(s.config.company ?? "");
  if (!company || !job.external_id) return;
  const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings/${encodeURIComponent(job.external_id)}`;
  try {
    const d = await fetchJson(url);
    const desc = [
      d?.jobAd?.sections?.jobDescription?.text,
      d?.jobAd?.sections?.qualifications?.text,
    ].filter(Boolean).map((t) => stripHtml(t) ?? "").filter(Boolean).join("\n\n");
    if (desc) job.description = desc;
    (job as any).job_type = d?.typeOfEmployment?.label ?? null;
    (job as any).raw_data = {
      ...(job.raw_data ?? {}),
      experience_hint: d?.experienceLevel?.label ?? null,
      sr_typeOfEmployment: d?.typeOfEmployment?.label ?? null,
    };
  } catch (e) {
    (job as any).raw_data = { ...(job.raw_data ?? {}), detail_fetch_error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Enrich newly-discovered jobs with: detail fetches (per source_type),
 * salary regex extraction across (salary field, description, title),
 * multi-location detection.
 */
async function enrichNewJobs(
  s: JobSource,
  rows: (NormalizedJob & { salary?: string | null; additional_locations?: string[] })[],
  existingUrls: Set<string>,
): Promise<void> {
  const newJobs = rows.filter((r) => !existingUrls.has(r.url));

  // Per-source detail fetch (rate-limited)
  if (s.source_type === "ats_greenhouse") {
    for (const j of newJobs) {
      await fetchDetailGreenhouse(s, j);
      await sleep(200); // 5 req/s
    }
  } else if (s.source_type === "ats_smartrecruiters") {
    for (const j of newJobs) {
      await fetchDetailSmartRecruiters(s, j);
      await sleep(340); // ~3 req/s
    }
  }

  // Salary scan + multi-location detection apply to ALL rows (cheap, no network)
  for (const j of rows) {
    if (!j.salary) {
      j.salary = extractSalary(j.title, j.description, (j.raw_data as any)?.gh_metadata ? JSON.stringify((j.raw_data as any).gh_metadata) : null);
    }
    const { country, additional } = parseMultiLocation(j.location, j.country);
    if (additional.length > 1) {
      j.country = country;
      j.additional_locations = additional;
    } else {
      j.additional_locations = j.additional_locations ?? [];
    }
    // Workday transparency note
    if ((j.raw_data as any)?.workday_limited_data) {
      (j.raw_data as any).archiles_hint = "Detail fetch skipped (Workday HTML-only); enrichment based on list data.";
    }
    if ((j.raw_data as any)?.detail_fetch_error) {
      (j.raw_data as any).archiles_hint = "Detail fetch failed, enrichment based on title/location only";
    }
  }
}

async function runSource(supabase: ReturnType<typeof createClient>, s: JobSource) {
  const started = Date.now();
  try {
    const adapter = ADAPTERS[s.source_type];
    if (!adapter) throw new Error(`unknown source_type: ${s.source_type}`);
    const rows = (await adapter(s)) as (NormalizedJob & { salary?: string | null; additional_locations?: string[] })[];

    // PART 1+3+5: enrich only new URLs with detail, salary, multi-location
    const existingUrls = await getExistingUrls(supabase, rows.map((r) => r.url));
    await enrichNewJobs(s, rows, existingUrls);

    // Only insert NEW jobs — never overwrite existing rows (would wipe Archiles enrichment).
    const toInsert = rows.filter((r) => !existingUrls.has(r.url));

    let added = 0;
    const insertedIds: string[] = [];
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { error: upErr, count, data: upserted } = await supabase
        .from("public_jobs")
        .upsert(chunk, {
          onConflict: "source_portal,external_id",
          ignoreDuplicates: false,
          count: "exact",
        })
        .select("id");
      if (upErr) throw upErr;
      added += count ?? chunk.length;
      if (Array.isArray(upserted)) {
        for (const r of upserted) if ((r as any)?.id) insertedIds.push(String((r as any).id));
      }
    }

    // Fire-and-forget Archiles enrichment in batches of 30 (don't await — stay within timeout).
    if (insertedIds.length > 0) {
      const ARCH_BATCH = 30;
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/archiles-enrich`;
      const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
      for (let i = 0; i < insertedIds.length; i += ARCH_BATCH) {
        const slice = insertedIds.slice(i, i + ARCH_BATCH);
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({ job_ids: slice }),
        }).catch((e) => console.error("[ingest-jobs] archiles-enrich trigger failed", e));
      }
    }

    const { data: cur } = await supabase.from("job_sources").select("jobs_added_total").eq("id", s.id).maybeSingle();
    const prev = Number((cur as any)?.jobs_added_total ?? 0);

    await supabase.from("job_sources").update({
      last_run_at: nowIso(),
      last_run_status: "success",
      last_error: null,
      jobs_added_total: prev + added,
    }).eq("id", s.id);

    await supabase.from("ingest_logs").insert({
      source: `${s.source_type}:${s.name}`,
      status: "success",
      jobs_added: added,
      jobs_skipped: rows.length - added,
      duration_ms: Date.now() - started,
    });

    return { id: s.id, name: s.name, total: rows.length, added };
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

  let body: { source_id?: string; force?: boolean } = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* empty ok */ }
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