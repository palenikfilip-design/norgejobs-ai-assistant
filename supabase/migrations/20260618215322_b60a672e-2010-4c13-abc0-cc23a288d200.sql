
-- 1) Conversations table
CREATE TABLE public.leslie_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leslie_conversations TO authenticated;
GRANT ALL ON public.leslie_conversations TO service_role;

ALTER TABLE public.leslie_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations"
  ON public.leslie_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversations"
  ON public.leslie_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
  ON public.leslie_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_leslie_conv_user_active ON public.leslie_conversations (user_id, last_message_at DESC) WHERE deleted_at IS NULL;

-- 2) Add conversation_id to history
ALTER TABLE public.leslie_chat_history
  ADD COLUMN conversation_id uuid REFERENCES public.leslie_conversations(id) ON DELETE CASCADE;

-- 3) Backfill: group existing messages by user_id; new conversation when gap > 30 min
DO $$
DECLARE
  r record;
  cur_user uuid := NULL;
  cur_conv uuid := NULL;
  prev_time timestamptz := NULL;
BEGIN
  FOR r IN
    SELECT id, user_id, message_role, message_content, created_at
    FROM public.leslie_chat_history
    ORDER BY user_id, created_at
  LOOP
    IF cur_user IS DISTINCT FROM r.user_id
       OR prev_time IS NULL
       OR (r.created_at - prev_time) > interval '30 minutes' THEN
      cur_conv := gen_random_uuid();
      INSERT INTO public.leslie_conversations (id, user_id, created_at, last_message_at)
        VALUES (cur_conv, r.user_id, r.created_at, r.created_at);
      cur_user := r.user_id;
    END IF;

    UPDATE public.leslie_chat_history SET conversation_id = cur_conv WHERE id = r.id;

    UPDATE public.leslie_conversations
      SET last_message_at = r.created_at,
          title = COALESCE(title,
                  CASE WHEN r.message_role = 'user' THEN left(r.message_content, 80) ELSE NULL END)
      WHERE id = cur_conv;

    prev_time := r.created_at;
  END LOOP;
END $$;

ALTER TABLE public.leslie_chat_history ALTER COLUMN conversation_id SET NOT NULL;

CREATE INDEX idx_leslie_hist_conv ON public.leslie_chat_history (conversation_id, created_at);

-- 4) Trigger: keep conversation title + last_message_at fresh
CREATE OR REPLACE FUNCTION public.touch_leslie_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leslie_conversations
    SET last_message_at = NEW.created_at,
        title = COALESCE(title,
                CASE WHEN NEW.message_role = 'user' THEN left(NEW.message_content, 80) ELSE NULL END)
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_leslie_conversation
  AFTER INSERT ON public.leslie_chat_history
  FOR EACH ROW EXECUTE FUNCTION public.touch_leslie_conversation();
