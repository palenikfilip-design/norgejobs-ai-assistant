CREATE OR REPLACE FUNCTION public.normalize_job_country()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.country IS NOT NULL THEN
    NEW.country := CASE upper(btrim(NEW.country))
      WHEN 'DE' THEN 'Germany'
      WHEN 'SE' THEN 'Sweden'
      WHEN 'AT' THEN 'Austria'
      WHEN 'CH' THEN 'Switzerland'
      WHEN 'NO' THEN 'Norway'
      WHEN 'DK' THEN 'Denmark'
      WHEN 'FI' THEN 'Finland'
      WHEN 'NL' THEN 'Netherlands'
      WHEN 'GB' THEN 'United Kingdom'
      WHEN 'UK' THEN 'United Kingdom'
      WHEN 'FR' THEN 'France'
      WHEN 'US' THEN 'United States'
      ELSE NEW.country
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_job_country ON public.public_jobs;
CREATE TRIGGER trg_normalize_job_country
BEFORE INSERT OR UPDATE OF country ON public.public_jobs
FOR EACH ROW EXECUTE FUNCTION public.normalize_job_country();