import type { Job } from "@/data/mockJobs";
import type { JobInteraction, JobPreference, UserPreferenceProfile } from "@/types/behaviorLearning";
import { parseSalaryRange } from "@/utils/currency";

/** Action weights for behavior signals. */
const WEIGHTS: Record<string, number> = {
  apply: 5,
  save: 3,
  favorite: 4,
  top_pick: 5,
  click: 1,
  view: 0.3,
  reject: -4,
  not_interested: -5,
  unsave: -1,
};

interface JobLookup {
  [jobId: string]: Job;
}

/** Compute behavior alignment score 0-100 for a single job, given user's interaction history. */
export function computeBehaviorScore(
  job: Job,
  interactions: JobInteraction[],
  preferences: JobPreference[],
  jobs: Job[],
): number {
  if (interactions.length === 0 && preferences.length === 0) return 50;

  const lookup: JobLookup = Object.fromEntries(jobs.map((j) => [j.id, j]));
  let score = 50;

  // Aggregate signals from similar jobs
  const allSignals = [
    ...interactions.map((i) => ({ jobId: i.jobId, weight: WEIGHTS[i.actionType] ?? 0 })),
    ...preferences.map((p) => ({ jobId: p.jobId, weight: WEIGHTS[p.category] ?? 0 })),
  ];

  for (const sig of allSignals) {
    const ref = lookup[sig.jobId];
    if (!ref || sig.weight === 0) continue;
    const sim = jobSimilarity(job, ref);
    score += sig.weight * sim * 2;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Cheap similarity 0-1 between two jobs based on type, country, salary band, dimensions. */
function jobSimilarity(a: Job, b: Job): number {
  if (a.id === b.id) return 1;
  let score = 0;
  let factors = 0;

  if (a.type && b.type) { factors++; if (a.type === b.type) score++; }
  if (a.country && b.country) { factors++; if (a.country === b.country) score++; }

  // Skill overlap
  const skillsA = new Set(a.skills.map((s) => s.toLowerCase()));
  const skillsB = new Set(b.skills.map((s) => s.toLowerCase()));
  if (skillsA.size && skillsB.size) {
    const inter = [...skillsA].filter((s) => skillsB.has(s)).length;
    const union = new Set([...skillsA, ...skillsB]).size;
    factors++;
    score += inter / union;
  }

  // Salary band (€10k buckets)
  const sa = parseSalaryRange(a.salary);
  const sb = parseSalaryRange(b.salary);
  if (sa && sb) {
    factors++;
    const aMid = (sa.min + sa.max) / 2;
    const bMid = (sb.min + sb.max) / 2;
    const diff = Math.abs(aMid - bMid);
    score += Math.max(0, 1 - diff / 30000);
  }

  // Dimensions
  if (a.dimensions && b.dimensions) {
    const dims: (keyof typeof a.dimensions)[] = ["stress_level", "isolation_level", "physical_demand", "social_interaction", "routine_level"];
    for (const d of dims) {
      const av = a.dimensions[d];
      const bv = b.dimensions[d];
      if (typeof av === "number" && typeof bv === "number") {
        factors++;
        score += 1 - Math.abs(av - bv) / 100;
      }
    }
    if (a.dimensions.shift_type && b.dimensions.shift_type) {
      factors++;
      if (a.dimensions.shift_type === b.dimensions.shift_type) score++;
    }
    if (a.dimensions.environment_type && b.dimensions.environment_type) {
      factors++;
      if (a.dimensions.environment_type === b.dimensions.environment_type) score++;
    }
  }

  return factors === 0 ? 0.5 : score / factors;
}

/** Derive an aggregated preference profile from interactions + explicit preferences. */
export function deriveUserPreferenceProfile(
  interactions: JobInteraction[],
  preferences: JobPreference[],
  jobs: Job[],
): UserPreferenceProfile {
  const lookup: JobLookup = Object.fromEntries(jobs.map((j) => [j.id, j]));

  // Positive signals (the jobs the user gravitated toward)
  const positiveJobIds = new Set<string>();
  const negativeJobIds = new Set<string>();

  preferences.forEach((p) => {
    if (["favorite", "top_pick", "applied", "saved_for_later"].includes(p.category)) positiveJobIds.add(p.jobId);
    if (p.category === "not_interested") negativeJobIds.add(p.jobId);
  });
  interactions.forEach((i) => {
    if (["apply", "save", "click"].includes(i.actionType)) positiveJobIds.add(i.jobId);
    if (i.actionType === "reject") negativeJobIds.add(i.jobId);
  });

  const positiveJobs = [...positiveJobIds].map((id) => lookup[id]).filter(Boolean);
  const totalSignals = positiveJobs.length;
  const confidence = (n: number) => Math.min(1, n / 5);

  // Salary
  const salaries = positiveJobs.map((j) => parseSalaryRange(j.salary)).filter(Boolean) as { min: number; max: number }[];
  const preferredSalary = salaries.length
    ? {
        min: Math.round(salaries.reduce((s, x) => s + x.min, 0) / salaries.length),
        max: Math.round(salaries.reduce((s, x) => s + x.max, 0) / salaries.length),
        confidence: confidence(salaries.length),
      }
    : { min: null, max: null, confidence: 0 };

  // Job type
  const typeCounts = countBy(positiveJobs.map((j) => j.type));
  const topType = topEntry(typeCounts);
  const preferredJobType = topType
    ? { value: topType.key, confidence: confidence(topType.count) }
    : { value: null, confidence: 0 };

  // Environment / shift from dimensions
  const envCounts = countBy(positiveJobs.map((j) => j.dimensions?.environment_type).filter(Boolean) as string[]);
  const topEnv = topEntry(envCounts);
  const preferredEnvironment = topEnv
    ? { value: topEnv.key, confidence: confidence(topEnv.count) }
    : { value: null, confidence: 0 };

  const shiftCounts = countBy(positiveJobs.map((j) => j.dimensions?.shift_type).filter(Boolean) as string[]);
  const topShift = topEntry(shiftCounts);
  const preferredShiftType = topShift
    ? { value: topShift.key, confidence: confidence(topShift.count) }
    : { value: null, confidence: 0 };

  // Numeric averages
  const avg = (vals: number[]) => (vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null);
  const stressVals = positiveJobs.map((j) => j.dimensions?.stress_level).filter((v): v is number => typeof v === "number");
  const isolationVals = positiveJobs.map((j) => j.dimensions?.isolation_level).filter((v): v is number => typeof v === "number");
  const stressAvg = avg(stressVals);
  const isolationAvg = avg(isolationVals);

  const stressTolerance = stressAvg !== null
    ? { value: Math.round(stressAvg), confidence: confidence(stressVals.length) }
    : { value: null, confidence: 0 };
  const isolationPreference = isolationAvg !== null
    ? { value: Math.round(isolationAvg), confidence: confidence(isolationVals.length) }
    : { value: null, confidence: 0 };

  // Patterns (human-readable)
  const patterns: string[] = [];
  if (preferredSalary.min && preferredSalary.confidence > 0.4)
    patterns.push(`Preferuješ platy v rozmezí ${Math.round(preferredSalary.min / 1000)}k–${Math.round((preferredSalary.max ?? 0) / 1000)}k EUR`);
  if (preferredJobType.value && preferredJobType.confidence > 0.4)
    patterns.push(`Zaměřuješ se na pozice typu ${preferredJobType.value}`);
  if (preferredShiftType.value && preferredShiftType.confidence > 0.4)
    patterns.push(`Vybíráš ${preferredShiftType.value === "day" ? "denní" : preferredShiftType.value} směny`);
  if (preferredEnvironment.value && preferredEnvironment.confidence > 0.4)
    patterns.push(`Preferuješ prostředí: ${preferredEnvironment.value}`);
  if (stressTolerance.value !== null && stressTolerance.confidence > 0.4)
    patterns.push(stressTolerance.value < 40 ? "Vybíráš pozice s nízkým stresem" : stressTolerance.value > 65 ? "Zvládáš vysoký stres" : "Středně náročné pozice");

  // Conflicts
  const conflicts: string[] = [];
  if (stressTolerance.value !== null && stressTolerance.value < 40 && preferredSalary.min && preferredSalary.min > 60000) {
    conflicts.push("Říkáš, že chceš vysoký plat, ale často vybíráš pozice s nízkým stresem (typicky hůře placené).");
  }

  return {
    preferredSalary,
    preferredJobType,
    preferredEnvironment,
    preferredShiftType,
    stressTolerance,
    isolationPreference,
    patterns,
    conflicts,
    lastComputedAt: totalSignals > 0 ? new Date().toISOString() : null,
  };
}

function countBy(items: string[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, x) => {
    if (!x) return acc;
    acc[x] = (acc[x] ?? 0) + 1;
    return acc;
  }, {});
}

function topEntry(counts: Record<string, number>): { key: string; count: number } | null {
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { key: entries[0][0], count: entries[0][1] };
}
