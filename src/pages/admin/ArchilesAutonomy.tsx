import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import ArchilesLayout, { formatRelative } from "./ArchilesLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Autonomy {
  autonomy_level: number;
  auto_publish_threshold: number;
  auto_source_add: boolean;
  auto_delete_dead: boolean;
  auto_recategorize: boolean;
}

const STOPS: { v: number; label: string; desc: string }[] = [
  { v: 0, label: "Plně manuální", desc: "Vše schvaluješ ručně. Archiles jen sbírá a navrhuje." },
  { v: 25, label: "Asistent", desc: "Archiles navrhuje akce, ty potvrzuješ." },
  { v: 50, label: "Partner", desc: "Vysoká confidence (nad threshold) se publikuje automaticky." },
  { v: 75, label: "Autonomní", desc: "Jen extrémní případy a změny zdrojů ke schválení." },
  { v: 100, label: "Plně samostatný", desc: "Jen monitorování. Archiles dělá vše sám." },
];

function interpret(level: number) {
  for (let i = STOPS.length - 1; i >= 0; i--) {
    if (level >= STOPS[i].v) return STOPS[i];
  }
  return STOPS[0];
}

export default function ArchilesAutonomy() {
  const [data, setData] = useState<Autonomy | null>(null);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data: row, error } = await supabase
      .from("archiles_autonomy")
      .select("autonomy_level, auto_publish_threshold, auto_source_add, auto_delete_dead, auto_recategorize")
      .eq("id", 1)
      .maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (row) setData(row as Autonomy);
    const { data: logs } = await supabase
      .from("archiles_autonomy_log")
      .select("id, changed_by, old_values, new_values, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setLog(logs ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("archiles_autonomy").update(data).eq("id", 1);
      if (error) throw error;
      toast.success(`Autonomie nastavena na ${data.autonomy_level}%`);
      load();
    } catch (e: any) {
      toast.error(`Selhalo: ${e.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return (
    <ArchilesLayout title="Autonomie & Nastavení">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </ArchilesLayout>
  );

  const current = interpret(data.autonomy_level);

  return (
    <ArchilesLayout
      title="Autonomie & Nastavení"
      actions={<Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Ukládám…" : "Uložit změny"}</Button>}
    >
      <Card>
        <CardHeader><CardTitle className="text-base">Hlavní úroveň autonomie</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-4xl font-semibold">{data.autonomy_level}%</div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[data.autonomy_level]}
            onValueChange={(v) => setData({ ...data, autonomy_level: v[0] })}
          />
          <div className="grid grid-cols-5 text-[10px] text-muted-foreground">
            {STOPS.map((s) => <div key={s.v} className="text-center">{s.v}%</div>)}
          </div>
          <div className="border border-border rounded-md p-3 bg-muted/20">
            <div className="font-medium">{current.label}</div>
            <div className="text-sm text-muted-foreground">{current.desc}</div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div><strong>Co Archiles NIKDY nedělá bez schválení:</strong> mazání zdrojů, změna autonomy_level, přístup k user datům, mazání chat history.</div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Per-feature nastavení</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Auto-publish threshold: {data.auto_publish_threshold}%</Label>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[data.auto_publish_threshold]}
              onValueChange={(v) => setData({ ...data, auto_publish_threshold: v[0] })}
            />
            <div className="text-xs text-muted-foreground mt-1">Minimální confidence pro auto-publish.</div>
          </div>
          {([
            ["auto_source_add", "Auto-add sources", "Archiles může přidávat nové zdroje bez schválení."],
            ["auto_delete_dead", "Auto-delete dead jobs", "Archiles může deaktivovat 404 / mrtvé joby."],
            ["auto_recategorize", "Auto-recategorize", "Archiles může měnit kategorie schválených jobů."],
          ] as const).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <Label className="text-sm">{label}</Label>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Switch checked={data[key]} onCheckedChange={(v) => setData({ ...data, [key]: v })} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Historie změn</CardTitle></CardHeader>
        <CardContent className="p-0">
          {log.length === 0 && <div className="p-4 text-sm text-muted-foreground">Žádné změny zatím.</div>}
          {log.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr><th className="p-2 text-left">Kdy</th><th className="p-2 text-left">Změna</th></tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="p-2 text-xs whitespace-nowrap">{formatRelative(l.created_at)}</td>
                    <td className="p-2 text-xs">
                      {Object.keys(l.new_values ?? {}).map((k) => {
                        const oldV = l.old_values?.[k];
                        const newV = l.new_values?.[k];
                        if (JSON.stringify(oldV) === JSON.stringify(newV)) return null;
                        return <div key={k}><strong>{k}</strong>: {String(oldV)} → {String(newV)}</div>;
                      })}
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