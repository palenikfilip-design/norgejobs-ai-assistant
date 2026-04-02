// Mock cost of living data (monthly, EUR)
const LIVING_COSTS: Record<string, number> = {
  Norway: 2200,
  Germany: 1500,
  Austria: 1600,
  "Czech Republic": 1000,
  Remote: 1200, // average estimate
};

// Mock average annual salaries by role category (EUR)
const MARKET_AVERAGES: Record<string, Record<string, number>> = {
  Norway: { tech: 65000, manual: 38000, service: 35000, creative: 50000, education: 42000 },
  Germany: { tech: 58000, manual: 32000, service: 30000, creative: 45000, education: 38000 },
  Austria: { tech: 52000, manual: 30000, service: 28000, creative: 40000, education: 36000 },
  "Czech Republic": { tech: 30000, manual: 18000, service: 16000, creative: 25000, education: 20000 },
  Remote: { tech: 55000, manual: 25000, service: 28000, creative: 40000, education: 30000 },
};

const TECH_KEYWORDS = ["developer", "engineer", "software", "frontend", "backend", "full-stack", "data", "devops", "cloud"];
const MANUAL_KEYWORDS = ["warehouse", "construction", "fishing", "farm", "driver", "delivery", "worker"];
const SERVICE_KEYWORDS = ["receptionist", "customer", "support", "hospitality", "hotel"];
const CREATIVE_KEYWORDS = ["designer", "ux", "graphic", "creative", "artist"];
const EDUCATION_KEYWORDS = ["teacher", "tutor", "instructor", "education"];

function classifyJob(title: string): string {
  const lower = title.toLowerCase();
  if (TECH_KEYWORDS.some(k => lower.includes(k))) return "tech";
  if (MANUAL_KEYWORDS.some(k => lower.includes(k))) return "manual";
  if (SERVICE_KEYWORDS.some(k => lower.includes(k))) return "service";
  if (CREATIVE_KEYWORDS.some(k => lower.includes(k))) return "creative";
  if (EDUCATION_KEYWORDS.some(k => lower.includes(k))) return "education";
  return "service";
}

export interface CostOfLivingInsight {
  monthlyNet: number;
  monthlyCost: number;
  monthlySavings: number;
  savingsLevel: "high" | "medium" | "low";
  salaryVsMarket: "above" | "average" | "below";
  marketAverage: number;
  country: string;
}

export function getCostOfLivingInsight(
  country: string,
  jobTitle: string,
  salaryMin: number,
  salaryMax: number,
): CostOfLivingInsight | null {
  const monthlyCost = LIVING_COSTS[country];
  if (!monthlyCost) return null;

  const avgSalary = (salaryMin + salaryMax) / 2;
  // Rough net estimate: ~70% of gross
  const annualNet = avgSalary * 0.7;
  const monthlyNet = Math.round(annualNet / 12);
  const monthlySavings = monthlyNet - monthlyCost;

  const savingsLevel: "high" | "medium" | "low" =
    monthlySavings > 1000 ? "high" : monthlySavings > 300 ? "medium" : "low";

  const category = classifyJob(jobTitle);
  const marketData = MARKET_AVERAGES[country] || MARKET_AVERAGES["Remote"];
  const marketAverage = marketData[category] || 35000;

  const ratio = avgSalary / marketAverage;
  const salaryVsMarket: "above" | "average" | "below" =
    ratio > 1.1 ? "above" : ratio < 0.9 ? "below" : "average";

  return {
    monthlyNet,
    monthlyCost,
    monthlySavings,
    savingsLevel,
    salaryVsMarket,
    marketAverage,
    country,
  };
}
