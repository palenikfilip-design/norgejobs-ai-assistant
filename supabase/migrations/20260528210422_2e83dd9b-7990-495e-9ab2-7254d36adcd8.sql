
-- PART 1: Extend user_presets
ALTER TABLE public.user_presets
  ADD COLUMN IF NOT EXISTS seasonal_preference text DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS duration_preference text DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS language_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS learning_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- PART 3: Add preset_id to cached_matches
ALTER TABLE public.cached_matches
  ADD COLUMN IF NOT EXISTS preset_id uuid;

CREATE INDEX IF NOT EXISTS idx_cached_matches_preset ON public.cached_matches(user_id, preset_id);

-- PART 2: Migrate avatar_json → first preset for users with avatar but no preset
INSERT INTO public.user_presets (
  user_id, name, active,
  preferred_job_type, preferred_countries,
  salary_min, salary_max,
  housing_preference, desired_bonuses,
  language_requirements, seasonal_preference,
  last_used_at
)
SELECT
  p.user_id,
  'Můj první preset',
  true,
  COALESCE(p.avatar_json->>'preferred_job_type', 'Full-time'),
  COALESCE(p.avatar_json->'preferred_countries', '[]'::jsonb),
  COALESCE((p.avatar_json->>'min_salary')::numeric, 0),
  COALESCE((p.avatar_json->>'max_salary')::numeric, 0),
  COALESCE((p.avatar_json->>'housing_preference')::boolean, false),
  COALESCE(p.avatar_json->'desired_bonuses', '[]'::jsonb),
  COALESCE(p.avatar_json->'languages_spoken', '[]'::jsonb),
  CASE
    WHEN p.avatar_json->>'seasonal_preference' ILIKE '%permanent%' THEN 'permanent'
    WHEN p.avatar_json->>'seasonal_preference' ILIKE '%summer%' THEN 'summer'
    WHEN p.avatar_json->>'seasonal_preference' ILIKE '%winter%' THEN 'winter'
    WHEN p.avatar_json->>'seasonal_preference' IS NOT NULL THEN 'any'
    ELSE 'any'
  END,
  now()
FROM public.profiles p
WHERE p.avatar_json IS NOT NULL
  AND jsonb_typeof(p.avatar_json) = 'object'
  AND p.avatar_json <> '{}'::jsonb
  AND NOT EXISTS (SELECT 1 FROM public.user_presets up WHERE up.user_id = p.user_id);

-- Backfill cached_matches.preset_id with the user's active preset
UPDATE public.cached_matches cm
SET preset_id = up.id
FROM public.user_presets up
WHERE cm.user_id = up.user_id
  AND up.active = true
  AND cm.preset_id IS NULL;
