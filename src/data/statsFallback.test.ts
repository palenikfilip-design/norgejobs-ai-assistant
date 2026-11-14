import { afterEach, expect, it } from "vitest";
import { mergeStats, readCachedStats, showNewestJobs, STATS_STORAGE_KEY, writeCachedStats } from "./statsFallback";

afterEach(() => localStorage.removeItem(STATS_STORAGE_KEY));

it("hides a zero newest-jobs count", () => {
  expect(showNewestJobs({ jobs_today: 0 })).toBe(false);
  expect(showNewestJobs({ jobs_today: 2431 })).toBe(true);
  expect(showNewestJobs({})).toBe(false);
});

it("keeps the last known count in the browser across unavailable stats responses", () => {
  writeCachedStats({ total_active_jobs: 61755, jobs_today: 2431 });
  expect(readCachedStats()?.jobs_today).toBe(2431);
  expect(mergeStats(readCachedStats() ?? {}, { total_active_jobs: 61755 }).jobs_today).toBe(2431);
});

it("replaces a previous count with a genuine zero after an ingest outage", () => {
  const fresh = mergeStats({ jobs_today: 2431 }, { total_active_jobs: 61755, jobs_today: 0 });
  expect(fresh.jobs_today).toBe(0);
  expect(showNewestJobs(fresh)).toBe(false);
});