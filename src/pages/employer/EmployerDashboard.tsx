import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { isEmployer, resolveLogoUrl, TRUST_LABELS } from "@/lib/companies";
import { STATUS_LABELS, type EmployerJobStatus } from "@/lib/employerJobs";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const EmployerDashboard = () => {
  const navigate = useNavigate();
  const [c, setC] = useState<Tables<"companies"> | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Tables<"employer_jobs">[]>([]);
  const [admin, setAdmin] = useState(false);
  const { toast } = useToast();
  const loadJobs = async (companyId: string) => {
    const { data } = await supabase.from("employer_jobs").select("*").eq("company_id", companyId).order("updated_at", { ascending: false });
    setJobs(data ?? []);
  };
  const setStatus = async (id: string, status: EmployerJobStatus) => {
    const { error } = await supabase.from("employer_jobs").update({ status }).eq("id", id);
    if (error) toast({ title: "Změna se nepovedla", description: error.message, variant: "destructive" });
    if (c) loadJobs(c.id);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");
      if (!(await isEmployer(user.id))) return navigate("/dashboard");
      const { data } = await supabase.from("companies").select("*").eq("user_id", user.id).maybeSingle();
      if (!data || data.status !== "active") return navigate("/employer/company");
      setC(data); setLogo(await resolveLogoUrl(data.logo_url));
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setAdmin(!!r);
      await loadJobs(data.id); setLoading(false);
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Pracovní nabídky</h2>
            <Button asChild><Link to="/employer/jobs/new">+ Nová nabídka</Link></Button>
          </div>
          {jobs.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">Zatím nemáš žádnou nabídku.</div>}
          {jobs.map((j) => {
            const st = j.status as EmployerJobStatus;
            return (
              <div key={j.id} className="glass-card-elevated rounded-xl p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-semibold">{j.title}</div>
                  <div className="text-sm text-muted-foreground">{j.city}, {j.country} · platí do {j.expiry_date ?? "—"}</div>
                </div>
                <Badge variant={st === "published" ? "default" : "outline"}>{STATUS_LABELS[st]}</Badge>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link to={`/employer/jobs/${j.id}/edit`}>Upravit</Link></Button>
                  {st === "published" && <Button size="sm" variant="ghost" onClick={() => setStatus(j.id, "closed")}>Uzavřít</Button>}
                  {(st === "closed" || st === "expired") && <Button size="sm" variant="ghost" onClick={() => setStatus(j.id, "pending_review")}>Znovu odeslat ke schválení</Button>}
                  {admin && st === "pending_review" && <Button size="sm" onClick={() => setStatus(j.id, "published")}>Zveřejnit (admin)</Button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default EmployerDashboard;
