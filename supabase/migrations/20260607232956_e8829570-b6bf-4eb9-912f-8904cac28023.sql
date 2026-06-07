ALTER TABLE public.employer_sources DROP CONSTRAINT IF EXISTS employer_sources_ats_type_check;
ALTER TABLE public.employer_sources
  ADD CONSTRAINT employer_sources_ats_type_check
  CHECK (ats_type IN ('workday','smartrecruiters','workable','recruitee','personio','ashby','greenhouse','lever'));