import { Fragment, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ExternalLink, Hourglass, Loader2, RefreshCw } from "lucide-react";
import ArchilesLayout, { formatRelative } from "./ArchilesLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface Job {
  id: string;
  title: string;
  company: string | null;
  country: string | null;
  region: string | null;
  source_portal: string;
  salary_normalized_eur: number | null;
  trust_score: number;
  archiles_confidence: number;
  data_completeness: string;
  needs_review: boolean;
  created_at: string;
  url: string;
  description: string | null;
  language_requirements: unknown;
  expat_openness: string;
  skill_level: string;
  category: string | null;
  trust_signals: Record<string, unknown> | null;
  archiles_notes: string | null;
  raw_data: Record<string, unknown> | null;
}

const COMPLETENESS_OPTS = ["complete", "partial", "sparse", "unknown"];

function TrustDot({ score }: { score: number }) {
  const cls =
    score >= 80 ? "bg-emerald-500"
    : score >= 60 ? "bg-sky-500"
    : score >= 40 ? "bg-amber-500"
    : "bg-rose-500";
  return <span title={`Trust: ${score}`} className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function CompletenessBadge({ value }: { value: string }) {
  const tone =
    value === "complete" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    : value === "partial" ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
    : value === "sparse" ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
    : "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={tone}>{value}</Badge>;
}

const DEFAULT_PAGE_SIZE = 20;

export default function ArchilesReview() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode"); // "sparse" or null
  const sparseMode = mode === "sparse";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageSizeInput, setPageSizeInput] = useState(String(DEFAULT_PAGE_SIZE));
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Job>>>({});
  const [confirmReject, setConfirmReject] = useState<string[] | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [trustRange, setTrustRange] = useState<[number, number]>([0, 100]);
  const [confRange, setConfRange] = useState<[number, number]>([0, 100]);
  const [completeness, setCompleteness] = useState<string[]>(sparseMode ? ["sparse"] : []);
  const [hasSalary, setHasSalary] = useState(false);
  const [redFlags, setRedFlags] = useState(false);

  const [sourceOptions, setSourceOptions] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("public_jobs")
      .select("source_portal")
      .match(sparseMode ? { data_completeness: "sparse" } : { needs_review: true })
      .limit(500)
      .then(({ data }) => {
        const set = new Set<string>();
        (data ?? []).forEach((r: any) => r.source_portal && set.add(r.source_portal));
        setSourceOptions(Array.from(set).sort());
      });
  }, [sparseMode]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("public_jobs")
        .select(
          "id, title, company, country, region, source_portal, salary_normalized_eur, trust_score, archiles_confidence, data_completeness, needs_review, created_at, url, description, language_requirements, expat_openness, skill_level, category, trust_signals, archiles_notes, raw_data",
          { count: "exact" },
        )
        .gte("trust_score", trustRange[0])
        .lte("trust_score", trustRange[1])
        .gte("archiles_confidence", confRange[0])
        .lte("archiles_confidence", confRange[1])
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (sparseMode) {
        q = q.eq("data_completeness", "sparse");
      } else {
        q = q.eq("needs_review", true);
      }
      if (sourceFilter) q = q.eq("source_portal", sourceFilter);
      if (country) q = q.eq("country", country);
      if (completeness.length) q = q.in("data_completeness", completeness);
      if (hasSalary) q = q.not("salary_normalized_eur", "is", null);

      const { data, count, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as Job[];
      if (redFlags) {
        rows = rows.filter((r) => {
          const sig = r.trust_signals as any;
          return sig && Array.isArray(sig.red_flags) && sig.red_flags.length > 0;
        });
      }
      setJobs(rows);
      setTotalCount(count ?? 0);
    } catch (e: any) {
      toast.error(`Načtení selhalo: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sourceFilter, country, trustRange, confRange, completeness, hasSalary, redFlags, sparseMode]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(totalCount / pageSize));

  const toggleSel = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const approveOne = async (job: Job) => {
    const edit = edits[job.id] ?? {};
    const updates: any = { needs_review: false, reviewed_at: new Date().toISOString() };
    const changed: Record<string, unknown> = {};
    (["category", "expat_openness", "skill_level"] as const).forEach((k) => {
      if (edit[k] !== undefined && edit[k] !== (job as any)[k]) {
        updates[k] = edit[k];
        changed[k] = { from: (job as any)[k], to: edit[k] };
      }
    });
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes.user) updates.reviewed_by = userRes.user.id;
      const { error } = await supabase.from("public_jobs").update(updates).eq("id", job.id);
      if (error) throw error;
      await supabase.from("archiles_decisions").insert([
        {
          job_id: job.id,
          decision_type: "admin_review",
          archiles_choice: {
            category: job.category,
            expat_openness: job.expat_openness,
            skill_level: job.skill_level,
            trust_score: job.trust_score,
          },
          admin_choice: changed as any,
          admin_id: userRes.user?.id ?? null,
          confidence: job.archiles_confidence,
          resolved_at: new Date().toISOString(),
        },
      ]);
      toast.success(`Schváleno: ${job.title}`);
      setEdits((e) => { const n = { ...e }; delete n[job.id]; return n; });
      setExpanded(null);
      load();
    } catch (e: any) {
      toast.error(`Selhalo: ${e.message ?? e}`);
    }
  };

  const bulkApprove = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const { error } = await supabase
        .from("public_jobs")
        .update({ needs_review: false, reviewed_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      toast.success(`Schváleno ${ids.length} jobů`);
      setSelected(new Set());
      load();
    } catch (e: any) {
      toast.error(`Selhalo: ${e.message ?? e}`);
    }
  };

  const rejectIds = async (ids: string[]) => {
    try {
      // is_active column may not exist on all rows — set needs_review=false and rely on raw_data for safety
      // Use update to deactivate instead.
      const { error } = await supabase
        .from("public_jobs")
        .update({ needs_review: false, reviewed_at: new Date().toISOString(), archiles_notes: "REJECTED by admin" })
        .in("id", ids);
      if (error) throw error;
      toast.success(`Zamítnuto ${ids.length} jobů`);
      setSelected(new Set());
      setConfirmReject(null);
      load();
    } catch (e: any) {
      toast.error(`Selhalo: ${e.message ?? e}`);
    }
  };

  const visibleIds = jobs.map((j) => j.id);

  return (
    <ArchilesLayout
      title={`${sparseMode ? "Sparse Queue" : "Review Queue"} (${totalCount})`}
      actions={
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Obnovit
        </Button>
      }
    >
      <ConfirmDialog
        open={confirmReject !== null}
        title={`Zamítnout ${confirmReject?.length ?? 0} jobů?`}
        description="Joby zmizí z review queue. Tato akce se zapíše do logu."
        confirmLabel="Zamítnout"
        onConfirm={() => confirmReject && rejectIds(confirmReject)}
        onCancel={() => setConfirmReject(null)}
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Filtry</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Source portal</Label>
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}
              className="w-full mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Vše</option>
              {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Country (kód)</Label>
            <Input value={country} onChange={(e) => { setCountry(e.target.value.toUpperCase()); setPage(0); }} placeholder="např. NO" />
          </div>
          <div>
            <Label className="text-xs">Completeness</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COMPLETENESS_OPTS.map((c) => (
                <label key={c} className="flex items-center gap-1 text-xs">
                  <Checkbox
                    checked={completeness.includes(c)}
                    onCheckedChange={(v) => {
                      setCompleteness((p) => v ? [...p, c] : p.filter((x) => x !== c));
                      setPage(0);
                    }}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Trust {trustRange[0]}–{trustRange[1]}</Label>
            <Slider min={0} max={100} step={5} value={trustRange} onValueChange={(v) => setTrustRange([v[0], v[1]] as [number, number])} />
          </div>
          <div>
            <Label className="text-xs">Confidence {confRange[0]}–{confRange[1]}</Label>
            <Slider min={0} max={100} step={5} value={confRange} onValueChange={(v) => setConfRange([v[0], v[1]] as [number, number])} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between gap-2">
              <span className="text-xs">Má salary EUR</span>
              <Switch checked={hasSalary} onCheckedChange={(v) => { setHasSalary(v); setPage(0); }} />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-xs">Red flags</span>
              <Switch checked={redFlags} onCheckedChange={setRedFlags} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" disabled={selected.size === 0} onClick={() => bulkApprove(Array.from(selected))}>
          Schválit vybrané ({selected.size})
        </Button>
        <Button size="sm" variant="secondary" onClick={() => bulkApprove(visibleIds)} disabled={!visibleIds.length}>
          Schválit vše na stránce
        </Button>
        <Button size="sm" variant="destructive" disabled={selected.size === 0} onClick={() => setConfirmReject(Array.from(selected))}>
          Zamítnout vybrané
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading && <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {!loading && jobs.length === 0 && <div className="p-6 text-sm text-muted-foreground">Žádné joby k review.</div>}
          {!loading && jobs.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2"></th>
                  <th className="p-2 text-left">Title / Company</th>
                  <th className="p-2 text-left">Source</th>
                  <th className="p-2 text-left">Country</th>
                  <th className="p-2 text-right">Salary €</th>
                  <th className="p-2 text-center">Compl.</th>
                  <th className="p-2 text-center">Conf.</th>
                  <th className="p-2 text-left">Created</th>
                  <th className="p-2 text-right">Akce</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <Fragment key={j.id}>
                    <tr className="border-t border-border hover:bg-muted/20">
                      <td className="p-2"><Checkbox checked={selected.has(j.id)} onCheckedChange={() => toggleSel(j.id)} /></td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <TrustDot score={j.trust_score} />
                          {j.needs_review && (
                            <Hourglass className="h-4 w-4 text-amber-400" aria-label="Čeká na schválení" />
                          )}
                        </div>
                      </td>
                      <td className="p-2 max-w-[280px]">
                        <button className="text-left" onClick={() => setExpanded((e) => e === j.id ? null : j.id)}>
                          <div className="font-medium truncate flex items-center gap-1">
                            {expanded === j.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {j.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{j.company ?? "—"}</div>
                        </button>
                      </td>
                      <td className="p-2 text-xs">{j.source_portal}</td>
                      <td className="p-2 text-xs">{j.country ?? "—"} {j.region && <span className="text-muted-foreground">/ {j.region}</span>}</td>
                      <td className="p-2 text-right">{j.salary_normalized_eur ? `${j.salary_normalized_eur}` : "—"}</td>
                      <td className="p-2 text-center"><CompletenessBadge value={j.data_completeness} /></td>
                      <td className="p-2 text-center">{j.archiles_confidence}%</td>
                      <td className="p-2 text-xs">{formatRelative(j.created_at)}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => approveOne(j)}>✅</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmReject([j.id])}>❌</Button>
                        <a href={j.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-8 w-8 hover:bg-muted rounded"><ExternalLink className="h-3 w-3" /></a>
                      </td>
                    </tr>
                    {expanded === j.id && (
                      <tr className="border-t border-border bg-muted/10">
                        <td colSpan={10} className="p-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                              <div className="max-h-64 overflow-y-auto text-sm bg-background border border-border rounded p-2 whitespace-pre-wrap">
                                {j.description ?? <em className="text-muted-foreground">žádný popis</em>}
                              </div>
                              {j.archiles_notes && (
                                <div className="mt-2 text-xs p-2 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded">
                                  ⚠️ {j.archiles_notes}
                                </div>
                              )}
                            </div>
                            <div className="space-y-3">
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">Enrichment</div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <Label>Category</Label>
                                  <Input value={edits[j.id]?.category ?? j.category ?? ""} onChange={(e) => setEdits((p) => ({ ...p, [j.id]: { ...p[j.id], category: e.target.value } }))} />
                                  <Label>Expat openness</Label>
                                  <Input value={edits[j.id]?.expat_openness ?? j.expat_openness} onChange={(e) => setEdits((p) => ({ ...p, [j.id]: { ...p[j.id], expat_openness: e.target.value } }))} />
                                  <Label>Skill level</Label>
                                  <Input value={edits[j.id]?.skill_level ?? j.skill_level} onChange={(e) => setEdits((p) => ({ ...p, [j.id]: { ...p[j.id], skill_level: e.target.value } }))} />
                                  <Label>Languages</Label>
                                  <div className="text-xs">{JSON.stringify(j.language_requirements)}</div>
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">Trust signals</div>
                                <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto max-h-32">{JSON.stringify(j.trust_signals, null, 2)}</pre>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => approveOne(j)}>Approve & learn</Button>
                                <a href={j.url} target="_blank" rel="noreferrer">
                                  <Button size="sm" variant="outline">Open original <ExternalLink className="h-3 w-3 ml-1" /></Button>
                                </a>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-3 text-sm">
        <div className="text-muted-foreground">Stránka {page + 1} / {pages}</div>
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">Na stránku:</Label>
          <Input
            type="number"
            min={1}
            max={500}
            value={pageSizeInput}
            onChange={(e) => setPageSizeInput(e.target.value)}
            onBlur={() => {
              const n = parseInt(pageSizeInput, 10);
              if (!isNaN(n) && n > 0 && n <= 500) { setPageSize(n); setPage(0); }
              else setPageSizeInput(String(pageSize));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="h-8 w-20"
          />
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Předchozí</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Další</Button>
        </div>
      </div>
    </ArchilesLayout>
  );
}