CREATE OR REPLACE FUNCTION public.set_ingest_cron_secret(_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO _id FROM vault.secrets WHERE name = 'INGEST_CRON_SECRET';
  IF _id IS NULL THEN
    PERFORM vault.create_secret(_value, 'INGEST_CRON_SECRET');
  ELSE
    PERFORM vault.update_secret(_id, _value);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_ingest_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_ingest_cron_secret(text) TO service_role;