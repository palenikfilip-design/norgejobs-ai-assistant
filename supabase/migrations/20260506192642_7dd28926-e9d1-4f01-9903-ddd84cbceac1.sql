CREATE TABLE public.employer_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  ats_type text NOT NULL CHECK (ats_type IN ('greenhouse','lever','smartrecruiters','workday')),
  ats_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  country text,
  sector text,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employer_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view employer sources"
ON public.employer_sources FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages employer sources"
ON public.employer_sources FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_employer_sources_updated_at
BEFORE UPDATE ON public.employer_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.employer_sources (company_name, ats_type, ats_config, country, sector) VALUES
  ('Spotify', 'lever', '{"company":"spotify"}'::jsonb, 'SE', 'Tech'),
  ('Klarna', 'greenhouse', '{"company":"klarna"}'::jsonb, 'SE', 'Fintech'),
  ('N26', 'greenhouse', '{"company":"n26"}'::jsonb, 'DE', 'Fintech'),
  ('HelloFresh', 'greenhouse', '{"company":"hellofresh"}'::jsonb, 'DE', 'FoodTech');