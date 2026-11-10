CREATE TYPE public.company_trust_level AS ENUM ('new','verified','gold');
CREATE TYPE public.company_status AS ENUM ('draft','active');

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.company_status NOT NULL DEFAULT 'draft',
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  country text,
  description text,
  website_url text,
  instagram_url text,
  contact_email text,
  show_contact_email boolean NOT NULL DEFAULT false,
  trust_level public.company_trust_level NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX companies_user_id_unique ON public.companies(user_id) WHERE user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own company" ON public.companies FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Employer inserts own company" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(),'employer'));
CREATE POLICY "Owner updates own company" ON public.companies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin manages companies" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.protect_company_trust_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR auth.role() = 'service_role') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.trust_level := 'new';
    ELSIF NEW.trust_level IS DISTINCT FROM OLD.trust_level THEN
      NEW.trust_level := OLD.trust_level;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER companies_protect_trust BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.protect_company_trust_level();

CREATE VIEW public.public_companies WITH (security_invoker = false) AS
SELECT id, name, slug, logo_url, country, description, website_url, instagram_url, trust_level,
       CASE WHEN show_contact_email THEN contact_email ELSE NULL END AS contact_email
FROM public.companies WHERE status = 'active';
GRANT SELECT ON public.public_companies TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role := CASE WHEN NEW.raw_user_meta_data->>'user_type' = 'employer'
                                THEN 'employer'::public.app_role ELSE 'user'::public.app_role END;
BEGIN
  IF _role <> 'employer' THEN
    INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  SELECT NEW.id, _role
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = _role);
  RETURN NEW;
END;
$$;

CREATE POLICY "Public read company logos" ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');
CREATE POLICY "Employer uploads own logo" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.has_role(auth.uid(),'employer'));
CREATE POLICY "Employer updates own logo" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);