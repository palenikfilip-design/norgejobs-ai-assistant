import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import JobApplyPanel from "@/components/employer/JobApplyPanel";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Globe, Camera as Instagram, Mail, Loader2, MapPin } from "lucide-react";
import { TRUST_LABELS, resolveLogoUrl } from "@/lib/companies";
import type { Tables } from "@/integrations/supabase/types";

const CompanyPage = () => {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const jobId = params.get("job");
  const [c, setC] = useState<Tables<"public_companies"> | null | undefined>(undefined);
  const [logo, setLogo] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setC(undefined); setLogo(null);
    if (!slug) { setC(null); return; }
    (async () => {
      const { data } = await supabase.from("public_companies").select("*").eq("slug", slug).maybeSingle();
      if (cancelled) return;
      if (!data) {
        // Owner preview before approval: RLS only returns the owner's (or admin's) own row.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: own } = await supabase.from("companies")
            .select("id, name, slug, logo_url, country, description, website_url, instagram_url, trust_level, contact_email, show_contact_email")
            .eq("slug", slug).maybeSingle();
          if (cancelled) return;
          if (own) {
            setPreview(true);
            setC({ ...own, contact_email: own.show_contact_email ? own.contact_email : null } as Tables<"public_companies">);
            setLogo(await resolveLogoUrl(own.logo_url));
            return;
          }
        }
      }
      setC(data);
      if (!data?.logo_url) return;
      if (/^https?:\/\//.test(data.logo_url)) { setLogo(data.logo_url); return; }
      const response = await supabase.functions.invoke("public-company-logo", { body: { slug } });
      if (!cancelled && !response.error) setLogo(response.data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (c === undefined) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!c) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Firma nenalezena</div>;
  return (
    <div className="min-h-screen bg-background p-4">
      {preview && <div className="max-w-3xl mx-auto mb-3 rounded-xl border border-border bg-muted p-3 text-sm">Režim náhledu – profil firmy zatím čeká na schválení a veřejnost ho nevidí.</div>}
      <div className="max-w-3xl mx-auto glass-card-elevated rounded-2xl p-8 space-y-5">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden">{logo && <img src={logo} alt={c.name ?? ""} className="w-full h-full object-contain" />}</div>
          <div>
            <h1 className="font-display text-3xl font-bold">{c.name}</h1>
            <div className="flex gap-2 items-center mt-1">
              {c.trust_level && <Badge variant="secondary">{TRUST_LABELS[c.trust_level]}</Badge>}
              {c.country && <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-4 h-4" />{c.country}</span>}
            </div>
          </div>
        </div>
        {c.description && <p className="whitespace-pre-line">{c.description}</p>}
        <div className="flex flex-wrap gap-4 text-sm">
          {c.website_url && <a href={c.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-red-accent"><Globe className="w-4 h-4" />Web</a>}
          {c.instagram_url && <a href={c.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-red-accent"><Instagram className="w-4 h-4" />Instagram</a>}
          {c.contact_email && <a href={`mailto:${c.contact_email}`} className="flex items-center gap-1 text-red-accent"><Mail className="w-4 h-4" />{c.contact_email}</a>}
        </div>
      </div>
      {jobId && !preview && <div className="max-w-3xl mx-auto mt-5"><JobApplyPanel jobId={jobId} companyName={c.name ?? ""} /></div>}
    </div>
  );
};
export default CompanyPage;
