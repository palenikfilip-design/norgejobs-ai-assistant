CREATE TABLE public.user_cover_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id text,
  job_title text NOT NULL,
  company text,
  location text,
  language text NOT NULL DEFAULT 'cs',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_cover_letters TO authenticated;
GRANT ALL ON public.user_cover_letters TO service_role;

ALTER TABLE public.user_cover_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cover letters" ON public.user_cover_letters FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cover letters" ON public.user_cover_letters FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cover letters" ON public.user_cover_letters FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own cover letters" ON public.user_cover_letters FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX user_cover_letters_user_id_idx ON public.user_cover_letters(user_id);

CREATE TRIGGER user_cover_letters_updated_at
BEFORE UPDATE ON public.user_cover_letters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();