import type { CandidateDimensions, JobDimensions, DimensionValue } from "@/types/candidateDimensions";
import { confidenceWeight } from "@/types/candidateDimensions";

export interface DimensionMatchCategory {
  category: string;
  score: number; // 0–100
  confidence: number; // 0–100
  icon: string;
  details: string;
  riskFlag?: string;
  strongMatch?: string;
}

export interface UnknownField {
  field: string;
  label: string;
  question: string;
}

function dimSimilarity(candidateVal: number, jobVal: number): number {
  const diff = Math.abs(candidateVal - jobVal);
  if (diff <= 10) return 100;
  if (diff <= 25) return 75;
  if (diff <= 40) return 50;
  return Math.max(10, 100 - diff);
}

function weightedDimScore(dim: DimensionValue, jobVal: number): { score: number; confidence: number } {
  const raw = dimSimilarity(dim.value, jobVal);
  return { score: raw, confidence: confidenceWeight(dim.confidence) * 100 };
}

export function calculateDimensionMatch(
  candidate: CandidateDimensions,
  job: JobDimensions
): { categories: DimensionMatchCategory[]; overallScore: number; overallConfidence: number } {
  const categories: DimensionMatchCategory[] = [];

  // Work Style Fit
  const stressMatch = weightedDimScore(candidate.workStyle.stress_tolerance, job.stress_level);
  const isolationMatch = weightedDimScore(candidate.lifestyle.isolation_tolerance, job.isolation_level);
  const socialMatch = weightedDimScore(candidate.workStyle.social_need, job.social_interaction);
  const routineMatch = weightedDimScore(candidate.workStyle.routine_vs_dynamic, job.routine_level);

  const workStyleScore = Math.round((stressMatch.score + socialMatch.score + routineMatch.score) / 3);
  const workStyleConf = Math.round((stressMatch.confidence + socialMatch.confidence + routineMatch.confidence) / 3);

  categories.push({
    category: "Work Style Fit",
    score: workStyleScore,
    confidence: workStyleConf,
    icon: "🧠",
    details: workStyleScore >= 70 ? "Your work style aligns well" : "Work style may differ from this role",
    riskFlag: stressMatch.score < 40 ? "High stress mismatch" : undefined,
    strongMatch: workStyleScore >= 80 ? "Strong work style alignment" : undefined,
  });

  // Lifestyle Fit
  const climatePref = candidate.lifestyle.climate_tolerance;
  const climateMatch = climatePref === job.climate ? 100 : 50;
  const natureCityMap = { city: 80, nature: 20, mixed: 50 };
  const envMatch = dimSimilarity(candidate.lifestyle.nature_vs_city.value, natureCityMap[job.environment_type]);

  const lifestyleScore = Math.round((climateMatch + envMatch + isolationMatch.score) / 3);
  const lifestyleConf = Math.round((100 + confidenceWeight(candidate.lifestyle.nature_vs_city.confidence) * 100 + isolationMatch.confidence) / 3);

  categories.push({
    category: "Lifestyle Fit",
    score: lifestyleScore,
    confidence: lifestyleConf,
    icon: "🌍",
    details: lifestyleScore >= 70 ? "Lifestyle well suited" : "Some lifestyle adjustments needed",
    riskFlag: isolationMatch.score < 40 ? "Isolation mismatch" : undefined,
    strongMatch: lifestyleScore >= 80 ? "Great lifestyle match" : undefined,
  });

  // Work Preferences Fit
  const shiftMatch = candidate.workPreferences.shift_type === job.shift_type ? 100 : candidate.workPreferences.shift_type === "flexible" ? 80 : 40;
  const physicalMatch = weightedDimScore(candidate.workPreferences.physical_vs_mental, job.physical_demand);

  const prefScore = Math.round((shiftMatch + physicalMatch.score) / 2);
  const prefConf = Math.round((100 + physicalMatch.confidence) / 2);

  categories.push({
    category: "Work Preferences",
    score: prefScore,
    confidence: prefConf,
    icon: "⚙️",
    details: prefScore >= 70 ? "Preferences align well" : "Some preference differences",
    riskFlag: physicalMatch.score < 30 ? "Physical demand mismatch" : undefined,
    strongMatch: prefScore >= 85 ? "Excellent preference match" : undefined,
  });

  const overallScore = Math.round(categories.reduce((s, c) => s + c.score, 0) / categories.length);
  const overallConfidence = Math.round(categories.reduce((s, c) => s + c.confidence, 0) / categories.length);

  return { categories, overallScore, overallConfidence };
}

/** Detect missing or low-confidence fields and generate follow-up questions */
export function detectUnknowns(candidate: CandidateDimensions): UnknownField[] {
  const unknowns: UnknownField[] = [];

  const checks: { dim: DimensionValue; field: string; label: string; question: string }[] = [
    { dim: candidate.workStyle.stress_tolerance, field: "stress_tolerance", label: "Stress Tolerance", question: "How do you handle high-pressure deadlines or stressful situations at work?" },
    { dim: candidate.workStyle.independence_level, field: "independence_level", label: "Independence Level", question: "Do you prefer working independently or with close team supervision?" },
    { dim: candidate.workStyle.routine_vs_dynamic, field: "routine_vs_dynamic", label: "Routine vs Dynamic", question: "Do you prefer a predictable daily routine or a dynamic, changing environment?" },
    { dim: candidate.workStyle.social_need, field: "social_need", label: "Social Interaction", question: "How important is socializing and team interaction during your workday?" },
    { dim: candidate.workStyle.authority_acceptance, field: "authority_acceptance", label: "Authority Acceptance", question: "How comfortable are you with strict hierarchical management?" },
    { dim: candidate.workPreferences.physical_vs_mental, field: "physical_vs_mental", label: "Physical vs Mental Work", question: "Do you prefer physically active work or desk-based mental tasks?" },
    { dim: candidate.lifestyle.isolation_tolerance, field: "isolation_tolerance", label: "Isolation Tolerance", question: "How do you handle working alone for long periods?" },
    { dim: candidate.lifestyle.nightlife_need, field: "nightlife_need", label: "Nightlife / Social Life", question: "How important is an active social/nightlife scene in your work location?" },
    { dim: candidate.lifestyle.nature_vs_city, field: "nature_vs_city", label: "Nature vs City", question: "Do you prefer living in a bustling city or a quieter natural setting?" },
    { dim: candidate.financial.risk_tolerance, field: "risk_tolerance", label: "Financial Risk Tolerance", question: "Are you comfortable with variable income or do you prefer guaranteed stable pay?" },
  ];

  for (const c of checks) {
    if (c.dim.confidence === "low") {
      unknowns.push({ field: c.field, label: c.label, question: c.question });
    }
  }

  return unknowns;
}
