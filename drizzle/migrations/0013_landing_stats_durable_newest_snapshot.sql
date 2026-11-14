CREATE TABLE public.leslie_stats_snapshot (
 id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
 total_active_jobs bigint NOT NULL,
 jobs_today bigint NOT NULL,
 fully_enriched bigint NOT NULL,
 employers bigint NOT NULL,
 countries bigint NOT NULL,
 updated_at timestamptz NOT NULL
);
GRANT SELECT ON public.leslie_stats_snapshot TO anon, authenticated;
GRANT ALL ON public.leslie_stats_snapshot TO service_role;
ALTER TABLE public.leslie_stats_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public statistics snapshot read" ON public.leslie_stats_snapshot FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.leslie_stats_snapshot (id, total_active_jobs, jobs_today, fully_enriched, employers, countries, updated_at)
SELECT true, total_active_jobs, jobs_today, quality_active_jobs, active_companies, countries_covered, computed_at FROM public.leslie_stats;
CREATE OR REPLACE FUNCTION public.refresh_leslie_stats() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 REFRESH MATERIALIZED VIEW public.leslie_stats;
 INSERT INTO public.leslie_stats_snapshot (id, total_active_jobs, jobs_today, fully_enriched, employers, countries, updated_at)
 SELECT true, total_active_jobs, jobs_today, quality_active_jobs, active_companies, countries_covered, computed_at FROM public.leslie_stats
 ON CONFLICT (id) DO UPDATE SET total_active_jobs = EXCLUDED.total_active_jobs, jobs_today = EXCLUDED.jobs_today, fully_enriched = EXCLUDED.fully_enriched, employers = EXCLUDED.employers, countries = EXCLUDED.countries, updated_at = EXCLUDED.updated_at;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_leslie_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_leslie_stats() TO service_role;