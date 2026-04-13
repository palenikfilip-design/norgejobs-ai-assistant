export interface JobSource {
  id: string;
  name: string;
  type: "job_portal";
  base_url: string;
  active: boolean;
  auto_assigned: boolean;
  /** Countries this source is relevant for */
  countries: string[];
  /** URL patterns for detection */
  url_patterns: string[];
}

/** Master catalog of known job sources */
export const JOB_SOURCE_CATALOG: Omit<JobSource, "active" | "auto_assigned">[] = [
  {
    id: "finn",
    name: "FINN.no",
    type: "job_portal",
    base_url: "https://www.finn.no/job",
    countries: ["Norway"],
    url_patterns: ["finn.no"],
  },
  {
    id: "nav",
    name: "NAV.no",
    type: "job_portal",
    base_url: "https://arbeidsplassen.nav.no",
    countries: ["Norway"],
    url_patterns: ["nav.no", "arbeidsplassen.nav.no"],
  },
  {
    id: "eures",
    name: "EURES",
    type: "job_portal",
    base_url: "https://eures.ec.europa.eu",
    countries: ["Norway", "Sweden", "Denmark", "Finland", "Germany", "Czech Republic", "Poland", "Spain", "France", "Italy", "Netherlands"],
    url_patterns: ["eures.ec.europa.eu"],
  },
  {
    id: "indeed",
    name: "Indeed",
    type: "job_portal",
    base_url: "https://www.indeed.com",
    countries: ["Norway", "Sweden", "Denmark", "Finland", "Germany", "Czech Republic", "Poland", "Spain", "France", "Italy", "Netherlands", "United Kingdom"],
    url_patterns: ["indeed.com", "indeed.co"],
  },
  {
    id: "jobs_cz",
    name: "Jobs.cz",
    type: "job_portal",
    base_url: "https://www.jobs.cz",
    countries: ["Czech Republic"],
    url_patterns: ["jobs.cz"],
  },
  {
    id: "prace_cz",
    name: "Prace.cz",
    type: "job_portal",
    base_url: "https://www.prace.cz",
    countries: ["Czech Republic"],
    url_patterns: ["prace.cz"],
  },
  {
    id: "linkedin",
    name: "LinkedIn Jobs",
    type: "job_portal",
    base_url: "https://www.linkedin.com/jobs",
    countries: ["Norway", "Sweden", "Denmark", "Finland", "Germany", "Czech Republic", "Poland", "Spain", "France", "Italy", "Netherlands", "United Kingdom"],
    url_patterns: ["linkedin.com"],
  },
  {
    id: "glassdoor",
    name: "Glassdoor",
    type: "job_portal",
    base_url: "https://www.glassdoor.com",
    countries: ["Norway", "Sweden", "Denmark", "Germany", "United Kingdom", "Netherlands"],
    url_patterns: ["glassdoor.com", "glassdoor.co"],
  },
  {
    id: "stepstone",
    name: "StepStone",
    type: "job_portal",
    base_url: "https://www.stepstone.de",
    countries: ["Germany"],
    url_patterns: ["stepstone.de", "stepstone.com"],
  },
  {
    id: "pole_emploi",
    name: "France Travail",
    type: "job_portal",
    base_url: "https://candidat.francetravail.fr",
    countries: ["France"],
    url_patterns: ["francetravail.fr", "pole-emploi.fr"],
  },
  {
    id: "infojobs",
    name: "InfoJobs",
    type: "job_portal",
    base_url: "https://www.infojobs.net",
    countries: ["Spain"],
    url_patterns: ["infojobs.net"],
  },
  {
    id: "pracuj_pl",
    name: "Pracuj.pl",
    type: "job_portal",
    base_url: "https://www.pracuj.pl",
    countries: ["Poland"],
    url_patterns: ["pracuj.pl"],
  },
];

/**
 * Auto-assign sources based on user's preferred countries.
 */
export function getAutoSources(preferredCountries: string[]): JobSource[] {
  if (!preferredCountries.length) {
    // Default global sources
    return JOB_SOURCE_CATALOG
      .filter((s) => ["indeed", "eures", "linkedin"].includes(s.id))
      .map((s) => ({ ...s, active: true, auto_assigned: true }));
  }

  const matched = JOB_SOURCE_CATALOG.filter((s) =>
    s.countries.some((c) => preferredCountries.includes(c))
  );

  // Always include global portals
  const globals = JOB_SOURCE_CATALOG.filter((s) => ["indeed", "eures", "linkedin"].includes(s.id));
  const merged = new Map<string, typeof JOB_SOURCE_CATALOG[0]>();
  [...matched, ...globals].forEach((s) => merged.set(s.id, s));

  return Array.from(merged.values()).map((s) => ({
    ...s,
    active: true,
    auto_assigned: true,
  }));
}

/**
 * Detect which source a URL belongs to. Returns source id or null.
 */
export function detectSourceFromUrl(url: string): string | null {
  const lower = url.toLowerCase();
  for (const source of JOB_SOURCE_CATALOG) {
    if (source.url_patterns.some((p) => lower.includes(p))) {
      return source.id;
    }
  }
  return null;
}
