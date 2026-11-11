CREATE TYPE public.employer_job_status AS ENUM ('draft','pending_review','published','closed','expired');

ALTER TABLE public.public_jobs ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX idx_public_jobs_company_id ON public.public_jobs(company_id) WHERE company_id IS NOT NULL;

CREATE TABLE public.employer_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  public_job_id uuid REFERENCES public.public_jobs(id) ON DELETE SET NULL,
  status public.employer_job_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  job_type text NOT NULL,
  start_date date,
  start_immediately boolean NOT NULL DEFAULT false,
  duration text NOT NULL,
  salary_amount numeric NOT NULL,
  salary_currency text NOT NULL DEFAULT 'EUR',
  salary_period text NOT NULL DEFAULT 'month' CHECK (salary_period IN ('hour','month')),
  accommodation_provided boolean NOT NULL DEFAULT false,
  accommodation_cost numeric,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  experience text,
  working_hours text,
  food_provided boolean,
  transport_provided boolean,
  description text,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  expiry_date date,
  completeness_score integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_employer_jobs_company ON public.employer_jobs(company_id);
CREATE INDEX idx_employer_jobs_expiry ON public.employer_jobs(expiry_date) WHERE status = 'published';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employer_jobs TO authenticated;
GRANT ALL ON public.employer_jobs TO service_role;
ALTER TABLE public.employer_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_company(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND user_id = auth.uid())
$$;

