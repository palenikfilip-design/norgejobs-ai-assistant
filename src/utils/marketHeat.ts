export type HeatLevel = "LOW" | "MEDIUM" | "HIGH";

export interface MarketHeatResult {
  heatLevel: HeatLevel;
  label: string;
  insight: string;
  recommendation: string;
  ratio: number;
}

export function calculateMarketHeat(
  applicants: number,
  positions: number,
  avgDaysToFill?: number
): MarketHeatResult {
  const ratio = positions > 0 ? applicants / positions : applicants;

  let heatLevel: HeatLevel;
  let label: string;
  let recommendation: string;

  if (ratio < 10) {
    heatLevel = "LOW";
    label = "Low competition";
    recommendation = "Great opportunity — fewer applicants means higher chances!";
  } else if (ratio <= 30) {
    heatLevel = "MEDIUM";
    label = "Moderate competition";
    recommendation = "Stand out with a strong cover letter and relevant skills.";
  } else {
    heatLevel = "HIGH";
    label = "High competition";
    recommendation = "Improve your profile to increase chances. Consider upskilling.";
  }

  const insight = `${applicants} applicant${applicants !== 1 ? "s" : ""} for ${positions} position${positions !== 1 ? "s" : ""}${avgDaysToFill ? ` · Avg. ${avgDaysToFill} days to fill` : ""}`;

  return { heatLevel, label, insight, recommendation, ratio };
}

export function getHeatColor(level: HeatLevel): { bg: string; text: string; border: string } {
  switch (level) {
    case "LOW":
      return { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" };
    case "MEDIUM":
      return { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" };
    case "HIGH":
      return { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500/30" };
  }
}
