CREATE OR REPLACE FUNCTION public.employer_jobs_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _privileged boolean := auth.uid() IS NULL OR auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin');
  _trust public.company_trust_level;
  _content_changed boolean := false;
BEGIN
  IF NEW.expiry_date IS NULL THEN NEW.expiry_date := (now() + interval '60 days')::date; END IF;
  IF NEW.start_immediately THEN NEW.start_date := NULL;
  ELSIF NEW.start_date IS NULL AND NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'start_date required unless start_immediately';
  END IF;
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
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('draft','pending_review','closed') THEN
      RAISE EXCEPTION 'Employers cannot set status %', NEW.status;
    END IF;
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