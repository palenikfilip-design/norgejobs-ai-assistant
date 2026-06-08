
ALTER TABLE public.public_jobs ADD COLUMN IF NOT EXISTS title_cs text;
ALTER TABLE public.public_jobs ADD COLUMN IF NOT EXISTS summary_cs text;

-- Backfill: mark foreign-language jobs for re-enrichment so the next catchup
-- run generates Czech labels for them.
UPDATE public.public_jobs SET enriched_at = NULL
WHERE title_cs IS NULL
  AND country IN ('Sweden', 'Germany', 'Norway', 'Denmark', 'Finland');
