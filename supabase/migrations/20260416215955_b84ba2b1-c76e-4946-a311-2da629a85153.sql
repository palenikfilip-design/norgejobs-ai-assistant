-- 1. user_job_interactions
CREATE TABLE public.user_job_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('view','click','apply','save','reject','unsave')),
  time_spent INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_uji_user ON public.user_job_interactions(user_id, created_at DESC);
CREATE INDEX idx_uji_user_job ON public.user_job_interactions(user_id, job_id);

ALTER TABLE public.user_job_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own interactions" ON public.user_job_interactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own interactions" ON public.user_job_interactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own interactions" ON public.user_job_interactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. job_preferences (explicit)
CREATE TABLE public.job_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('favorite','top_pick','not_interested','applied','saved_for_later')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id, category)
);
CREATE INDEX idx_jp_user_cat ON public.job_preferences(user_id, category);

ALTER TABLE public.job_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own prefs" ON public.job_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prefs" ON public.job_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prefs" ON public.job_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own prefs" ON public.job_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER jp_updated BEFORE UPDATE ON public.job_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. job_snapshots (opt-in 📌 Keep Snapshot)
CREATE TABLE public.job_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  original_job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  description TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  currency TEXT,
  location TEXT,
  country TEXT,
  job_type TEXT,
  url TEXT,
  source TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  is_original_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, original_job_id)
);
CREATE INDEX idx_snap_user ON public.job_snapshots(user_id, created_at DESC);

ALTER TABLE public.job_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own snapshots" ON public.job_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own snapshots" ON public.job_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own snapshots" ON public.job_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own snapshots" ON public.job_snapshots FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER snap_updated BEFORE UPDATE ON public.job_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. user_preference_profile (derived)
CREATE TABLE public.user_preference_profile (
  user_id UUID PRIMARY KEY,
  preferred_salary_min NUMERIC,
  preferred_salary_max NUMERIC,
  salary_confidence NUMERIC DEFAULT 0,
  preferred_job_type TEXT,
  job_type_confidence NUMERIC DEFAULT 0,
  preferred_environment TEXT,
  environment_confidence NUMERIC DEFAULT 0,
  preferred_shift_type TEXT,
  shift_confidence NUMERIC DEFAULT 0,
  stress_tolerance NUMERIC,
  stress_confidence NUMERIC DEFAULT 0,
  isolation_preference NUMERIC,
  isolation_confidence NUMERIC DEFAULT 0,
  patterns JSONB DEFAULT '[]'::jsonb,
  conflicts JSONB DEFAULT '[]'::jsonb,
  last_computed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preference_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pref profile" ON public.user_preference_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pref profile" ON public.user_preference_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pref profile" ON public.user_preference_profile FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER upp_updated BEFORE UPDATE ON public.user_preference_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();