ALTER TABLE public.employer_jobs
  ADD COLUMN contact_options text[] NOT NULL DEFAULT ARRAY['cv','message']::text[],
  ADD COLUMN contact_email text,
  ADD COLUMN closed_at timestamptz;
ALTER TABLE public.employer_jobs ADD CONSTRAINT employer_jobs_contact_options_check
  CHECK (cardinality(contact_options) >= 1 AND contact_options <@ ARRAY['cv','message','email']::text[]);
UPDATE public.employer_jobs SET closed_at = updated_at WHERE status IN ('closed','expired') AND closed_at IS NULL;

CREATE OR REPLACE FUNCTION public.employer_jobs_set_closed_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('closed','expired') THEN
    IF TG_OP = 'INSERT' OR OLD.status NOT IN ('closed','expired') OR OLD.closed_at IS NULL THEN
      NEW.closed_at := now();
    ELSE NEW.closed_at := OLD.closed_at; END IF;
  ELSE NEW.closed_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER employer_jobs_set_closed_at BEFORE INSERT OR UPDATE ON public.employer_jobs
  FOR EACH ROW EXECUTE FUNCTION public.employer_jobs_set_closed_at();

-- contact options (never the email) go to the public catalog copy
CREATE OR REPLACE FUNCTION public.employer_jobs_sync_contact_options()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.public_job_id IS NOT NULL THEN
    UPDATE public.public_jobs
      SET raw_data = (coalesce(raw_data,'{}'::jsonb) - 'contact_email') || jsonb_build_object('contact_options', to_jsonb(NEW.contact_options))
      WHERE id = NEW.public_job_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER employer_jobs_sync_contact_options AFTER INSERT OR UPDATE ON public.employer_jobs
  FOR EACH ROW EXECUTE FUNCTION public.employer_jobs_sync_contact_options();
UPDATE public.public_jobs p SET raw_data = coalesce(p.raw_data,'{}'::jsonb) || jsonb_build_object('contact_options', to_jsonb(ej.contact_options))
  FROM public.employer_jobs ej WHERE ej.public_job_id = p.id;

-- applications
CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_job_id uuid NOT NULL REFERENCES public.employer_jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  applicant_user_id uuid NOT NULL,
  method text NOT NULL CHECK (method IN ('cv','message')),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  cv_id uuid REFERENCES public.user_cvs(id) ON DELETE SET NULL,
  cv_snapshot jsonb,
  applicant_name text,
  applicant_email text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','rejected','shortlisted')),
  gdpr_consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employer_job_id, applicant_user_id)
);
CREATE INDEX job_applications_company_idx ON public.job_applications(company_id, created_at DESC);
CREATE INDEX job_applications_applicant_idx ON public.job_applications(applicant_user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.job_applications TO authenticated;
GRANT UPDATE (status) ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applicants read own applications" ON public.job_applications FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());
CREATE POLICY "Employers read applications to own offers" ON public.job_applications FOR SELECT TO authenticated
  USING (public.owns_company(company_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Applicants create own applications" ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_user_id = auth.uid());
CREATE POLICY "Employers update application status" ON public.job_applications FOR UPDATE TO authenticated
  USING (public.owns_company(company_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.owns_company(company_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Applicants withdraw own applications" ON public.job_applications FOR DELETE TO authenticated
  USING (applicant_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.job_applications_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _j public.employer_jobs; _c public.companies; _cv public.user_cvs;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  NEW.applicant_user_id := auth.uid();
  SELECT * INTO _j FROM public.employer_jobs WHERE id = NEW.employer_job_id;
  IF _j.id IS NULL OR _j.status <> 'published' OR _j.is_reported_hidden THEN RAISE EXCEPTION 'offer_not_open'; END IF;
  SELECT * INTO _c FROM public.companies WHERE id = _j.company_id;
  IF _c.status <> 'active' OR _c.approved_at IS NULL THEN RAISE EXCEPTION 'company_not_approved'; END IF;
  IF _c.user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_apply_to_own_offer'; END IF;
  IF NOT (NEW.method = ANY(_j.contact_options)) THEN RAISE EXCEPTION 'method_not_accepted'; END IF;
  NEW.company_id := _j.company_id;
  IF NEW.method = 'cv' THEN
    SELECT * INTO _cv FROM public.user_cvs WHERE id = NEW.cv_id AND user_id = auth.uid();
    IF _cv.id IS NULL THEN RAISE EXCEPTION 'cv_required'; END IF;
    NEW.cv_snapshot := to_jsonb(_cv) - 'user_id' - 'id' - 'created_at' - 'updated_at';
  ELSE
    NEW.cv_id := NULL; NEW.cv_snapshot := NULL;
    IF coalesce(btrim(NEW.note),'') = '' THEN RAISE EXCEPTION 'message_required'; END IF;
  END IF;
  SELECT email INTO NEW.applicant_email FROM auth.users WHERE id = auth.uid();
  SELECT nullif(btrim(full_name),'') INTO NEW.applicant_name FROM public.profiles WHERE user_id = auth.uid();
  IF NEW.applicant_name IS NULL AND _cv.id IS NOT NULL THEN NEW.applicant_name := nullif(btrim(_cv.full_name),''); END IF;
  NEW.status := 'new'; NEW.gdpr_consent_at := now(); NEW.created_at := now(); NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER job_applications_before_insert BEFORE INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.job_applications_before_insert();
CREATE TRIGGER job_applications_updated_at BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- email reveals (stats only)
CREATE TABLE public.employer_job_email_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_job_id uuid NOT NULL REFERENCES public.employer_jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  revealed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employer_job_email_reveals_job_idx ON public.employer_job_email_reveals(employer_job_id);
GRANT SELECT ON public.employer_job_email_reveals TO authenticated;
GRANT ALL ON public.employer_job_email_reveals TO service_role;
ALTER TABLE public.employer_job_email_reveals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employers read reveals of own offers" ON public.employer_job_email_reveals FOR SELECT TO authenticated
  USING (public.owns_company(company_id) OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_employer_job_contact_email(p_job_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _j public.employer_jobs; _c public.companies; _email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _j FROM public.employer_jobs WHERE id = p_job_id;
  IF _j.id IS NULL OR _j.status <> 'published' OR _j.is_reported_hidden OR NOT ('email' = ANY(_j.contact_options)) THEN RETURN NULL; END IF;
  SELECT * INTO _c FROM public.companies WHERE id = _j.company_id;
  IF _c.status <> 'active' OR _c.approved_at IS NULL THEN RETURN NULL; END IF;
  _email := coalesce(nullif(btrim(_j.contact_email),''), nullif(btrim(_c.contact_email),''));
  IF _email IS NOT NULL THEN
    INSERT INTO public.employer_job_email_reveals (employer_job_id, company_id, user_id) VALUES (_j.id, _c.id, auth.uid());
  END IF;
  RETURN _email;
END $$;
REVOKE ALL ON FUNCTION public.get_employer_job_contact_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employer_job_contact_email(uuid) TO authenticated;

-- GDPR cleanup
CREATE OR REPLACE FUNCTION public.cleanup_old_job_applications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.job_applications a USING public.employer_jobs j
   WHERE a.employer_job_id = j.id AND j.closed_at IS NOT NULL AND j.closed_at < now() - interval '6 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_old_job_applications() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('cleanup-old-job-applications', '30 3 * * 0', 'SELECT public.cleanup_old_job_applications()');