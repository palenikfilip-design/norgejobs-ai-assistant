import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, RefreshCw, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ADMIN_USER_ID = "db1d3de1-3678-4c31-9416-98b88248ae29";

interface IngestLog {
  id: string;
  source: string;
  status: string;
  jobs_added: number;
  jobs_skipped: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export default function AdminIngest() {
  const { supabaseUser } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [logs, setLogs] = useState<IngestLog[]>([]);
  const [counts, setCounts] = useState<{ total: number; bySource: Record<string, number> }>({ total: 0, bySource: {} });

  const isAdmin = supabaseUser?.id === ADMIN_USER_ID;

  const loadStats = async () => {
    const { count: total } = await supabase.from("public_jobs").select("*", { count: "exact", head: true });
    const { data: logRows } = await supabase
      .from("ingest_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    const { data: jobs } = await supabase.from("public_jobs").select("source_portal");
    const bySource: Record<string, number> = {};
    (jobs ?? []).forEach((j: any) => { bySource[j.source_portal] = (bySource[j.source_portal] ?? 0) + 1; });
    setCounts({ total: total ?? 0, bySource });
    setLogs((logRows ?? []) as IngestLog[]);
  };

  useEffect(() => {
    if (isAdmin) void loadStats();
  }, [isAdmin]);

  const runIngest = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-jobs", { body: {} });
      if (error) throw error;
      const summary = (data?.results ?? []).map((r: any) =>
        `${r.source}: +${r.added} new, ${r.skipped} dup${r.error ? ` (err: ${r.error})` : ""}`
      ).join(" · ");
      toast({ title: "Ingest complete", description: summary || "No data" });
      await loadStats();
    } catch (e: any) {
      toast({ title: "Ingest failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const setupCronSecret = async () => {
    setSettingUp(true);
    try {
      const { error } = await supabase.functions.invoke("setup-cron-secret", { body: {} });
      if (error) throw error;
      toast({ title: "Cron secret stored", description: "Daily 04:00 UTC ingest is now armed." });
    } catch (e: any) {
      toast({ title: "Setup failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSettingUp(false);
    }
  };

  if (!supabaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Sign in to access admin tools.
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Access denied.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Job Ingest Admin</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={setupCronSecret} disabled={settingUp}>
              {settingUp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Setup cron secret
            </Button>
            <Button onClick={runIngest} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Load new jobs
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Total jobs</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{counts.total}</p></CardContent>
          </Card>
          {["mpsv.cz", "nav.no", "eures.ec.europa.eu"].map((s) => (
            <Card key={s}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">{s}</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{counts.bySource[s] ?? 0}</p></CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Recent ingest runs</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No runs yet. Click "Load new jobs".</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Added</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{l.source}</TableCell>
                      <TableCell className={l.status === "success" ? "text-green-600 text-xs" : "text-destructive text-xs"}>{l.status}</TableCell>
                      <TableCell className="text-right text-xs">{l.jobs_added}</TableCell>
                      <TableCell className="text-right text-xs">{l.jobs_skipped}</TableCell>
                      <TableCell className="text-right text-xs">{l.duration_ms ? `${l.duration_ms}ms` : "—"}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-xs truncate">{l.error_message ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}