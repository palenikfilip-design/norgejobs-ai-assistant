import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NormalizedJob {
  external_id: string | null;
  source_portal: string;
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

interface EmployerRow {
  id: string;
  company_name: string;
  ats_type:
    | "greenhouse"
    | "lever"
    | "smartrecruiters"
    | "workday"
    | "wp_rest"
    | "html_ischgl";
  ats_config: Record<string, unknown>;
  country: string | null;
}

function nowIso() {
  return new Date().toISOString();
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
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; LeslieJobIngest/1.0; +https://lovable.dev)",
      Accept: "text/html,*/*",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|br|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

async function adapterGreenhouse(emp: EmployerRow): Promise<NormalizedJob[]> {
  const company = String(emp.ats_config.company ?? "");
  if (!company) throw new Error("greenhouse: missing company");
  const data = await fetchJson(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs`,
  );
  const items: any[] = Array.isArray(data?.jobs) ? data.jobs : [];
  return items
    .filter((it) => it?.title && it?.absolute_url)
    .map((it) => ({
      external_id: it.id != null ? String(it.id) : null,
      source_portal: `greenhouse:${company}`,
      title: String(it.title),
      company: emp.company_name,
      description: null,
      location: it.location?.name ?? null,
      country: emp.country,
      url: String(it.absolute_url),
      job_type: null,
      salary_min: null,
      salary_max: null,
      currency: null,
      posted_at: it.updated_at ?? null,
      raw_data: {},
      fetched_at: nowIso(),
    }));
}

async function adapterLever(emp: EmployerRow): Promise<NormalizedJob[]> {
  const company = String(emp.ats_config.company ?? "");
  if (!company) throw new Error("lever: missing company");
  const data = await fetchJson(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`,
  );
  const items: any[] = Array.isArray(data) ? data : [];
  return items
    .filter((it) => it?.text && it?.hostedUrl)
    .map((it) => ({
      external_id: it.id ? String(it.id) : null,
      source_portal: `lever:${company}`,
      title: String(it.text),
      company: emp.company_name,
      description: it.descriptionPlain ?? null,
      location: it.categories?.location ?? null,
      country: emp.country,
      url: String(it.hostedUrl),
      job_type: null,
      salary_min: null,
      salary_max: null,
      currency: null,
      posted_at: it.createdAt ? new Date(it.createdAt).toISOString() : null,
      raw_data: {},
      fetched_at: nowIso(),
    }));
}

async function adapterSmartRecruiters(emp: EmployerRow): Promise<NormalizedJob[]> {
  const company = String(emp.ats_config.company ?? "");
  if (!company) throw new Error("smartrecruiters: missing company");
  const data = await fetchJson(
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings`,
  );
  const items: any[] = Array.isArray(data?.content) ? data.content : [];
  return items
    .filter((it) => it?.name && it?.id)
    .map((it) => ({
      external_id: String(it.id),
      source_portal: `smartrecruiters:${company}`,
      title: String(it.name),
      company: emp.company_name,
      description: null,
      location: it.location?.city ?? null,
      country: emp.country ?? it.location?.country ?? null,
      url: `https://jobs.smartrecruiters.com/${company}/${it.id}`,
      job_type: null,
      salary_min: null,
      salary_max: null,
      currency: null,
      posted_at: it.releasedDate ?? null,
      raw_data: {},
      fetched_at: nowIso(),
    }));
}

async function adapterWorkday(emp: EmployerRow): Promise<NormalizedJob[]> {
  const tenant = String(emp.ats_config.tenant ?? "");
  const wd = Number(emp.ats_config.wd ?? 0);
  const site = String(emp.ats_config.site ?? "");
  if (!tenant || !wd || !site) throw new Error("workday: missing tenant/wd/site");
  const url = `https://${tenant}.wd${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  const data = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
  });
  const items: any[] = Array.isArray(data?.jobPostings) ? data.jobPostings : [];
  return items
    .filter((it) => it?.title && it?.externalPath)
    .map((it) => ({
      external_id: it.bulletFields?.[0] ?? it.externalPath ?? null,
      source_portal: `workday:${tenant}`,
      title: String(it.title),
      company: emp.company_name,
      description: null,
      location: it.locationsText ?? null,
      country: emp.country,
      url: `https://${tenant}.wd${wd}.myworkdayjobs.com${it.externalPath}`,
      job_type: null,
      salary_min: null,
      salary_max: null,
      currency: null,
      posted_at: it.postedOn ?? null,
      raw_data: {},
      fetched_at: nowIso(),
    }));
}

