ALTER TABLE public.public_jobs
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS is_seasonal boolean;

ALTER TABLE public.cached_matches
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS is_seasonal boolean;

CREATE INDEX IF NOT EXISTS idx_public_jobs_category ON public.public_jobs(category);
CREATE INDEX IF NOT EXISTS idx_public_jobs_is_seasonal ON public.public_jobs(is_seasonal);
CREATE INDEX IF NOT EXISTS idx_cached_matches_category ON public.cached_matches(category);
CREATE INDEX IF NOT EXISTS idx_cached_matches_is_seasonal ON public.cached_matches(is_seasonal);