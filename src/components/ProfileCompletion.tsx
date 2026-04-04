import { useUser, getProfileCompletion } from "@/context/UserContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, UserCog } from "lucide-react";
import { useState } from "react";

const ProfileCompletion = ({ onEditProfile }: { onEditProfile?: () => void }) => {
  const { user } = useUser();
  const [expanded, setExpanded] = useState(false);

  if (!user.profile.fullName) return null;

  const { percent, missing } = getProfileCompletion(user.profile);

  if (percent === 100) return null;

  const color =
    percent >= 75 ? "text-green-500" : percent >= 50 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <UserCog className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-foreground text-sm">Profile Completion</h3>
        </div>
        <span className={`text-lg font-bold ${color}`}>{percent}%</span>
      </div>

      <Progress value={percent} className="h-2 mb-3" />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {missing.length} field{missing.length !== 1 ? "s" : ""} remaining
        </p>
        <div className="flex items-center gap-2">
          {onEditProfile && (
            <Button variant="outline" size="sm" onClick={onEditProfile}>
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
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Missing fields:</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <span
                key={m}
                className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
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
