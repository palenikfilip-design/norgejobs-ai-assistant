ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS professions jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.profiles
SET professions = jsonb_build_array(
  jsonb_build_object(
    'category', profession,
    'experienceLevel', experience_level
  )
)
WHERE professions = '[]'::jsonb
  AND coalesce(profession, '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles (user_id);