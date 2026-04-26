import type { LanguageFilter } from "@/constants/jobRequirements";

export interface JobFilters {
  keyword: string;
  location: string;
  countries: string[];
  jobType: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryType: "monthly" | "hourly";
  languages: LanguageFilter[];
  experienceLevel: string;
  professionCategories: string[];
  bonuses: string[];
  /** Selected job portal source IDs (e.g. "jobs_cz", "indeed"). Empty = all. */
  sources: string[];
  /** Geographic scope for portals. */
  sourceScope: "all" | "around_me" | "abroad" | "remote";
}

export const defaultFilters: JobFilters = {
  keyword: "",
  location: "",
  countries: [],
  jobType: "",
  salaryMin: undefined,
  salaryMax: undefined,
  salaryType: "monthly",
  languages: [],
  experienceLevel: "",
  professionCategories: [],
  bonuses: [],
  sources: [],
  sourceScope: "all",
};
