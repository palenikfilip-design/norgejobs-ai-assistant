import type { EnhancedJob } from "@/data/mockJobs";
import type { AvatarProfile, LanguageWithLevel } from "@/context/UserContext";
import { parseSalaryRange, convertCurrency } from "./currency";

export interface SmartMatchBreakdown {
  category: string;
  score: number;
  maxScore: number;
  reason: string;
  icon: string;
}

export interface SmartMatchResult {
  score: number;
  breakdown: SmartMatchBreakdown[];
  missingRequirements: string[];
  topReasons: string[];
}

const LANGUAGE_LEVEL_MAP: Record<string, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};

function langLevelScore(userLevel: string, requiredLevel: string): number {
  const user = LANGUAGE_LEVEL_MAP[userLevel] ?? 0;
  const req = LANGUAGE_LEVEL_MAP[requiredLevel] ?? 0;
  if (user >= req) return 1;
  if (user >= req - 1) return 0.5;
  return 0;
}

export function calculateSmartMatch(
  job: EnhancedJob,
  avatar: AvatarProfile
): SmartMatchResult {
  const breakdown: SmartMatchBreakdown[] = [];
  const missing: string[] = [];
  const topReasons: string[] = [];

  const normalizedSkills = avatar.skills.map(s => s.toLowerCase());

  // --- Skills Match (30%) ---
  const requiredSkills = job.requiredSkills ?? job.skills;
  const matchedSkills = requiredSkills.filter(s => normalizedSkills.includes(s.toLowerCase()));
  const missingSkills = requiredSkills.filter(s => !normalizedSkills.includes(s.toLowerCase()));
  const skillScore = Math.round((matchedSkills.length / Math.max(requiredSkills.length, 1)) * 30);
  
  breakdown.push({
    category: "Skills",
    score: skillScore,
    maxScore: 30,
    reason: matchedSkills.length > 0 ? `${matchedSkills.length}/${requiredSkills.length} skills match` : "No matching skills",
    icon: "🎯",
  });
  if (matchedSkills.length > 0) topReasons.push(`Matches ${matchedSkills.join(", ")}`);
  missingSkills.forEach(s => missing.push(`Skill: ${s}`));

  // --- Language Match (25%) ---
  const requiredLangs = job.requiredLanguages ?? [];
  let langScore = 0;
  if (requiredLangs.length === 0) {
    langScore = 25; // No requirement = full score
  } else {
    let totalLangScore = 0;
    requiredLangs.forEach(req => {
      const userLang = avatar.languages.find(
        l => l.language.toLowerCase() === req.language.toLowerCase()
      );
      if (userLang) {
        totalLangScore += langLevelScore(userLang.level, req.level);
      } else {
        missing.push(`Language: ${req.language} (${req.level})`);
      }
    });
    langScore = Math.round((totalLangScore / requiredLangs.length) * 25);
  }
  breakdown.push({
    category: "Languages",
    score: langScore,
    maxScore: 25,
    reason: langScore >= 20 ? "Language requirements met" : langScore > 0 ? "Partial language match" : "Missing required languages",
    icon: "🗣️",
  });
  if (langScore >= 20) topReasons.push("Language requirements met");

  // --- Experience (20%) ---
  const reqExp = job.experienceRequired ?? "any";
  const userExp = avatar.experienceLevel ?? "any";
  const expMap: Record<string, number> = {
    any: 0, no_experience: 0, "6_months": 0.5, "1_year": 1, "2_years": 2, "3_5_years": 3,
  };
  const userExpYears = expMap[userExp] ?? 0;
  const reqExpYears = expMap[reqExp] ?? 0;
  let expScore = 0;
  if (reqExpYears === 0 || userExpYears >= reqExpYears) {
    expScore = 20;
    topReasons.push("Experience level matches");
  } else if (userExpYears >= reqExpYears * 0.5) {
    expScore = 10;
  } else {
    missing.push(`Experience: ${reqExp} required`);
  }
  breakdown.push({
    category: "Experience",
    score: expScore,
    maxScore: 20,
    reason: expScore >= 15 ? "Meets experience requirement" : expScore > 0 ? "Close to required experience" : "More experience needed",
    icon: "📊",
  });

  // --- Certifications (15%) ---
  const reqCerts = job.certificationsRequired ?? [];
  const userCerts = (avatar.certifications ?? []).map(c => c.toLowerCase());
  let certScore = 0;
  if (reqCerts.length === 0) {
    certScore = 15;
  } else {
    const matchedCerts = reqCerts.filter(c => userCerts.includes(c.toLowerCase()));
    certScore = Math.round((matchedCerts.length / reqCerts.length) * 15);
    const missingCerts = reqCerts.filter(c => !userCerts.includes(c.toLowerCase()));
    missingCerts.forEach(c => missing.push(`Certification: ${c}`));
    if (matchedCerts.length > 0) topReasons.push(`Has ${matchedCerts.join(", ")}`);
  }
  breakdown.push({
    category: "Certifications",
    score: certScore,
    maxScore: 15,
    reason: certScore >= 12 ? "Certifications match" : certScore > 0 ? "Some certifications match" : "Missing certifications",
    icon: "📜",
  });

  // --- Location + Salary (10%) ---
  let locSalScore = 0;
  const countryMatch = avatar.preferredCountries.some(
    c => c.toLowerCase() === job.country.toLowerCase()
  );
  const wantsRemote = avatar.preferredCountries.some(c => c.toLowerCase().includes("remote"));
  const isRemote = job.country.toLowerCase() === "remote";
  if (countryMatch || (wantsRemote && isRemote)) {
    locSalScore += 5;
    topReasons.push(isRemote ? "Remote — work from anywhere" : `Located in ${job.country}`);
  }

  const parsed = parseSalaryRange(job.salary);
  if (parsed) {
    const jobMaxEur = convertCurrency(parsed.max, parsed.currency, "EUR");
    if (jobMaxEur >= avatar.salaryMin) {
      locSalScore += 5;
    }
  } else {
    locSalScore += 3; // unknown salary, give partial
  }
  breakdown.push({
    category: "Location & Salary",
    score: locSalScore,
    maxScore: 10,
    reason: locSalScore >= 8 ? "Great location & salary fit" : locSalScore >= 5 ? "Partial match" : "Location or salary mismatch",
    icon: "📍",
  });

  const score = Math.min(100, breakdown.reduce((sum, b) => sum + b.score, 0));

  return { score, breakdown, missingRequirements: missing, topReasons: topReasons.slice(0, 3) };
}
