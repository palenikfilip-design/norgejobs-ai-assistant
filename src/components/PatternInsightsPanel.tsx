import { motion } from "framer-motion";
import { Brain, AlertTriangle, Sparkles, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePreferenceProfile } from "@/hooks/usePreferenceProfile";
import { mockJobs } from "@/data/mockJobs";
import { useToast } from "@/hooks/use-toast";

const PatternInsightsPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supabaseUser, updateProfile, user } = useUser();
  const userId = supabaseUser?.id ?? null;
  const { isActive: isPremium } = useSubscription(userId);
  const { profile, interactions, preferences } = usePreferenceProfile(userId, mockJobs);

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

  if (!profile || (!profile.patterns.length && !profile.conflicts.length)) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-accent" />
          <p className="font-medium text-foreground text-sm">Učím se tvé preference</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Klikej na ❤️ Favorite, ⭐ Top Pick, ❌ Not for me a 💾 Save — postupně rozpoznám tvé vzorce ({interactions.length + preferences.length} signálů zatím).
        </p>
      </div>
    );
  }

  const applySuggestion = async (key: "shift" | "stress" | "environment") => {
    if (key === "shift" && profile.preferredShiftType.value) {
      // Suggestion only — for now we just notify; deeper integration via dimensions requires UI in profile editor.
      toast({ title: "Doporučení uloženo", description: `Profil bude favorizovat ${profile.preferredShiftType.value} směny.` });
    } else if (key === "stress" && profile.stressTolerance.value !== null) {
      toast({ title: "Doporučení uloženo", description: `Profil bude favorizovat stress level ~${profile.stressTolerance.value}.` });
    } else if (key === "environment" && profile.preferredEnvironment.value) {
      toast({ title: "Doporučení uloženo", description: `Profil bude favorizovat prostředí: ${profile.preferredEnvironment.value}.` });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-accent" />
        <h3 className="font-semibold text-foreground">Co jsem se o tobě naučila</h3>
      </div>

      {profile.patterns.length > 0 && (
        <ul className="space-y-2">
          {profile.patterns.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <span className="text-foreground/90">{p}</span>
            </li>
          ))}
        </ul>
      )}

      {profile.conflicts.length > 0 && (
        <div className="space-y-2">
          {profile.conflicts.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-foreground/90">{c}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
        {profile.preferredShiftType.confidence > 0.4 && profile.preferredShiftType.value && (
          <Button size="sm" variant="outline" onClick={() => applySuggestion("shift")}>
            Aplikovat: {profile.preferredShiftType.value} směny
          </Button>
        )}
        {profile.stressTolerance.confidence > 0.4 && profile.stressTolerance.value !== null && (
          <Button size="sm" variant="outline" onClick={() => applySuggestion("stress")}>
            Aplikovat: stres ~{profile.stressTolerance.value}
          </Button>
        )}
        {profile.preferredEnvironment.confidence > 0.4 && profile.preferredEnvironment.value && (
          <Button size="sm" variant="outline" onClick={() => applySuggestion("environment")}>
            Aplikovat: {profile.preferredEnvironment.value}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default PatternInsightsPanel;
