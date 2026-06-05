
DROP MATERIALIZED VIEW IF EXISTS public.leslie_stats;

CREATE MATERIALIZED VIEW public.leslie_stats AS
SELECT
  (SELECT count(*) FROM public.job_sources WHERE is_active = true) AS active_sources,
  (SELECT count(DISTINCT company) FROM public.public_jobs WHERE company IS NOT NULL) AS active_companies,
  (SELECT count(DISTINCT country) FROM public.public_jobs WHERE country IS NOT NULL AND country <> 'Multiple') AS countries_covered,
  (SELECT count(*) FROM public.public_jobs) AS total_active_jobs,
  (SELECT count(*) FROM public.public_jobs
     WHERE data_completeness IN ('complete','partial')
       AND enriched_at IS NOT NULL) AS quality_active_jobs,
  (SELECT count(*) FROM public.public_jobs WHERE created_at > now() - interval '24 hours') AS jobs_today,
  (SELECT count(*) FROM public.public_jobs WHERE created_at > now() - interval '7 days') AS jobs_this_week,
  (SELECT COALESCE(sum(positions_available), count(*)) FROM public.public_jobs) AS total_positions,
  (SELECT COALESCE(sum(positions_available), count(*))
     FROM public.public_jobs
     WHERE data_completeness IN ('complete','partial')
       AND enriched_at IS NOT NULL) AS quality_total_positions,
  (SELECT max(created_at) FROM public.public_jobs) AS last_job_added,
  (SELECT max(last_run_at) FROM public.job_sources WHERE is_active = true) AS last_ingest_run,
  now() AS computed_at;

GRANT SELECT ON public.leslie_stats TO anon, authenticated, service_role;

REFRESH MATERIALIZED VIEW public.leslie_stats;
