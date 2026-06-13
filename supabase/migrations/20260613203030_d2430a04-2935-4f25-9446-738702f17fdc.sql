
-- Soft archive for presets
ALTER TABLE public.user_presets ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS user_presets_user_archived_idx ON public.user_presets (user_id, archived_at);

-- Manual overrides / mutes on learned profile
ALTER TABLE public.user_preference_profile ADD COLUMN IF NOT EXISTS overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.user_preference_profile ADD COLUMN IF NOT EXISTS muted jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.user_preference_profile ADD COLUMN IF NOT EXISTS user_corrections jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Ensure a row exists upsert path works even without prior signals
-- (no schema change needed for that; the hook already upserts)
