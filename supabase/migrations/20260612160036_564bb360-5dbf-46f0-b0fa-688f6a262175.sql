CREATE TABLE public.user_cvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template text NOT NULL DEFAULT 'modern',
  title text NOT NULL DEFAULT 'Můj životopis',
  full_name text,
  headline text,
  email text,
  phone text,
  location text,
  summary text,
  work_experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_cvs TO authenticated;
GRANT ALL ON public.user_cvs TO service_role;

ALTER TABLE public.user_cvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cvs" ON public.user_cvs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cvs" ON public.user_cvs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cvs" ON public.user_cvs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own cvs" ON public.user_cvs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_cvs_updated_at BEFORE UPDATE ON public.user_cvs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX user_cvs_user_id_idx ON public.user_cvs(user_id);