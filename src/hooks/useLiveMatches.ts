import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Job } from "@/data/mockJobs";
import i18n from "@/i18n";

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
  reasons?: string[];
  category?: string | null;
  is_seasonal?: boolean | null;
  dimensions?: Record<string, number> | null;
  warnings?: string[] | null;
  company_signal?: string | null;
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
    matchReasons: Array.isArray(m.reasons) ? m.reasons : [],
    category: m.category ?? null,
    isSeasonal: m.is_seasonal ?? null,
    scoreDimensions: m.dimensions ?? null,
    warnings: Array.isArray(m.warnings) ? m.warnings : [],
    companySignal: m.company_signal ?? null,
  } as Job & {
    matchScore?: number;
    matchReasons?: string[];
    category?: string | null;
    isSeasonal?: boolean | null;
    scoreDimensions?: Record<string, number> | null;
    warnings?: string[];
    companySignal?: string | null;
  };
}

interface CachedRow {
  job_title: string;
  job_location: string | null;
  job_country: string | null;
  job_salary: string | null;
  job_url: string;
  source_portal: string | null;
  score: number;
  reasons: unknown;
  created_at: string;
  category: string | null;
  is_seasonal: boolean | null;
  score_dimensions: unknown;
  warnings: unknown;
  company_signal: string | null;
}

function cachedRowToMatch(r: CachedRow): LiveMatch {
  return {
    source_portal: r.source_portal ?? "unknown",
    external_id: r.job_url,
    title: r.job_title,
    company: null,
    location: r.job_location,
    country: r.job_country,
    salary_min: null,
    salary_max: null,
    currency: null,
    url: r.job_url,
    job_type: null,
    score: r.score,
    reasons: Array.isArray(r.reasons) ? (r.reasons as string[]) : [],
    category: r.category,
    is_seasonal: r.is_seasonal,
    dimensions: r.score_dimensions && typeof r.score_dimensions === "object" ? (r.score_dimensions as Record<string, number>) : null,
    warnings: Array.isArray(r.warnings) ? (r.warnings as string[]) : [],
    company_signal: r.company_signal,
  };
}

/**
 * Cache-first match loading.
 * - On mount: read `cached_matches` for the user; show immediately if any.
 * - If cache empty: trigger `match-jobs`, persist new rows, then show.
 * - `refresh()` always re-runs `match-jobs` and inserts only new URLs.
 */
export function useLiveMatches(avatar: unknown | null) {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newlyAdded, setNewlyAdded] = useState<number | null>(null);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  const refreshHiddenStats = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const [{ count: total }, { count: active }] = await Promise.all([
      supabase
        .from("cached_matches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabase
        .from("cached_matches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("is_active", true),
    ]);
    const totalN = total ?? 0;
    const activeN = active ?? 0;
    setActiveCount(activeN);
    setHiddenCount(Math.max(0, totalN - activeN));
  }, []);

  const loadFromCache = useCallback(async (): Promise<LiveMatch[]> => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from("cached_matches")
      .select("job_title, job_location, job_country, job_salary, job_url, source_portal, score, reasons, created_at, category, is_seasonal, score_dimensions, warnings, company_signal")
      .eq("user_id", uid)
      .eq("is_active", true)
      .order("score", { ascending: false })
      .limit(50);
    if (error) {
      console.error("cached_matches load failed:", error);
      return [];
    }
    const rows = (data ?? []) as CachedRow[];
    if (rows.length > 0) {
      const newest = rows.reduce(
        (acc, r) => (new Date(r.created_at) > acc ? new Date(r.created_at) : acc),
        new Date(rows[0].created_at),
      );
      setLastUpdated(newest);
    }
    void refreshHiddenStats();
    return rows.map(cachedRowToMatch);
  }, [refreshHiddenStats]);

  const fetchFromApiAndCache = useCallback(async (): Promise<{ matches: LiveMatch[]; added: number }> => {
    if (!avatar) return { matches: [], added: 0 };
    const language = i18n.resolvedLanguage || i18n.language || "cs";
    const { data, error } = await supabase.functions.invoke("match-jobs", {
      body: { avatar, language },
    });
    if (error) throw error;
    const fresh = ((data?.matches as LiveMatch[]) ?? []).filter((m) => m && m.url);

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    let added = 0;
    if (uid && fresh.length > 0) {
      // Find existing URLs for this user to skip duplicates
      const urls = fresh.map((m) => m.url);
      const { data: existing } = await supabase
        .from("cached_matches")
        .select("job_url")
        .eq("user_id", uid)
        .in("job_url", urls);
      const seen = new Set((existing ?? []).map((r: { job_url: string }) => r.job_url));
      const toInsert = fresh
        .filter((m) => !seen.has(m.url))
        .map((m) => ({
          user_id: uid,
          job_title: m.title ?? "",
          job_location: m.location,
          job_country: m.country,
          job_salary: formatSalary(m.salary_min, m.salary_max, m.currency),
          job_url: m.url,
          source_portal: m.source_portal,
          score: m.score ?? 0,
          reasons: m.reasons ?? [],
          is_active: true,
          category: m.category ?? null,
          is_seasonal: m.is_seasonal ?? null,
          score_dimensions: m.dimensions ?? {},
          warnings: m.warnings ?? [],
          company_signal: m.company_signal ?? "unknown",
        }));
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from("cached_matches")
          .insert(toInsert);
        if (insErr) {
          console.error("cached_matches insert failed:", insErr);
        } else {
          added = toInsert.length;
        }
      }
    }
    return { matches: fresh, added };
  }, [avatar]);

  const refresh = useCallback(async () => {
    if (!avatar) return;
    setLoading(true);
    setError(null);
    setNewlyAdded(null);
    try {
      const { added } = await fetchFromApiAndCache();
      setNewlyAdded(added);
      const cached = await loadFromCache();
      setMatches(cached);
    } catch (e) {
      console.error("refresh failed:", e);
      setError(e instanceof Error ? e.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, [avatar, fetchFromApiAndCache, loadFromCache]);

  // Initial load: cache-first, fallback to API+cache when empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // If profile says preferences changed since last scoring, force a fresh fetch
        let mustRescore = false;
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (uid) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("needs_rescore")
            .eq("user_id", uid)
            .maybeSingle();
          mustRescore = !!prof?.needs_rescore;
        }

        const cached = await loadFromCache();
        if (cancelled) return;
        if (cached.length > 0 && !mustRescore) {
          setMatches(cached);
          setLoading(false);
          return;
        }
        if (!avatar) {
          if (cached.length > 0) setMatches(cached);
          setLoading(false);
          return;
        }
        await fetchFromApiAndCache();
        if (cancelled) return;
        if (mustRescore && uid) {
          await supabase
            .from("profiles")
            .update({ needs_rescore: false })
            .eq("user_id", uid);
        }
        const after = await loadFromCache();
        if (!cancelled) setMatches(after);
      } catch (e) {
        if (!cancelled) {
          console.error("initial match load failed:", e);
          setError(e instanceof Error ? e.message : "Failed to load matches");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatar, loadFromCache, fetchFromApiAndCache]);

  return {
    matches,
    loading,
    error,
    refresh,
    lastUpdated,
    newlyAdded,
    hiddenCount,
    activeCount,
  };
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