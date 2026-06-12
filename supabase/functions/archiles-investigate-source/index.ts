// Archiles ATS detection + test fetch for a candidate job source URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "palenik.filip@gmail.com";

interface Detected {
  ats_type: string;
  config: Record<string, unknown>;
}

function detect(url: string): Detected | null {
  const u = url.toLowerCase();
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    if (host.includes("greenhouse.io")) {
      const slug = pathParts[0];
      if (!slug) return null;
      return { ats_type: "greenhouse", config: { slug, list_endpoint: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs` } };
    }
    if (host.includes("lever.co")) {
      const slug = pathParts[0] ?? host.split(".")[0];
      return { ats_type: "lever", config: { slug, list_endpoint: `https://api.lever.co/v0/postings/${slug}?mode=json` } };
    }
    if (host.includes("myworkdayjobs.com")) {
      const tenant = host.split(".")[0];
      const site = pathParts[0] ?? "External";
      return { ats_type: "workday", config: { tenant, site, list_endpoint: `https://${host}/wday/cxs/${tenant}/${site}/jobs` } };
    }
    if (host.includes("smartrecruiters.com")) {
      const slug = pathParts[0];
      if (!slug) return null;
      return { ats_type: "smartrecruiters", config: { slug, list_endpoint: `https://api.smartrecruiters.com/v1/companies/${slug}/postings` } };
    }
    if (host.includes("personio")) {
      const tenant = host.split(".")[0];
      return { ats_type: "personio", config: { tenant, list_endpoint: `https://${tenant}.jobs.personio.de/xml` } };
    }
    if (host.includes("workable.com")) {
      const slug = pathParts[0] ?? host.split(".")[0];
      return { ats_type: "workable", config: { slug, list_endpoint: `https://apply.workable.com/api/v3/accounts/${slug}/jobs` } };
    }
    if (host.includes("teamtailor.com")) {
      const slug = host.split(".")[0];
      return { ats_type: "teamtailor", config: { company: slug, list_endpoint: `https://${slug}.teamtailor.com/jobs.json` } };
    }
  } catch {}
  return null;
}

async function testFetch(d: Detected): Promise<any | null> {
  try {
    const endpoint = d.config.list_endpoint as string;
    if (!endpoint) return null;
    const r = await fetch(endpoint, { headers: { "User-Agent": "Archiles/1.0 (Lovable)" } });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const ct = r.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const json = await r.json();
      // Try to extract first job
      let sample: any = null;
      if (Array.isArray(json.jobs) && json.jobs.length) sample = json.jobs[0];
      else if (Array.isArray(json) && json.length) sample = json[0];
      else if (Array.isArray(json.content) && json.content.length) sample = json.content[0];
      else if (Array.isArray(json.data) && json.data.length) sample = json.data[0];
      return {
        ok: true,
        sample_job: sample
          ? {
              title: sample.title ?? sample.name ?? sample.text ?? "—",
              location: sample.location?.name ?? sample.location ?? sample.categories?.location ?? "—",
            }
          : null,
      };
    }
    const text = await r.text();
    return { ok: true, sample_job: null, content_type: ct, length: text.length };
  } catch (e: any) {
    return { error: e.message ?? String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user || userData.user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const url: string | undefined = body.url;
    const company: string | undefined = body.company;

    if (!url && !company) {
      return new Response(JSON.stringify({ error: "Provide url or company" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!url && company) {
      const slug = company.toLowerCase().replace(/[^a-z0-9]/g, "");
      // Try Teamtailor first — very common for Nordic SMBs.
      const ttEndpoint = `https://${slug}.teamtailor.com/jobs.json`;
      try {
        const r = await fetch(ttEndpoint, { headers: { "User-Agent": "Archiles/1.0 (Lovable)" } });
        if (r.ok) {
          const json = await r.json().catch(() => null);
          const items = Array.isArray(json?.items) ? json.items : [];
          if (items.length > 0) {
            const sample = items[0];
            return new Response(JSON.stringify({
              detected: { ats_type: "teamtailor", config: { company: slug, list_endpoint: ttEndpoint } },
              sample_job: { title: sample?.title ?? "—", location: sample?._jobposting?.jobLocation?.address?.addressLocality ?? "—" },
              items_count: items.length,
              suggested_name: company,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch { /* fall through */ }
      // No URL → cannot reliably auto-detect other ATSes; offer guesses.
      return new Response(JSON.stringify({
        detected: null,
        reason: "Bez URL nelze spolehlivě auto-detekovat ATS (Teamtailor zkoušen — neodpověděl). Zkus zadat URL kariérní stránky.",
        possible_reasons: [
          `Zkus: https://boards.greenhouse.io/${slug}`,
          `Zkus: https://jobs.lever.co/${slug}`,
          `Zkus: https://${slug}.workable.com`,
          `Zkus: https://${slug}.teamtailor.com/jobs.json`,
        ],
        suggested_name: company,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const detected = detect(url!);
    if (!detected) {
      return new Response(JSON.stringify({
        detected: null,
        reason: "Nepoznaný ATS pro tuto URL.",
        possible_reasons: [
          "URL není ze známého ATS portálu (Greenhouse, Lever, Workday, SmartRecruiters, Personio, Workable).",
          "Firma možná používá custom careers page — bude potřeba manuální konfigurace.",
        ],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const test = await testFetch(detected);
    if (!test || test.error) {
      return new Response(JSON.stringify({
        detected,
        sample_job: null,
        warning: `Test fetch selhalo: ${test?.error ?? "no response"}`,
        suggested_name: (detected.config as any).slug ?? (detected.config as any).tenant ?? "New source",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      detected,
      sample_job: test.sample_job,
      suggested_name: (detected.config as any).slug ?? (detected.config as any).tenant ?? "New source",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});