
CREATE TABLE IF NOT EXISTS public.leslie_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preset_id uuid,
  message_role text NOT NULL CHECK (message_role IN ('user','assistant','system')),
  message_content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leslie_chat_user_created ON public.leslie_chat_history(user_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.leslie_chat_history TO authenticated;
GRANT ALL ON public.leslie_chat_history TO service_role;

ALTER TABLE public.leslie_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own leslie chat" ON public.leslie_chat_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own leslie chat" ON public.leslie_chat_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own leslie chat" ON public.leslie_chat_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.user_job_interactions
  DROP CONSTRAINT IF EXISTS user_job_interactions_action_type_check;
ALTER TABLE public.user_job_interactions
  ADD CONSTRAINT user_job_interactions_action_type_check
  CHECK (action_type IN ('view','click','apply','save','reject','unsave','like','dislike'));
