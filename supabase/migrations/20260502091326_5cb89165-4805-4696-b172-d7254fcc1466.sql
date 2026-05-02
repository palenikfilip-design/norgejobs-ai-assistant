CREATE TABLE IF NOT EXISTS public.ingest_state (
  source text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingest_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ingest state"
ON public.ingest_state
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE UNIQUE INDEX IF NOT EXISTS public_jobs_source_external_uniq
ON public.public_jobs (source_portal, external_id)
WHERE external_id IS NOT NULL;