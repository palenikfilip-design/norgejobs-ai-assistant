import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Database,
  ExternalLink,
  Loader2,
  MessageCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  Zap,
} from "lucide-react";
import ArchilesLayout, { formatRelative } from "./ArchilesLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AiCostsCard from "@/components/admin/AiCostsCard";

interface Metrics {
  jobsTotal: number;
  jobs7dAgo: number;
  pendingReview: number;
  activeSources: number;
  lastEnrichmentAt: string | null;
  avgTrust: number;
  sparsePct: number;
}

interface Activity {
  id: string;
  decision_type: string;
  archiles_choice: Record<string, unknown> | null;
  confidence: number;
  created_at: string;
  job_title: string | null;
  job_source: string | null;
  job_url: string | null;
}

function ConfidenceBadge({ value }: { value: number }) {
  const tone =
    value >= 70 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    : value >= 40 ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
    : "bg-rose-500/20 text-rose-300 border-rose-500/30";
  return <Badge variant="outline" className={tone}>{value}%</Badge>;
}

export default function ArchilesDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Backfill state
  const [bfRunning, setBfRunning] = useState(false);
  const [bfTotal, setBfTotal] = useState(0);
  const [bfDone, setBfDone] = useState(0);
  const [bfStartedAt, setBfStartedAt] = useState<number | null>(null);
  const [bfError, setBfError] = useState<{ message: string; billing?: boolean } | null>(null);
  const [bfSummary, setBfSummary] = useState<{ processed: number; avgTrust: number; sparsePct: number } | null>(null);
  const bfStopRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

      const [
        jobsTotalRes,
        jobs7Res,
        pendingRes,
        activeSrcRes,
        lastDecRes,
        avgTrustRes,
        sparseRes,
        totalEnrichedRes,
        activityRes,
      ] = await Promise.all([
        supabase.from("public_jobs").select("id", { count: "exact", head: true }),
        supabase.from("public_jobs").select("id", { count: "exact", head: true }).lt("created_at", sevenDaysAgo),
        supabase.from("public_jobs").select("id", { count: "exact", head: true }).eq("needs_review", true),
        supabase.from("job_sources").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("archiles_decisions").select("created_at").order("created_at", { ascending: false }).limit(1),
        supabase.from("public_jobs").select("trust_score").not("enriched_at", "is", null).limit(2000),
        supabase.from("public_jobs").select("id", { count: "exact", head: true }).eq("data_completeness", "sparse").not("enriched_at", "is", null),
        supabase.from("public_jobs").select("id", { count: "exact", head: true }).not("enriched_at", "is", null),
        supabase
          .from("archiles_decisions")
          .select("id, decision_type, archiles_choice, confidence, created_at, job_id")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const trustScores = (avgTrustRes.data ?? []).map((r) => (r as { trust_score: number }).trust_score ?? 0);
      const avgTrust = trustScores.length ? Math.round(trustScores.reduce((a, b) => a + b, 0) / trustScores.length) : 0;

      const totalEnriched = totalEnrichedRes.count ?? 0;
      const sparseCount = sparseRes.count ?? 0;
      const sparsePct = totalEnriched > 0 ? Math.round((sparseCount / totalEnriched) * 100) : 0;

      setMetrics({
        jobsTotal: jobsTotalRes.count ?? 0,
        jobs7dAgo: jobs7Res.count ?? 0,
        pendingReview: pendingRes.count ?? 0,
        activeSources: activeSrcRes.count ?? 0,
        lastEnrichmentAt: lastDecRes.data?.[0]?.created_at ?? null,
        avgTrust,
        sparsePct,
      });

      // Enrich activity with job info
      const decisions = activityRes.data ?? [];
      const jobIds = Array.from(new Set(decisions.map((d) => (d as any).job_id).filter(Boolean)));
      let jobMap: Record<string, { title: string; source: string; url: string }> = {};
      if (jobIds.length) {
        const jr = await supabase.from("public_jobs").select("id, title, source_portal, url").in("id", jobIds);
        (jr.data ?? []).forEach((j: any) => { jobMap[j.id] = { title: j.title, source: j.source_portal, url: j.url }; });
      }
      setActivity(
        decisions.map((d: any) => ({
          id: d.id,
          decision_type: d.decision_type,
          archiles_choice: d.archiles_choice,
          confidence: d.confidence,
          created_at: d.created_at,
          job_title: jobMap[d.job_id]?.title ?? null,
          job_source: jobMap[d.job_id]?.source ?? null,
          job_url: jobMap[d.job_id]?.url ?? null,
        })),
      );
    } catch (e) {
      console.error("dashboard load", e);
      toast.error("Nepodařilo se načíst data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runBackfill = useCallback(async () => {
    setBfError(null);
    setBfSummary(null);
    bfStopRef.current = false;

    // Initial pending count
    const { count: initialPending, error: cntErr } = await supabase
      .from("public_jobs")
      .select("id", { count: "exact", head: true })
      .is("enriched_at", null);
    if (cntErr) {
      setBfError({ message: `Nepodařilo se načíst frontu: ${cntErr.message}` });
      return;
    }
    const total = initialPending ?? 0;
    if (total === 0) {
      toast.success("Fronta je prázdná — není co zpracovat.");
      return;
    }

    setBfRunning(true);
    setBfTotal(total);
    setBfDone(0);
    setBfStartedAt(Date.now());

    let processed = 0;
    const BATCH = 50;
    while (!bfStopRef.current) {
      const t0 = Date.now();
      const { data, error } = await supabase.functions.invoke("archiles-enrich", {
        body: { batch_size: BATCH },
      });
      if (error) {
        const msg = String(error.message ?? error);
        const billing = /402|payment_required|insufficient|credit/i.test(msg) ||
          /402|payment_required|insufficient|credit/i.test(JSON.stringify((data as any) ?? {}));
        setBfError({
          message: billing
            ? "AI Gateway: nedostatek kreditů (402 payment_required). Smyčka zastavena."
            : `Dávka selhala: ${msg}`,
          billing,
        });
        break;
      }
      const resp = (data ?? {}) as { processed?: number; succeeded?: number; failed?: number };
      const batchProcessed = resp.processed ?? 0;
      processed += batchProcessed;
      setBfDone((d) => Math.min(total, d + batchProcessed));

      if (batchProcessed === 0) break; // queue empty

      // Brief breather to avoid hammering
      const elapsed = Date.now() - t0;
      if (elapsed < 500) await new Promise((r) => setTimeout(r, 500 - elapsed));
    }

    setBfRunning(false);

    // Final summary
    try {
      const [trustRes, sparseRes, enrichedRes] = await Promise.all([
        supabase.from("public_jobs").select("trust_score").not("enriched_at", "is", null).limit(2000),
        supabase.from("public_jobs").select("id", { count: "exact", head: true }).eq("data_completeness", "sparse").not("enriched_at", "is", null),
        supabase.from("public_jobs").select("id", { count: "exact", head: true }).not("enriched_at", "is", null),
      ]);
      const scores = (trustRes.data ?? []).map((r: any) => r.trust_score ?? 0);
      const avgTrust = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
      const totalEnriched = enrichedRes.count ?? 0;
      const sparseCount = sparseRes.count ?? 0;
      const sparsePct = totalEnriched > 0 ? Math.round((sparseCount / totalEnriched) * 100) : 0;
      setBfSummary({ processed, avgTrust, sparsePct });
    } catch (e) {
      console.error("summary", e);
    }
    load();
  }, [load]);

  const stopBackfill = () => {
    bfStopRef.current = true;
    toast.message("Zastavuji po dokončení aktuální dávky…");
  };

  const bfPct = bfTotal > 0 ? Math.min(100, Math.round((bfDone / bfTotal) * 100)) : 0;
  const bfEtaMin = (() => {
    if (!bfStartedAt || bfDone === 0) return null;
    const elapsed = (Date.now() - bfStartedAt) / 1000;
    const rate = bfDone / elapsed; // jobs/s
    const remaining = Math.max(0, bfTotal - bfDone);
    return rate > 0 ? Math.ceil(remaining / rate / 60) : null;
  })();

  const trigger = async (fn: string, body?: Record<string, unknown>) => {
    setRunning(fn);
    try {
      const { error } = await supabase.functions.invoke(fn, { body: body ?? {} });
      if (error) throw error;
      toast.success(`${fn} spuštěno`);
      setTimeout(load, 1500);
    } catch (e: any) {
      toast.error(`${fn} selhalo: ${e.message ?? e}`);
    } finally {
      setRunning(null);
    }
  };

  const delta = metrics ? metrics.jobsTotal - metrics.jobs7dAgo : 0;

  return (
    <ArchilesLayout
      title="Dashboard"
      actions={
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Obnovit
        </Button>
      }
    >
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Jobs v katalogu</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{metrics?.jobsTotal ?? "—"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {delta >= 0 ? <ArrowUp className="h-3 w-3 text-emerald-400" /> : <ArrowDown className="h-3 w-3 text-rose-400" />}
              {Math.abs(delta)} za 7 dní
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30" onClick={() => navigate("/admin/archiles/review")}>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Čeká na schválení</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{metrics?.pendingReview ?? "—"}</div>
            <div className="text-xs text-primary">Otevřít Review Queue →</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Aktivní zdroje</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold flex items-center gap-2"><Database className="h-5 w-5 text-muted-foreground" />{metrics?.activeSources ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Poslední enrichment</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatRelative(metrics?.lastEnrichmentAt)}</div>
            <div className="text-xs text-muted-foreground">{metrics?.lastEnrichmentAt ? new Date(metrics.lastEnrichmentAt).toLocaleString("cs-CZ") : "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Průměrný trust score</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-muted-foreground" />{metrics?.avgTrust ?? "—"}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30" onClick={() => navigate("/admin/archiles/review?mode=sparse")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground" title="Podíl jobů, kde Archiles získal jen velmi málo informací (chybí popis, plat, jazyk apod.). Doporučeno ověřit na původním zdroji.">
              Sparse data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-400" />{metrics?.sparsePct ?? 0}%</div>
            <div className="text-xs text-primary">Otevřít Sparse Queue →</div>
          </CardContent>
        </Card>
      </div>

      {/* Activity feed */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Aktivita Archila</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {!loading && activity.length === 0 && <div className="text-sm text-muted-foreground">Zatím žádná aktivita.</div>}
          {activity.map((a) => (
            <div key={a.id} className="border border-border rounded-md p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setExpanded((e) => (e === a.id ? null : a.id))}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{a.decision_type}</Badge>
                    <span className="text-xs text-muted-foreground">{formatRelative(a.created_at)}</span>
                    <ConfidenceBadge value={a.confidence} />
                  </div>
                  <div className="mt-1 font-medium truncate">{a.job_title ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{a.job_source ?? "—"}</div>
                </button>
                {a.job_url && (
                  <a
                    href={a.job_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0 mt-1"
                    title="Otevřít původní inzerát"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Originál
                  </a>
                )}
              </div>
              {expanded === a.id && (
                <pre className="mt-3 bg-muted/40 rounded p-2 text-xs overflow-x-auto max-h-64">{JSON.stringify(a.archiles_choice, null, 2)}</pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <AiCostsCard />

      {/* Quick actions */}
      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Rychlé akce</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => trigger("ingest-jobs")} disabled={running !== null}>
            {running === "ingest-jobs" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            Spustit ingest
          </Button>
          <Button variant="secondary" onClick={() => trigger("archiles-enrich", { batch_size: 50 })} disabled={running !== null}>
            {running === "archiles-enrich" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Spustit enrichment (50)
          </Button>
          {!bfRunning ? (
            <Button variant="default" onClick={runBackfill} disabled={running !== null}>
              <Zap className="h-4 w-4 mr-2" />
              Run Backfill
            </Button>
          ) : (
            <Button variant="destructive" onClick={stopBackfill}>
              <Square className="h-4 w-4 mr-2" />
              Zastavit backfill
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate("/admin/archiles/chat")}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Otevřít chat s Archilem
          </Button>

          {(bfRunning || bfDone > 0 || bfError || bfSummary) && (
            <div className="w-full mt-3 space-y-2">
              {(bfRunning || bfDone > 0) && (
                <>
                  <Progress value={bfPct} />
                  <div className="text-xs text-muted-foreground">
                    Zpracováno {bfDone} / {bfTotal}
                    {bfEtaMin !== null && bfRunning ? `, zbývá ~${bfEtaMin} min` : ""}
                    {!bfRunning && bfDone > 0 ? " — zastaveno" : ""}
                  </div>
                </>
              )}
              {bfError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Backfill selhal</AlertTitle>
                  <AlertDescription>
                    {bfError.message}
                    {bfError.billing && (
                      <>
                        {" "}
                        <a
                          href="https://lovable.dev/settings/workspace/billing"
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-primary"
                        >
                          Otevřít Billing →
                        </a>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {bfSummary && !bfError && (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Hotovo</AlertTitle>
                  <AlertDescription>
                    Zpracováno {bfSummary.processed} jobů. Avg trust score: {bfSummary.avgTrust}. Sparse: {bfSummary.sparsePct}%.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </ArchilesLayout>
  );
}