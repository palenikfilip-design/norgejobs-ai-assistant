
-- Archiles Phase 3: chat history + autonomy change log

CREATE TABLE public.archiles_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  message_role text NOT NULL CHECK (message_role IN ('user','assistant','tool','system')),
  message_content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archiles_chat_history TO authenticated;
GRANT ALL ON public.archiles_chat_history TO service_role;

ALTER TABLE public.archiles_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage archiles chat history"
  ON public.archiles_chat_history
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_archiles_chat_history_admin_created
  ON public.archiles_chat_history (admin_id, created_at DESC);


CREATE TABLE public.archiles_autonomy_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid,
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.archiles_autonomy_log TO authenticated;
GRANT ALL ON public.archiles_autonomy_log TO service_role;

ALTER TABLE public.archiles_autonomy_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view autonomy log"
  ON public.archiles_autonomy_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert autonomy log"
  ON public.archiles_autonomy_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));


CREATE OR REPLACE FUNCTION public.log_archiles_autonomy_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.archiles_autonomy_log (changed_by, old_values, new_values)
  VALUES (
    auth.uid(),
    jsonb_build_object(
      'autonomy_level', OLD.autonomy_level,
      'auto_publish_threshold', OLD.auto_publish_threshold,
      'auto_source_add', OLD.auto_source_add,
      'auto_delete_dead', OLD.auto_delete_dead,
      'auto_recategorize', OLD.auto_recategorize
    ),
    jsonb_build_object(
      'autonomy_level', NEW.autonomy_level,
      'auto_publish_threshold', NEW.auto_publish_threshold,
      'auto_source_add', NEW.auto_source_add,
      'auto_delete_dead', NEW.auto_delete_dead,
      'auto_recategorize', NEW.auto_recategorize
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_archiles_autonomy_log
  AFTER UPDATE ON public.archiles_autonomy
  FOR EACH ROW
  WHEN (
    OLD.autonomy_level IS DISTINCT FROM NEW.autonomy_level OR
    OLD.auto_publish_threshold IS DISTINCT FROM NEW.auto_publish_threshold OR
    OLD.auto_source_add IS DISTINCT FROM NEW.auto_source_add OR
    OLD.auto_delete_dead IS DISTINCT FROM NEW.auto_delete_dead OR
    OLD.auto_recategorize IS DISTINCT FROM NEW.auto_recategorize
  )
  EXECUTE FUNCTION public.log_archiles_autonomy_change();


-- Ensure palenik.filip@gmail.com has admin role (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'palenik.filip@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
