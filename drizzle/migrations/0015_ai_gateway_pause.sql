CREATE TABLE public.ai_gateway_state (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 paused boolean NOT NULL DEFAULT false,
 status integer NOT NULL DEFAULT 403 CHECK (status BETWEEN 400 AND 599),
 error_type text NOT NULL DEFAULT 'ai_paused',
 message text NOT NULL DEFAULT 'AI requests are paused.',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.ai_gateway_state TO authenticated;
GRANT ALL ON public.ai_gateway_state TO service_role;
ALTER TABLE public.ai_gateway_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read AI pause" ON public.ai_gateway_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update AI pause" ON public.ai_gateway_state FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));