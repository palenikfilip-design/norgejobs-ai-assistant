CREATE TABLE public.chat_extractions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  raw_message text NOT NULL DEFAULT '',
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  routed_to text NOT NULL DEFAULT 'none',
  confidence text NOT NULL DEFAULT 'low',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.chat_extractions TO authenticated;
GRANT ALL ON public.chat_extractions TO service_role;

ALTER TABLE public.chat_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own extractions"
ON public.chat_extractions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all extractions"
ON public.chat_extractions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own extractions"
ON public.chat_extractions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_extractions_created_at ON public.chat_extractions (created_at DESC);