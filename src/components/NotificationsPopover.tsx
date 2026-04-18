import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, Sparkles, TrendingUp, Lightbulb } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EnhancedJob } from "@/utils/jobMatching";

interface NotificationsPopoverProps {
  topJobs: EnhancedJob[];
}

const SEEN_KEY = "dailyNotificationSeen"; // value = YYYY-MM-DD of last seen

const todayStr = () => new Date().toISOString().slice(0, 10);

const NotificationsPopover = ({ topJobs }: NotificationsPopoverProps) => {
  const navigate = useNavigate();
  const top3 = topJobs.slice(0, 3);

  // One notification per day. Unread until user opens popover today.
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    setUnread(localStorage.getItem(SEEN_KEY) !== todayStr());
  }, []);

  const markSeen = () => {
    localStorage.setItem(SEEN_KEY, todayStr());
    setUnread(false);
  };

  // 2–3 sentence daily summary built from today's matches
  const summary = useMemo(() => {
    if (topJobs.length === 0) {
      return "No new matches today. Try adjusting your search presets to broaden the results.";
    }
    const total = topJobs.length;
    const high = topJobs.filter((j) => j.matchScore >= 80).length;
    const best = topJobs[0];
    const avg = Math.round(topJobs.reduce((s, j) => s + j.matchScore, 0) / total);

    const parts: string[] = [];
    parts.push(
      `Today you have ${total} new job${total === 1 ? "" : "s"}, ${high} above 80% match.`
    );
    parts.push(
      `Your best fit is ${best.title} at ${best.company} (${best.matchScore}%).`
    );
    if (avg >= 70) parts.push(`Overall match quality is strong (avg ${avg}%).`);
    else parts.push(`Average match quality sits at ${avg}% — refining your profile could help.`);
    return parts.join(" ");
  }, [topJobs]);

  const skillTip = top3
    .flatMap((j) => j.matchDetails ?? [])
    .find((d: any) => d?.matched === false && typeof d?.label === "string");

  return (
    <Popover onOpenChange={(open) => open && markSeen()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {unread && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-gradient ring-2 ring-card" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <button
          onClick={() => navigate("/insights")}
          className="w-full p-3 border-b border-border flex items-center gap-2 hover:bg-secondary/50 transition-colors text-left"
        >
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm text-foreground flex-1">Daily highlights</h3>
          <span className="text-xs text-accent">Open →</span>
        </button>

        {/* Daily summary (2-3 sentences) */}
        <div className="p-3 border-b border-border bg-secondary/20">
          <p className="text-xs text-foreground leading-relaxed">{summary}</p>
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
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate("/insights")}>
            See full daily overview →
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPopover;
