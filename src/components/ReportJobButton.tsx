import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { REPORT_REASONS } from "@/lib/reviewQueue";

/** Logged-in job seekers can report an offer once. */
const ReportJobButton = ({ jobUrl }: { jobUrl: string }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [reason, setReason] = useState("invalid_info");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setOpen(false); navigate("/login"); return; }
      setUserId(session.user.id);
      const { data: job } = await supabase.from("public_jobs").select("id").eq("url", jobUrl).limit(1).maybeSingle();
      if (!job) return;
      setJobId(job.id);
      const { data: mine } = await supabase.from("job_reports").select("id").eq("job_id", job.id).eq("user_id", session.user.id).maybeSingle();
      if (mine) setReported(true);
    })();
  }, [open, jobUrl, navigate]);

  const send = async () => {
    if (!jobId || !userId) return;
    setSending(true);
    const { error } = await supabase.from("job_reports").insert({ job_id: jobId, user_id: userId, reason, details: details.trim() || null });
    setSending(false);
    if (error && error.code !== "23505") return toast({ title: "Nahlášení se nepovedlo", description: error.message, variant: "destructive" });
    setReported(true); setOpen(false);
    toast({ title: "Díky, nabídku zkontrolujeme." });
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setOpen(true)} disabled={reported}>
        <Flag className="w-3 h-3 mr-1" />{reported ? "Nahlášeno" : "Nahlásit nabídku"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nahlásit nabídku</DialogTitle><DialogDescription>Co je s nabídkou špatně?</DialogDescription></DialogHeader>
          {reported ? <p className="text-sm text-muted-foreground">Tuhle nabídku už jsi nahlásil(a).</p> : !jobId ? <p className="text-sm text-muted-foreground">Načítám…</p> : (
            <div className="space-y-4">
              <RadioGroup value={reason} onValueChange={setReason}>
                {Object.entries(REPORT_REASONS).map(([k, l]) => (
                  <div key={k} className="flex items-center gap-2"><RadioGroupItem value={k} id={`r-${k}`} /><Label htmlFor={`r-${k}`}>{l}</Label></div>
                ))}
              </RadioGroup>
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Podrobnosti (nepovinné)" />
            </div>
          )}
          <DialogFooter><Button onClick={send} disabled={!jobId || reported || sending}>Odeslat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
export default ReportJobButton;