// WordPress REST API adapter — reads a custom post type (default: "job-opening")
// Reusable for any WP site that exposes its job CPT publicly.
async function adapterWpRest(emp: EmployerRow): Promise<NormalizedJob[]> {
  const cfg = emp.ats_config as Record<string, unknown>;
  const base = String(cfg.base ?? "").replace(/\/+$/, "");
  const postType = String(cfg.post_type ?? "job-opening");
  const sourcePortal = String(cfg.source_portal ?? `wp:${base.replace(/^https?:\/\//, "")}`);
  if (!base) throw new Error("wp_rest: missing base");
  const url = `${base}/wp-json/wp/v2/${encodeURIComponent(postType)}?per_page=100&_embed=0`;
  const data = await fetchJson(url);
  const items: any[] = Array.isArray(data) ? data : [];
  const isSeasonal = cfg.is_seasonal === true;
  const seasonalType = cfg.seasonal_type ?? null;
  const category = cfg.category ?? null;
  const displayCategory = cfg.display_category ?? null;
  return items
    .filter((it) => it?.link && (it?.title?.rendered || it?.slug))
    .map((it) => ({
      external_id: it.id != null ? String(it.id) : String(it.slug ?? it.link),
      source_portal: sourcePortal,
      title: stripHtml(String(it.title?.rendered ?? it.slug ?? "")).slice(0, 240),
      company: emp.company_name,
      description: stripHtml(String(it.content?.rendered ?? it.excerpt?.rendered ?? "")).slice(0, 8000) || null,
      location: null,
      country: emp.country,
      url: String(it.link),
      job_type: null,
      salary_min: null,
      salary_max: null,
      currency: null,
      posted_at: it.date ? new Date(it.date).toISOString() : null,
      raw_data: {
        wp_id: it.id,
        is_seasonal: isSeasonal,
        seasonal_type: seasonalType,
        category,
        display_category: displayCategory,
      },
      fetched_at: nowIso(),
    }));
}

// Ischgl HTML adapter — server-side rendered listing at /en/jobs
// Detail URLs follow /en/jobs/<slug>_job_<id>
async function adapterHtmlIschgl(emp: EmployerRow): Promise<NormalizedJob[]> {
  const cfg = emp.ats_config as Record<string, unknown>;
  const base = String(cfg.base ?? "https://www.ischgl.com").replace(/\/+$/, "");
  const listingUrl = String(cfg.listing_url ?? `${base}/en/jobs`);
  const sourcePortal = String(cfg.source_portal ?? "html:ischgl");
  const isSeasonal = cfg.is_seasonal === true;
  const seasonalType = cfg.seasonal_type ?? null;
  const category = cfg.category ?? null;
  const displayCategory = cfg.display_category ?? null;

  let listingHtml: string;
  try {
    listingHtml = await fetchText(listingUrl);
  } catch (err) {
    console.error("[html_ischgl] listing fetch failed", err);
    return [];
  }

  // Match links like /en/jobs/<slug>_job_<id> — capture once per id.
  const linkRe = /href=["'](\/en\/jobs\/[a-z0-9][^"'\s]*?_job_(\d+)[^"']*)["']/gi;
  const seen = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(listingHtml)) !== null) {
    const path = m[1];
    const id = m[2];
    if (!seen.has(id)) seen.set(id, path);
  }

  const jobs: NormalizedJob[] = [];
  for (const [id, path] of seen) {
    const url = `${base}${path}`;
    try {
      const html = await fetchText(url);
      // <title>Job title | Ischgl</title>
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      let title = titleMatch ? stripHtml(titleMatch[1]).replace(/\s*[|–-]\s*Ischgl.*$/i, "").trim() : "";
      if (!title) {
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        title = h1 ? stripHtml(h1[1]) : `Ischgl job ${id}`;
      }
      // Description: grab the main content area; fallback to all body text.
      const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0]
        ?? html.match(/<article[\s\S]*?<\/article>/i)?.[0]
        ?? html;
      const description = stripHtml(main).slice(0, 8000) || null;

      jobs.push({
        external_id: id,
        source_portal: sourcePortal,
        title: title.slice(0, 240),
        company: emp.company_name,
        description,
        location: "Ischgl",
        country: emp.country,
        url,
        job_type: null,
        salary_min: null,
        salary_max: null,
        currency: null,
        posted_at: null,
        raw_data: {
          is_seasonal: isSeasonal,
          seasonal_type: seasonalType,
          category,
          display_category: displayCategory,
        },
        fetched_at: nowIso(),
      });
    } catch (err) {
      console.warn(`[html_ischgl] detail ${id} skipped:`, err instanceof Error ? err.message : err);
    }
  }
  return jobs;
}

const ADAPTERS: Record<EmployerRow["ats_type"], (e: EmployerRow) => Promise<NormalizedJob[]>> = {
  greenhouse: adapterGreenhouse,
  lever: adapterLever,
  smartrecruiters: adapterSmartRecruiters,
  workday: adapterWorkday,
  wp_rest: adapterWpRest,
  html_ischgl: adapterHtmlIschgl,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: employers, error } = await supabase
    .from("employer_sources")
    .select("id, company_name, ats_type, ats_config, country")
    .eq("is_active", true);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const results: any[] = [];
  const errors: { company: string; error: string }[] = [];

  for (const emp of (employers ?? []) as EmployerRow[]) {
    const started = Date.now();
    const source = `${emp.ats_type}:${String((emp.ats_config as any)?.company ?? (emp.ats_config as any)?.tenant ?? emp.company_name)}`;
    try {
      const adapter = ADAPTERS[emp.ats_type];
      if (!adapter) throw new Error(`unknown ats_type: ${emp.ats_type}`);
      const rows = await adapter(emp);

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

      await supabase
        .from("employer_sources")
        .update({ last_run_at: nowIso() })
        .eq("id", emp.id);

      const duration = Date.now() - started;
      await supabase.from("ingest_logs").insert({
        source,
        status: "success",
        jobs_added: added,
        jobs_skipped: rows.length - added,
        duration_ms: duration,
      });

      results.push({ company: emp.company_name, source, total: rows.length, added, duration_ms: duration });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ingest-direct-employers] ${emp.company_name} failed`, msg);
      errors.push({ company: emp.company_name, error: msg });
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