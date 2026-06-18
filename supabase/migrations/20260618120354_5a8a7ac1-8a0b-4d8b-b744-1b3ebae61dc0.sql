
ALTER TABLE public.employer_sources DROP CONSTRAINT IF EXISTS employer_sources_ats_type_check;
ALTER TABLE public.employer_sources ADD CONSTRAINT employer_sources_ats_type_check
  CHECK (ats_type = ANY (ARRAY['workday','smartrecruiters','workable','recruitee','personio','ashby','greenhouse','lever','teamtailor','wp_rest','html_ischgl']));

INSERT INTO public.employer_sources (company_name, ats_type, ats_config, country, sector, is_active)
VALUES
  ('Santa Claus Reindeer',
   'wp_rest',
   '{"base":"https://www.santaclausreindeer.fi","post_type":"job-opening","category":"Gastronomy","display_category":"hospitality","is_seasonal":true,"seasonal_type":"winter","source_portal":"wp:santaclausreindeer"}'::jsonb,
   'Finland',
   'hospitality',
   true),
  ('Ischgl',
   'html_ischgl',
   '{"listing_url":"https://www.ischgl.com/en/jobs","base":"https://www.ischgl.com","category":"Gastronomy","display_category":"hospitality","is_seasonal":true,"seasonal_type":"winter","source_portal":"html:ischgl"}'::jsonb,
   'Austria',
   'hospitality',
   true)
ON CONFLICT DO NOTHING;
