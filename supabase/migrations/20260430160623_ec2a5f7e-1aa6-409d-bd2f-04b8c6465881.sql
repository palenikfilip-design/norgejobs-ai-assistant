-- Create job_matches table for learning (no job content stored)
CREATE TABLE public.job_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_url text NOT NULL,
  source_portal text NOT NULL,
  title text,
  location text,
  score integer NOT NULL,
  clicked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_matches_user ON public.job_matches(user_id, created_at DESC);

ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own matches" ON public.job_matches
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own matches" ON public.job_matches
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own matches" ON public.job_matches
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own matches" ON public.job_matches
  FOR DELETE TO authenticated USING (auth.uid() = user_id);