CREATE POLICY "Owner reads own jobs" ON public.employer_jobs FOR SELECT TO authenticated
  USING (public.owns_company(company_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Employer inserts own jobs" ON public.employer_jobs FOR INSERT TO authenticated
  WITH CHECK (public.owns_company(company_id) AND public.has_role(auth.uid(),'employer'));
CREATE POLICY "Owner updates own jobs" ON public.employer_jobs FOR UPDATE TO authenticated
  USING (public.owns_company(company_id)) WITH CHECK (public.owns_company(company_id));
CREATE POLICY "Owner deletes own jobs" ON public.employer_jobs FOR DELETE TO authenticated
  USING (public.owns_company(company_id));
CREATE POLICY "Admin manages jobs" ON public.employer_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.employer_job_completeness(j public.employer_jobs)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT 60
    + CASE WHEN jsonb_array_length(coalesce(j.languages,'[]'::jsonb)) > 0 THEN 8 ELSE 0 END
    + CASE WHEN coalesce(j.experience,'') <> '' THEN 5 ELSE 0 END
    + CASE WHEN coalesce(j.working_hours,'') <> '' THEN 5 ELSE 0 END
    + CASE WHEN j.food_provided IS NOT NULL THEN 4 ELSE 0 END
    + CASE WHEN j.transport_provided IS NOT NULL THEN 4 ELSE 0 END
    + CASE WHEN length(coalesce(j.description,'')) >= 150 THEN 8 ELSE 0 END
    + CASE WHEN jsonb_array_length(coalesce(j.benefits,'[]'::jsonb)) > 0 THEN 6 ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.deactivate_employer_public_job(_public_job_id uuid, _reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.public_jobs SET is_active = false, deactivated_at = now(), deactivation_reason = _reason
  WHERE id = _public_job_id AND is_active;
$$;
REVOKE EXECUTE ON FUNCTION public.deactivate_employer_public_job(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_employer_public_job(j public.employer_jobs)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.companies;
  _monthly numeric;
  _rate numeric;
  _accom text;
  _benefits jsonb;
  _id uuid;
BEGIN
  SELECT * INTO c FROM public.companies WHERE id = j.company_id;
  _rate := CASE upper(j.salary_currency) WHEN 'EUR' THEN 1 WHEN 'CZK' THEN 0.04 WHEN 'CHF' THEN 1.05
    WHEN 'NOK' THEN 0.085 WHEN 'SEK' THEN 0.087 WHEN 'DKK' THEN 0.134 WHEN 'GBP' THEN 1.17 WHEN 'PLN' THEN 0.23
    WHEN 'USD' THEN 0.92 ELSE NULL END;
  _monthly := j.salary_amount * CASE WHEN j.salary_period = 'hour' THEN 173 ELSE 1 END;
  _accom := CASE WHEN NOT j.accommodation_provided THEN 'none'
                 WHEN coalesce(j.accommodation_cost,0) = 0 THEN 'included' ELSE 'available' END;
  _benefits := coalesce(j.benefits,'[]'::jsonb)
    || CASE WHEN j.food_provided THEN '["food"]'::jsonb ELSE '[]'::jsonb END
    || CASE WHEN j.transport_provided THEN '["transport"]'::jsonb ELSE '[]'::jsonb END;

  INSERT INTO public.public_jobs AS p (
    source_portal, external_id, url, company_id, company, title, country, location, job_type,
    salary_min, salary_max, currency, salary, salary_normalized_eur, description, accommodation, benefits,
    language_requirements, is_seasonal, trust_score, needs_review, enriched_at, data_completeness,
    posted_at, raw_data, is_active, deactivated_at, deactivation_reason)
  VALUES (
    'employer', j.id::text, '/company/' || c.slug || '?job=' || j.id, c.id, c.name, j.title, j.country,
    j.city || ', ' || j.country, j.job_type, j.salary_amount, j.salary_amount, upper(j.salary_currency),
    j.salary_amount::text || ' ' || upper(j.salary_currency) || CASE WHEN j.salary_period='hour' THEN ' / h' ELSE ' / měsíc' END,
    CASE WHEN _rate IS NULL THEN NULL ELSE round(_monthly * _rate)::int END,
    j.description, _accom, _benefits, coalesce(j.languages,'[]'::jsonb), j.job_type = 'seasonal',
    CASE c.trust_level WHEN 'gold' THEN 90 WHEN 'verified' THEN 80 ELSE 60 END,
    false, now(), CASE WHEN j.completeness_score >= 80 THEN 'complete' ELSE 'partial' END,
    coalesce(j.published_at, now()),
    jsonb_build_object('employer_job_id', j.id, 'duration', j.duration, 'start_date', j.start_date,
      'start_immediately', j.start_immediately, 'working_hours', j.working_hours, 'experience', j.experience,
      'accommodation_cost', j.accommodation_cost, 'salary_period', j.salary_period, 'expiry_date', j.expiry_date),
    true, NULL, NULL)
  ON CONFLICT (source_portal, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
    url = EXCLUDED.url, company = EXCLUDED.company, title = EXCLUDED.title, country = EXCLUDED.country,
    location = EXCLUDED.location, job_type = EXCLUDED.job_type, salary_min = EXCLUDED.salary_min,
    salary_max = EXCLUDED.salary_max, currency = EXCLUDED.currency, salary = EXCLUDED.salary,
    salary_normalized_eur = EXCLUDED.salary_normalized_eur, description = EXCLUDED.description,
    accommodation = EXCLUDED.accommodation, benefits = EXCLUDED.benefits,
    language_requirements = EXCLUDED.language_requirements, is_seasonal = EXCLUDED.is_seasonal,
    trust_score = EXCLUDED.trust_score, data_completeness = EXCLUDED.data_completeness,
    raw_data = EXCLUDED.raw_data, is_active = true, deactivated_at = NULL, deactivation_reason = NULL,
    skill_class = NULL
  RETURNING p.id INTO _id;
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_employer_public_job(public.employer_jobs) FROM PUBLIC, anon, authenticated;

-- BEFORE trigger: status rules, defaults, completeness, sync of public copy.
CREATE OR REPLACE FUNCTION public.employer_jobs_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _privileged boolean := auth.uid() IS NULL OR auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin');
  _trust public.company_trust_level;
  _content_changed boolean := false;
BEGIN
  IF NEW.expiry_date IS NULL THEN NEW.expiry_date := (now() + interval '60 days')::date; END IF;
  IF NEW.start_immediately THEN NEW.start_date := NULL;
  ELSIF NEW.start_date IS NULL THEN RAISE EXCEPTION 'start_date required unless start_immediately'; END IF;
  NEW.completeness_score := public.employer_job_completeness(NEW);
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' THEN
    NEW.company_id := OLD.company_id;
    IF NOT _privileged THEN NEW.public_job_id := OLD.public_job_id; NEW.published_at := OLD.published_at; END IF;
    _content_changed := (to_jsonb(NEW) - ARRAY['status','updated_at','completeness_score','public_job_id','published_at'])
                     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at','completeness_score','public_job_id','published_at']);
  ELSIF NOT _privileged THEN
    NEW.public_job_id := NULL; NEW.published_at := NULL;
  END IF;

  IF NOT _privileged THEN
    IF TG_OP = 'INSERT' AND NEW.status NOT IN ('draft','pending_review') THEN
      RAISE EXCEPTION 'Employers can only create draft or pending_review offers';
    END IF;
    -- Unchanged status is always allowed; changed status limited to employer-allowed values.
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('draft','pending_review','closed') THEN
      RAISE EXCEPTION 'Employers cannot set status %', NEW.status;
    END IF;
    -- New companies: edits of a published offer go back to review; live copy stays until approval.
    IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status = 'published' AND _content_changed THEN
      SELECT trust_level INTO _trust FROM public.companies WHERE id = NEW.company_id;
      IF _trust = 'new' THEN NEW.status := 'pending_review'; END IF;
    END IF;
  END IF;

  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status <> 'published' OR _content_changed) THEN
    IF NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
    NEW.public_job_id := public.sync_employer_public_job(NEW);
  ELSIF NEW.status IN ('draft','closed','expired') AND NEW.public_job_id IS NOT NULL THEN
    PERFORM public.deactivate_employer_public_job(NEW.public_job_id, 'employer_' || NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER employer_jobs_before_write BEFORE INSERT OR UPDATE ON public.employer_jobs
  FOR EACH ROW EXECUTE FUNCTION public.employer_jobs_before_write();

CREATE OR REPLACE FUNCTION public.employer_jobs_after_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.public_job_id IS NOT NULL THEN
    PERFORM public.deactivate_employer_public_job(OLD.public_job_id, 'employer_deleted');
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER employer_jobs_after_delete AFTER DELETE ON public.employer_jobs
  FOR EACH ROW EXECUTE FUNCTION public.employer_jobs_after_delete();

CREATE OR REPLACE FUNCTION public.companies_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.public_jobs SET is_active = false, deactivated_at = now(), deactivation_reason = 'company_deleted'
  WHERE company_id = OLD.id AND is_active;
  RETURN OLD;
END;
$$;
CREATE TRIGGER companies_before_delete BEFORE DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.companies_before_delete();

CREATE OR REPLACE FUNCTION public.expire_employer_jobs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.employer_jobs SET status = 'expired'
  WHERE status IN ('published','pending_review') AND expiry_date < current_date;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.expire_employer_jobs() FROM PUBLIC, anon, authenticated;