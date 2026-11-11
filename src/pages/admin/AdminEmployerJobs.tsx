import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { STATUS_LABELS, type EmployerJobStatus } from "@/lib/employerJobs";
import type { Tables } from "@/integrations/supabase/types";

type Row = Tables<"employer_jobs"> & { companies: { name: string; trust_level: string } | null };

/** Temporary admin-only publish tool until the review queue exists. */
const AdminEmployerJobs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = async () => {
    const { data } = await supabase.from("employer_jobs").select("*, companies(name, trust_level)")
      .in("status", ["pending_review", "published"]).order("updated_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  };
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!data) return navigate("/");
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: EmployerJobStatus) => {
    const { error } = await supabase.from("employer_jobs").update({ status }).eq("id", id);
    toast(error ? { title: "Chyba", description: error.message, variant: "destructive" } : { title: STATUS_LABELS[status] });
    load();
  };

  if (!rows) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        <h1 className="font-display text-2xl font-bold">Firemní nabídky</h1>
        {rows.length === 0 && <p className="text-muted-foreground">Nic nečeká na schválení.</p>}
        {rows.map((j) => (
          <div key={j.id} className="glass-card-elevated rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[12rem]">
              <div className="font-semibold">{j.title}</div>
              <div className="text-sm text-muted-foreground">{j.companies?.name} · {j.city}, {j.country} · {j.salary_amount} {j.salary_currency}</div>
            </div>
            <Badge variant="outline">{STATUS_LABELS[j.status as EmployerJobStatus]}</Badge>
            {j.status === "pending_review" && <Button size="sm" onClick={() => setStatus(j.id, "published")}>Zveřejnit</Button>}
            {j.status === "published" && <Button size="sm" variant="ghost" onClick={() => setStatus(j.id, "closed")}>Uzavřít</Button>}
          </div>
        ))}
      </div>
    </div>
  );
};
export default AdminEmployerJobs;
