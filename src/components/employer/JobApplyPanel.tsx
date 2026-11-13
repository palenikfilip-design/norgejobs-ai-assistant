import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Mail, MessageSquare, Loader2, MapPin } from "lucide-react";
import type { ContactOption } from "@/lib/employerJobs";

type Job = { title: string; location: string | null; salary: string | null; description: string | null; raw_data: unknown };
const ERRORS: Record<string, string> = {
  duplicate: "Na tuto nabídku už máš přihlášku.", offer_not_open: "Nabídka už není otevřená.",
  method_not_accepted: "Firma tento způsob kontaktu nepřijímá.", cv_required: "Vyber životopis.",
  message_required: "Napiš zprávu.", cannot_apply_to_own_offer: "Na vlastní nabídku se přihlásit nejde.",
};

export default function JobApplyPanel({ jobId, companyName }: { jobId: string; companyName: string }) {
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [userId, setUserId] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [cvs, setCvs] = useState<{ id: string; title: string }[]>([]);
  const [mode, setMode] = useState<"cv" | "message" | null>(null);
  const [cvId, setCvId] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("public_jobs").select("title, location, salary, description, raw_data")
        .eq("source_portal", "employer").eq("external_id", jobId).eq("is_active", true).maybeSingle();
      setJob(data);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const [{ data: a }, { data: c }] = await Promise.all([
        supabase.from("job_applications").select("id").eq("employer_job_id", jobId).maybeSingle(),
        supabase.from("user_cvs").select("id, title").order("updated_at", { ascending: false }),
      ]);
      setApplied(!!a); setCvs(c ?? []); if (c?.[0]) setCvId(c[0].id);
    })();
  }, [jobId]);

  if (job === undefined) return null;
  if (!job) return <div className="glass-card-elevated rounded-2xl p-6 text-muted-foreground">Tato nabídka už není aktivní.</div>;
  const opts = (((job.raw_data as { contact_options?: ContactOption[] })?.contact_options) ?? []) as ContactOption[];

  const submit = async () => {
    if (!mode || !consent) return;
    setSending(true);
    const { data, error } = await supabase.from("job_applications").insert({
      employer_job_id: jobId, method: mode, note: note.trim() || null, cv_id: mode === "cv" ? cvId : null,
      applicant_user_id: userId!, company_id: "00000000-0000-0000-0000-000000000000", gdpr_consent_at: new Date().toISOString(),
    }).select("id").single();
    setSending(false);
    if (error) {
      const key = error.code === "23505" ? "duplicate" : Object.keys(ERRORS).find((k) => error.message.includes(k));
      return toast({ title: "Odeslání selhalo", description: key ? ERRORS[key] : error.message, variant: "destructive" });
    }
    supabase.functions.invoke("notify-new-application", { body: { application_id: data.id } }).catch(() => {});
    setApplied(true); setMode(null); setNote(""); setConsent(false);
    toast({ title: "Odesláno", description: "Stav najdeš v Moje přihlášky." });
  };
  const reveal = async () => {
    const { data, error } = await supabase.rpc("get_employer_job_contact_email", { p_job_id: jobId });
    if (error || !data) return toast({ title: "E-mail není k dispozici", variant: "destructive" });
    setEmail(data);
  };

  return (
    <div className="glass-card-elevated rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold">{job.title}</h2>
        <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-1">
          {job.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>}
          {job.salary && <span>{job.salary}</span>}
        </div>
      </div>
      {job.description && <p className="whitespace-pre-line text-sm">{job.description}</p>}
      {!userId ? (
        <div className="rounded-xl border border-border bg-muted p-4 text-sm flex flex-wrap items-center gap-3">
          Pro přihlášení nebo zobrazení kontaktu se přihlas.
          <Button asChild size="sm"><Link to="/login">Přihlásit se</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {applied && <div className="rounded-xl border border-border bg-muted p-3 text-sm">Už jsi poslal(a) přihlášku. <Link to="/applications" className="text-red-accent underline">Moje přihlášky</Link></div>}
          <div className="flex flex-wrap gap-2">
            {opts.includes("cv") && !applied && <Button onClick={() => setMode("cv")}><FileText className="w-4 h-4 mr-2" />Přihlásit se s CV</Button>}
            {opts.includes("message") && !applied && <Button variant="outline" onClick={() => setMode("message")}><MessageSquare className="w-4 h-4 mr-2" />Poslat zprávu</Button>}
            {opts.includes("email") && (email
              ? <a href={`mailto:${email}`} className="inline-flex items-center gap-2 text-red-accent text-sm"><Mail className="w-4 h-4" />{email}</a>
              : <Button variant="outline" onClick={reveal}><Mail className="w-4 h-4 mr-2" />Zobrazit e-mail</Button>)}
          </div>
        </div>
      )}
      <Dialog open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{mode === "cv" ? "Přihláška s životopisem" : "Zpráva pro firmu"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {mode === "cv" && (cvs.length === 0
              ? <p className="text-sm">Zatím nemáš žádný životopis. <Link to="/cv" className="text-red-accent underline">Vytvořit životopis</Link></p>
              : <div className="space-y-2"><Label htmlFor="cv">Životopis</Label>
                  <select id="cv" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={cvId} onChange={(e) => setCvId(e.target.value)}>
                    {cvs.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select></div>)}
            <div className="space-y-2"><Label htmlFor="note">{mode === "cv" ? "Krátká poznámka (nepovinné)" : "Zpráva *"}</Label>
              <Textarea id="note" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Firma odpoví na e-mail tvého účtu.</p>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Souhlasím, že mé jméno, e-mail{mode === "cv" ? ", životopis" : ""} a zpráva budou předány firmě {companyName} kvůli této nabídce.
            </label>
            <Button className="w-full" disabled={!consent || sending || (mode === "cv" ? !cvId : !note.trim())} onClick={submit}>
              {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Odeslat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
