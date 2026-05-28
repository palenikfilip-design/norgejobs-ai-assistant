import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, Check, Loader2 } from "lucide-react";

interface PresetRow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  preferred_countries: string[] | null;
  salary_min: number;
  salary_max: number;
  preferred_job_type: string;
  seasonal_preference: string | null;
  last_used_at: string | null;
  language_requirements: string[] | null;
}

/**
 * /presets — manage all SEARCH PRESETS (current intent).
 * Avatar (identity) lives on /profile/edit.
 */
export default function Presets() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      navigate("/login");
      return;
    }
    const { data, error } = await supabase
      .from("user_presets")
      .select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    }
    const rows = (data ?? []) as unknown as PresetRow[];
    setPresets(rows);

    // Per-preset match counts
    const map: Record<string, number> = {};
    await Promise.all(
      rows.map(async (p) => {
        const { count } = await supabase
          .from("cached_matches")
          .select("id", { count: "exact", head: true })
          .eq("user_id", u.user!.id)
          .eq("preset_id", p.id)
          .eq("is_active", true);
        map[p.id] = count ?? 0;
      }),
    );
    setCounts(map);
    setLoading(false);
  }, [navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async (id: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("user_presets").update({ active: false }).eq("user_id", u.user.id);
    await supabase
      .from("user_presets")
      .update({ active: true, last_used_at: new Date().toISOString() })
      .eq("id", id);
    toast({ title: "Preset aktivován" });
    await load();
  };

  const remove = async (id: string) => {
    const c = counts[id] ?? 0;
    if (c > 0 && !confirm(`Tento preset má ${c} uložených nabídek. Opravdu smazat?`)) return;
    await supabase.from("cached_matches").delete().eq("preset_id", id);
    await supabase.from("user_presets").delete().eq("id", id);
    toast({ title: "Preset smazán" });
    await load();
  };

  const saveName = async (id: string) => {
    const name = editingName.trim() || "Bez názvu";
    await supabase.from("user_presets").update({ name }).eq("id", id);
    setEditingId(null);
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-semibold text-foreground">Moje presety</h1>
          <Button size="sm" onClick={() => navigate("/preset/new")} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nový
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : presets.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Zatím nemáš žádný preset.</p>
            <Button onClick={() => navigate("/preset/new")} className="gap-1.5">
              <Plus className="w-4 h-4" /> Vytvořit první preset
            </Button>
          </Card>
        ) : (
          presets.map((p) => (
            <Card key={p.id} className={`p-5 ${p.active ? "border-accent/60 bg-accent/5" : ""}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  {editingId === p.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && saveName(p.id)}
                        className="h-8"
                      />
                      <Button size="sm" onClick={() => saveName(p.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{p.name}</h3>
                      <button
                        onClick={() => {
                          setEditingId(p.id);
                          setEditingName(p.name);
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {p.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                          Aktivní
                        </span>
                      )}
                    </div>
                  )}
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                <div><span className="font-medium text-foreground">Země:</span> {(p.preferred_countries ?? []).join(", ") || "—"}</div>
                <div><span className="font-medium text-foreground">Typ:</span> {p.preferred_job_type || "—"}</div>
                <div><span className="font-medium text-foreground">Plat min:</span> {p.salary_min || "—"}</div>
                <div><span className="font-medium text-foreground">Sezóna:</span> {p.seasonal_preference || "any"}</div>
                <div><span className="font-medium text-foreground">Nabídek:</span> {counts[p.id] ?? 0}</div>
                <div><span className="font-medium text-foreground">Naposledy:</span> {p.last_used_at ? new Date(p.last_used_at).toLocaleDateString() : "—"}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!p.active && (
                  <Button size="sm" onClick={() => activate(p.id)}>
                    Použít
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => navigate(`/preset/edit/${p.id}`)} className="gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Upravit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => remove(p.id)}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Smazat
                </Button>
              </div>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}