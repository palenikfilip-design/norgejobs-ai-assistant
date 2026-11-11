import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Public company info (name, logo, trust) for employer-posted catalog offers. */
export function useEmployerCompany(slug: string | null) {
  return useQuery({
    queryKey: ["employer-company", slug],
    enabled: !!slug,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("public_companies").select("name,slug,logo_url,trust_level").eq("slug", slug!).maybeSingle();
      if (!data) return null;
      let logo: string | null = null;
      if (data.logo_url && /^https?:\/\//.test(data.logo_url)) logo = data.logo_url;
      else if (data.logo_url) {
        const r = await supabase.functions.invoke("public-company-logo", { body: { slug } });
        logo = r.error ? null : r.data?.signedUrl ?? null;
      }
      return { ...data, logo };
    },
  });
}
