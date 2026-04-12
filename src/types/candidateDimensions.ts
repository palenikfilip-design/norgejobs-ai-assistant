/** A single scored dimension with confidence tracking */
export interface DimensionValue {
  value: number; // 0–100
  confidence: "low" | "medium" | "high";
  source?: "self" | "test" | "employer";
}

export const defaultDimension = (value = 50): DimensionValue => ({
  value,
  confidence: "low",
  source: "self",
});

export interface WorkStyleDimensions {
  independence_level: DimensionValue;
  stress_tolerance: DimensionValue;
  routine_vs_dynamic: DimensionValue;
  social_need: DimensionValue;
  authority_acceptance: DimensionValue;
}

export interface WorkPreferences {
  hours_per_week: number;
  shift_type: "day" | "night" | "flexible";
  contract_type: "fulltime" | "seasonal" | "temp";
  physical_vs_mental: DimensionValue;
}

export interface LifestyleDimensions {
  climate_tolerance: "cold" | "moderate" | "warm";
  isolation_tolerance: DimensionValue;
  nightlife_need: DimensionValue;
  nature_vs_city: DimensionValue;
}

export interface FinancialDimensions {
  savings_goal: number; // monthly target
  risk_tolerance: DimensionValue;
  spending_pattern: "low" | "medium" | "high";
}

export interface CandidateDimensions {
  workStyle: WorkStyleDimensions;
  workPreferences: WorkPreferences;
  lifestyle: LifestyleDimensions;
  financial: FinancialDimensions;
}

export const defaultCandidateDimensions: CandidateDimensions = {
  workStyle: {
    independence_level: defaultDimension(),
    stress_tolerance: defaultDimension(),
    routine_vs_dynamic: defaultDimension(),
    social_need: defaultDimension(),
    authority_acceptance: defaultDimension(),
  },
  workPreferences: {
    hours_per_week: 40,
    shift_type: "day",
    contract_type: "fulltime",
    physical_vs_mental: defaultDimension(),
  },
  lifestyle: {
    climate_tolerance: "moderate",
    isolation_tolerance: defaultDimension(),
    nightlife_need: defaultDimension(30),
    nature_vs_city: defaultDimension(),
  },
  financial: {
    savings_goal: 500,
    risk_tolerance: defaultDimension(),
    spending_pattern: "medium",
  },
};

/** Job-side dimension requirements */
export interface JobDimensions {
  stress_level: number; // 0–100
  isolation_level: number;
  physical_demand: number;
  environment_type: "city" | "nature" | "mixed";
  shift_type: "day" | "night" | "flexible";
  climate: "cold" | "moderate" | "warm";
  social_interaction: number; // 0–100
  routine_level: number; // 0–100
}

export const defaultJobDimensions: JobDimensions = {
  stress_level: 50,
  isolation_level: 30,
  physical_demand: 30,
  environment_type: "city",
  shift_type: "day",
  climate: "moderate",
  social_interaction: 50,
  routine_level: 50,
};

/** Confidence multiplier */
export function confidenceWeight(c: "low" | "medium" | "high"): number {
  switch (c) {
    case "high": return 1.0;
    case "medium": return 0.7;
    case "low": return 0.4;
  }
}

/** Average confidence of all dimension values */
export function averageConfidence(dims: CandidateDimensions): number {
  const all: DimensionValue[] = [
    dims.workStyle.independence_level,
    dims.workStyle.stress_tolerance,
    dims.workStyle.routine_vs_dynamic,
    dims.workStyle.social_need,
    dims.workStyle.authority_acceptance,
    dims.workPreferences.physical_vs_mental,
    dims.lifestyle.isolation_tolerance,
    dims.lifestyle.nightlife_need,
    dims.lifestyle.nature_vs_city,
    dims.financial.risk_tolerance,
  ];
  const weights = all.map(d => confidenceWeight(d.confidence));
  return Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 100);
}
