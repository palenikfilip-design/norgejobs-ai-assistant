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
      if (preferredCountries.some((c) => c.toLowerCase() === job.country.toLowerCase())) {
        score += 30;
        reasons.push(`Located in ${job.country}, one of your preferred countries`);
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
