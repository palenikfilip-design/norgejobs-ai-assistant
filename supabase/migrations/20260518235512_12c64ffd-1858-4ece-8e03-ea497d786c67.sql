CREATE OR REPLACE FUNCTION public.get_public_jobs_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.public_jobs;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_jobs_count() TO anon, authenticated;