CREATE TABLE public.liveness_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  batch_size integer NOT NULL DEFAULT 500,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.liveness_state TO service_role;
ALTER TABLE public.liveness_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role liveness_state" ON public.liveness_state FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
INSERT INTO public.liveness_state (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.liveness_source_backoff (
  source_portal text PRIMARY KEY,
  consecutive_429 integer NOT NULL DEFAULT 0,
  delay_ms integer NOT NULL DEFAULT 150,
  backoff_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.liveness_source_backoff TO service_role;
ALTER TABLE public.liveness_source_backoff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role liveness_backoff" ON public.liveness_source_backoff FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE public.liveness_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  batch_size integer,
  checked integer NOT NULL DEFAULT 0,
  deactivated integer NOT NULL DEFAULT 0,
  inconclusive integer NOT NULL DEFAULT 0,
  by_source jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text
);
GRANT ALL ON public.liveness_runs TO service_role;
ALTER TABLE public.liveness_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role liveness_runs" ON public.liveness_runs FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE INDEX liveness_runs_started_idx ON public.liveness_runs (started_at DESC);

CREATE OR REPLACE FUNCTION public.liveness_acquire_lease(_seconds integer)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.liveness_state SET lease_until = now() + make_interval(secs => _seconds), updated_at = now()
  WHERE id = 1 AND (lease_until IS NULL OR lease_until < now())
  RETURNING batch_size;
$$;
REVOKE EXECUTE ON FUNCTION public.liveness_acquire_lease(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.liveness_acquire_lease(integer) TO service_role;