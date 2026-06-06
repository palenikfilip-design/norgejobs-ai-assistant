
-- Allow admins to manage employer_sources (table already exists)
DROP POLICY IF EXISTS "Admins manage employer sources" ON public.employer_sources;
CREATE POLICY "Admins manage employer sources" ON public.employer_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed Equinor Workday employer (proof source). Idempotent on company_name+ats_type.
INSERT INTO public.employer_sources (company_name, ats_type, ats_config, country, sector, is_active)
SELECT 'Equinor', 'workday',
       '{"tenant":"equinor","wd":3,"site":"EQNR"}'::jsonb,
       'Norway', 'Energy', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.employer_sources
  WHERE company_name = 'Equinor' AND ats_type = 'workday'
);
