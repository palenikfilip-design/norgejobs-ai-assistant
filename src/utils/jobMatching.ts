import type { Job } from "@/data/mockJobs";
import type { AvatarProfile } from "@/context/UserContext";
import { parseSalaryRange, convertCurrency, type CurrencyCode } from "./currency";

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
}

export function calculateMatchScore(job: Job, avatar: AvatarProfile): {
  score: number;
  details: MatchDetail[];
  reasons: string[];
  negatives: string[];
} {
  const details: MatchDetail[] = [];
  const reasons: string[] = [];
  const negatives: string[] = [];
  const normalizedSkills = avatar.skills.map(s => s.toLowerCase());

  // Skills match (0-40 points)
  const overlap = job.skills.filter(s => normalizedSkills.includes(s.toLowerCase()));
  const skillScore = Math.round((overlap.length / Math.max(job.skills.length, 1)) * 40);
  details.push({ category: "Skills", points: skillScore, maxPoints: 40, reason: overlap.length > 0 ? `Matches: ${overlap.join(", ")}` : "No skill overlap" });
  if (overlap.length > 0) reasons.push(`Matches your ${overlap.join(", ")} skills`);
  if (overlap.length === 0) negatives.push("No matching skills found");
  const missingSkills = job.skills.filter(s => !normalizedSkills.includes(s.toLowerCase()));
  if (missingSkills.length > 0 && overlap.length > 0) negatives.push(`Missing: ${missingSkills.join(", ")}`);

  // Location match (0-20 points)
  const wantsRemote = avatar.preferredCountries.some(c => c.toLowerCase().includes("remote"));
  const countryMatch = avatar.preferredCountries.some(c => c.toLowerCase() === job.country.toLowerCase());
  const isRemoteJob = job.country.toLowerCase() === "remote";
  let locationScore = 0;
  if (countryMatch || (wantsRemote && isRemoteJob)) {
    locationScore = 20;
    reasons.push(isRemoteJob ? "Remote job — work from anywhere" : `Located in ${job.country}, your preferred country`);
  } else {
    negatives.push(`${job.country} is not in your preferred countries`);
  }
  details.push({ category: "Location", points: locationScore, maxPoints: 20, reason: locationScore > 0 ? `${job.country} matches preference` : `${job.country} not preferred` });

  // Salary match (0-20 points)
  const parsed = parseSalaryRange(job.salary);
  let salaryScore = 0;
  if (parsed) {
    const jobMaxEur = convertCurrency(parsed.max, parsed.currency, "EUR");
    const jobMinEur = convertCurrency(parsed.min, parsed.currency, "EUR");
    if (jobMaxEur >= avatar.salaryMin && jobMinEur <= avatar.salaryMax * 1.5) {
      salaryScore = 20;
      reasons.push("Salary meets your expectations");
    } else if (jobMaxEur >= avatar.salaryMin * 0.8) {
      salaryScore = 10;
      reasons.push("Salary is close to your expectations");
    } else {
      negatives.push("Salary below your minimum expectation");
    }
  }
  details.push({ category: "Salary", points: salaryScore, maxPoints: 20, reason: salaryScore >= 15 ? "Meets expectations" : salaryScore > 0 ? "Close to expectations" : "Below expectations" });

  // Job type match (0-10 points)
  let typeScore = 0;
  if (job.type.toLowerCase() === avatar.preferredJobType.toLowerCase()) {
    typeScore = 10;
    reasons.push(`${job.type} matches your preference`);
  }
  details.push({ category: "Job Type", points: typeScore, maxPoints: 10, reason: typeScore > 0 ? "Matches preference" : `You prefer ${avatar.preferredJobType}` });

  // Bonus (0-10 points) — language, housing, etc.
  let bonusScore = 5; // base relevance
  if (job.description.toLowerCase().includes("housing") || job.description.toLowerCase().includes("accommodation")) {
    if (avatar.housingPreference) {
      bonusScore += 5;
      reasons.push("Housing/accommodation provided");
    }
  }
  if (job.skills.some(s => s.toLowerCase() === "english") || job.description.toLowerCase().includes("no language required")) {
    reasons.push("No local language required");
  }
  if (job.description.toLowerCase().includes("physically demanding") || job.skills.some(s => s.toLowerCase() === "physical fitness")) {
    negatives.push("Physically demanding job");
  }
  details.push({ category: "Bonus", points: Math.min(bonusScore, 10), maxPoints: 10, reason: "Additional factors" });

  const totalScore = Math.min(99, skillScore + locationScore + salaryScore + typeScore + Math.min(bonusScore, 10));

  return { score: totalScore, details, reasons, negatives };
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
      const { score, details, reasons, negatives } = calculateMatchScore(job, avatar);
      return {
        ...job,
        matchScore: score,
        matchDetails: details,
        matchReasons: reasons,
        negativeSignals: negatives,
        matchReason: reasons.join(". "),
        aiSummary: generateAiSummary(job),
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
