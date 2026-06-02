import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import ArchilesLayout, { formatRelative } from "./ArchilesLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface PendingSource {
  id: string;
  name: string;
  source_type: string;
  tier: number;
  country: string | null;
  config: Record<string, any>;
  created_at: string;
}

export default function ArchilesSourcesQueue() {
  const [rows, setRows] = useState<PendingSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_sources")
        .select("id, name, source_type, tier, country, config, created_at")
        .eq("is_active", false)
        .is("last_run_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as PendingSource[]);
    } catch (e: any) {
      toast.error(`Načtení selhalo: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (s: PendingSource) => {
    setBusyId(s.id);
    try {
      const { error } = await supabase.from("job_sources").update({ is_active: true }).eq("id", s.id);
      if (error) throw error;
      toast.success(`Schváleno: ${s.name}`);
      setRows((prev) => prev.filter((r) => r.id !== s.id));
    } catch (e: any) {
      toast.error(`Selhalo: ${e.message ?? e}`);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase.from("job_sources").delete().eq("id", id);
      if (error) throw error;
      toast.success("Zamítnuto");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      toast.error(`Selhalo: ${e.message ?? e}`);
    } finally {
      setBusyId(null);
      setRejectId(null);
    }
  };

  const sampleUrl = (s: PendingSource): string | null => {
    const cfg = s.config ?? {};
    if (cfg.url) return cfg.url as string;
    if (cfg.base_url) return cfg.base_url as string;
    if (cfg.slug && s.source_type === "greenhouse") return `https://boards.greenhouse.io/${cfg.slug}`;
    if (cfg.slug && s.source_type === "lever") return `https://jobs.lever.co/${cfg.slug}`;
    if (cfg.slug && s.source_type === "ashby") return `https://jobs.ashbyhq.com/${cfg.slug}`;
    if (cfg.tenant && s.source_type === "workday") return `https://${cfg.tenant}.wd1.myworkdayjobs.com`;
    return null;
  };

  return (
    <ArchilesLayout
      title="Sources Queue"
      actions={
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Obnovit
        </Button>
      }
    >
      <ConfirmDialog
        open={rejectId !== null}
        title="Zamítnout zdroj?"
        description="Zdroj bude smazán z databáze."
        onConfirm={() => rejectId && reject(rejectId)}
        onCancel={() => setRejectId(null)}
        confirmLabel="Zamítnout"
      />

      <p className="text-sm text-muted-foreground mb-4">
        Zdroje navržené Archilem nebo přidané z Investigation čekající na tvé schválení. Schválené přejdou do aktivních zdrojů a začnou stahovat nabídky.
      </p>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading && <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {!loading && rows.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">Žádné zdroje nečekají na schválení.</div>
          )}
          {!loading && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-center">Tier</th>
                  <th className="p-2 text-left">Country</th>
                  <th className="p-2 text-left">Config</th>
                  <th className="p-2 text-left">Vytvořeno</th>
                  <th className="p-2 text-right">Akce</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const url = sampleUrl(s);
                  return (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/20 align-top">
                      <td className="p-2 font-medium">{s.name}</td>
                      <td className="p-2"><Badge variant="outline">{s.source_type}</Badge></td>
                      <td className="p-2 text-center">{s.tier}</td>
                      <td className="p-2 text-xs">{s.country ?? "—"}</td>
                      <td className="p-2 text-xs">
                        <pre className="bg-muted/40 rounded p-1 text-[10px] max-w-xs overflow-x-auto">{JSON.stringify(s.config ?? {}, null, 0)}</pre>
                        {url && (
                          <a href={url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-xs mt-1 hover:underline">
                            <ExternalLink className="h-3 w-3" /> Otevřít zdroj
                          </a>
                        )}
                      </td>
                      <td className="p-2 text-xs">{formatRelative(s.created_at)}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="default" disabled={busyId === s.id} onClick={() => approve(s)} className="mr-1">
                          <Check className="h-4 w-4 mr-1" /> Schválit
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busyId === s.id} onClick={() => setRejectId(s.id)}>
                          <X className="h-4 w-4 text-rose-400" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </ArchilesLayout>
  );
}