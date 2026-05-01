ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferences_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_rescore boolean NOT NULL DEFAULT false;