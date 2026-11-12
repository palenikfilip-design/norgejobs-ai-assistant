ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_note text,
  ADD COLUMN IF NOT EXISTS approved_jobs_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registration_number text;

ALTER TABLE public.employer_jobs
  ADD COLUMN IF NOT EXISTS rejection_note text,
  ADD COLUMN IF NOT EXISTS reports_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_reported_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_approved_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_privileged_writer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NULL OR auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin')
      OR coalesce(current_setting('app.leslie_privileged', true), '') = 'on'
$$;

-- Companies: protect trust/approval/suspension columns
CREATE OR REPLACE FUNCTION public.protect_company_trust_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_privileged_writer() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.trust_level := 'new'; NEW.approved_at := NULL; NEW.rejection_note := NULL; NEW.approved_jobs_count := 0;
      IF NEW.status = 'suspended' THEN NEW.status := 'draft'; END IF;
    ELSE
      NEW.trust_level := OLD.trust_level;
      NEW.approved_at := OLD.approved_at;
      NEW.rejection_note := OLD.rejection_note;
      NEW.approved_jobs_count := OLD.approved_jobs_count;
      IF OLD.status = 'suspended' OR NEW.status = 'suspended' THEN NEW.status := OLD.status; END IF;
      IF NEW.status = 'active' AND OLD.status <> 'active' THEN NEW.rejection_note := NULL; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.companies_after_suspend()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'suspended' AND OLD.status IS DISTINCT FROM 'suspended' THEN
    PERFORM set_config('app.leslie_privileged','on',true);
    UPDATE public.employer_jobs SET status = 'closed'
      WHERE company_id = NEW.id AND status IN ('published','pending_review');
    PERFORM set_config('app.leslie_privileged','off',true);
    UPDATE public.public_jobs SET is_active = false, deactivated_at = now(), deactivation_reason = 'company_suspended'
      WHERE company_id = NEW.id AND is_active;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS companies_after_suspend ON public.companies;
CREATE TRIGGER companies_after_suspend AFTER UPDATE OF status ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.companies_after_suspend();

-- Employer jobs: status rights, protected columns, approval counting, company approval gate
CREATE OR REPLACE FUNCTION public.employer_jobs_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _privileged boolean := public.is_privileged_writer();
  _c public.companies;
  _content_changed boolean := false;
  _going_live boolean;
  _meta text[] := ARRAY['status','updated_at','completeness_score','public_job_id','published_at',
                        'reports_count','is_reported_hidden','rejection_note','first_approved_at'];
