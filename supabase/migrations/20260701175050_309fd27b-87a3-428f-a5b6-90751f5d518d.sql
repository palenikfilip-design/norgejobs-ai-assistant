ALTER TABLE public.public_jobs
  ADD COLUMN IF NOT EXISTS accommodation text,
  ADD COLUMN IF NOT EXISTS benefits jsonb NOT NULL DEFAULT '[]'::jsonb;