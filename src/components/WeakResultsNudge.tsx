import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeProfileCompleteness, areResultsWeak } from "@/utils/weakResultsCompleteness";
import type { UserProfile, SearchPreset } from "@/context/UserContext";
import type { EnhancedJob } from "@/utils/jobMatching";

const SESSION_KEY = "leslie_nudge_shown_session";
const MIN_DAYS_BETWEEN = 5;

interface Props {
  profile: UserProfile;
  activePreset: SearchPreset | null;
  countryOfOrigin?: string | null;
  currentResidence?: string | null;
  jobs: EnhancedJob[];
  loading: boolean;
  userId: string | null;
  onEditProfile: () => void;
  onEditPreset: (presetId: string, anchor?: string) => void;
}

const WeakResultsNudge = ({
  profile, activePreset, countryOfOrigin, currentResidence,
  jobs, loading, userId, onEditProfile, onEditPreset,
}: Props) => {
  const [dismissedAt, setDismissedAt] = useState<Date | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load dismissed_at once
  useEffect(() => {
    if (!userId) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_access")
        .select("profile_nudge_dismissed_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const raw = (data as { profile_nudge_dismissed_at?: string | null } | null)?.profile_nudge_dismissed_at;
      if (raw) setDismissedAt(new Date(raw));
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const { percent, missing } = useMemo(
    () => computeProfileCompleteness(profile, activePreset, { countryOfOrigin, currentResidence }),
    [profile, activePreset, countryOfOrigin, currentResidence]
  );
  const { weak, strongCount } = useMemo(() => areResultsWeak(jobs), [jobs]);

  // Don't render until we know if user dismissed
  if (!loaded || loading || hidden) return null;

  // Profile already in good shape — don't nudge
  if (percent >= 80) return null;

  // Results look fine — don't interrupt
  if (!weak) return null;

  // Respect recent dismissal (5+ days)
  if (dismissedAt) {
    const days = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (days < MIN_DAYS_BETWEEN) return null;
  }

  // Once per session
  if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1") return null;

  const top = missing[0];
  if (!top) return null;

  const handleDismiss = async () => {
    setHidden(true);
    if (typeof window !== "undefined") sessionStorage.setItem(SESSION_KEY, "1");
    if (userId) {
      await supabase
        .from("user_access")
        .update({ profile_nudge_dismissed_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
  };

  const handleComplete = () => {
    if (typeof window !== "undefined") sessionStorage.setItem(SESSION_KEY, "1");
    if (top.target === "preset" && activePreset?.id) {
      onEditPreset(activePreset.id, top.fieldAnchor);
    } else {
      onEditProfile();
    }
  };

  return (
    <div className="rounded-xl border border-accent/40 bg-card/80 backdrop-blur-sm p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-accent shrink-0" />
            <p className="text-sm font-medium text-foreground">
              Našla jsem jen <span className="font-bold">{strongCount}</span> silných nabídek.
              Tvůj profil je z <span className="font-bold">{percent}%</span> hotový — s doplněním ti najdu víc a přesněji.
            </p>
          </div>

          <Progress value={percent} className="h-2 mb-3" />

          <p className="text-sm text-muted-foreground mb-3">
            Doplň <span className="font-semibold text-foreground">{top.label}</span>
            <span className="mx-1">→</span>
            {top.benefit}
          </p>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-muted-foreground">
              Teď ne
              <X className="w-3.5 h-3.5 ml-1" />
            </Button>
            <Button size="sm" onClick={handleComplete} className="bg-accent-gradient text-accent-foreground hover:opacity-90">
              Doplnit profil
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeakResultsNudge;