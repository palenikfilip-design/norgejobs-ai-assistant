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
  ats_type: "greenhouse" | "lever" | "smartrecruiters" | "workday";
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

const ADAPTERS: Record<EmployerRow["ats_type"], (e: EmployerRow) => Promise<NormalizedJob[]>> = {
  greenhouse: adapterGreenhouse,
  lever: adapterLever,
  smartrecruiters: adapterSmartRecruiters,
  workday: adapterWorkday,
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