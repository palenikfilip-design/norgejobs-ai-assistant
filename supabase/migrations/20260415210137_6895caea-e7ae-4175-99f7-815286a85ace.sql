
CREATE TABLE public.user_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  daily_view_limit INTEGER NOT NULL DEFAULT 4,
  jobs_viewed_today INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  free_unlocks_available INTEGER NOT NULL DEFAULT 0,
  free_unlocks_used INTEGER NOT NULL DEFAULT 0,
  premium_since TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access" ON public.user_access FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own access" ON public.user_access FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own access" ON public.user_access FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create access row for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_access (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_access
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_access();

-- Updated_at trigger
CREATE TRIGGER update_user_access_updated_at
  BEFORE UPDATE ON public.user_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
