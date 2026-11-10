import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { isEmployer, resolveLogoUrl, TRUST_LABELS } from "@/lib/companies";
import type { Tables } from "@/integrations/supabase/types";

const EmployerDashboard = () => {
  const navigate = useNavigate();
  const [c, setC] = useState<Tables<"companies"> | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");
      if (!(await isEmployer(user.id))) return navigate("/dashboard");
      const { data } = await supabase.from("companies").select("*").eq("user_id", user.id).maybeSingle();
      if (!data || data.status !== "active") return navigate("/employer/company");
      setC(data); setLogo(await resolveLogoUrl(data.logo_url)); setLoading(false);
    })();
  }, [navigate]);

  if (loading || !c) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="glass-card-elevated rounded-2xl p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden">{logo && <img src={logo} alt={c.name} className="w-full h-full object-contain" />}</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">{c.name}</h1>
            <div className="flex gap-2 mt-1"><Badge variant="secondary">{TRUST_LABELS[c.trust_level]}</Badge><Badge variant="outline">Aktivní</Badge></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline"><Link to="/employer/company">Upravit profil</Link></Button>
          <Button asChild variant="outline"><Link to={`/company/${c.slug}`}>Zobrazit veřejnou stránku</Link></Button>
          <Button variant="ghost" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}>Odhlásit</Button>
        </div>
        <div className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">Inzerce pracovních nabídek bude brzy k dispozici.</div>
      </div>
    </div>
  );
};
export default EmployerDashboard;
