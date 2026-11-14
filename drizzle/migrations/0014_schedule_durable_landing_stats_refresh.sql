DO $$
BEGIN
 PERFORM cron.alter_job(6, command := 'SELECT public.refresh_leslie_stats()');
 PERFORM public.refresh_leslie_stats();
END;
$$;