ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS cover_letters_used_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_letter_month_reset date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date;