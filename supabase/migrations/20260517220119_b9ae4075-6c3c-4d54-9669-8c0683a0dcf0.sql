
ALTER TABLE public.public_jobs
  ADD CONSTRAINT public_jobs_source_portal_external_id_key UNIQUE (source_portal, external_id);
