CREATE OR REPLACE FUNCTION public.verify_ingest_cron_secret(_provided text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  _stored text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RETURN false;
  END IF;
  SELECT decrypted_secret INTO _stored FROM vault.decrypted_secrets WHERE name = 'INGEST_CRON_SECRET' LIMIT 1;
  RETURN _stored IS NOT NULL AND _stored = _provided;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_ingest_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_ingest_cron_secret(text) TO service_role;