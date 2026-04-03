import { motion } from "framer-motion";
import type { SmartMatchResult } from "@/utils/smartMatch";

interface SmartMatchScoreProps {
  result: SmartMatchResult;
}

const SmartMatchScore = ({ result }: SmartMatchScoreProps) => {
  const scoreColor =
    result.score >= 80 ? "text-emerald-500" :
    result.score >= 60 ? "text-amber-500" : "text-red-500";

  return (
    <div className="space-y-3">
      {/* Score breakdown bars */}
      <div className="space-y-2">
        {result.breakdown.map((b) => (
          <div key={b.category} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <span>{b.icon}</span> {b.category}
              </span>
              <span className="font-medium text-foreground">{b.score}/{b.maxScore}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${(b.score / b.maxScore) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.1 }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{b.reason}</p>
          </div>
        ))}
      </div>

      {/* Top reasons */}
      {result.topReasons.length > 0 && (
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs font-medium text-foreground mb-1">Top reasons:</p>
          {result.topReasons.map((r, i) => (
            <p key={i} className="text-xs text-muted-foreground">✓ {r}</p>
          ))}
        </div>
      )}

      {/* Missing requirements */}
      {result.missingRequirements.length > 0 && (
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs font-medium text-foreground mb-1">Missing:</p>
          {result.missingRequirements.slice(0, 3).map((m, i) => (
            <p key={i} className="text-xs text-red-500/80">✗ {m}</p>
          ))}
          {result.missingRequirements.length > 3 && (
            <p className="text-[10px] text-muted-foreground">+{result.missingRequirements.length - 3} more</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartMatchScore;
