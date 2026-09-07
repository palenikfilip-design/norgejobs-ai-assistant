/**
 * Last-known-good landing page stats.
 *
 * Used only when the live stats endpoint AND the browser's cached copy are both
 * unavailable (e.g. backend cold start). Numbers are refreshed from the live
 * endpoint on every successful load and cached in localStorage, so this file
 * is just the floor – never the source of truth.
 */
export type LeslieStats = {
  active_sources?: number;
  active_companies?: number;
  countries_covered?: number;
  total_active_jobs?: number;
  quality_active_jobs?: number;
  total_positions?: number;
  quality_total_positions?: number;
  last_ingest_run?: string | null;
  computed_at?: string | null;
  from_snapshot?: boolean;
  stale?: boolean;
  fallback?: boolean;
};

export const STATS_STORAGE_KEY = "leslie:stats:last-good";

export const STATIC_STATS_FALLBACK: LeslieStats = {
  active_sources: 9,
  active_companies: 4300,
  countries_covered: 5,
  total_active_jobs: 46701,
  last_ingest_run: "2026-09-07T00:00:00.000Z",
  stale: true,
};

export const hasStatNumbers = (s: LeslieStats | null | undefined): s is LeslieStats =>
  !!s && !s.fallback && typeof s.total_active_jobs === "number" && s.total_active_jobs > 0;

export const readCachedStats = (): LeslieStats | null => {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeslieStats;
    return hasStatNumbers(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeCachedStats = (s: LeslieStats) => {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable – ignore */
  }
};
