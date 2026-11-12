export type EmployerJobStatus = "draft" | "pending_review" | "published" | "closed" | "expired";

export const STATUS_LABELS: Record<EmployerJobStatus, string> = {
  draft: "Koncept", pending_review: "Čeká na schválení", published: "Zveřejněno", closed: "Uzavřeno", expired: "Vypršelo",
};

export const JOB_TYPES = [
  { value: "full-time", label: "Plný úvazek" }, { value: "part-time", label: "Částečný úvazek" },
  { value: "seasonal", label: "Sezónní" }, { value: "temporary", label: "Brigáda / dočasná" },
];
export const CURRENCIES = ["EUR", "CZK", "CHF", "NOK", "SEK", "DKK", "GBP", "PLN", "USD"];
export const LANG_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export type CompletenessInput = {
  languages?: unknown[] | null; experience?: string | null; working_hours?: string | null;
  food_provided?: boolean | null; transport_provided?: boolean | null; description?: string | null; benefits?: unknown[] | null;
};

/** Mirrors public.employer_job_completeness() in the database (required fields = 60). */
export function completeness(j: CompletenessInput): number {
  return 60
    + ((j.languages?.length ?? 0) > 0 ? 8 : 0)
    + (j.experience?.trim() ? 5 : 0)
    + (j.working_hours?.trim() ? 5 : 0)
    + (j.food_provided != null ? 4 : 0)
    + (j.transport_provided != null ? 4 : 0)
    + ((j.description?.length ?? 0) >= 150 ? 8 : 0)
    + ((j.benefits?.length ?? 0) > 0 ? 6 : 0);
}

/** Employer offers in the catalog use a same-site link to the company page. */
export function employerSlugFromUrl(url: string | null | undefined): string | null {
  const m = url?.match(/^\/company\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Catalog categories (public_jobs.category) offered to employers. */
export const JOB_CATEGORIES = [
  { value: "Gastronomy", label: "Gastronomie a hotely" }, { value: "SkiResort", label: "Lyžařská střediska" },
  { value: "Agriculture", label: "Zemědělství" }, { value: "Construction", label: "Stavebnictví" },
  { value: "Manufacturing", label: "Výroba" }, { value: "Logistics", label: "Logistika a sklady" },
  { value: "Transport", label: "Doprava a řidiči" }, { value: "Healthcare", label: "Zdravotnictví a péče" },
  { value: "Education", label: "Vzdělávání" }, { value: "Office", label: "Kancelář a administrativa" },
  { value: "Sales", label: "Prodej a obchod" }, { value: "IT", label: "IT a technologie" },
  { value: "Marine", label: "Námořní a rybářství" }, { value: "AuPair", label: "Au pair" },
  { value: "Management", label: "Management" }, { value: "Other", label: "Ostatní" },
] as const;
export const SKILL_LEVELS = [
  { value: "manual", label: "Manuální práce" }, { value: "skilled", label: "Odborná práce" },
  { value: "management", label: "Vedoucí pozice" },
] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number]["value"];
