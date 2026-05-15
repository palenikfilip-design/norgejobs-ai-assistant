import type { Job } from "@/data/mockJobs";
import type { AvatarProfile } from "@/context/UserContext";
import { parseSalaryRange, convertCurrency, type CurrencyCode } from "./currency";
import type { LifestyleProfile } from "@/types/lifestyleProfile";
import { hasLifestyleData } from "@/types/lifestyleProfile";

export interface MatchDetail {
  category: string;
  points: number;
  maxPoints: number;
  reason: string;
  isNegative?: boolean;
}

export interface EnhancedJob extends Job {
  matchScore: number;
  matchDetails: MatchDetail[];
  matchReasons: string[];
  negativeSignals: string[];
  aiSummary: string;
  hardFiltered?: boolean;
  hardFilterReason?: string;
  sourcePortal?: string;
}

// --- Category scorers (each returns 0–100) ---

function scoreSkills(job: Job, normalizedSkills: string[]): { score: number; reasons: string[]; negatives: string[] } {
  const required = job.requiredSkills ?? job.skills;
  const exact = required.filter(s => normalizedSkills.includes(s.toLowerCase()));
  const missing = required.filter(s => !normalizedSkills.includes(s.toLowerCase()));

  // Related skills: if user has at least some skills but not exact, partial credit
  const related = missing.filter(s => {
    const sl = s.toLowerCase();
    return normalizedSkills.some(us => us.includes(sl) || sl.includes(us));
  });

  if (required.length === 0) return { score: 100, reasons: ["No specific skills required"], negatives: [] };

  const exactScore = exact.length * 100;
  const relatedScore = related.length * 70;
  const noMatchCount = missing.length - related.length;
  const noMatchScore = noMatchCount * 20;
  const total = (exactScore + relatedScore + noMatchScore) / required.length;

  const reasons: string[] = [];
  const negatives: string[] = [];
  if (exact.length > 0) reasons.push(`Matches your ${exact.join(", ")} skills`);
  if (missing.length > 0) negatives.push(`Missing: ${missing.join(", ")}`);
  if (exact.length === 0 && related.length === 0) negatives.push("No matching skills found");

  return { score: Math.round(Math.min(100, total)), reasons, negatives };
}

function scoreSalary(job: Job, avatar: AvatarProfile): { score: number; reasons: string[]; negatives: string[] } {
  const parsed = parseSalaryRange(job.salary);
  if (!parsed) return { score: 50, reasons: [], negatives: [] };

  const jobAvgEur = convertCurrency((parsed.min + parsed.max) / 2, parsed.currency, "EUR");
  const expectedEur = (avatar.salaryMin + avatar.salaryMax) / 2 || avatar.salaryMin;

  if (expectedEur === 0) return { score: 80, reasons: ["No salary expectation set"], negatives: [] };

  const ratio = jobAvgEur / expectedEur;
  if (ratio >= 0.95) return { score: 100, reasons: ["Salary meets your expectations"], negatives: [] };
  if (ratio >= 0.85) return { score: 70, reasons: ["Salary is close to your expectations"], negatives: [] };
  return { score: 30, reasons: [], negatives: ["Salary below your minimum expectation"] };
}

function scoreLocation(job: Job, avatar: AvatarProfile): { score: number; reasons: string[]; negatives: string[] } {
  const wantsRemote = avatar.preferredCountries.some(c => c.toLowerCase().includes("remote"));
  const countryMatch = avatar.preferredCountries.some(c => c.toLowerCase() === job.country.toLowerCase());
  const isRemote = job.country.toLowerCase() === "remote";

  if (countryMatch || (wantsRemote && isRemote)) {
    return {
      score: 100,
      reasons: [isRemote ? "Remote job — work from anywhere" : `Located in ${job.country}, your preferred country`],
      negatives: [],
    };
  }
  // Check if relocation might be OK (user has multiple countries listed)
  if (avatar.preferredCountries.length > 0) {
    return { score: 30, reasons: [], negatives: [`${job.country} is not in your preferred countries`] };
  }
  return { score: 70, reasons: ["No location preference set"], negatives: [] };
}

const LANG_MAP: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

