
-- AI call log
CREATE TABLE IF NOT EXISTS public.ai_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  model text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_call_log TO authenticated;
GRANT ALL ON public.ai_call_log TO service_role;
ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ai_call_log"
  ON public.ai_call_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS ai_call_log_created_idx ON public.ai_call_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_call_log_function_idx ON public.ai_call_log (function_name);

-- Daily budget
CREATE TABLE IF NOT EXISTS public.ai_daily_budget (
  date date PRIMARY KEY DEFAULT current_date,
  total_cost_usd numeric NOT NULL DEFAULT 0,
  call_count integer NOT NULL DEFAULT 0,
  daily_limit_usd numeric NOT NULL DEFAULT 3.0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.ai_daily_budget TO authenticated;
GRANT ALL ON public.ai_daily_budget TO service_role;
ALTER TABLE public.ai_daily_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read budget"
  ON public.ai_daily_budget FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update budget"
  ON public.ai_daily_budget FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Atomic increment helper used by edge functions
CREATE OR REPLACE FUNCTION public.ai_budget_increment(_cost numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_daily_budget (date, total_cost_usd, call_count)
  VALUES (current_date, COALESCE(_cost,0), 1)
  ON CONFLICT (date) DO UPDATE
    SET total_cost_usd = ai_daily_budget.total_cost_usd + COALESCE(_cost,0),
        call_count = ai_daily_budget.call_count + 1,
        updated_at = now();
END;
$$;

-- Budget check helper readable by anyone (returns boolean only)
CREATE OR REPLACE FUNCTION public.ai_budget_remaining_today()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT daily_limit_usd - total_cost_usd FROM public.ai_daily_budget WHERE date = current_date),
    (SELECT 3.0::numeric)
  );
$$;

-- Enrichment version column for surgical backfills.
-- Bump ENRICHMENT_VERSION constant in archiles-enrich/index.ts and reprocess
-- WHERE enrichment_version < <new> in controlled batches, instead of nulling enriched_at wholesale.
ALTER TABLE public.public_jobs
  ADD COLUMN IF NOT EXISTS enrichment_version integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS public_jobs_enrichment_version_idx ON public.public_jobs (enrichment_version);
