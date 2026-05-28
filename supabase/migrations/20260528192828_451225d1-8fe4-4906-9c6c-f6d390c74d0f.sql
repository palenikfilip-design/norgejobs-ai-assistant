ALTER TABLE public.cached_matches
  ADD COLUMN IF NOT EXISTS score_dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS company_signal text,
  ADD COLUMN IF NOT EXISTS scored_at timestamp with time zone NOT NULL DEFAULT now();