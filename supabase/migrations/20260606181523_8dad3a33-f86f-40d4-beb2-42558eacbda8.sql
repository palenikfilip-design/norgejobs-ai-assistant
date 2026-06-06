ALTER TABLE public.job_sources DROP CONSTRAINT IF EXISTS job_sources_source_type_check;
ALTER TABLE public.job_sources ADD CONSTRAINT job_sources_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'portal_api','ats_greenhouse','ats_lever','ats_smartrecruiters',
    'ats_workday','ats_personio','rss_feed','arbeitnow','nav_no_feed'
  ]));