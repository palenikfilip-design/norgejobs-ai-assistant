ALTER TABLE public.employer_jobs ADD COLUMN category text, ADD COLUMN skill_class public.job_skill_class;
ALTER TABLE public.employer_jobs ADD CONSTRAINT employer_jobs_category_valid CHECK (category IS NULL OR category IN
  ('Gastronomy','SkiResort','Agriculture','Construction','Manufacturing','Logistics','Transport','Healthcare','Education','Office','Sales','IT','Marine','AuPair','Management','Other'));
ALTER TABLE public.employer_jobs ADD CONSTRAINT employer_jobs_category_required CHECK (status = 'draft' OR category IS NOT NULL) NOT VALID;
ALTER TABLE public.employer_jobs ADD CONSTRAINT employer_jobs_skill_class_valid CHECK (skill_class IS NULL OR skill_class <> 'unknown');

CREATE OR REPLACE FUNCTION public.sync_employer_public_job(j public.employer_jobs)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.companies; _monthly numeric; _rate numeric; _accom text; _benefits jsonb; _id uuid;
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
    posted_at, raw_data, is_active, deactivated_at, deactivation_reason, category, display_category, skill_class)
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
    true, NULL, NULL, j.category, public.map_display_category(coalesce(j.category,'Other')), j.skill_class)
  ON CONFLICT (source_portal, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
    url = EXCLUDED.url, company = EXCLUDED.company, title = EXCLUDED.title, country = EXCLUDED.country,
    location = EXCLUDED.location, job_type = EXCLUDED.job_type, salary_min = EXCLUDED.salary_min,
    salary_max = EXCLUDED.salary_max, currency = EXCLUDED.currency, salary = EXCLUDED.salary,
    salary_normalized_eur = EXCLUDED.salary_normalized_eur, description = EXCLUDED.description,
    accommodation = EXCLUDED.accommodation, benefits = EXCLUDED.benefits,
    language_requirements = EXCLUDED.language_requirements, is_seasonal = EXCLUDED.is_seasonal,
    trust_score = EXCLUDED.trust_score, data_completeness = EXCLUDED.data_completeness,
    raw_data = EXCLUDED.raw_data, is_active = true, deactivated_at = NULL, deactivation_reason = NULL,
    category = EXCLUDED.category, display_category = EXCLUDED.display_category, skill_class = EXCLUDED.skill_class
  RETURNING p.id INTO _id;
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_employer_public_job(public.employer_jobs) FROM PUBLIC, anon, authenticated;