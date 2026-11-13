import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/employerJobs";

type Row = { id: string; method: string; status: string; created_at: string; employer_job_id: string;
  employer_jobs: { title: string } | null; companies: { name: string; slug: string } | null };

const Applications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = async () => {
    const { data } = await supabase.from("job_applications")
      .select("id, method, status, created_at, employer_job_id, employer_jobs(title), companies(name, slug)")
      .order("created_at", { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
  };
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (!session) navigate("/login"); else load(); });
  }, [navigate]);
  const withdraw = async (id: string) => {
    if (!confirm("Opravdu stáhnout přihlášku? Firma ji už neuvidí.")) return;
    const { error } = await supabase.from("job_applications").delete().eq("id", id);
    if (error) toast({ title: "Nepovedlo se", description: error.message, variant: "destructive" });
    else { toast({ title: "Přihláška stažena" }); load(); }
  };
  if (!rows) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">Moje přihlášky</h1>
          <Button asChild variant="ghost"><Link to="/dashboard">Zpět</Link></Button>
        </div>
        {rows.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">Zatím jsi neposlal(a) žádnou přihlášku.</div>}
        {rows.map((r) => (
          <div key={r.id} className="glass-card-elevated rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[12rem]">
              <Link to={`/company/${r.companies?.slug}?job=${r.employer_job_id}`} className="font-semibold hover:underline">{r.employer_jobs?.title ?? "Nabídka"}</Link>
              <div className="text-sm text-muted-foreground">{r.companies?.name} · {r.method === "cv" ? "s životopisem" : "zpráva"} · {new Date(r.created_at).toLocaleDateString("cs-CZ")}</div>
            </div>
            <Badge variant={r.status === "shortlisted" ? "default" : "outline"}>{APPLICATION_STATUS_LABELS[r.status as ApplicationStatus]}</Badge>
            <Button size="sm" variant="ghost" onClick={() => withdraw(r.id)}>Stáhnout</Button>
          </div>
        ))}
      </div>
    </div>
  );
};
export default Applications;
