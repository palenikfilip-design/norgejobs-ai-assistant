-- Run against the database: exercises the same predicate as leslie_stats.
WITH jobs(is_active, created_at, posted_at, fetched_at) AS (
  VALUES
    (true, now() - interval '23 hours', now() - interval '90 days', now()),
    (false, now() - interval '1 hour', now(), now()),
    (true, now() - interval '25 hours', now(), now()),
    (true, now() - interval '24 hours', now(), now())
), result AS (
  SELECT count(*) AS newest FROM jobs
  WHERE is_active = true AND created_at > now() - interval '24 hours'
)
SELECT newest, newest = 1 AS passed FROM result;