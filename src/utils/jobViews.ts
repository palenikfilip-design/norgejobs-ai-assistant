/**
 * Deterministic mock "views" counter for a job (stable per id).
 * Used as a popularity proxy across the app until we have real analytics.
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