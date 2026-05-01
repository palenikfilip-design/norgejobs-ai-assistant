CREATE TABLE public.cached_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  job_title text NOT NULL DEFAULT '',
  job_location text,
  job_country text,
  job_salary text,
  job_url text NOT NULL,
  source_portal text,
  score integer NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cached_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cached matches"
  ON public.cached_matches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own cached matches"
  ON public.cached_matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own cached matches"
  ON public.cached_matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own cached matches"
  ON public.cached_matches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX cached_matches_user_url_uidx
  ON public.cached_matches (user_id, job_url);

CREATE INDEX cached_matches_user_active_score_idx
  ON public.cached_matches (user_id, is_active, score DESC);