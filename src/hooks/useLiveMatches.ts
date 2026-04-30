import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Job } from "@/data/mockJobs";

export interface LiveMatch {
  source_portal: string;
  external_id: string;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  url: string;
  job_type: string | null;
  score: number;
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
): string {
  if (!min && !max) return "Salary not specified";
  const sym =
    currency === "EUR"
      ? "€"
      : currency === "CZK"
        ? "Kč "
        : currency === "NOK"
          ? "kr "
          : (currency ?? "") + " ";
  if (min && max)
    return `${sym}${min.toLocaleString()} – ${sym}${max.toLocaleString()}`;
  return `${sym}${(min ?? max ?? 0).toLocaleString()}`;
}

const PORTAL_TO_SOURCE_ID: Record<string, string> = {
  "mpsv.cz": "mpsv_cz",
  "nav.no": "nav",
};

export function liveMatchToJob(m: LiveMatch): Job & { matchScore?: number } {
  return {
    id: `live_${m.source_portal}_${m.external_id}`,
    title: m.title,
    company: m.company || "Unknown employer",
    country: m.country || "Unknown",
    city: m.location || "—",
    salary: formatSalary(m.salary_min, m.salary_max, m.currency),
    type: m.job_type || "Full-time",
    description: "View original posting for full details.",
    skills: [],
    requiredSkills: [],
    requiredLanguages: [],
    experienceRequired: "any",
    certificationsRequired: [],
    applicants: undefined,
    positions: 1,
    avgDaysToFill: undefined,
    sourceId: PORTAL_TO_SOURCE_ID[m.source_portal] ?? m.source_portal,
    sourceUrl: m.url,
    matchScore: m.score,
  } as Job & { matchScore?: number };
}

/**
 * Calls the match-jobs edge function which fetches live jobs from MPSV/NAV
 * public APIs, AI-scores them against the avatar, and returns matches >= 60.
 */
export function useLiveMatches(avatar: unknown | null) {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!avatar) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("match-jobs", {
        body: { avatar },
      });
      if (error) throw error;
      setMatches((data?.matches as LiveMatch[]) ?? []);
    } catch (e) {
      console.error("Live match failed:", e);
      setError(e instanceof Error ? e.message : "Failed to load matches");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [avatar]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { matches, loading, error, refresh };
}

/**
 * Records a click on a matched job (for learning). Stores no full job content.
 */
export async function recordMatchClick(
  userId: string,
  match: LiveMatch,
): Promise<void> {
  try {
    await supabase.from("job_matches").insert({
      user_id: userId,
      source_url: match.url,
      source_portal: match.source_portal,
      title: match.title,
      location: match.location,
      score: match.score,
      clicked_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("recordMatchClick failed:", e);
  }
}