function scoreLanguage(job: Job, avatar: AvatarProfile): { score: number; reasons: string[]; negatives: string[]; hardFail: boolean } {
  const required = job.requiredLanguages ?? [];
  if (required.length === 0) return { score: 100, reasons: ["No language requirement"], negatives: [], hardFail: false };

  let total = 0;
  let hardFail = false;
  const reasons: string[] = [];
  const negatives: string[] = [];

  required.forEach(req => {
    const userLang = avatar.languages.find(l => l.language.toLowerCase() === req.language.toLowerCase());
    if (!userLang) {
      total += 30;
      negatives.push(`Missing language: ${req.language} (${req.level})`);
      hardFail = true;
      return;
    }
    const userLevel = LANG_MAP[userLang.level] ?? 0;
    const reqLevel = LANG_MAP[req.level] ?? 0;
    if (userLevel >= reqLevel) {
      total += 100;
      reasons.push(`${req.language} level meets requirement`);
    } else if (userLevel >= reqLevel - 1) {
      total += 70;
      negatives.push(`${req.language} level slightly below required ${req.level}`);
    } else {
      total += 30;
      negatives.push(`${req.language} level may be insufficient (need ${req.level})`);
      hardFail = true;
    }
  });

  return { score: Math.round(total / required.length), reasons, negatives, hardFail };
}

function scoreJobType(job: Job, avatar: AvatarProfile): { score: number; reasons: string[]; negatives: string[] } {
  const jobType = job.type.toLowerCase();
  const prefs = (avatar.preferredJobType || []).map((p) => p.toLowerCase());
  if (prefs.length === 0) return { score: 70, reasons: [], negatives: [] };

  if (prefs.includes(jobType)) {
    return { score: 100, reasons: [`${job.type} matches your preference`], negatives: [] };
  }

  const remoteTypes = ["remote", "full-time"];
  if (remoteTypes.includes(jobType) && prefs.some((p) => remoteTypes.includes(p))) {
    return { score: 70, reasons: [`${job.type} is similar to your preference`], negatives: [] };
  }

  return { score: 30, reasons: [], negatives: [`You prefer ${avatar.preferredJobType.join(", ")}`] };
}

function scoreLifestyle(job: Job, avatar: AvatarProfile): { score: number; reasons: string[]; negatives: string[] } {
  let score = 60; // baseline
  const reasons: string[] = [];
  const negatives: string[] = [];
  const desc = job.description.toLowerCase();

  // Housing
  if (desc.includes("housing") || desc.includes("accommodation")) {
    if (avatar.housingPreference) {
      score += 20;
      reasons.push("Housing/accommodation provided");
    }
  }

  // Physical work
  if (desc.includes("physically demanding") || job.skills.some(s => s.toLowerCase() === "physical fitness")) {
    negatives.push("Physically demanding job");
    score -= 10;
  }

  // Remote bonus
  if (job.country.toLowerCase() === "remote") {
    score += 15;
    reasons.push("Remote — flexible lifestyle");
  }

  // No local language
  if (job.skills.some(s => s.toLowerCase() === "english") || desc.includes("no language required")) {
    reasons.push("No local language required");
    score += 5;
  }

  return { score: Math.min(100, Math.max(0, score)), reasons, negatives };
}

/** Lifestyle layer scoring — only used when enabled */
function scoreLifestyleLayer(job: Job, lp: LifestyleProfile): { score: number; reasons: string[]; negatives: string[] } {
  let score = 50;
  const reasons: string[] = [];
  const negatives: string[] = [];
  const desc = job.description.toLowerCase();
  const dims = job.dimensions;

  // Children-related scoring
  if (lp.hasChildren) {
    if (dims?.shift_type === "night" || desc.includes("night shift")) {
      score -= 15;
      negatives.push("Night shifts — not ideal with children");
    }
    if (dims?.routine_level && dims.routine_level < 40) {
      score -= 10;
      negatives.push("Unpredictable schedule may conflict with family life");
    }
    if (dims?.routine_level && dims.routine_level >= 60) {
      score += 15;
      reasons.push("Stable schedule — suitable for parents");
    }
    if (lp.youngestChildAge === "0-3") {
      if (job.type.toLowerCase() === "seasonal") {
        score -= 10;
        negatives.push("Seasonal work can be challenging with a toddler");
      }
    }
  }

  // Shift work
  if (!lp.canWorkShifts && dims?.shift_type === "flexible") {
    score -= 10;
    negatives.push("Requires shift flexibility");
  }
  if (!lp.canWorkNights && (dims?.shift_type === "night" || desc.includes("night"))) {
    score -= 15;
    negatives.push("Night work required — you prefer daytime");
  }
  if (lp.canWorkNights && dims?.shift_type === "night") {
    score += 10;
    reasons.push("Night shift — matches your availability");
  }

  // Weekend
  if (lp.weekendAvailability === "none" && (desc.includes("weekend") || desc.includes("saturday") || desc.includes("sunday"))) {
    score -= 15;
    negatives.push("May require weekend work");
  }

  // Relocation
  if (lp.willingToRelocate && job.country.toLowerCase() !== "remote") {
    score += 5;
    reasons.push("Suitable for relocation");
  }
  if (!lp.willingToRelocate && job.country.toLowerCase() !== "remote") {
    score -= 10;
    negatives.push("Requires relocation — you prefer not to move");
  }

  // Stable schedule
  if (lp.prefersStableSchedule) {
    if (dims?.routine_level && dims.routine_level >= 60) {
      score += 10;
      reasons.push("Stable, predictable schedule");
    }
    if (dims?.routine_level && dims.routine_level < 30) {
      score -= 10;
      negatives.push("Unpredictable schedule");
    }
  }

  // Seasonal
  if (!lp.openToSeasonalJobs && job.type.toLowerCase() === "seasonal") {
    score -= 15;
    negatives.push("Seasonal job — you prefer permanent positions");
  }
  if (lp.openToSeasonalJobs && job.type.toLowerCase() === "seasonal") {
    score += 5;
    reasons.push("Open to seasonal work");
  }

  // Single & flexible bonus
  if (lp.relationshipStatus === "single" && !lp.hasChildren && lp.willingToRelocate) {
    score += 5;
    reasons.push("Flexible lifestyle — good fit for any location");
  }

  return { score: Math.min(100, Math.max(0, score)), reasons, negatives };
}

