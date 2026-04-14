
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  gender TEXT,
  age INTEGER,
  country TEXT NOT NULL DEFAULT '',
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  profession TEXT NOT NULL DEFAULT '',
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience_level TEXT NOT NULL DEFAULT 'any',
  work_experience TEXT NOT NULL DEFAULT '',
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  personality TEXT,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  has_completed_onboarding BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Search presets table
CREATE TABLE public.user_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  preferred_job_type TEXT NOT NULL DEFAULT 'Full-time',
  preferred_countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  salary_min NUMERIC NOT NULL DEFAULT 0,
  salary_max NUMERIC NOT NULL DEFAULT 0,
  housing_preference BOOLEAN NOT NULL DEFAULT false,
  desired_bonuses JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_weights JSONB NOT NULL DEFAULT '{"skills":40,"location":20,"salary":20,"jobType":10,"bonus":10}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own presets" ON public.user_presets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own presets" ON public.user_presets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own presets" ON public.user_presets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own presets" ON public.user_presets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER user_presets_updated_at BEFORE UPDATE ON public.user_presets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
