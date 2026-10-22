DROP MATERIALIZED VIEW IF EXISTS public.leslie_stats;
DROP MATERIALIZED VIEW IF EXISTS public.leslie_stats_by_country;
DROP MATERIALIZED VIEW IF EXISTS public.leslie_stats_by_category;

CREATE MATERIALIZED VIEW public.leslie_stats AS
WITH a AS (SELECT * FROM public.public_jobs WHERE is_active)
SELECT
  (SELECT count(*) FROM public.job_sources WHERE is_active = true) AS active_sources,
  (SELECT count(DISTINCT company) FROM a WHERE company IS NOT NULL) AS active_companies,
  (SELECT count(DISTINCT country) FROM a WHERE country IS NOT NULL AND country <> 'Multiple') AS countries_covered,
  (SELECT count(*) FROM a) AS total_active_jobs,
  (SELECT count(*) FROM a WHERE data_completeness = ANY (ARRAY['complete','partial']) AND enriched_at IS NOT NULL) AS quality_active_jobs,
  (SELECT count(*) FROM a WHERE created_at > now() - interval '24 hours') AS jobs_today,
  (SELECT count(*) FROM a WHERE created_at > now() - interval '7 days') AS jobs_this_week,
  (SELECT COALESCE(sum(positions_available), count(*)) FROM a) AS total_positions,
  (SELECT COALESCE(sum(positions_available), count(*)) FROM a WHERE data_completeness = ANY (ARRAY['complete','partial']) AND enriched_at IS NOT NULL) AS quality_total_positions,
  (SELECT max(created_at) FROM a) AS last_job_added,
  (SELECT max(last_run_at) FROM public.job_sources WHERE is_active = true) AS last_ingest_run,
  now() AS computed_at;

CREATE MATERIALIZED VIEW public.leslie_stats_by_country AS
SELECT pj.country, cc.country_code, cc.region, cc.continent,
  count(*) AS job_count,
  COALESCE(sum(pj.positions_available), count(*)) AS position_count,
  count(DISTINCT pj.company) AS company_count,
  count(DISTINCT pj.display_category) AS category_count
FROM public.public_jobs pj
LEFT JOIN public.country_context cc ON pj.country = cc.country_name
WHERE pj.country IS NOT NULL AND pj.is_active
GROUP BY pj.country, cc.country_code, cc.region, cc.continent;

CREATE MATERIALIZED VIEW public.leslie_stats_by_category AS
SELECT dc.id AS category_id, dc.label_cs, dc.icon, dc.color, dc.sort_order,
  count(pj.*) AS job_count,
  COALESCE(sum(pj.positions_available), count(pj.*)) AS position_count,
  count(DISTINCT pj.country) AS country_count,
  count(DISTINCT pj.company) AS company_count
FROM public.display_categories dc
LEFT JOIN public.public_jobs pj ON pj.display_category = dc.id AND pj.is_active
GROUP BY dc.id, dc.label_cs, dc.icon, dc.color, dc.sort_order;

CREATE UNIQUE INDEX leslie_stats_singleton ON public.leslie_stats (computed_at);
CREATE UNIQUE INDEX leslie_stats_by_category_pk ON public.leslie_stats_by_category (category_id);

GRANT SELECT ON public.leslie_stats, public.leslie_stats_by_country, public.leslie_stats_by_category TO anon, authenticated, service_role;