// --- Hard filter: experience check ---
function checkExperienceHardFilter(job: Job, avatar: AvatarProfile): { pass: boolean; reason?: string } {
  const expMap: Record<string, number> = {
    any: 0, no_experience: 0, "6_months": 0.5, "1_year": 1, "2_years": 2, "3_5_years": 3,
  };
  const reqExp = job.experienceRequired ?? "any";
  const userExp = avatar.experienceLevel ?? "any";
  const reqYears = expMap[reqExp] ?? 0;
  const userYears = expMap[userExp] ?? 0;

  if (reqYears === 0) return { pass: true };
  if (userYears >= reqYears) return { pass: true };
  if (userYears >= reqYears * 0.5) return { pass: true }; // close enough
  return { pass: false, reason: `Required experience: ${reqExp.replace(/_/g, " ")}` };
}

// --- Main scoring function ---
export function calculateMatchScore(job: Job, avatar: AvatarProfile): {
  score: number;
  details: MatchDetail[];
  reasons: string[];
  negatives: string[];
  hardFiltered: boolean;
  hardFilterReason?: string;
} {
  const normalizedSkills = avatar.skills.map(s => s.toLowerCase());

  const skills = scoreSkills(job, normalizedSkills);
  const salary = scoreSalary(job, avatar);
  const location = scoreLocation(job, avatar);
  const language = scoreLanguage(job, avatar);
  const jobType = scoreJobType(job, avatar);
  const lifestyle = scoreLifestyle(job, avatar);
  const expCheck = checkExperienceHardFilter(job, avatar);

  // Base score (weights: 0.3, 0.2, 0.15, 0.15, 0.1, 0.1)
  let baseScore = Math.round(
    skills.score * 0.3 +
    salary.score * 0.2 +
    location.score * 0.15 +
    language.score * 0.15 +
    jobType.score * 0.1 +
    lifestyle.score * 0.1
  );

  // Lifestyle layer (optional)
  const useLifestyle = avatar.useLifestyleMatching && hasLifestyleData(avatar.lifestyleProfile) && avatar.lifestyleWeight > 0;
  const lifestyleLayer = useLifestyle ? scoreLifestyleLayer(job, avatar.lifestyleProfile) : null;

  let totalScore: number;
  if (lifestyleLayer && useLifestyle) {
    const w = avatar.lifestyleWeight / 100; // 0–0.5
    totalScore = Math.round(baseScore * (1 - w) + lifestyleLayer.score * w);
  } else {
    totalScore = baseScore;
  }

  // Hard filter logic
  let hardFiltered = false;
  let hardFilterReason: string | undefined;

  if (language.hardFail) {
    hardFiltered = true;
    hardFilterReason = "Required language not met";
  }
  if (!expCheck.pass) {
    hardFiltered = true;
    hardFilterReason = expCheck.reason || "Required experience missing";
  }

  if (hardFiltered) {
    totalScore = Math.min(totalScore, 40);
  }

  totalScore = Math.min(99, Math.max(0, totalScore));

  const details: MatchDetail[] = [
    { category: "Skills", points: Math.round(skills.score * 0.3), maxPoints: 30, reason: skills.reasons[0] || skills.negatives[0] || "Skills evaluated" },
    { category: "Salary", points: Math.round(salary.score * 0.2), maxPoints: 20, reason: salary.reasons[0] || salary.negatives[0] || "Salary evaluated" },
    { category: "Location", points: Math.round(location.score * 0.15), maxPoints: 15, reason: location.reasons[0] || location.negatives[0] || "Location evaluated" },
    { category: "Language", points: Math.round(language.score * 0.15), maxPoints: 15, reason: language.reasons[0] || language.negatives[0] || "Language evaluated" },
    { category: "Job Type", points: Math.round(jobType.score * 0.1), maxPoints: 10, reason: jobType.reasons[0] || jobType.negatives[0] || "Job type evaluated" },
    { category: "Lifestyle", points: Math.round(lifestyle.score * 0.1), maxPoints: 10, reason: lifestyle.reasons[0] || lifestyle.negatives[0] || "Lifestyle factors" },
  ];

  if (lifestyleLayer && useLifestyle) {
    const lifestylePoints = Math.round(lifestyleLayer.score * (avatar.lifestyleWeight / 100));
    details.push({ category: "Life Match", points: lifestylePoints, maxPoints: Math.round(avatar.lifestyleWeight / 2), reason: lifestyleLayer.reasons[0] || lifestyleLayer.negatives[0] || "Lifestyle compatibility" });
  }

  const reasons = [...skills.reasons, ...salary.reasons, ...location.reasons, ...language.reasons, ...jobType.reasons, ...lifestyle.reasons, ...(lifestyleLayer?.reasons ?? [])];
  const negatives = [...skills.negatives, ...salary.negatives, ...location.negatives, ...language.negatives, ...jobType.negatives, ...lifestyle.negatives, ...(lifestyleLayer?.negatives ?? [])];

  if (hardFiltered) {
    negatives.unshift(`⚠️ ${hardFilterReason}`);
  }

  return { score: totalScore, details, reasons, negatives, hardFiltered, hardFilterReason };
}

