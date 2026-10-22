ALTER TABLE public.public_jobs
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivation_reason text,
  ADD COLUMN IF NOT EXISTS last_liveness_check timestamptz;
CREATE INDEX IF NOT EXISTS idx_public_jobs_active_country_category ON public.public_jobs (is_active, country, category);
CREATE INDEX IF NOT EXISTS idx_public_jobs_liveness_check ON public.public_jobs (last_liveness_check NULLS FIRST) WHERE is_active;