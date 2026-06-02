ALTER TABLE public.public_jobs
  ADD COLUMN IF NOT EXISTS data_completeness text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS additional_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS salary text;

ALTER TABLE public.country_context DROP CONSTRAINT IF EXISTS country_context_region_check;
ALTER TABLE public.country_context ADD CONSTRAINT country_context_region_check
  CHECK (region = ANY (ARRAY['EU-East','EU-North','EU-West','EU-South','UK-IE','NorthAmerica','AsiaPacific','MiddleEast','LatinAmerica','Africa','Remote','Multiple']));

INSERT INTO public.country_context
  (country_code, country_name, region, continent, avg_salary_eur, cost_of_living_index, languages_spoken, expat_friendliness, work_visa_difficulty)
VALUES
  ('MULTI', 'Multiple', 'Multiple', 'Global', 3000, 130, '["en"]'::jsonb, 85, 'medium')
ON CONFLICT DO NOTHING;

UPDATE public.public_jobs
SET enriched_at = NULL
WHERE source_portal LIKE 'greenhouse:%'
   OR source_portal LIKE 'lever:%'
   OR source_portal LIKE 'smartrecruiters:%';