export function generateAiSummary(job: Job): string {
  const summaries: Record<string, string> = {
    "Frontend Developer": `A React/TypeScript role at a growing fintech in ${job.city}. Great for developers wanting Nordic work culture with competitive pay.`,
    "Warehouse Operative": `Logistics position in ${job.city} with housing included. Ideal for those seeking stable employment with practical benefits.`,
    "Seasonal Fishing Worker": `Seasonal opportunity in scenic ${job.city} with meals and accommodation. Perfect for adventurous workers seeking unique experiences.`,
    "Hotel Receptionist": `Hospitality role at a premium resort in ${job.city}. Great for multilingual candidates who enjoy guest interaction.`,
    "Software Engineer": `Backend engineering at a top e-commerce platform in ${job.city}. Strong tech stack with growth opportunities in a major tech hub.`,
    "Construction Worker": `Sustainable housing project in Northern Norway. Good pay with safety-focused team environment.`,
    "UX Designer": `Healthcare UX design in ${job.city}. Meaningful work creating applications that impact lives across Europe.`,
    "Farm Worker": `Seasonal agricultural work near ${job.city} with accommodation. Simple, rewarding outdoor work during growing season.`,
    "Remote Customer Support Specialist": `Fully remote support role with flexible hours. Work from anywhere with comprehensive training provided.`,
    "Full-Stack Developer (Remote)": `Remote SaaS development with a distributed team. Full flexibility with competitive European salary.`,
    "Data Entry Clerk": `Office-based data role in Prague city center. Steady, structured work with financial sector exposure.`,
    "Remote Graphic Designer": `Creative remote role with full schedule flexibility. Ideal for designers wanting to work with diverse European brands.`,
    "Delivery Driver": `Local delivery in Frankfurt with company vehicle provided. Straightforward role with all equipment supplied.`,
    "Online English Teacher": `Flexible online teaching with self-set schedule. Perfect for native speakers wanting part-time remote income.`,
  };
  return summaries[job.title] || `${job.type} position at ${job.company} in ${job.city}, ${job.country}. ${job.description.slice(0, 100)}`;
}

export function matchJobsEnhanced(jobs: Job[], avatar: AvatarProfile): EnhancedJob[] {
  return jobs
    .map(job => {
      const { score, details, reasons, negatives, hardFiltered, hardFilterReason } = calculateMatchScore(job, avatar);
      return {
        ...job,
        matchScore: score,
        matchDetails: details,
        matchReasons: reasons,
        negativeSignals: negatives,
        matchReason: reasons.join(". "),
        aiSummary: generateAiSummary(job),
        hardFiltered,
        hardFilterReason,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
