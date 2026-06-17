
ALTER TABLE public.public_jobs ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.job_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_url text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_url, user_id, view_date)
);

GRANT SELECT, INSERT ON public.job_views TO authenticated;
GRANT ALL ON public.job_views TO service_role;

ALTER TABLE public.job_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own job views"
  ON public.job_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own job views"
  ON public.job_views FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_job_views_url ON public.job_views(job_url);

CREATE OR REPLACE FUNCTION public.register_job_view(p_job_url text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer := 0;
  v_count integer;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    SELECT view_count INTO v_count FROM public.public_jobs WHERE url = p_job_url LIMIT 1;
    RETURN COALESCE(v_count, 0);
  END IF;

  INSERT INTO public.job_views (job_url, user_id)
  VALUES (p_job_url, v_uid)
  ON CONFLICT (job_url, user_id, view_date) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    UPDATE public.public_jobs
    SET view_count = view_count + 1
    WHERE url = p_job_url
    RETURNING view_count INTO v_count;
  ELSE
    SELECT view_count INTO v_count FROM public.public_jobs WHERE url = p_job_url LIMIT 1;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_job_view(text) TO authenticated;
