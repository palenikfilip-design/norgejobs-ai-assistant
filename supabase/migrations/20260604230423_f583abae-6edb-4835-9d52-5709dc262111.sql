
-- PART 1 & 2: columns
ALTER TABLE public.public_jobs ADD COLUMN IF NOT EXISTS positions_available integer NOT NULL DEFAULT 1;
ALTER TABLE public.public_jobs ADD COLUMN IF NOT EXISTS display_category text NOT NULL DEFAULT 'other';

-- display_categories lookup
CREATE TABLE IF NOT EXISTS public.display_categories (
  id text PRIMARY KEY,
  label_cs text NOT NULL,
  label_en text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  sort_order integer NOT NULL
);

GRANT SELECT ON public.display_categories TO anon;
GRANT SELECT ON public.display_categories TO authenticated;
GRANT ALL ON public.display_categories TO service_role;

ALTER TABLE public.display_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view display categories"
  ON public.display_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage display categories"
  ON public.display_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.display_categories (id, label_cs, label_en, icon, color, sort_order) VALUES
  ('tech',          'IT a Tech',                   'IT and Tech',              '💻', '#1976D2', 1),
  ('hospitality',   'Hotely a Gastronomie',        'Hospitality',              '🏨', '#E91E63', 2),
  ('construction',  'Stavebnictví',                'Construction',             '🏗️', '#795548', 3),
  ('healthcare',    'Zdravotnictví',               'Healthcare',               '⚕️', '#00ACC1', 4),
  ('agriculture',   'Zemědělství a Rybářství',     'Agriculture and Fishing',  '🌾', '#558B2F', 5),
  ('maritime',      'Lodě a Cruise',               'Maritime and Cruise',      '🚢', '#0277BD', 6),
  ('ski_resort',    'Lyžařské resorty',            'Ski Resorts',              '⛷️', '#5C6BC0', 7),
  ('logistics',     'Doprava a Logistika',         'Transport and Logistics',  '🚛', '#F57C00', 8),
  ('office',        'Kancelář a Administrace',     'Office and Admin',         '📋', '#546E7A', 9),
  ('manufacturing', 'Výroba a Průmysl',            'Manufacturing',            '🏭', '#455A64', 10),
  ('sales',         'Obchod a Sales',              'Sales',                    '💼', '#7B1FA2', 11),
  ('education',     'Vzdělávání a Výzkum',         'Education and Research',   '🎓', '#6A1B9A', 12),
  ('aupair',        'Au-pair a Péče',              'Au-pair and Care',         '👨‍👩‍👧', '#D81B60', 13),
  ('other',         'Ostatní',                     'Other',                    '📂', '#616161', 99)
ON CONFLICT (id) DO NOTHING;

-- Helper function to map detailed category → display_category
CREATE OR REPLACE FUNCTION public.map_display_category(_cat text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_cat,''))
    WHEN 'gastronomy'    THEN 'hospitality'
    WHEN 'construction'  THEN 'construction'
    WHEN 'it'            THEN 'tech'
    WHEN 'healthcare'    THEN 'healthcare'
    WHEN 'agriculture'   THEN 'agriculture'
    WHEN 'skiresort'     THEN 'ski_resort'
    WHEN 'aupair'        THEN 'aupair'
    WHEN 'marine'        THEN 'maritime'
    WHEN 'logistics'     THEN 'logistics'
    WHEN 'office'        THEN 'office'
    WHEN 'manufacturing' THEN 'manufacturing'
    WHEN 'transport'     THEN 'logistics'
    WHEN 'sales'         THEN 'sales'
    WHEN 'education'     THEN 'education'
    ELSE 'other'
  END;
$$;

-- Ensure pg_cron + pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- PART 3: overall stats materialized view
DROP MATERIALIZED VIEW IF EXISTS public.leslie_stats CASCADE;
CREATE MATERIALIZED VIEW public.leslie_stats AS
SELECT
  (SELECT COUNT(*) FROM public.job_sources WHERE is_active = true) AS active_sources,
  (SELECT COUNT(DISTINCT company) FROM public.public_jobs WHERE company IS NOT NULL) AS active_companies,
  (SELECT COUNT(DISTINCT country) FROM public.public_jobs WHERE country IS NOT NULL AND country <> 'Multiple') AS countries_covered,
  (SELECT COUNT(*) FROM public.public_jobs) AS total_active_jobs,
  (SELECT COUNT(*) FROM public.public_jobs WHERE created_at > now() - interval '24 hours') AS jobs_today,
  (SELECT COUNT(*) FROM public.public_jobs WHERE created_at > now() - interval '7 days') AS jobs_this_week,
  (SELECT COALESCE(SUM(positions_available), COUNT(*)) FROM public.public_jobs) AS total_positions,
  (SELECT MAX(created_at) FROM public.public_jobs) AS last_job_added,
  (SELECT MAX(last_run_at) FROM public.job_sources WHERE is_active = true) AS last_ingest_run,
  now() AS computed_at;

GRANT SELECT ON public.leslie_stats TO anon, authenticated, service_role;

-- PART 4: country breakdown
DROP MATERIALIZED VIEW IF EXISTS public.leslie_stats_by_country CASCADE;
CREATE MATERIALIZED VIEW public.leslie_stats_by_country AS
SELECT
  pj.country,
  cc.country_code,
  cc.region,
  cc.continent,
  COUNT(*) AS job_count,
  COALESCE(SUM(pj.positions_available), COUNT(*)) AS position_count,
  COUNT(DISTINCT pj.company) AS company_count,
  COUNT(DISTINCT pj.display_category) AS category_count
FROM public.public_jobs pj
LEFT JOIN public.country_context cc ON pj.country = cc.country_name
WHERE pj.country IS NOT NULL
GROUP BY pj.country, cc.country_code, cc.region, cc.continent;

GRANT SELECT ON public.leslie_stats_by_country TO anon, authenticated, service_role;

-- PART 5: category breakdown
DROP MATERIALIZED VIEW IF EXISTS public.leslie_stats_by_category CASCADE;
CREATE MATERIALIZED VIEW public.leslie_stats_by_category AS
SELECT
  dc.id AS category_id,
  dc.label_cs,
  dc.icon,
  dc.color,
  dc.sort_order,
  COUNT(pj.*) AS job_count,
  COALESCE(SUM(pj.positions_available), COUNT(pj.*)) AS position_count,
  COUNT(DISTINCT pj.country) AS country_count,
  COUNT(DISTINCT pj.company) AS company_count
FROM public.display_categories dc
LEFT JOIN public.public_jobs pj ON pj.display_category = dc.id
GROUP BY dc.id, dc.label_cs, dc.icon, dc.color, dc.sort_order;

GRANT SELECT ON public.leslie_stats_by_category TO anon, authenticated, service_role;
