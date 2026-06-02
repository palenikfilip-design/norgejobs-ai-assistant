import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit, Loader2, PlayCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import ArchilesLayout, { formatRelative } from "./ArchilesLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface Source {
  id: string;
  name: string;
  source_type: string;
  tier: number;
  country: string | null;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  jobs_added_total: number;
  config: Record<string, unknown>;
  jobs_24h?: number;
  avg_trust?: number | null;
}

export default function ArchilesSources() {
  const [rows, setRows] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Investigate
  const [invUrl, setInvUrl] = useState("");
  const [invCompany, setInvCompany] = useState("");
  const [invCountry, setInvCountry] = useState("");
  const [investigating, setInvestigating] = useState(false);
  const [invResult, setInvResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_sources")
        .select("id, name, source_type, tier, country, is_active, last_run_at, last_run_status, jobs_added_total, config")
        .order("name");
      if (error) throw error;
      const list = (data ?? []) as Source[];

      const since24 = new Date(Date.now() - 86400_000).toISOString();
      await Promise.all(list.map(async (s) => {
        const { count } = await supabase.from("public_jobs").select("id", { count: "exact", head: true }).eq("source_id", s.id).gte("created_at", since24);
        s.jobs_24h = count ?? 0;
        const { data: trustRows } = await supabase.from("public_jobs").select("trust_score").eq("source_id", s.id).not("enriched_at", "is", null).limit(500);
        const scores = (trustRows ?? []).map((r: any) => r.trust_score ?? 0);
        s.avg_trust = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      }));
      setRows(list);
    } catch (e: any) {
      toast.error(`Načtení selhalo: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (s: Source) => {
    const { error } = await supabase.from("job_sources").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("Aktualizováno"); load(); }
  };

  const runNow = async (s: Source) => {
    try {
      const { error } = await supabase.functions.invoke("ingest-jobs", { body: { source_ids: [s.id] } });
      if (error) throw error;
      toast.success(`Spuštěno: ${s.name}`);
    } catch (e: any) {
      toast.error(`Selhalo: ${e.message ?? e}`);
    }
  };

  const deleteSource = async (id: string) => {
    const { error } = await supabase.from("job_sources").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Smazáno"); load(); setDeleteId(null); }
  };

  const investigate = async () => {
    setInvestigating(true);
    setInvResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("archiles-investigate-source", {
        body: { url: invUrl || undefined, company: invCompany || undefined, country: invCountry || undefined },
      });
      if (error) throw error;
      setInvResult(data);
    } catch (e: any) {
      toast.error(`Investigation selhala: ${e.message ?? e}`);
    } finally {
      setInvestigating(false);
    }
  };

  const addFromInvestigation = async () => {
    if (!invResult?.detected) return;
    try {
      const { error } = await supabase.from("job_sources").insert([{
        name: invResult.suggested_name ?? invResult.detected.config?.slug ?? "New source",
        source_type: invResult.detected.ats_type,
        tier: 2,
        country: invCountry || null,
        config: invResult.detected.config ?? {},
        is_active: false,
      }]);
      if (error) throw error;
      toast.success("Zdroj přidán (neaktivní)");
      setInvResult(null);
      setInvUrl("");
      load();
    } catch (e: any) {
      toast.error(`Selhalo: ${e.message ?? e}`);
    }
  };

  return (
    <ArchilesLayout
      title="Sources"
      actions={
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Obnovit
        </Button>
      }
    >
      <ConfirmDialog
        open={deleteId !== null}
        title="Smazat zdroj?"
        onConfirm={() => deleteId && deleteSource(deleteId)}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Smazat"
      />

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Přidat nový zdroj</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="investigate">
            <TabsList>
              <TabsTrigger value="investigate">Zeptat se Archila</TabsTrigger>
              <TabsTrigger value="manual">Manuálně</TabsTrigger>
            </TabsList>
            <TabsContent value="investigate" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">URL kariérní stránky</Label>
                  <Input value={invUrl} onChange={(e) => setInvUrl(e.target.value)} placeholder="https://boards.greenhouse.io/discord" />
                </div>
                <div>
                  <Label className="text-xs">Country (volitelné)</Label>
                  <Input value={invCountry} onChange={(e) => setInvCountry(e.target.value.toUpperCase())} placeholder="NO" />
                </div>
              </div>
              <div>
                <Label className="text-xs">…nebo jen jméno firmy</Label>
                <Input value={invCompany} onChange={(e) => setInvCompany(e.target.value)} placeholder="Stripe" />
              </div>
              <Button onClick={investigate} disabled={investigating || (!invUrl && !invCompany)}>
                {investigating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Prozkoumat
              </Button>

              {invResult && (
                <div className="border border-border rounded-md p-3 text-sm">
                  {invResult.detected ? (
                    <div className="space-y-2">
                      <div className="font-medium text-emerald-300">Detekováno: {invResult.detected.ats_type}</div>
                      <pre className="bg-muted/40 rounded p-2 text-xs overflow-x-auto">{JSON.stringify(invResult.detected.config, null, 2)}</pre>
                      {invResult.sample_job && (
                        <div>
                          <div className="text-xs text-muted-foreground">Vzorový job:</div>
                          <div className="text-sm font-medium">{invResult.sample_job.title}</div>
                          <div className="text-xs text-muted-foreground">{invResult.sample_job.location}</div>
                        </div>
                      )}
                      <Button size="sm" onClick={addFromInvestigation}>Přidat tento zdroj (neaktivní)</Button>
                    </div>
                  ) : (
                    <div className="text-amber-300">
                      <div className="font-medium">Detekce selhala</div>
                      <div className="text-xs mt-1">{invResult.reason}</div>
                      {Array.isArray(invResult.possible_reasons) && (
                        <ul className="list-disc pl-4 mt-1 text-xs">
                          {invResult.possible_reasons.map((r: string) => <li key={r}>{r}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            <TabsContent value="manual" className="pt-3 text-sm text-muted-foreground">
              Pro plnou manuální konfiguraci použij stránku <a className="text-primary underline" href="/admin/sources">/admin/sources</a>.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading && <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {!loading && (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-center">Tier</th>
                  <th className="p-2 text-left">Country</th>
                  <th className="p-2 text-center">Aktivní</th>
                  <th className="p-2 text-left">Last run</th>
                  <th className="p-2 text-right">Jobs (24h / total)</th>
                  <th className="p-2 text-right">Avg trust</th>
                  <th className="p-2 text-right">Akce</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-2 font-medium">{s.name}</td>
                    <td className="p-2 text-xs">{s.source_type}</td>
                    <td className="p-2 text-center">{s.tier}</td>
                    <td className="p-2 text-xs">{s.country ?? "—"}</td>
                    <td className="p-2 text-center"><Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} /></td>
                    <td className="p-2 text-xs">
                      {formatRelative(s.last_run_at)}{" "}
                      {s.last_run_status && (
                        <Badge variant="outline" className={
                          s.last_run_status === "success" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : s.last_run_status === "error" ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          : "bg-muted text-muted-foreground"
                        }>{s.last_run_status}</Badge>
                      )}
                    </td>
                    <td className="p-2 text-right text-xs">{s.jobs_24h ?? 0} / {s.jobs_added_total}</td>
                    <td className="p-2 text-right text-xs">{s.avg_trust ?? "—"}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => runNow(s)}><PlayCircle className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </ArchilesLayout>
  );
}