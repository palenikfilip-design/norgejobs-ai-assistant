import { useUser, getProfileCompletion } from "@/context/UserContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, UserCog, AlertTriangle } from "lucide-react";
import { useState } from "react";

const ProfileCompletion = ({ onEditProfile }: { onEditProfile?: () => void }) => {
  const { user } = useUser();
  const [expanded, setExpanded] = useState(false);

  const { percent, missing } = getProfileCompletion(user.profile);

  if (percent === 100) return null;

  const isLow = percent < 50;
  const isMid = percent >= 50 && percent < 75;

  return (
    <div
      className={`rounded-xl p-5 shadow-sm border-2 ${
        isLow
          ? "bg-destructive/10 border-destructive/60 ring-2 ring-destructive/20"
          : isMid
          ? "bg-yellow-500/10 border-yellow-500/40"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLow ? (
            <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />
          ) : (
            <UserCog className="w-4 h-4 text-accent" />
          )}
          <h3
            className={`font-bold text-sm ${
              isLow ? "text-destructive" : "text-foreground"
            }`}
          >
            {isLow ? "⚠️ Profile Incomplete!" : "Profile Completion"}
          </h3>
        </div>
        <span
          className={`text-lg font-black ${
            isLow ? "text-destructive" : isMid ? "text-yellow-500" : "text-green-500"
          }`}
        >
          {percent}%
        </span>
      </div>

      <div className="relative h-3 mb-3 rounded-full bg-secondary overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
            isLow
              ? "bg-destructive"
              : isMid
              ? "bg-yellow-500"
              : "bg-green-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p
          className={`text-xs font-medium ${
            isLow ? "text-destructive/80" : "text-muted-foreground"
          }`}
        >
          {missing.length} field{missing.length !== 1 ? "s" : ""} remaining
        </p>
        <div className="flex items-center gap-2">
          {onEditProfile && (
            <Button
              size="sm"
              onClick={onEditProfile}
              className={
                isLow
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold shadow-md"
                  : "bg-accent-gradient text-accent-foreground hover:opacity-90"
              }
            >
              <UserCog className="w-3.5 h-3.5 mr-1" />
              Complete Profile
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Missing fields:</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <span
                key={m}
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  isLow
                    ? "bg-destructive/20 text-destructive"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileCompletion;
