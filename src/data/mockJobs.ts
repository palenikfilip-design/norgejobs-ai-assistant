import { type JobDimensions, defaultJobDimensions } from "@/types/candidateDimensions";

export interface Job {
  id: string;
  title: string;
  company: string;
  country: string;
  city: string;
  salary: string;
  type: string;
  description: string;
  skills: string[];
  matchScore?: number;
  matchReason?: string;
  requiredSkills?: string[];
  requiredLanguages?: { language: string; level: string }[];
  experienceRequired?: string;
  certificationsRequired?: string[];
  applicants?: number;
  positions?: number;
  avgDaysToFill?: number;
  dimensions?: JobDimensions;
}

export const mockJobs: Job[] = [
  {
    id: "1",
    title: "Frontend Developer",
    company: "Nordic Tech AS",
    country: "Norway",
    city: "Oslo",
    salary: "€55,000 – €72,000",
    type: "Full-time",
    description: "Build modern web applications using React and TypeScript for a growing fintech startup in Oslo.",
    skills: ["React", "TypeScript", "CSS", "Node.js"],
    requiredSkills: ["React", "TypeScript", "CSS", "Node.js"],
    requiredLanguages: [{ language: "english", level: "B2" }],
    experienceRequired: "2_years",
    certificationsRequired: [],
    applicants: 45,
    positions: 2,
    avgDaysToFill: 30,
    dimensions: { stress_level: 55, isolation_level: 30, physical_demand: 10, environment_type: "city", shift_type: "day", climate: "cold", social_interaction: 60, routine_level: 40 },
  },
  {
    id: "2",
    title: "Warehouse Operative",
    company: "FjordLogistics",
    country: "Norway",
    city: "Bergen",
    salary: "€32,000 – €38,000",
    type: "Full-time",
    description: "Join our logistics team managing inventory and shipments. Housing provided near the facility.",
    skills: ["Logistics", "Physical fitness", "Forklift license"],
    requiredSkills: ["Logistics", "Physical fitness"],
    requiredLanguages: [{ language: "english", level: "A2" }, { language: "norwegian", level: "A1" }],
    experienceRequired: "6_months",
    certificationsRequired: ["Forklift license"],
    applicants: 8,
    positions: 3,
    avgDaysToFill: 14,
    dimensions: { stress_level: 40, isolation_level: 50, physical_demand: 80, environment_type: "mixed", shift_type: "day", climate: "cold", social_interaction: 40, routine_level: 70 },
  },
  {
    id: "3",
    title: "Seasonal Fishing Worker",
    company: "Lofoten Seafood",
    country: "Norway",
    city: "Lofoten",
    salary: "€28,000 – €35,000",
    type: "Seasonal",
    description: "Work in fish processing during peak season. Accommodation and meals included.",
    skills: ["Physical fitness", "Teamwork", "Food processing"],
    requiredLanguages: [{ language: "english", level: "A1" }],
    experienceRequired: "no_experience",
    applicants: 5,
    positions: 10,
    avgDaysToFill: 7,
    dimensions: { stress_level: 60, isolation_level: 70, physical_demand: 90, environment_type: "nature", shift_type: "flexible", climate: "cold", social_interaction: 30, routine_level: 80 },
  },
  {
    id: "4",
    title: "Hotel Receptionist",
    company: "Alpine Resort GmbH",
    country: "Austria",
    city: "Innsbruck",
    salary: "€30,000 – €36,000",
    type: "Full-time",
    description: "Welcome guests at a premium alpine resort. Multi-language skills are a plus.",
    skills: ["Customer service", "Languages", "Hospitality"],
    requiredLanguages: [{ language: "english", level: "B1" }, { language: "german", level: "A2" }],
    experienceRequired: "1_year",
    applicants: 22,
    positions: 1,
    avgDaysToFill: 21,
    dimensions: { stress_level: 45, isolation_level: 15, physical_demand: 20, environment_type: "nature", shift_type: "flexible", climate: "cold", social_interaction: 90, routine_level: 50 },
  },
  {
    id: "5",
    title: "Software Engineer",
    company: "TechBerlin AG",
    country: "Germany",
    city: "Berlin",
    salary: "€60,000 – €80,000",
    type: "Full-time",
    description: "Develop scalable backend systems for Europe's fastest-growing e-commerce platform.",
    skills: ["Python", "AWS", "PostgreSQL", "Docker"],
    requiredSkills: ["Python", "AWS", "PostgreSQL", "Docker"],
    requiredLanguages: [{ language: "english", level: "B2" }],
    experienceRequired: "3_5_years",
    applicants: 120,
    positions: 3,
    avgDaysToFill: 45,
    dimensions: { stress_level: 65, isolation_level: 35, physical_demand: 10, environment_type: "city", shift_type: "day", climate: "moderate", social_interaction: 55, routine_level: 35 },
  },
  {
    id: "6",
    title: "Construction Worker",
    company: "NordBygg AB",
    country: "Norway",
    city: "Tromsø",
    salary: "€38,000 – €48,000",
    type: "Full-time",
    description: "Help build sustainable housing projects in Northern Norway. Experience preferred.",
    skills: ["Construction", "Physical fitness", "Safety certification"],
    requiredSkills: ["Construction", "Physical fitness"],
    certificationsRequired: ["Safety certification"],
    requiredLanguages: [{ language: "english", level: "A2" }],
    experienceRequired: "1_year",
    applicants: 12,
    positions: 5,
    avgDaysToFill: 10,
    dimensions: { stress_level: 55, isolation_level: 40, physical_demand: 90, environment_type: "nature", shift_type: "day", climate: "cold", social_interaction: 50, routine_level: 60 },
  },
  {
    id: "7",
    title: "UX Designer",
    company: "DesignHouse",
    country: "Germany",
    city: "Munich",
    salary: "€50,000 – €65,000",
    type: "Full-time",
    description: "Design intuitive user experiences for healthcare applications used across Europe.",
    skills: ["Figma", "User Research", "Prototyping", "Design Systems"],
    requiredLanguages: [{ language: "english", level: "B2" }],
    experienceRequired: "2_years",
    applicants: 55,
    positions: 1,
    avgDaysToFill: 35,
    dimensions: { stress_level: 45, isolation_level: 25, physical_demand: 10, environment_type: "city", shift_type: "day", climate: "moderate", social_interaction: 65, routine_level: 30 },
  },
  {
    id: "8",
    title: "Farm Worker",
    company: "GreenFields AG",
    country: "Austria",
    city: "Graz",
    salary: "€24,000 – €30,000",
    type: "Seasonal",
    description: "Help with harvest and farm maintenance during the growing season. Accommodation available.",
    skills: ["Agriculture", "Physical fitness", "Driving license"],
    experienceRequired: "no_experience",
    applicants: 3,
    positions: 8,
    avgDaysToFill: 5,
    dimensions: { stress_level: 30, isolation_level: 60, physical_demand: 85, environment_type: "nature", shift_type: "day", climate: "moderate", social_interaction: 30, routine_level: 75 },
  },
  {
    id: "9",
    title: "Remote Customer Support Specialist",
    company: "CloudDesk",
    country: "Remote",
    city: "Anywhere",
    salary: "€28,000 – €35,000",
    type: "Remote",
    description: "Provide customer support via chat and email from home. Flexible hours, full training provided.",
    skills: ["Customer service", "Communication", "English"],
    requiredLanguages: [{ language: "english", level: "B1" }],
    applicants: 80,
    positions: 5,
    avgDaysToFill: 20,
    dimensions: { stress_level: 50, isolation_level: 60, physical_demand: 5, environment_type: "city", shift_type: "flexible", climate: "moderate", social_interaction: 70, routine_level: 60 },
  },
  {
    id: "10",
    title: "Full-Stack Developer (Remote)",
    company: "DistributeIO",
    country: "Remote",
    city: "Anywhere",
    salary: "€50,000 – €70,000",
    type: "Remote",
    description: "Build and maintain web applications for a fully remote SaaS company. Work from anywhere in Europe.",
    skills: ["React", "Node.js", "TypeScript", "PostgreSQL"],
    requiredSkills: ["React", "Node.js", "TypeScript", "PostgreSQL"],
    requiredLanguages: [{ language: "english", level: "B2" }],
    experienceRequired: "2_years",
    applicants: 90,
    positions: 2,
    avgDaysToFill: 28,
    dimensions: { stress_level: 55, isolation_level: 50, physical_demand: 5, environment_type: "city", shift_type: "flexible", climate: "moderate", social_interaction: 45, routine_level: 30 },
  },
  {
    id: "11",
    title: "Data Entry Clerk",
    company: "DataFirst s.r.o.",
    country: "Czech Republic",
    city: "Prague",
    salary: "€18,000 – €24,000",
    type: "Full-time",
    description: "Process and organize data for financial clients. Office-based in Prague city center.",
    skills: ["Excel", "Attention to detail", "Data entry"],
    experienceRequired: "no_experience",
    applicants: 15,
    positions: 2,
    avgDaysToFill: 12,
    dimensions: { stress_level: 25, isolation_level: 35, physical_demand: 10, environment_type: "city", shift_type: "day", climate: "moderate", social_interaction: 30, routine_level: 90 },
  },
  {
    id: "12",
    title: "Remote Graphic Designer",
    company: "PixelCraft",
    country: "Remote",
    city: "Anywhere",
    salary: "€30,000 – €45,000",
    type: "Remote",
    description: "Create visual content for brands across Europe. Fully remote with flexible schedule.",
    skills: ["Figma", "Adobe Creative Suite", "Branding", "Illustration"],
    requiredLanguages: [{ language: "english", level: "B1" }],
    applicants: 70,
    positions: 1,
    avgDaysToFill: 40,
    dimensions: { stress_level: 40, isolation_level: 55, physical_demand: 5, environment_type: "city", shift_type: "flexible", climate: "moderate", social_interaction: 35, routine_level: 35 },
  },
  {
    id: "13",
    title: "Delivery Driver",
    company: "SwiftPack GmbH",
    country: "Germany",
    city: "Frankfurt",
    salary: "€28,000 – €34,000",
    type: "Full-time",
    description: "Deliver packages across the Frankfurt metro area. Company vehicle and fuel provided.",
    skills: ["Driving license", "Navigation", "Physical fitness"],
    certificationsRequired: ["Driving license"],
    applicants: 18,
    positions: 4,
    avgDaysToFill: 8,
    dimensions: { stress_level: 45, isolation_level: 65, physical_demand: 60, environment_type: "city", shift_type: "day", climate: "moderate", social_interaction: 20, routine_level: 80 },
  },
  {
    id: "14",
    title: "Online English Teacher",
    company: "LearnGlobal",
    country: "Remote",
    city: "Anywhere",
    salary: "€20,000 – €32,000",
    type: "Part-time",
    description: "Teach English online to students worldwide. Set your own schedule, work from home.",
    skills: ["English", "Teaching", "Communication", "Patience"],
    requiredLanguages: [{ language: "english", level: "C1" }],
    applicants: 200,
    positions: 10,
    avgDaysToFill: 15,
    dimensions: { stress_level: 35, isolation_level: 50, physical_demand: 5, environment_type: "city", shift_type: "flexible", climate: "moderate", social_interaction: 80, routine_level: 40 },
  },
];
export function matchJobsToProfile(
  jobs: Job[],
  skills: string[],
  preferredCountries: string[],
  salaryMin: number,
  salaryMax: number,
  preferredJobType: string
): Job[] {
  const normalizedSkills = skills.map((s) => s.toLowerCase());

  return jobs
    .map((job) => {
      let score = 0;
      const reasons: string[] = [];

      // Country match (30 pts)
      const wantsRemote = preferredCountries.some((c) => c.toLowerCase().includes("remote"));
      const countryMatch = preferredCountries.some((c) => c.toLowerCase() === job.country.toLowerCase());
      const isRemoteJob = job.country.toLowerCase() === "remote";

      if (countryMatch || (wantsRemote && isRemoteJob)) {
        score += 30;
        reasons.push(isRemoteJob ? "Remote job — work from anywhere" : `Located in ${job.country}, one of your preferred countries`);
      }

      // Skills overlap (up to 40 pts)
      const overlap = job.skills.filter((s) =>
        normalizedSkills.includes(s.toLowerCase())
      );
      const skillScore = Math.min(40, (overlap.length / Math.max(job.skills.length, 1)) * 40);
      score += skillScore;
      if (overlap.length > 0) {
        reasons.push(`Matches your skills: ${overlap.join(", ")}`);
      }

      // Job type match (15 pts)
      if (job.type.toLowerCase() === preferredJobType.toLowerCase()) {
        score += 15;
        reasons.push(`${job.type} matches your preference`);
      }

      // Base relevance (15 pts)
      score += 15;

      const matchScore = Math.min(99, Math.round(score));

      return {
        ...job,
        matchScore,
        matchReason: reasons.length > 0 ? reasons.join(". ") + "." : "General match based on your profile.",
      };
    })
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}
