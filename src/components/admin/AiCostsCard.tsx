import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";

interface Row { function_name: string; model: string; estimated_cost_usd: number | null; created_at: string; }

export default function AiCostsCard() {
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<{ total: number; calls: number; limit: number } | null>(null);
  const [weekTotal, setWeekTotal] = useState(0);
  const [byFunc, setByFunc] = useState<Array<{ k: string; cost: number; count: number }>>([]);
  const [byModel, setByModel] = useState<Array<{ k: string; cost: number; count: number }>>([]);
  const [limitDraft, setLimitDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [budgetRes, weekRes] = await Promise.all([
        supabase.from("ai_daily_budget").select("*").eq("date", todayStr).maybeSingle(),
        supabase.from("ai_call_log").select("function_name, model, estimated_cost_usd, created_at")
          .gte("created_at", weekAgo).limit(5000),
      ]);
      const b = (budgetRes.data ?? null) as any;
      setToday({
        total: Number(b?.total_cost_usd ?? 0),
        calls: Number(b?.call_count ?? 0),
        limit: Number(b?.daily_limit_usd ?? 3.0),
      });
      setLimitDraft(String(b?.daily_limit_usd ?? "3.0"));
      const rows = (weekRes.data ?? []) as Row[];
      const week = rows.reduce((s, r) => s + Number(r.estimated_cost_usd ?? 0), 0);
      setWeekTotal(week);
      const groupBy = (key: keyof Row) => {
        const m = new Map<string, { cost: number; count: number }>();
        for (const r of rows) {
          const k = String(r[key] ?? "—");
          const cur = m.get(k) ?? { cost: 0, count: 0 };
          cur.cost += Number(r.estimated_cost_usd ?? 0);
          cur.count += 1;
          m.set(k, cur);
        }
        return Array.from(m.entries())
          .map(([k, v]) => ({ k, ...v }))
          .sort((a, b) => b.cost - a.cost);
      };
      setByFunc(groupBy("function_name"));
      setByModel(groupBy("model"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveLimit = async () => {
    const v = Number(limitDraft);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Limit musí být kladné číslo");
      return;
    }
    setSaving(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    // Ensure row exists, then update
    await supabase.from("ai_daily_budget").upsert(
      { date: todayStr, daily_limit_usd: v },
      { onConflict: "date" },
    );
    setSaving(false);
    toast.success(`Denní limit nastaven na $${v.toFixed(2)}`);
    load();
  };

  const pct = today && today.limit > 0
    ? Math.min(100, Math.round((today.total / today.limit) * 100))
    : 0;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4" /> AI náklady
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {today && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Dnes: <strong>${today.total.toFixed(4)}</strong> / ${today.limit.toFixed(2)} ({today.calls} volání)</span>
              <span className="text-muted-foreground">Týden: ${weekTotal.toFixed(4)}</span>
            </div>
            <Progress value={pct} className={pct >= 90 ? "[&>div]:bg-rose-500" : pct >= 70 ? "[&>div]:bg-amber-500" : ""} />
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Denní limit (USD)</label>
            <Input
              type="number"
              step="0.1"
              value={limitDraft}
              onChange={(e) => setLimitDraft(e.target.value)}
            />
          </div>
          <Button onClick={saveLimit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložit"}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Podle funkce (7 dní)</div>
            <div className="space-y-1 text-sm">
              {byFunc.length === 0 && <div className="text-xs text-muted-foreground">Žádná data</div>}
              {byFunc.map((r) => (
                <div key={r.k} className="flex justify-between">
                  <span className="truncate">{r.k}</span>
                  <span className="tabular-nums text-muted-foreground">${r.cost.toFixed(4)} · {r.count}×</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Podle modelu (7 dní)</div>
            <div className="space-y-1 text-sm">
              {byModel.length === 0 && <div className="text-xs text-muted-foreground">Žádná data</div>}
              {byModel.map((r) => (
                <div key={r.k} className="flex justify-between">
                  <span className="truncate">{r.k}</span>
                  <span className="tabular-nums text-muted-foreground">${r.cost.toFixed(4)} · {r.count}×</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}