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
};
