import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Job } from "@/data/mockJobs";

interface PublicJobRow {
  id: string;
  source_portal: string;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  description: string | null;
  url: string;
  job_type: string | null;
}

const PORTAL_TO_SOURCE_ID: Record<string, string> = {
  "mpsv.cz": "mpsv_cz",
  "nav.no": "nav",
  "eures.ec.europa.eu": "eures",
};

function formatSalary(min: number | null, max: number | null, currency: string | null): string {
  if (!min && !max) return "Salary not specified";
  const sym = currency === "EUR" ? "€" : currency === "CZK" ? "Kč " : currency === "NOK" ? "kr " : (currency ?? "") + " ";
  if (min && max) return `${sym}${min.toLocaleString()} – ${sym}${max.toLocaleString()}`;
  return `${sym}${(min ?? max ?? 0).toLocaleString()}`;
}

function rowToJob(r: PublicJobRow): Job {
  return {
    id: `db_${r.id}`,
    title: r.title,
    company: r.company || "Unknown employer",
    country: r.country || "Unknown",
    city: r.location || "—",
    salary: formatSalary(r.salary_min, r.salary_max, r.currency),
    type: r.job_type || "Full-time",
    description: r.description ? r.description.slice(0, 400) : "View original posting for full details.",
    skills: [],
    requiredSkills: [],
    requiredLanguages: [],
    experienceRequired: "any",
    certificationsRequired: [],
    applicants: undefined,
    positions: 1,
    avgDaysToFill: undefined,
    sourceId: PORTAL_TO_SOURCE_ID[r.source_portal] ?? r.source_portal,
    sourceUrl: r.url,
  };
}

/**
 * Loads public jobs catalog from Supabase. Falls back to empty array on error.
 */
export function usePublicJobs(limit = 200) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("public_jobs")
          .select("id, source_portal, title, company, location, country, salary_min, salary_max, currency, description, url, job_type")
          .order("fetched_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        if (!cancelled) setJobs((data ?? []).map(rowToJob));
      } catch (e) {
        console.error("Failed to load public jobs:", e);
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [limit]);

  return { jobs, loading };
}