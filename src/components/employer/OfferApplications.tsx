import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CvPreview from "@/components/cv/CvPreview";
import type { CvData, CvTemplate } from "@/types/cv";
import type { Tables } from "@/integrations/supabase/types";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/employerJobs";

type App = Tables<"job_applications">;
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

export default function OfferApplications({ jobId, title }: { jobId: string; title: string }) {
  const [apps, setApps] = useState<App[]>([]);
  const [reveals, setReveals] = useState(0);
  const [cv, setCv] = useState<App | null>(null);
  const load = async () => {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("job_applications").select("*").eq("employer_job_id", jobId).order("created_at", { ascending: false }),
      supabase.from("employer_job_email_reveals").select("id", { count: "exact", head: true }).eq("employer_job_id", jobId),
    ]);
    setApps(data ?? []); setReveals(count ?? 0);
  };
  useEffect(() => { load(); }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  const setStatus = async (id: string, status: ApplicationStatus) => {
    await supabase.from("job_applications").update({ status }).eq("id", id); load();
  };
  const openCv = (a: App) => { setCv(a); if (a.status === "new") setStatus(a.id, "seen"); };
  if (apps.length === 0 && reveals === 0) return <p className="text-xs text-muted-foreground mt-2">Zatím žádné přihlášky.</p>;
  const snap = cv?.cv_snapshot as unknown as (CvData & { template?: CvTemplate }) | null;
  return (
    <div className="mt-3 space-y-2 w-full">
      <div className="text-xs text-muted-foreground">Přihlášky: {apps.length} · Zobrazení e-mailu: {reveals}</div>
      {apps.map((a) => (
        <div key={a.id} className="rounded-lg border border-border p-3 text-sm space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium flex-1">{a.applicant_name ?? "Uchazeč"} · {a.method === "cv" ? "CV" : "zpráva"} · {new Date(a.created_at).toLocaleDateString("cs-CZ")}</span>
            <select aria-label="Stav přihlášky" className={sel} value={a.status} onChange={(e) => setStatus(a.id, e.target.value as ApplicationStatus)}>
              {Object.entries(APPLICATION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {a.note && <p className="whitespace-pre-line text-muted-foreground">{a.note}</p>}
          <div className="flex gap-2">
            {a.cv_snapshot && <Button size="sm" variant="outline" onClick={() => openCv(a)}>Zobrazit / stáhnout CV</Button>}
            {a.applicant_email && <Button asChild size="sm" variant="ghost" onClick={() => a.status === "new" && setStatus(a.id, "seen")}>
              <a href={`mailto:${a.applicant_email}?subject=${encodeURIComponent(title)}`}>Odpovědět e-mailem</a></Button>}
          </div>
        </div>
      ))}
      <Dialog open={!!cv} onOpenChange={(o) => !o && setCv(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>Životopis – {cv?.applicant_name}</DialogTitle></DialogHeader>
          <Button size="sm" className="w-fit" onClick={() => window.print()}>Stáhnout PDF</Button>
          {snap && <div className="cv-print-area"><CvPreview data={snap} template={(snap.template ?? "modern") as CvTemplate} /></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
