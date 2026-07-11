-- New enum for classification (distinct from existing job seniority column skill_level)
DO $$ BEGIN
  CREATE TYPE public.job_skill_class AS ENUM ('manual','skilled','management','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.public_jobs
  ADD COLUMN IF NOT EXISTS skill_class public.job_skill_class,
  ADD COLUMN IF NOT EXISTS foreigner_friendly boolean,
  ADD COLUMN IF NOT EXISTS foreigner_signals jsonb;

CREATE INDEX IF NOT EXISTS public_jobs_skill_class_idx ON public.public_jobs(skill_class);
CREATE INDEX IF NOT EXISTS public_jobs_foreigner_friendly_idx ON public.public_jobs(foreigner_friendly);