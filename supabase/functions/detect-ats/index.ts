import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (compatible; LeslieBot/1.0; +https://leslie.app)";

type AtsType =
  | "greenhouse"
  | "lever"
  | "workday"
  | "smartrecruiters"
  | "recruitee"
  | "personio"
  | "ashby"
  | "workable";

interface Detection {
  ats_type: AtsType;
  ats_config: Record<string, unknown>;
  source: "url" | "html";
}

function safeUrl(s: string): URL | null {
  try { return new URL(s.trim()); } catch { return null; }
}

/**
 * Match a URL (or any URL-like string found in HTML) against known ATS signatures.
 * Returns the ats_type + ats_config, or null.
 */
function matchAtsUrl(raw: string): Detection | null {
  const u = safeUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  // Greenhouse: boards.greenhouse.io/{slug}, job-boards.greenhouse.io/{slug}, boards.eu.greenhouse.io/{slug}
  if (/(^|\.)((job-)?boards(\.eu)?)\.greenhouse\.io$/.test(host)) {
    const slug = path.split("/").filter(Boolean)[0];
    if (slug) return { ats_type: "greenhouse", ats_config: { company: slug }, source: "url" };
  }

  // Lever: jobs.lever.co/{slug}
  if (host === "jobs.lever.co") {
    const slug = path.split("/").filter(Boolean)[0];
    if (slug) return { ats_type: "lever", ats_config: { company: slug }, source: "url" };
  }

  // Workday: {tenant}.wd{N}.myworkdayjobs.com/.../{site}
  const wdHost = host.match(/^([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com$/);
  if (wdHost) {
    const tenant = wdHost[1];
    const wd = Number(wdHost[2]);
    const parts = path.split("/").filter(Boolean);
    // Path looks like: /{lang?}/{site} or /en-US/{site}/job/...
    // Site = the segment immediately before "/jobs" or "/job/" if present, else the last segment.
    let site: string | null = null;
    const jobsIdx = parts.findIndex((p) => p === "jobs" || p === "job");
    if (jobsIdx > 0) site = parts[jobsIdx - 1];
    else if (parts.length >= 2) site = parts[parts.length - 1];
    else if (parts.length === 1) site = parts[0];
    if (site) return { ats_type: "workday", ats_config: { tenant, wd, site }, source: "url" };
  }

  // SmartRecruiters: careers.smartrecruiters.com/{slug} or jobs.smartrecruiters.com/{slug}
  if (host === "careers.smartrecruiters.com" || host === "jobs.smartrecruiters.com") {
    const slug = path.split("/").filter(Boolean)[0];
    if (slug) return { ats_type: "smartrecruiters", ats_config: { company: slug }, source: "url" };
  }

  // Recruitee: {slug}.recruitee.com
  const rc = host.match(/^([a-z0-9-]+)\.recruitee\.com$/);
  if (rc) return { ats_type: "recruitee", ats_config: { company: rc[1] }, source: "url" };

  // Personio: {slug}.jobs.personio.com|.de
  const pe = host.match(/^([a-z0-9-]+)\.jobs\.personio\.(com|de)$/);
  if (pe) return { ats_type: "personio", ats_config: { company: pe[1] }, source: "url" };

  // Ashby: jobs.ashbyhq.com/{slug}
  if (host === "jobs.ashbyhq.com") {
    const slug = path.split("/").filter(Boolean)[0];
    if (slug) return { ats_type: "ashby", ats_config: { jobBoardName: slug }, source: "url" };
  }

  // Workable: apply.workable.com/{slug} OR {slug}.workable.com
  if (host === "apply.workable.com") {
    const slug = path.split("/").filter(Boolean)[0];
    if (slug) return { ats_type: "workable", ats_config: { account: slug }, source: "url" };
  }
  const wk = host.match(/^([a-z0-9-]+)\.workable\.com$/);
  if (wk && wk[1] !== "apply" && wk[1] !== "www") {
    return { ats_type: "workable", ats_config: { account: wk[1] }, source: "url" };
  }

  return null;
}

/**
 * Best-effort: fetch a single HTML page and scan for embedded ATS links.
 */
async function detectFromHtml(pageUrl: string): Promise<Detection | null> {
  let html = "";
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  // Look for known ATS hosts inside HTML (href, src, data-*, plain text).
  const PATTERNS: RegExp[] = [
    /https?:\/\/(?:job-)?boards(?:\.eu)?\.greenhouse\.io\/[a-z0-9-]+/gi,
    /https?:\/\/jobs\.lever\.co\/[a-z0-9-]+/gi,
    /https?:\/\/[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com\/[^\s"'<>]+/gi,
    /https?:\/\/(?:careers|jobs)\.smartrecruiters\.com\/[a-z0-9-]+/gi,
    /https?:\/\/[a-z0-9-]+\.recruitee\.com/gi,
    /https?:\/\/[a-z0-9-]+\.jobs\.personio\.(?:com|de)/gi,
    /https?:\/\/jobs\.ashbyhq\.com\/[a-z0-9-]+/gi,
    /https?:\/\/apply\.workable\.com\/[a-z0-9-]+/gi,
    /https?:\/\/[a-z0-9-]+\.workable\.com/gi,
  ];
  for (const re of PATTERNS) {
    const matches = html.match(re);
    if (!matches) continue;
    for (const m of matches) {
      const d = matchAtsUrl(m);
      if (d) return { ...d, source: "html" };
    }
  }
  return null;
}

/**
 * Live test fetch — same endpoints as the ingest adapters, but inline so this
 * function stays self-contained. Returns { count, sample_titles, first }.
 */
async function testFetch(d: Detection): Promise<{ count: number; sample_titles: string[]; first: unknown | null; error?: string }> {
  const cfg = d.ats_config as any;
  try {
    if (d.ats_type === "greenhouse") {
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(cfg.company)}/jobs`);
      const j: any = await r.json();
      const items = Array.isArray(j?.jobs) ? j.jobs : [];
      return { count: items.length, sample_titles: items.slice(0, 3).map((x: any) => x.title), first: items[0] ?? null };
    }
    if (d.ats_type === "lever") {
      const r = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(cfg.company)}?mode=json`);
      const items: any[] = await r.json();
      const list = Array.isArray(items) ? items : [];
      return { count: list.length, sample_titles: list.slice(0, 3).map((x: any) => x.text), first: list[0] ?? null };
    }
    if (d.ats_type === "smartrecruiters") {
      const r = await fetch(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(cfg.company)}/postings?limit=10`);
      const j: any = await r.json();
      const items = Array.isArray(j?.content) ? j.content : [];
      return { count: Number(j?.totalFound ?? items.length), sample_titles: items.slice(0, 3).map((x: any) => x.name), first: items[0] ?? null };
    }
    if (d.ats_type === "workday") {
      const url = `https://${cfg.tenant}.wd${cfg.wd}.myworkdayjobs.com/wday/cxs/${cfg.tenant}/${cfg.site}/jobs`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
        body: JSON.stringify({ appliedFacets: {}, limit: 10, offset: 0, searchText: "" }),
      });
      const j: any = await r.json();
      const items = Array.isArray(j?.jobPostings) ? j.jobPostings : [];
      return { count: Number(j?.total ?? items.length), sample_titles: items.slice(0, 3).map((x: any) => x.title), first: items[0] ?? null };
    }
    if (d.ats_type === "recruitee") {
      const r = await fetch(`https://${cfg.company}.recruitee.com/api/offers/`);
      const j: any = await r.json();
      const items = Array.isArray(j?.offers) ? j.offers : [];
      return { count: items.length, sample_titles: items.slice(0, 3).map((x: any) => x.title), first: items[0] ?? null };
    }
    if (d.ats_type === "personio") {
      const r = await fetch(`https://${cfg.company}.jobs.personio.com/xml?language=en`);
      const xml = await r.text();
      const positions = [...xml.matchAll(/<position[\s\S]*?<\/position>/g)].map((m) => m[0]);
      const getTag = (block: string, tag: string) => {
        const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : null;
      };
      return {
        count: positions.length,
        sample_titles: positions.slice(0, 3).map((p) => getTag(p, "name") ?? ""),
        first: positions[0] ? { name: getTag(positions[0], "name"), office: getTag(positions[0], "office") } : null,
      };
    }
    if (d.ats_type === "ashby") {
      const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(cfg.jobBoardName)}?includeCompensation=true`);
      const j: any = await r.json();
      const items = Array.isArray(j?.jobs) ? j.jobs : [];
      return { count: items.length, sample_titles: items.slice(0, 3).map((x: any) => x.title), first: items[0] ?? null };
    }
    if (d.ats_type === "workable") {
      const r = await fetch(`https://apply.workable.com/api/v3/accounts/${encodeURIComponent(cfg.account)}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
      });
      const j: any = await r.json();
      const items = Array.isArray(j?.results) ? j.results : (Array.isArray(j?.jobs) ? j.jobs : []);
      return { count: items.length, sample_titles: items.slice(0, 3).map((x: any) => x.title), first: items[0] ?? null };
    }
    return { count: 0, sample_titles: [], first: null, error: "unsupported ats_type" };
  } catch (e) {
    return { count: 0, sample_titles: [], first: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function deriveCompanyName(input: string | undefined, urlStr: string, cfg: any): string {
  if (input && input.trim()) return input.trim();
  const u = safeUrl(urlStr);
  if (u) {
    const host = u.hostname.replace(/^www\./, "");
    const base = host.split(".")[0];
    if (base && base !== "boards" && base !== "jobs" && base !== "careers" && base !== "apply") return base;
  }
  return String(cfg.company ?? cfg.tenant ?? cfg.account ?? cfg.jobBoardName ?? "Unknown");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const url: string = String(body?.url ?? "").trim();
    const companyName: string | undefined = body?.company_name ? String(body.company_name) : undefined;
    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step A — direct URL signature match
    let detection = matchAtsUrl(url);

    // Step B — best-effort HTML scan when generic domain
    if (!detection) {
      console.log(`[detect-ats] no URL match, scanning HTML at ${url}`);
      detection = await detectFromHtml(url);
    }

    if (!detection) {
      console.log(`[detect-ats] no ATS detected for ${url}`);
      return new Response(JSON.stringify({ detected: false, reason: "No supported ATS signature found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[detect-ats] detected ${detection.ats_type} via ${detection.source}:`, JSON.stringify(detection.ats_config));

    // Step C — live test fetch
    const test = await testFetch(detection);
    console.log(`[detect-ats] test fetch: ${test.count} jobs, first posting:`, JSON.stringify(test.first));
    if (test.error) console.warn(`[detect-ats] test error:`, test.error);

    // Step D — insert pending employer_sources row (is_active=false)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const company_name = deriveCompanyName(companyName, url, detection.ats_config);
    const { data: inserted, error: insErr } = await supabase
      .from("employer_sources")
      .insert([{
        company_name,
        ats_type: detection.ats_type,
        ats_config: detection.ats_config,
        is_active: false,
      }])
      .select("id")
      .single();
    if (insErr) console.warn(`[detect-ats] insert failed:`, insErr.message);

    return new Response(JSON.stringify({
      detected: true,
      ats_type: detection.ats_type,
      ats_config: detection.ats_config,
      detection_source: detection.source,
      test_job_count: test.count,
      sample_titles: test.sample_titles.filter(Boolean).slice(0, 3),
      test_error: test.error ?? null,
      employer_source_id: inserted?.id ?? null,
      company_name,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[detect-ats] fatal:`, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});