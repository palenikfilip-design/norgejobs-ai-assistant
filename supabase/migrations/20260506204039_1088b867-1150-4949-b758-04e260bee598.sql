
-- 1. job_sources table
CREATE TABLE public.job_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN (
    'portal_api','ats_greenhouse','ats_lever','ats_smartrecruiters',
    'ats_workday','ats_personio','rss_feed'
  )),
  tier int NOT NULL DEFAULT 2 CHECK (tier IN (1,2,3)),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  country text,
  sector text,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,
  last_error text,
  jobs_added_total int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_sources_active ON public.job_sources(is_active, tier, last_run_at);

ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view job sources"
  ON public.job_sources FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage job sources"
  ON public.job_sources FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages job sources"
  ON public.job_sources FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_job_sources_updated_at
  BEFORE UPDATE ON public.job_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. public_jobs.source_id
ALTER TABLE public.public_jobs
  ADD COLUMN source_id uuid REFERENCES public.job_sources(id) ON DELETE SET NULL;

CREATE INDEX idx_public_jobs_source_id ON public.public_jobs(source_id);

-- 3. Seed
INSERT INTO public.job_sources (name, source_type, tier, config, country, sector) VALUES
  -- Tier 1 portal APIs
  ('MPSV Czech Republic', 'portal_api', 1,
    '{"url":"https://portal.mpsv.cz/sz/local/services/EURESServices.svc/getOffers","field_map":{"title":"NAZEV_PRACOVNI_POZICE","location":"OBEC","salary":"MZDA_OD","url":"URL"}}'::jsonb,
    'Czech Republic', 'General'),
  ('EURES EU', 'portal_api', 1,
    '{"url":"https://ec.europa.eu/eures/eures-apps/searchengine/page/jv-search/search","field_map":{"title":"title","location":"locationName","url":"detailUrl"}}'::jsonb,
    'EU', 'General'),
  ('Arbeitsagentur DE', 'portal_api', 1,
    '{"url":"https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs","headers":{"X-API-Key":"jobboerse-jobsuche"},"field_map":{"title":"titel","location":"arbeitsort.ort","url":"refnr"}}'::jsonb,
    'Germany', 'General'),
  ('Arbetsförmedlingen SE', 'portal_api', 1,
    '{"url":"https://jobstream.api.jobtechdev.se/stream","field_map":{"title":"headline","location":"workplace_address.municipality","url":"webpage_url"}}'::jsonb,
    'Sweden', 'General'),
  ('NAV Norway', 'portal_api', 1,
    '{"url":"https://arbeidsplassen.nav.no/public-feed/api/v1/ads","token_required":true,"field_map":{"title":"title","location":"properties.location","url":"id"}}'::jsonb,
    'Norway', 'General'),

  -- Tier 2 ATS
  ('Spotify',   'ats_lever',          2, '{"company":"spotify"}'::jsonb,                                            'Sweden',      'Tech'),
  ('Klarna',    'ats_greenhouse',     2, '{"company":"klarna"}'::jsonb,                                             'Sweden',      'Fintech'),
  ('N26',       'ats_greenhouse',     2, '{"company":"n26"}'::jsonb,                                                'Germany',     'Fintech'),
  ('Booking.com','ats_workday',       2, '{"tenant":"booking","wd":"wd5","site":"BookingCom"}'::jsonb,              'Netherlands', 'Tech'),
  ('HelloFresh','ats_greenhouse',     2, '{"company":"hellofresh"}'::jsonb,                                         'Germany',     'FoodTech'),
  ('Equinor',   'ats_workday',        2, '{"tenant":"equinor","wd":"wd3","site":"EQNR"}'::jsonb,                    'Norway',      'Energy'),
  ('Atlassian', 'ats_lever',          2, '{"company":"atlassian"}'::jsonb,                                          'Australia',   'Tech'),
  ('Wise',      'ats_greenhouse',     2, '{"company":"wise"}'::jsonb,                                               'UK',          'Fintech');
