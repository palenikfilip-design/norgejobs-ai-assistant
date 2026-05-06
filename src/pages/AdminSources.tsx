import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Play, Plus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import NotFound from "./NotFound";

const ADMIN_EMAIL = "palenik.filip@gmail.com";

type SourceType =
  | "portal_api" | "ats_greenhouse" | "ats_lever" | "ats_smartrecruiters"
  | "ats_workday" | "ats_personio" | "rss_feed";

interface SourceRow {
  id: string;
  name: string;
  source_type: SourceType;
  tier: number;
  country: string | null;
  sector: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_error: string | null;
  jobs_added_total: number;
}

const TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "portal_api", label: "Portal API" },
  { value: "ats_greenhouse", label: "ATS · Greenhouse" },
  { value: "ats_lever", label: "ATS · Lever" },
  { value: "ats_smartrecruiters", label: "ATS · SmartRecruiters" },
  { value: "ats_workday", label: "ATS · Workday" },
  { value: "ats_personio", label: "ATS · Personio" },
  { value: "rss_feed", label: "RSS feed" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function defaultConfigFor(type: SourceType): string {
  switch (type) {
    case "ats_greenhouse":
    case "ats_lever":
    case "ats_smartrecruiters":
    case "ats_personio":
      return JSON.stringify({ company: "" }, null, 2);
    case "ats_workday":
      return JSON.stringify({ tenant: "", wd: "wd3", site: "" }, null, 2);
    case "rss_feed":
      return JSON.stringify({ url: "" }, null, 2);
    case "portal_api":
      return JSON.stringify({ url: "", json_path: "", field_map: { title: "", url: "", location: "" } }, null, 2);
  }
}

export default function AdminSources() {
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [totalJobs, setTotalJobs] = useState(0);
  const [last24, setLast24] = useState(0);

  // Modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    source_type: "ats_greenhouse" as SourceType,
    tier: 2,
    country: "",
    sector: "",
    config: defaultConfigFor("ats_greenhouse"),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email?.toLowerCase() ?? "";
      setAuthState(email === ADMIN_EMAIL.toLowerCase() ? "ok" : "denied");
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [srcRes, jobsRes, last24Res] = await Promise.all([
      supabase.from("job_sources").select("*").order("tier").order("name"),
      supabase.from("public_jobs").select("id", { count: "exact", head: true }),
      supabase.from("public_jobs").select("id", { count: "exact", head: true }).gte("created_at", since24),
    ]);
    setRows((srcRes.data ?? []) as SourceRow[]);
    setTotalJobs(jobsRes.count ?? 0);
    setLast24(last24Res.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    if (authState === "ok") load();
  }, [authState]);

  const totalActive = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);

  const toggleActive = async (id: string, value: boolean) => {
    const { error } = await supabase.from("job_sources").update({ is_active: value }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else setRows((rs) => rs.map((r) => (r.id === id ? { ...r, is_active: value } : r)));
  };

  const runNow = async (id: string) => {
    setRunning(id);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-jobs", {
        body: { source_id: id, force: true },
      });
      if (error) throw error;
      const r = (data as any)?.results?.[0];
      if (r?.error) toast({ title: "Run finished with error", description: r.error, variant: "destructive" });
      else toast({ title: "Run finished", description: `Added ${r?.added ?? 0} of ${r?.total ?? 0}` });
      await load();
    } catch (e: any) {
      toast({ title: "Run failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  const submitNew = async () => {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(form.config); }
    catch (e: any) {
      toast({ title: "Invalid JSON in config", description: e.message, variant: "destructive" });
      return;
    }
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("job_sources").insert({
      name: form.name.trim(),
      source_type: form.source_type,
      tier: form.tier,
      country: form.country.trim() || null,
      sector: form.sector.trim() || null,
      config: parsed,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Failed to add", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm({ ...form, name: "", country: "", sector: "", config: defaultConfigFor(form.source_type) });
    await load();
  };

  if (authState === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }
  if (authState === "denied") return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back">
            <Link to="/admin"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="font-display font-semibold text-foreground">Admin · Job sources</h1>
            <p className="text-xs text-muted-foreground">Manage feeds Leslie ingests from</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add new source
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Jobs added</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No sources yet.</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{r.source_type}</span></TableCell>
                    <TableCell>T{r.tier}</TableCell>
                    <TableCell className="text-sm">{r.country ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.sector ?? "—"}</TableCell>
                    <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => toggleActive(r.id, v)} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(r.last_run_at)}</TableCell>
                    <TableCell>
                      {r.last_run_status === "success" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">success</Badge>
                      )}
                      {r.last_run_status === "error" && (
                        <Badge variant="destructive" title={r.last_error ?? ""}>error</Badge>
                      )}
                      {!r.last_run_status && <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.jobs_added_total.toLocaleString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" disabled={running === r.id} onClick={() => runNow(r.id)}>
                        {running === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                        Run now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Active sources</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-display font-semibold">{totalActive}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total jobs in catalog</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-display font-semibold">{totalJobs.toLocaleString()}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Added in last 24h</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-display font-semibold">{last24.toLocaleString()}</div></CardContent></Card>
        </section>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add new source</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Equinor Careers" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.source_type} onValueChange={(v: SourceType) => setForm({ ...form, source_type: v, config: defaultConfigFor(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tier</Label>
                <Select value={String(form.tier)} onValueChange={(v) => setForm({ ...form, tier: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tier 1 — hourly</SelectItem>
                    <SelectItem value="2">Tier 2 — every 4 hours</SelectItem>
                    <SelectItem value="3">Tier 3 — daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              <div><Label>Sector</Label><Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></div>
            </div>
            <div>
              <Label>Config (JSON)</Label>
              <Textarea rows={10} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submitNew} disabled={saving}>{saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}