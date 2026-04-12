import type { DimensionMatchCategory } from "@/utils/dimensionMatching";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Star } from "lucide-react";

interface DimensionBreakdownProps {
  categories: DimensionMatchCategory[];
  overallScore: number;
  overallConfidence: number;
}

const DimensionBreakdown = ({ categories, overallScore, overallConfidence }: DimensionBreakdownProps) => {
  const scoreColor = (s: number) =>
    s >= 70 ? "text-emerald-500" : s >= 45 ? "text-amber-500" : "text-red-500";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Dimension Match</span>
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-bold ${scoreColor(overallScore)}`}>{overallScore}%</span>
          <span className="text-muted-foreground">(Conf: {overallConfidence}%)</span>
        </div>
      </div>

      {categories.map((cat) => (
        <div key={cat.category} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span>{cat.icon}</span>
              <span className="font-medium text-foreground">{cat.category}</span>
            </span>
            <span className={`font-semibold ${scoreColor(cat.score)}`}>{cat.score}%</span>
          </div>
          <Progress value={cat.score} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground">{cat.details}</p>
          {cat.riskFlag && (
            <div className="flex items-center gap-1 text-[10px] text-red-500">
              <AlertTriangle className="w-2.5 h-2.5" />
              {cat.riskFlag}
            </div>
          )}
          {cat.strongMatch && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-500">
              <Star className="w-2.5 h-2.5" />
              {cat.strongMatch}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DimensionBreakdown;
