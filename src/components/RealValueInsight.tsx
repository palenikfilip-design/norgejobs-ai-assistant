import { TrendingUp, TrendingDown, Minus, PiggyBank, BarChart3 } from "lucide-react";
import type { CostOfLivingInsight } from "@/utils/costOfLiving";
import { formatCurrency, type CurrencyCode } from "@/utils/currency";
import InfoTooltip from "@/components/InfoTooltip";

interface RealValueInsightProps {
  insight: CostOfLivingInsight;
  userCurrency?: CurrencyCode;
}

const RealValueInsight = ({ insight }: RealValueInsightProps) => {
  const savingsIcon =
    insight.savingsLevel === "high" ? "🟢" :
    insight.savingsLevel === "medium" ? "🟡" : "🔴";

  const marketIcon =
    insight.salaryVsMarket === "above" ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> :
    insight.salaryVsMarket === "below" ? <TrendingDown className="w-3.5 h-3.5 text-red-500" /> :
    <Minus className="w-3.5 h-3.5 text-amber-500" />;

  const marketLabel =
    insight.salaryVsMarket === "above"
      ? `ABOVE average for this role in ${insight.country}`
      : insight.salaryVsMarket === "below"
      ? `BELOW average for this role in ${insight.country}`
      : `Around average for this role in ${insight.country}`;

  return (
    <div className="bg-secondary/30 rounded-lg p-3 border border-border/30 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <PiggyBank className="w-4 h-4 text-accent" />
        <span className="font-medium text-foreground text-sm">Real Value Insight</span>
        <InfoTooltip content="Real Value Insight porovnává plat s náklady na život v dané zemi. Ukazuje, kolik reálně ušetříš a jak je plat ve srovnání s průměrem trhu." />
      </div>

      {/* Savings estimate */}
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5">{savingsIcon}</span>
        <div>
          <p className="text-xs text-foreground/80">
            After living costs in {insight.country} (~€{insight.monthlyCost.toLocaleString()}/mo), you could save approx.{" "}
            <span className={`font-semibold ${insight.monthlySavings > 0 ? "text-emerald-600" : "text-red-500"}`}>
              €{Math.abs(insight.monthlySavings).toLocaleString()}/month
            </span>
            {insight.monthlySavings < 0 && " (deficit)"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Est. net: €{insight.monthlyNet.toLocaleString()}/mo
          </p>
        </div>
      </div>

      {/* Salary vs market */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/20">
        <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
        <div className="flex items-center gap-1.5">
          {marketIcon}
          <span className="text-xs text-foreground/80">
            This salary is <span className="font-semibold">{marketLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default RealValueInsight;
