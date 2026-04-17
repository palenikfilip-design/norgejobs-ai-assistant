import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, Sparkles, TrendingUp, Lightbulb } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EnhancedJob } from "@/utils/jobMatching";

interface NotificationsPopoverProps {
  topJobs: EnhancedJob[];
  unreadCount: number;
  onOpen: () => void;
}

const NotificationsPopover = ({ topJobs, unreadCount, onOpen }: NotificationsPopoverProps) => {
  const navigate = useNavigate();
  const top3 = topJobs.slice(0, 3);

  // Pick a skill suggestion from the top job's missing requirements (if any)
  const skillTip = top3
    .flatMap((j) => j.matchDetails ?? [])
    .find((d: any) => d?.matched === false && typeof d?.label === "string");

  return (
    <Popover onOpenChange={(open) => open && onOpen()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-gradient text-[10px] text-accent-foreground flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm text-foreground">Daily highlights</h3>
        </div>

        <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Top matches today
              </span>
            </div>
            {top3.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No matches yet — adjust your presets.</p>
            ) : (
              <ul className="space-y-1.5">
                {top3.map((job) => (
                  <li key={job.id}>
                    <button
                      onClick={() => navigate("/dashboard")}
                      className="w-full text-left p-2 rounded-md hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {job.company} · {job.city}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-accent">{job.matchScore}%</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {skillTip && (
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Skill improvement
                </span>
              </div>
              <div className="p-2 rounded-md bg-secondary/30">
                <p className="text-xs text-foreground">
                  Boost your match — improve <span className="font-semibold">{(skillTip as any).label}</span>.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-1 text-xs"
                  onClick={() => navigate("/profile/edit")}
                >
                  Update profile →
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => navigate("/saved")}
          >
            View saved jobs
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPopover;