BEGIN
  IF NEW.expiry_date IS NULL THEN NEW.expiry_date := (now() + interval '60 days')::date; END IF;
  IF NEW.start_immediately THEN NEW.start_date := NULL;
  ELSIF NEW.start_date IS NULL AND NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'start_date required unless start_immediately';
  END IF;
  IF NEW.status IN ('pending_review','published') AND coalesce(NEW.category,'') = '' THEN
    RAISE EXCEPTION 'category required';
  END IF;
  NEW.completeness_score := public.employer_job_completeness(NEW);
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' THEN
    NEW.company_id := OLD.company_id;
    IF NOT _privileged THEN
      NEW.public_job_id := OLD.public_job_id; NEW.published_at := OLD.published_at;
      NEW.reports_count := OLD.reports_count; NEW.is_reported_hidden := OLD.is_reported_hidden;
      NEW.rejection_note := OLD.rejection_note; NEW.first_approved_at := OLD.first_approved_at;
    END IF;
    _content_changed := (to_jsonb(NEW) - _meta) IS DISTINCT FROM (to_jsonb(OLD) - _meta);
  ELSIF NOT _privileged THEN
    NEW.public_job_id := NULL; NEW.published_at := NULL; NEW.reports_count := 0;
    NEW.is_reported_hidden := false; NEW.rejection_note := NULL; NEW.first_approved_at := NULL;
  END IF;

  SELECT * INTO _c FROM public.companies WHERE id = NEW.company_id;

  IF NOT _privileged THEN
    IF TG_OP = 'INSERT' AND NEW.status NOT IN ('draft','pending_review') THEN
      RAISE EXCEPTION 'Employers can only create draft or pending_review offers';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('draft','pending_review','closed') THEN
      RAISE EXCEPTION 'Employers cannot set status %', NEW.status;
    END IF;
    IF _c.status = 'suspended' AND NEW.status IN ('pending_review','published')
       AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR _content_changed) THEN
      RAISE EXCEPTION 'company_suspended';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status = 'published' AND _content_changed
       AND _c.trust_level = 'new' THEN
      NEW.status := 'pending_review';
    END IF;
    IF NEW.status = 'pending_review' AND (TG_OP = 'INSERT' OR OLD.status <> 'pending_review') THEN
      NEW.rejection_note := NULL;
    END IF;
  END IF;

  _going_live := NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status <> 'published');

  IF NEW.status = 'published' AND (_going_live OR _content_changed)
     AND (_c.status <> 'active' OR _c.approved_at IS NULL) THEN
    RAISE EXCEPTION 'company_not_approved' USING HINT = 'Approve the company before publishing its offers';
  END IF;

  IF _going_live AND NEW.first_approved_at IS NULL THEN
    NEW.first_approved_at := now();
    PERFORM set_config('app.leslie_privileged','on',true);
    UPDATE public.companies SET
      approved_jobs_count = approved_jobs_count + 1,
      trust_level = CASE WHEN trust_level = 'new' AND approved_jobs_count + 1 = 3 THEN 'verified'::public.company_trust_level ELSE trust_level END
    WHERE id = NEW.company_id;
    PERFORM set_config('app.leslie_privileged','off',true);
  END IF;

  IF NEW.status = 'published' AND NOT NEW.is_reported_hidden
     AND (_going_live OR _content_changed OR (TG_OP = 'UPDATE' AND OLD.is_reported_hidden)) THEN
    IF NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
    NEW.public_job_id := public.sync_employer_public_job(NEW);
  ELSIF NEW.public_job_id IS NOT NULL AND (NEW.status IN ('draft','closed','expired') OR NEW.is_reported_hidden) THEN
    PERFORM public.deactivate_employer_public_job(NEW.public_job_id,
      CASE WHEN NEW.is_reported_hidden THEN 'reported_auto_hidden' ELSE 'employer_' || NEW.status::text END);
  END IF;
  RETURN NEW;
END;
$$;

-- Public companies: only approved
CREATE OR REPLACE VIEW public.public_companies WITH (security_invoker = false) AS
SELECT id, name, slug, logo_url, country, description, website_url, instagram_url, trust_level,
       CASE WHEN show_contact_email THEN contact_email ELSE NULL END AS contact_email
FROM public.companies WHERE status = 'active' AND approved_at IS NOT NULL;
GRANT SELECT ON public.public_companies TO anon, authenticated;

-- Reports
CREATE TABLE public.job_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.public_jobs(id) ON DELETE CASCADE,
  employer_job_id uuid REFERENCES public.employer_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('invalid_info','upfront_fees','no_longer_available','scam','discrimination','other')),
  details text CHECK (details IS NULL OR length(details) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT, INSERT ON public.job_reports TO authenticated;
GRANT ALL ON public.job_reports TO service_role;
ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reports" ON public.job_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users report as themselves" ON public.job_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin manages reports" ON public.job_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX job_reports_employer_job_idx ON public.job_reports(employer_job_id);

CREATE OR REPLACE FUNCTION public.job_reports_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.role() <> 'service_role' THEN NEW.user_id := auth.uid(); END IF;
  SELECT id INTO NEW.employer_job_id FROM public.employer_jobs WHERE public_job_id = NEW.job_id LIMIT 1;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER job_reports_before_insert BEFORE INSERT ON public.job_reports
  FOR EACH ROW EXECUTE FUNCTION public.job_reports_before_insert();

CREATE OR REPLACE FUNCTION public.job_reports_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.employer_job_id IS NULL THEN RETURN NEW; END IF;
  PERFORM set_config('app.leslie_privileged','on',true);
  UPDATE public.employer_jobs ej SET
    reports_count = ej.reports_count + 1,
    is_reported_hidden = ej.is_reported_hidden OR (ej.reports_count + 1 >= 2 AND
      (SELECT trust_level FROM public.companies c WHERE c.id = ej.company_id) = 'new')
  WHERE ej.id = NEW.employer_job_id;
  PERFORM set_config('app.leslie_privileged','off',true);
  RETURN NEW;
END;
$$;
CREATE TRIGGER job_reports_after_insert AFTER INSERT ON public.job_reports
  FOR EACH ROW EXECUTE FUNCTION public.job_reports_after_insert();