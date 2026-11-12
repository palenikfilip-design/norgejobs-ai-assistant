import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Building2, Briefcase, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TRUST_LABELS } from "@/lib/companies";
import { companyReadyToPublish, REPORT_REASONS, sortQueue, type ReviewEvent } from "@/lib/reviewQueue";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;
type Job = Tables<"employer_jobs"> & { companies: Company | null };
type Report = Tables<"job_reports">;
type Item =
  | { kind: "company"; id: string; at: string; company: Company }
  | { kind: "job"; id: string; at: string; job: Job }
  | { kind: "report"; id: string; at: string; job: Job; reports: Report[] };

const AdminEmployerJobs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reject, setReject] = useState<{ type: "company" | "job"; company: Company; job?: Job } | null>(null);
  const [note, setNote] = useState("");
  const [needsCompany, setNeedsCompany] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [cRes, jRes, rRes] = await Promise.all([
      supabase.from("companies").select("*").order("created_at"),
      supabase.from("employer_jobs").select("*, companies(*)").or("status.eq.pending_review,reports_count.gt.0"),
      supabase.from("job_reports").select("*").not("employer_job_id", "is", null).order("created_at"),
    ]);
    const cs = cRes.data ?? [];
    const jobs = (jRes.data as Job[]) ?? [];
    const reports = rRes.data ?? [];
    setCompanies(cs);
    const list: Item[] = [
      ...cs.filter((c) => c.status === "active" && !c.approved_at).map((c) => ({ kind: "company" as const, id: c.id, at: c.updated_at, company: c })),
      ...jobs.filter((j) => j.status === "pending_review").map((j) => ({ kind: "job" as const, id: j.id, at: j.updated_at, job: j })),
      ...jobs.filter((j) => j.reports_count > 0 && (j.status === "published" || j.is_reported_hidden)).map((j) => {
        const rs = reports.filter((r) => r.employer_job_id === j.id);
        return { kind: "report" as const, id: `r-${j.id}`, at: rs[0]?.created_at ?? j.updated_at, job: j, reports: rs };
      }),
    ];
    setItems(sortQueue(list));
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

  const notify = (event: ReviewEvent, company_id: string, job_id?: string, n?: string) =>
    supabase.functions.invoke("notify-employer-review", { body: { event, company_id, job_id, note: n } })
      .then(({ data, error }) => { if (error || !data?.sent) console.warn("E-mail se neodeslal", error ?? data); });

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    toast(error ? { title: "Chyba", description: error.message, variant: "destructive" } : { title: ok });
    await load();
    return !error;
  };

  const approveCompany = (c: Company) => run(async () => {
    const r = await supabase.from("companies").update({ approved_at: new Date().toISOString(), rejection_note: null }).eq("id", c.id);
    if (!r.error) notify("company_approved", c.id);
    return r;
  }, "Firma schválena");

  const approveJob = async (j: Job) => {
    if (!companyReadyToPublish(j.companies)) return setNeedsCompany(j);
    await run(async () => {
      const r = await supabase.from("employer_jobs").update({ status: "published", rejection_note: null }).eq("id", j.id);
      if (!r.error) notify("job_approved", j.company_id, j.id);
      return r;
    }, "Nabídka zveřejněna");
  };

  const approveBoth = async () => {
    const j = needsCompany; if (!j?.companies) return;
    setNeedsCompany(null);
    if (j.companies.status !== "active") {
      toast({ title: "Firma není aktivní", description: "Pozastavenou nebo nedokončenou firmu nejdřív aktivuj.", variant: "destructive" });
      return;
    }
    if (await approveCompany(j.companies)) await approveJob({ ...j, companies: { ...j.companies, approved_at: new Date().toISOString() } });
  };

  const submitReject = async () => {
    if (!reject || !note.trim()) return;
    const { type, company, job } = reject;
    const n = note.trim();
    setReject(null); setNote("");
    if (type === "company") await run(async () => {
      const r = await supabase.from("companies").update({ status: "draft", rejection_note: n }).eq("id", company.id);
      if (!r.error) notify("company_rejected", company.id, undefined, n);
      return r;
    }, "Firma vrácena k úpravě");
    else if (job) await run(async () => {
      const r = await supabase.from("employer_jobs").update({ status: "draft", rejection_note: n }).eq("id", job.id);
      if (!r.error) notify("job_rejected", company.id, job.id, n);
      return r;
    }, "Nabídka vrácena do konceptu");
  };

  const keepLive = (j: Job) => run(async () => supabase.from("employer_jobs").update({ is_reported_hidden: false, reports_count: 0 }).eq("id", j.id), "Hlášení vyřízeno");
  const closeJob = (j: Job) => run(async () => supabase.from("employer_jobs").update({ status: "closed" }).eq("id", j.id), "Nabídka uzavřena");
  const setTrust = (c: Company, t: Company["trust_level"]) => run(async () => supabase.from("companies").update({ trust_level: t }).eq("id", c.id), "Úroveň důvěry změněna");
  const toggleSuspend = (c: Company) => {
    if (c.status !== "suspended" && !confirm(`Pozastavit ${c.name}? Všechny její nabídky se skryjí.`)) return;
    return run(async () => supabase.from("companies").update({ status: c.status === "suspended" ? "active" : "suspended" }).eq("id", c.id),
      c.status === "suspended" ? "Firma obnovena (nabídky zůstávají skryté)" : "Firma pozastavena");
  };

  if (!items) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  const companyLine = (c: Company | null) => c && (
    <div className="text-sm text-muted-foreground">
      {c.name} · <Badge variant="secondary" className="text-[10px]">{TRUST_LABELS[c.trust_level]}</Badge>
      {c.registration_number && <> · IČO {c.registration_number}</>}
      {!c.approved_at && <> · <span className="text-red-accent">firma neschválená</span></>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="font-display text-2xl font-bold">Schvalovací fronta</h1>
        <Tabs defaultValue="queue">
          <TabsList><TabsTrigger value="queue">Ke kontrole ({items.length})</TabsTrigger><TabsTrigger value="companies">Firmy ({companies.length})</TabsTrigger></TabsList>
          <TabsContent value="queue" className="space-y-3 mt-4">
            {items.length === 0 && <p className="text-muted-foreground">Nic nečeká na kontrolu.</p>}
            {items.map((it) => (
              <div key={it.id} className="glass-card-elevated rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {it.kind === "company" ? <Building2 className="w-4 h-4" /> : it.kind === "job" ? <Briefcase className="w-4 h-4" /> : <Flag className="w-4 h-4 text-red-accent" />}
                  {it.kind === "company" ? "Nová firma" : it.kind === "job" ? "Nabídka ke schválení" : "Nahlášená nabídka"} · {new Date(it.at).toLocaleString("cs-CZ")}
                </div>
                {it.kind === "company" ? (
                  <>
                    <div className="font-semibold">{it.company.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {[it.company.country, it.company.registration_number && `IČO ${it.company.registration_number}`, it.company.contact_email, it.company.website_url].filter(Boolean).join(" · ")}
                    </div>
                    {it.company.description && <p className="text-sm">{it.company.description}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => approveCompany(it.company)}>Schválit firmu</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setReject({ type: "company", company: it.company })}>Vrátit s poznámkou</Button>
                      <Button size="sm" variant="ghost" asChild><a href={`/company/${it.company.slug}`} target="_blank" rel="noreferrer">Náhled</a></Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold">{it.job.title}</div>
                    {companyLine(it.job.companies)}
                    <div className="text-sm text-muted-foreground">{it.job.city}, {it.job.country} · {it.job.salary_amount} {it.job.salary_currency} · ubytování {it.job.accommodation_provided ? "ano" : "ne"}</div>
                    {it.kind === "report" && (
                      <div className="text-sm space-y-1">
                        <div>{it.job.reports_count}× nahlášeno{it.job.is_reported_hidden && <Badge variant="destructive" className="ml-2">Automaticky skryto</Badge>}</div>
                        {it.reports.map((r) => <div key={r.id} className="text-muted-foreground">• {REPORT_REASONS[r.reason] ?? r.reason}{r.details && ` — ${r.details}`}</div>)}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {it.kind === "job" ? (
                        <>
                          <Button size="sm" disabled={busy} onClick={() => approveJob(it.job)}>Schválit a zveřejnit</Button>
                          {it.job.companies && <Button size="sm" variant="outline" disabled={busy} onClick={() => setReject({ type: "job", company: it.job.companies!, job: it.job })}>Vrátit s poznámkou</Button>}
                        </>
                      ) : (
                        <>
                          <Button size="sm" disabled={busy} onClick={() => keepLive(it.job)}>Ponechat zveřejněnou</Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => closeJob(it.job)}>Uzavřít nabídku</Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="companies" className="space-y-3 mt-4">
            {companies.map((c) => (
              <div key={c.id} className="glass-card-elevated rounded-xl p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.status === "suspended" ? "Pozastavená" : c.approved_at ? "Schválená" : c.status === "active" ? "Čeká na schválení" : "Rozpracovaná"}
                    {" · "}{c.approved_jobs_count} schválených nabídek{c.registration_number && ` · IČO ${c.registration_number}`}
                  </div>
                </div>
                <Select value={c.trust_level} onValueChange={(v) => setTrust(c, v as Company["trust_level"])}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{(["new", "verified", "gold"] as const).map((t) => <SelectItem key={t} value={t}>{TRUST_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant={c.status === "suspended" ? "outline" : "destructive"} disabled={busy} onClick={() => toggleSuspend(c)}>
                  {c.status === "suspended" ? "Zrušit pozastavení" : "Pozastavit"}
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vrátit k úpravě</DialogTitle><DialogDescription>Poznámku uvidí zaměstnavatel a přijde mu e-mailem.</DialogDescription></DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Co je potřeba upravit?" />
          <DialogFooter><Button disabled={!note.trim()} onClick={submitReject}>Odeslat</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!needsCompany} onOpenChange={(o) => !o && setNeedsCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Firma zatím není schválená</DialogTitle>
            <DialogDescription>Nabídku firmy {needsCompany?.companies?.name} nejde zveřejnit, dokud není schválený profil firmy — jinak by karta odkazovala na skrytou stránku.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNeedsCompany(null)}>Zrušit</Button>
            <Button onClick={approveBoth}>Schválit firmu i nabídku</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default AdminEmployerJobs;
