
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_of_origin text,
  ADD COLUMN IF NOT EXISTS current_residence text,
  ADD COLUMN IF NOT EXISTS residence_since date,
  ADD COLUMN IF NOT EXISTS cultural_context jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Cultural context computation function
CREATE OR REPLACE FUNCTION public.compute_cultural_context(
  origin text,
  residence text,
  since date
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  years_in_residence numeric;
BEGIN
  IF origin IS NULL AND residence IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF origin IS NULL OR residence IS NULL OR origin = residence THEN
    RETURN jsonb_build_object(COALESCE(origin, residence), 100);
  END IF;

  IF since IS NULL THEN
    RETURN jsonb_build_object(origin, 80, residence, 20);
  END IF;

  years_in_residence := EXTRACT(EPOCH FROM (now() - since::timestamptz)) / (365.25 * 86400);

  IF years_in_residence >= 7 THEN
    RETURN jsonb_build_object(residence, 100);
  ELSIF years_in_residence >= 3 THEN
    RETURN jsonb_build_object(origin, 20, residence, 80);
  ELSIF years_in_residence >= 1 THEN
    RETURN jsonb_build_object(origin, 50, residence, 50);
  ELSE
    RETURN jsonb_build_object(origin, 80, residence, 20);
  END IF;
END;
$$;

-- Backfill for palenik.filip@gmail.com
UPDATE public.profiles p
SET
  country_of_origin = COALESCE(p.country_of_origin, NULLIF(p.country, '')),
  current_residence = COALESCE(p.current_residence, NULLIF(p.country, '')),
  cultural_context = CASE WHEN p.cultural_context = '{}'::jsonb THEN '{"CZ": 100}'::jsonb ELSE p.cultural_context END
FROM auth.users u
WHERE u.id = p.user_id AND u.email = 'palenik.filip@gmail.com';

-- 2. country_context table
CREATE TABLE IF NOT EXISTS public.country_context (
  country_code text PRIMARY KEY,
  country_name text NOT NULL,
  region text NOT NULL CHECK (region IN ('EU-East','EU-North','EU-West','EU-South','UK-IE','NorthAmerica','AsiaPacific','MiddleEast','LatinAmerica','Africa','Remote')),
  continent text NOT NULL,
  avg_salary_eur integer NOT NULL,
  cost_of_living_index integer NOT NULL,
  languages_spoken jsonb NOT NULL DEFAULT '[]'::jsonb,
  expat_friendliness integer NOT NULL CHECK (expat_friendliness BETWEEN 0 AND 100),
  work_visa_difficulty text NOT NULL CHECK (work_visa_difficulty IN ('easy','medium','hard','n/a')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.country_context TO authenticated;
GRANT SELECT ON public.country_context TO anon;
GRANT ALL ON public.country_context TO service_role;

ALTER TABLE public.country_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view country context"
  ON public.country_context FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage country context"
  ON public.country_context FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed country_context
INSERT INTO public.country_context (country_code, country_name, region, continent, avg_salary_eur, cost_of_living_index, languages_spoken, expat_friendliness, work_visa_difficulty) VALUES
('CZ','Czech Republic','EU-East','Europe',1500,100,'["cs","en"]'::jsonb,60,'easy'),
('SK','Slovakia','EU-East','Europe',1400,95,'["sk","cs","en"]'::jsonb,65,'easy'),
('PL','Poland','EU-East','Europe',1600,105,'["pl","en"]'::jsonb,55,'easy'),
('HU','Hungary','EU-East','Europe',1450,90,'["hu","en","de"]'::jsonb,45,'easy'),
('RO','Romania','EU-East','Europe',1200,85,'["ro","en","de"]'::jsonb,50,'easy'),
('DE','Germany','EU-West','Europe',3100,150,'["de","en"]'::jsonb,70,'easy'),
('AT','Austria','EU-West','Europe',2900,145,'["de","en"]'::jsonb,70,'easy'),
('CH','Switzerland','EU-West','Europe',5800,220,'["de","fr","it","en"]'::jsonb,40,'hard'),
('NL','Netherlands','EU-West','Europe',3000,155,'["nl","en"]'::jsonb,80,'easy'),
('BE','Belgium','EU-West','Europe',2700,140,'["nl","fr","en"]'::jsonb,70,'easy'),
('FR','France','EU-West','Europe',2400,135,'["fr","en"]'::jsonb,50,'easy'),
('NO','Norway','EU-North','Europe',4200,220,'["no","en"]'::jsonb,75,'medium'),
('SE','Sweden','EU-North','Europe',3500,175,'["sv","en"]'::jsonb,80,'easy'),
('DK','Denmark','EU-North','Europe',3800,180,'["da","en"]'::jsonb,75,'easy'),
('FI','Finland','EU-North','Europe',3200,145,'["fi","sv","en"]'::jsonb,65,'easy'),
('IS','Iceland','EU-North','Europe',3900,200,'["is","en"]'::jsonb,60,'medium'),
('EE','Estonia','EU-North','Europe',1800,110,'["et","en","ru"]'::jsonb,75,'easy'),
('IT','Italy','EU-South','Europe',2000,110,'["it","en"]'::jsonb,50,'easy'),
('ES','Spain','EU-South','Europe',1800,100,'["es","en"]'::jsonb,60,'easy'),
('PT','Portugal','EU-South','Europe',1500,95,'["pt","en"]'::jsonb,65,'easy'),
('GR','Greece','EU-South','Europe',1300,90,'["el","en"]'::jsonb,55,'easy'),
('MT','Malta','EU-South','Europe',1900,110,'["mt","en"]'::jsonb,75,'easy'),
('UK','United Kingdom','UK-IE','Europe',3300,160,'["en"]'::jsonb,65,'hard'),
('IE','Ireland','UK-IE','Europe',3500,165,'["en","ga"]'::jsonb,75,'medium'),
('US','United States','NorthAmerica','NorthAmerica',4500,170,'["en"]'::jsonb,50,'hard'),
('CA','Canada','NorthAmerica','NorthAmerica',3800,145,'["en","fr"]'::jsonb,80,'medium'),
('AU','Australia','AsiaPacific','Oceania',4000,160,'["en"]'::jsonb,75,'medium'),
('NZ','New Zealand','AsiaPacific','Oceania',3400,150,'["en"]'::jsonb,75,'medium'),
('AE','UAE','MiddleEast','Asia',3500,130,'["ar","en"]'::jsonb,60,'medium'),
('SA','Saudi Arabia','MiddleEast','Asia',3200,110,'["ar","en"]'::jsonb,35,'hard'),
('JP','Japan','AsiaPacific','Asia',3000,130,'["ja","en"]'::jsonb,30,'hard'),
('SG','Singapore','AsiaPacific','Asia',4200,165,'["en","zh","ms"]'::jsonb,60,'hard'),
('REMOTE','Remote','Remote','Global',2500,100,'["en"]'::jsonb,90,'n/a')
ON CONFLICT (country_code) DO NOTHING;

-- 3. Extend public_jobs
ALTER TABLE public.public_jobs
  ADD COLUMN IF NOT EXISTS salary_normalized_eur integer,
  ADD COLUMN IF NOT EXISTS language_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expat_openness text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS skill_level text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS trust_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archiles_confidence integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS archiles_notes text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

-- Allow admin writes to public_jobs (service role policy already exists)
CREATE POLICY "Admins manage public jobs"
  ON public.public_jobs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. archiles_decisions
CREATE TABLE IF NOT EXISTS public.archiles_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.public_jobs(id) ON DELETE CASCADE,
  decision_type text NOT NULL,
  archiles_choice jsonb NOT NULL,
  admin_choice jsonb,
  admin_id uuid,
  confidence integer NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archiles_decisions TO authenticated;
GRANT ALL ON public.archiles_decisions TO service_role;

ALTER TABLE public.archiles_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage archiles decisions"
  ON public.archiles_decisions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. archiles_autonomy
CREATE TABLE IF NOT EXISTS public.archiles_autonomy (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  autonomy_level integer NOT NULL DEFAULT 0,
  auto_publish_threshold integer NOT NULL DEFAULT 90,
  auto_source_add boolean NOT NULL DEFAULT false,
  auto_delete_dead boolean NOT NULL DEFAULT true,
  auto_recategorize boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archiles_autonomy TO authenticated;
GRANT ALL ON public.archiles_autonomy TO service_role;

ALTER TABLE public.archiles_autonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage archiles autonomy"
  ON public.archiles_autonomy FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.archiles_autonomy (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
