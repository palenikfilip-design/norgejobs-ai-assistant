import { motion } from "framer-motion";
import { Brain, AlertTriangle, Sparkles, Crown, Pencil, X, Send, Loader2, Settings2, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePreferenceProfile, type LearnedKey } from "@/hooks/usePreferenceProfile";
import { mockJobs } from "@/data/mockJobs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PatternInsightsPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supabaseUser } = useUser();
  const userId = supabaseUser?.id ?? null;
  const { isActive: isPremium } = useSubscription(userId);
  const { profile, interactions, preferences, muteLearned, setOverride, reload } = usePreferenceProfile(userId, mockJobs);
  const [editingKey, setEditingKey] = useState<LearnedKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [correction, setCorrection] = useState("");
  const [sending, setSending] = useState(false);
  const [editMode, setEditMode] = useState(false);

  if (!userId) return null;

  if (!isPremium) {
    return (
      <div className="bg-card rounded-xl border border-border p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-accent" />
          <div>
            <p className="font-medium text-foreground">Behavior Learning</p>
            <p className="text-xs text-muted-foreground">Naučím se tvé preference z toho, jak vybíráš pozice — Premium funkce.</p>
          </div>
        </div>
        <Button size="sm" className="bg-accent-gradient text-accent-foreground" onClick={() => navigate("/premium")}>
          <Crown className="w-4 h-4 mr-1" /> Premium
        </Button>
      </div>
    );
  }

  const noLearnings = !profile || (!profile.patterns.length && !profile.conflicts.length);

  /** Build list of {key, label, value} for the editable section. */
  const items: { key: LearnedKey; label: string; value: string }[] = [];
  if (profile) {
    if (profile.preferredJobType.value && profile.preferredJobType.confidence > 0.4)
      items.push({ key: "preferredJobType", label: "Typ pozice", value: profile.preferredJobType.value });
    if (profile.preferredShiftType.value && profile.preferredShiftType.confidence > 0.4)
      items.push({ key: "preferredShiftType", label: "Směny", value: profile.preferredShiftType.value });
    if (profile.preferredEnvironment.value && profile.preferredEnvironment.confidence > 0.4)
      items.push({ key: "preferredEnvironment", label: "Prostředí", value: profile.preferredEnvironment.value });
    if (profile.stressTolerance.value !== null && profile.stressTolerance.confidence > 0.4)
      items.push({ key: "stressTolerance", label: "Tolerance stresu", value: String(profile.stressTolerance.value) });
    if (profile.preferredSalary.min && profile.preferredSalary.confidence > 0.4)
      items.push({
        key: "preferredSalary",
        label: "Cílový plat",
        value: `${Math.round(profile.preferredSalary.min / 1000)}k–${Math.round((profile.preferredSalary.max ?? 0) / 1000)}k €`,
      });
  }

  const saveEdit = async (key: LearnedKey) => {
    const v = editValue.trim();
    if (!v) return;
    let parsed: unknown = v;
    if (key === "stressTolerance" || key === "isolationPreference") parsed = Number(v) || 50;
    if (key === "preferredSalary") {
      const m = v.match(/(\d+)\D+(\d+)/);
      parsed = m ? { min: Number(m[1]) * 1000, max: Number(m[2]) * 1000 } : v;
    }
    await setOverride(key, parsed);
    setEditingKey(null);
    toast({ title: "Uloženo", description: "Leslie tuhle preferenci teď bere přesně podle tebe." });
  };

  const deleteItem = async (key: LearnedKey, label: string) => {
    if (!confirm(`Smazat naučenou položku „${label}"? Leslie ji zapomene.`)) return;
    await muteLearned(key);
    toast({ title: "Zapomenuto", description: `„${label}" Leslie už nebere v úvahu.` });
  };

  const submitCorrection = async () => {
    const text = correction.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("interpret-correction", {
        body: { text, current_profile: profile },
      });
      if (error) throw error;
      if (data?.blocked) {
        toast({ title: "Leslie odpočívá", description: data.message, variant: "destructive" });
      } else {
        toast({ title: "Leslie", description: data?.assistant_message_cs ?? "Rozumím, upravila jsem to." });
        setCorrection("");
        await reload();
      }
    } catch (e) {
      toast({
        title: "Chyba",
        description: e instanceof Error ? e.message : "Nepodařilo se odeslat zprávu.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-foreground">Co jsem se o tobě naučila</h3>
        </div>
        {(items.length > 0 || !noLearnings) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setEditMode((v) => !v); setEditingKey(null); }}
          >
            {editMode ? <><ChevronUp className="w-3.5 h-3.5" /> Hotovo</> : <><Settings2 className="w-3.5 h-3.5" /> Upravit</>}
          </Button>
        )}
      </div>

      {noLearnings && (
        <p className="text-xs text-muted-foreground">
          Klikej na ❤️ Favorite, ⭐ Top Pick, ❌ Not for me a 💾 Save — postupně rozpoznám tvé vzorce ({interactions.length + preferences.length} signálů zatím). Nebo Leslie rovnou napiš dole, co tě zajímá.
        </p>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-2 text-sm group">
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
              {editingKey === it.key ? (
                <>
                  <span className="text-muted-foreground">{it.label}:</span>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 flex-1 min-w-0"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(it.key)}
                  />
                  <Button size="sm" className="h-7" onClick={() => saveEdit(it.key)}>OK</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingKey(null)}>Zpět</Button>
                </>
              ) : (
                <>
                  <span className="text-foreground/90 flex-1">
                    <span className="text-muted-foreground">{it.label}:</span> {it.value}
                  </span>
                  {editMode && (
                    <>
                      <button
                        onClick={() => { setEditingKey(it.key); setEditValue(it.value); }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Upravit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteItem(it.key, it.label)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Smazat"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {profile && profile.conflicts.length > 0 && (
        <div className="space-y-2">
          {profile.conflicts.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-foreground/90">{c}</span>
            </div>
          ))}
        </div>
      )}

      {editMode && (
      <div className="pt-3 border-t border-border/50 space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Něco nesedí? Napiš Leslie co změnit:
        </label>
        <Textarea
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          placeholder='Např. "Neřeš lodě, ten dislike byl kvůli lokaci" · "Zajímá mě hlavně Norsko" · "Nejsem junior, mám 10 let praxe"'
          rows={2}
          className="text-sm"
          disabled={sending}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submitCorrection} disabled={sending || !correction.trim()} className="gap-1.5">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Odeslat Leslie
          </Button>
        </div>
      </div>
      )}
    </motion.div>
  );
};

export default PatternInsightsPanel;
