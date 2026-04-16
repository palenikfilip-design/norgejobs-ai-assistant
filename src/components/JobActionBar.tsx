import { Heart, Star, X, Bookmark, Pin, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useJobPreferences } from "@/hooks/useJobPreferences";
import { useJobSnapshots } from "@/hooks/useJobSnapshots";
import { useJobInteractions } from "@/hooks/useJobInteractions";
import type { Job } from "@/data/mockJobs";
import type { PreferenceCategory } from "@/types/behaviorLearning";

interface Props {
  job: Job;
  compact?: boolean;
}

const ACTIONS: { key: PreferenceCategory; icon: typeof Heart; label: string; activeClass: string }[] = [
  { key: "favorite", icon: Heart, label: "Favorite", activeClass: "text-rose-500 fill-rose-500" },
  { key: "top_pick", icon: Star, label: "Top Pick", activeClass: "text-amber-500 fill-amber-500" },
  { key: "saved_for_later", icon: Bookmark, label: "Save", activeClass: "text-blue-500 fill-blue-500" },
  { key: "not_interested", icon: X, label: "Not for me", activeClass: "text-red-500" },
];

const JobActionBar = ({ job, compact }: Props) => {
  const { supabaseUser } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const userId = supabaseUser?.id ?? null;
  const { isActive: isPremium } = useSubscription(userId);
  const { getCategoriesFor, togglePreference } = useJobPreferences(userId);
  const { hasSnapshot, createSnapshot, snapshots, removeSnapshot } = useJobSnapshots(userId);
  const { track } = useJobInteractions(userId);

  const activeCats = getCategoriesFor(job.id);
  const snapped = hasSnapshot(job.id);

  const requirePremium = () => {
    toast({
      title: "Premium funkce",
      description: "Behavior Learning a Saved Jobs jsou součástí Premium předplatného.",
      action: undefined,
    });
    navigate("/premium");
  };

  const handleAction = async (cat: PreferenceCategory) => {
    if (!userId) return;
    if (!isPremium) return requirePremium();
    await togglePreference(job.id, cat);
    if (cat === "saved_for_later" && !activeCats.includes("saved_for_later")) {
      void track(job.id, "save");
    } else if (cat === "not_interested" && !activeCats.includes("not_interested")) {
      void track(job.id, "reject");
    }
  };

  const handleSnapshot = async () => {
    if (!userId) return;
    if (!isPremium) return requirePremium();
    if (snapped) {
      const existing = snapshots.find((s) => s.originalJobId === job.id);
      if (existing) await removeSnapshot(existing.id);
      toast({ title: "Snapshot odstraněn" });
    } else {
      const ok = await createSnapshot(job);
      if (ok) toast({ title: "📌 Snapshot uložen", description: "Tato pozice zůstane dostupná i pokud bude smazána." });
    }
  };

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", compact && "gap-0.5")} onClick={(e) => e.stopPropagation()}>
      {ACTIONS.map(({ key, icon: Icon, label, activeClass }) => {
        const active = activeCats.includes(key);
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 relative", active && "bg-accent/20")}
                onClick={() => handleAction(key)}
                aria-label={label}
              >
                {!isPremium && <Lock className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-muted-foreground" />}
                <Icon className={cn("w-4 h-4", active ? activeClass : "text-muted-foreground")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}{!isPremium && " (Premium)"}</TooltipContent>
          </Tooltip>
        );
      })}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 relative", snapped && "bg-accent/20")}
            onClick={handleSnapshot}
            aria-label="Keep Snapshot"
          >
            {!isPremium && <Lock className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-muted-foreground" />}
            <Pin className={cn("w-4 h-4", snapped ? "text-emerald-500 fill-emerald-500" : "text-muted-foreground")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Keep Snapshot{!isPremium && " (Premium)"}</TooltipContent>
      </Tooltip>
    </div>
  );
};

export default JobActionBar;
