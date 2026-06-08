ALTER TABLE public.public_jobs ADD COLUMN IF NOT EXISTS salary_estimated_eur integer;
ALTER TABLE public.public_jobs ADD COLUMN IF NOT EXISTS salary_is_estimated boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_public_jobs_salary_estimated_eur ON public.public_jobs(salary_estimated_eur);