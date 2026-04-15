import { motion } from "framer-motion";
import { MapPin, Briefcase, Lock, Sparkles, Crown, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EnhancedJob } from "@/utils/jobMatching";
import { useNavigate } from "react-router-dom";

interface BlurredJobCardProps {
  job: EnhancedJob;
  index: number;
  freeUnlocksAvailable: number;
  onUnlockWithFree: () => void;
}

const BlurredJobCard = ({ job, index, freeUnlocksAvailable, onUnlockWithFree }: BlurredJobCardProps) => {
  const navigate = useNavigate();

  const scoreColor = job.matchScore >= 80
    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
    : job.matchScore >= 60
    ? "text-amber-500 bg-amber-500/10 border-amber-500/30"
    : "text-red-500 bg-red-500/10 border-red-500/30";

  const matchLabel = job.matchScore >= 80 ? "Very strong fit" : job.matchScore >= 60 ? "Good fit" : "Potential fit";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="bg-card rounded-xl border border-border shadow-sm overflow-hidden relative"
    >
      <div className="p-5">
        {/* Visible: title + match */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-lg leading-tight">{job.title}</h3>
            <p className="text-muted-foreground text-sm mt-0.5">{job.company}</p>
          </div>
          <div className={`flex flex-col items-center px-3 py-2 rounded-lg border ${scoreColor}`}>
            <span className="text-2xl font-bold leading-none">{job.matchScore}%</span>
            <span className="text-[10px] font-medium mt-0.5">{matchLabel}</span>
          </div>
        </div>

        {/* Visible: location + type */}
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.city}, {job.country}</span>
          <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.type}</span>
        </div>

        {/* Blurred content */}
        <div className="relative">
          <div className="blur-md select-none pointer-events-none" aria-hidden>
            <div className="bg-secondary/50 rounded-lg p-3 mb-3">
              <p className="text-sm text-foreground">€2,500 – €3,500/month</p>
            </div>
            <p className="text-sm text-foreground/80 mb-3">
              This position offers excellent growth opportunities with a focus on modern technologies
              and a collaborative team environment in a dynamic company.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="px-2 py-1 rounded bg-secondary text-xs">React</span>
              <span className="px-2 py-1 rounded bg-secondary text-xs">TypeScript</span>
              <span className="px-2 py-1 rounded bg-secondary text-xs">Node.js</span>
            </div>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-sm rounded-lg">
            <Lock className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground text-center px-4">
              High match job ({job.matchScore}%)
            </p>
            <p className="text-xs text-muted-foreground text-center px-4 mt-1 mb-4">
              {matchLabel} — unlock to see full details
            </p>

            <div className="flex flex-col gap-2 w-full px-6">
              <Button
                className="w-full bg-accent-gradient text-accent-foreground"
                size="sm"
                onClick={() => navigate("/premium")}
              >
                <Crown className="w-4 h-4 mr-1.5" />
                Upgrade to Premium
              </Button>
              {freeUnlocksAvailable > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onUnlockWithFree}
                >
                  <Gift className="w-4 h-4 mr-1.5" />
                  Unlock 1 job ({freeUnlocksAvailable} left)
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BlurredJobCard;
