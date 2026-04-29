-- Public jobs catalog (shared across all users)
CREATE TABLE public.public_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_portal TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  country TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  currency TEXT,
  description TEXT,
  url TEXT NOT NULL UNIQUE,
  job_type TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_public_jobs_country ON public.public_jobs(country);
CREATE INDEX idx_public_jobs_source ON public.public_jobs(source_portal);
CREATE INDEX idx_public_jobs_fetched ON public.public_jobs(fetched_at DESC);

ALTER TABLE public.public_jobs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read the catalog
CREATE POLICY "Authenticated can view public jobs"
ON public.public_jobs
FOR SELECT
TO authenticated
USING (true);

-- Only service_role writes (via edge function)
CREATE POLICY "Service role manages public jobs"
ON public.public_jobs
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE TRIGGER update_public_jobs_updated_at
BEFORE UPDATE ON public.public_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Track ingest runs
CREATE TABLE public.ingest_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  jobs_added INTEGER DEFAULT 0,
  jobs_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ingest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ingest logs"
ON public.ingest_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role manages ingest logs"
ON public.ingest_logs
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
