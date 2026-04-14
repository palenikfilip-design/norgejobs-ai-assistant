import { Flame, TrendingUp, Users } from "lucide-react";
import InfoTooltip from "@/components/InfoTooltip";
import { calculateMarketHeat, getHeatColor, type MarketHeatResult } from "@/utils/marketHeat";

interface MarketHeatIndexProps {
  applicants: number;
  positions: number;
  avgDaysToFill?: number;
}

const MarketHeatIndex = ({ applicants, positions, avgDaysToFill }: MarketHeatIndexProps) => {
  const heat = calculateMarketHeat(applicants, positions, avgDaysToFill);
  const colors = getHeatColor(heat.heatLevel);

  return (
    <div className={`rounded-lg p-3 border ${colors.bg} ${colors.border}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Flame className={`w-4 h-4 ${colors.text}`} />
          <span className={`text-sm font-semibold ${colors.text}`}>{heat.label}</span>
          <InfoTooltip content="Market Heat ukazuje míru konkurence – poměr počtu uchazečů k volným pozicím. Vysoký heat = hodně konkurence, nízký = málo." />
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{heat.ratio.toFixed(0)}:1</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-1.5">{heat.insight}</p>
      <p className="text-xs text-foreground/70 italic">{heat.recommendation}</p>
    </div>
  );
};

export default MarketHeatIndex;
