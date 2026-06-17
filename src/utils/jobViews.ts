import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Deterministic mock "views" counter for a job (stable per id).
 * Used only for mock data (e.g. DailyInsights demo).
 * Real per-job views live in public_jobs.view_count and are accessed via
 * useJobViewCount(url) + registerJobView(url) below.
 */
export const getJobViews = (jobId: string): number => {
  let h = 0;
  for (let i = 0; i < jobId.length; i++) {
    h = (h * 31 + jobId.charCodeAt(i)) >>> 0;
  }
  // Range: ~120 – 4200 views
  return 120 + (h % 4080);
};

export const formatViews = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

/** Fetch the current view_count for a public_jobs row by URL. */
export async function fetchJobViewCount(url: string): Promise<number> {
  if (!url) return 0;
  const { data, error } = await supabase
    .from("public_jobs")
    .select("view_count")
    .eq("url", url)
    .maybeSingle();
  if (error || !data) return 0;
  return data.view_count ?? 0;
}

/**
 * Register a view for the given job URL. Atomic + deduped at the DB level
 * (1 user = 1 view per UTC day per URL). Returns the new total view_count.
 */
export async function registerJobView(url: string): Promise<number> {
  if (!url) return 0;
  const { data, error } = await supabase.rpc("register_job_view", { p_job_url: url });
  if (error) {
    console.error("register_job_view failed:", error);
    return 0;
  }
  return (data as number | null) ?? 0;
}

/** React hook: returns the current view_count for a job URL and a setter. */
export function useJobViewCount(url: string | null | undefined): {
  count: number;
  setCount: (n: number) => void;
} {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!url) return;
    fetchJobViewCount(url).then((n) => {
      if (!cancelled) setCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return { count, setCount };
}