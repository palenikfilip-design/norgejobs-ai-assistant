
CREATE TABLE public.job_portals_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  country text,
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  portal_type text,
  job_categories text,
  languages text,
  api_info text,
  scraping_terms text,
  recommended_approach text,
  priority integer DEFAULT 0,
  avg_salary text,
  notes text,
  housing_included text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_portals_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view portals catalog"
ON public.job_portals_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage portals catalog"
ON public.job_portals_catalog FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role manages portals catalog"
ON public.job_portals_catalog FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_job_portals_catalog_updated
BEFORE UPDATE ON public.job_portals_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_job_portals_catalog_country ON public.job_portals_catalog(country);
CREATE INDEX idx_job_portals_catalog_category ON public.job_portals_catalog(category);
