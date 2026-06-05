import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Database, Filter, Loader2, RefreshCw, Sparkles } from "lucide-react";
import ArchilesLayout from "./ArchilesLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CategoryRow {
  category_id: string;
  label_cs: string;
  icon: string;
  color: string;
  job_count: number;
  company_count: number;
  sort_order: number;
}

interface SparseSourceRow {
  source_portal: string;
  sparse: number;
  total: number;
}

interface SparseCategoryRow {
  display_category: string;
  label_cs: string;
  icon: string;
  sparse: number;
  total: number;
}

export default function ArchilesStatistics() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [sparseTotal, setSparseTotal] = useState(0);
  const [enrichedTotal, setEnrichedTotal] = useState(0);
  const [sparseBySource, setSparseBySource] = useState<SparseSourceRow[]>([]);
  const [sparseByCategory, setSparseByCategory] = useState<SparseCategoryRow[]>([]);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, jobsRes, dispCatsRes] = await Promise.all([
        supabase
          .from("leslie_stats_by_category")
          .select("category_id, label_cs, icon, color, job_count, company_count, sort_order")
          .order("job_count", { ascending: false }),
        supabase
          .from("public_jobs")
          .select("source_portal, display_category, data_completeness"),
        supabase
          .from("display_categories")
          .select("id, label_cs, icon"),
      ]);
      if (catRes.error) throw catRes.error;
      if (jobsRes.error) throw jobsRes.error;

      setCategories((catRes.data ?? []) as CategoryRow[]);

      const rows = (jobsRes.data ?? []) as Array<{ source_portal: string; display_category: string; data_completeness: string }>;
      const labelMap = new Map<string, { label_cs: string; icon: string }>();
      (dispCatsRes.data ?? []).forEach((r: any) => labelMap.set(r.id, { label_cs: r.label_cs, icon: r.icon }));

      const srcAgg = new Map<string, SparseSourceRow>();
      const catAgg = new Map<string, SparseCategoryRow>();
      let sparseTot = 0;
      let enrichedTot = 0;
      for (const r of rows) {
        const isSparse = r.data_completeness === "sparse";
        if (r.data_completeness && r.data_completeness !== "unknown") enrichedTot++;
        if (isSparse) sparseTot++;

        const src = r.source_portal ?? "—";
        if (!srcAgg.has(src)) srcAgg.set(src, { source_portal: src, sparse: 0, total: 0 });
        const s = srcAgg.get(src)!;
        s.total++;
        if (isSparse) s.sparse++;

        const cat = r.display_category ?? "other";
        if (!catAgg.has(cat)) {
          const meta = labelMap.get(cat) ?? { label_cs: cat, icon: "📂" };
          catAgg.set(cat, { display_category: cat, label_cs: meta.label_cs, icon: meta.icon, sparse: 0, total: 0 });
        }
        const c = catAgg.get(cat)!;
        c.total++;
        if (isSparse) c.sparse++;
      }

      setSparseTotal(sparseTot);
      setEnrichedTotal(enrichedTot);
      setSparseBySource(
        Array.from(srcAgg.values())
          .filter((s) => s.sparse > 0)
          .sort((a, b) => b.sparse - a.sparse),
      );
      setSparseByCategory(
        Array.from(catAgg.values())
          .filter((c) => c.sparse > 0)
          .sort((a, b) => b.sparse - a.sparse),
      );
    } catch (e: any) {
      toast.error(`Načtení selhalo: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalJobs = categories.reduce((acc, c) => acc + (c.job_count ?? 0), 0);
  const healthyThreshold = totalJobs * 0.05;

  const runReenrich = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("archiles-enrich", {
        body: { batch_size: 50, only_sparse: true },
      });
      if (error) throw error;
      const processed = (data as any)?.processed ?? 0;
      toast.success(`Spuštěno re-enrichment, zpracováno ${processed} jobů.`);
      setTimeout(load, 1500);
    } catch (e: any) {
      toast.error(`Re-enrichment selhal: ${e.message ?? e}`);
    } finally {
      setRunning(false);
    }
  };

  const sparsePct = enrichedTotal > 0 ? Math.round((sparseTotal / enrichedTotal) * 100) : 0;

  const top3Sources = sparseBySource.slice(0, 3);
  const otherSparse = sparseBySource.slice(3).reduce((acc, s) => acc + s.sparse, 0);

  return (
    <ArchilesLayout
      title="Statistiky katalogu"
      actions={
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Obnovit
        </Button>
      }
    >
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 gap-6">
          {/* Category breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rozdělení podle kategorií</CardTitle>
              <p className="text-xs text-muted-foreground">
                Celkem {totalJobs.toLocaleString("cs-CZ")} jobů ve {categories.length} kategoriích. Zvýrazněné řádky tvoří více než 5 % katalogu („zdravé" kategorie).
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-2">Ikona</th>
                      <th className="text-left py-2 pr-2">Kategorie</th>
                      <th className="text-right py-2 pr-2">Joby</th>
                      <th className="text-right py-2 pr-2">Firmy</th>
                      <th className="text-right py-2">% katalogu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => {
                      const pct = totalJobs > 0 ? (c.job_count / totalJobs) * 100 : 0;
                      const healthy = c.job_count > healthyThreshold;
                      return (
                        <tr
                          key={c.category_id}
                          className={`border-b border-border/50 ${healthy ? "bg-emerald-500/5" : ""}`}
                        >
                          <td className="py-2 pr-2 text-lg">{c.icon}</td>
                          <td className="py-2 pr-2 font-medium">
                            {c.label_cs}
                            {healthy && (
                              <Badge variant="outline" className="ml-2 text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                                zdravá
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{c.job_count.toLocaleString("cs-CZ")}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">{c.company_count.toLocaleString("cs-CZ")}</td>
                          <td className="py-2 text-right tabular-nums">{pct.toFixed(1)} %</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/archiles/review?category=other">
                    Procházet „Ostatní" joby
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sparse data analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sparse data analýza</CardTitle>
              <p className="text-xs text-muted-foreground">
                Sparse data znamená, že job nemá dostatečný popis pro kvalitní matching. Cíl: snížit pod 30 %.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                <span className="font-medium">Celkem sparse jobů:</span>{" "}
                <span className="tabular-nums">{sparseTotal.toLocaleString("cs-CZ")}</span>
                <span className="text-muted-foreground"> z {enrichedTotal.toLocaleString("cs-CZ")} obohacených ({sparsePct} %)</span>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2">Podle zdroje</div>
                <div className="space-y-1 font-mono text-xs">
                  {top3Sources.map((s) => {
                    const pct = s.total > 0 ? Math.round((s.sparse / s.total) * 100) : 0;
                    return (
                      <div key={s.source_portal} className="flex justify-between">
                        <span className="truncate pr-2">{s.source_portal}</span>
                        <span className="tabular-nums whitespace-nowrap">
                          {s.sparse.toLocaleString("cs-CZ")} ({pct} % jeho jobů)
                        </span>
                      </div>
                    );
                  })}
                  {otherSparse > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>ostatní zdroje</span>
                      <span className="tabular-nums">{otherSparse.toLocaleString("cs-CZ")}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2">Podle kategorie</div>
                <div className="space-y-1 font-mono text-xs">
                  {sparseByCategory.map((c) => {
                    const pct = c.total > 0 ? Math.round((c.sparse / c.total) * 100) : 0;
                    return (
                      <div key={c.display_category} className="flex justify-between">
                        <span className="truncate pr-2">{c.icon} {c.label_cs}</span>
                        <span className="tabular-nums whitespace-nowrap">
                          {c.sparse.toLocaleString("cs-CZ")} (popis chybí: {pct} %)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <Button size="sm" onClick={runReenrich} disabled={running}>
                  {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Spustit re-enrichment sparse jobů
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/archiles/sources">
                    <Database className="h-4 w-4 mr-2" />
                    Zobrazit zdroje s nejvíc sparse
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/archiles/review?mode=sparse">
                    <Filter className="h-4 w-4 mr-2" />
                    Manuální review sparse
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ArchilesLayout>
  );
}