import type { UserProfile, SearchPreset } from "@/context/UserContext";
import type { EnhancedJob } from "@/utils/jobMatching";

export type MissingKey =
  | "languages"
  | "profession"
  | "experience_level"
  | "residence"
  | "skills"
  | "preferred_countries"
  | "preferred_job_type"
  | "salary_min"
  | "seasonal_preference";

export interface MissingItem {
  key: MissingKey;
  weight: number;
  /** Czech label for "Doplň ..." */
  label: string;
  /** Czech benefit sentence shown after the arrow */
  benefit: string;
  /** Where to send the user (profile vs preset edit) */
  target: "profile" | "preset";
  /** Optional field hash, e.g. "#languages" */
  fieldAnchor?: string;
}

const nonEmpty = (v: unknown): boolean => {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0 && v.trim().toLowerCase() !== "any";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return v > 0;
  return true;
};

/**
 * Compute profile completeness from avatar (profile) + active preset.
 * Returns 0–100 + a list of missing items ordered by weight (biggest impact first).
 */
export function computeProfileCompleteness(
  profile: UserProfile | null | undefined,
  preset: SearchPreset | null | undefined,
  extras?: { countryOfOrigin?: string | null; currentResidence?: string | null }
): { percent: number; missing: MissingItem[] } {
  const checks: Array<{ ok: boolean; item: MissingItem }> = [
    {
      ok: nonEmpty(profile?.languages),
      item: {
        key: "languages", weight: 20, target: "profile", fieldAnchor: "#languages",
        label: "jazyky",
        benefit: "ukážu i nabídky s jazykovými požadavky",
      },
    },
    {
      ok: nonEmpty(profile?.profession) || nonEmpty(profile?.professions),
      item: {
        key: "profession", weight: 15, target: "profile", fieldAnchor: "#profession",
        label: "obor",
        benefit: "přesnější shody podle tvého oboru",
      },
    },
    {
      ok: nonEmpty(preset?.preferredCountries),
      item: {
        key: "preferred_countries", weight: 15, target: "preset", fieldAnchor: "#countries",
        label: "cílové země",
        benefit: "zúžím hledání na to co tě zajímá",
      },
    },
    {
      ok: nonEmpty(profile?.experienceLevel),
      item: {
        key: "experience_level", weight: 10, target: "profile", fieldAnchor: "#experience",
        label: "úroveň zkušeností",
        benefit: "lépe odhadnu seniority a plat",
      },
    },
    {
      ok: nonEmpty(extras?.countryOfOrigin) && nonEmpty(extras?.currentResidence),
      item: {
        key: "residence", weight: 10, target: "profile", fieldAnchor: "#origin",
        label: "zemi původu a bydliště",
        benefit: "zohledním vzdálenost a kulturní kontext",
      },
    },
    {
      ok: nonEmpty(preset?.preferredJobType),
      item: {
        key: "preferred_job_type", weight: 10, target: "preset", fieldAnchor: "#jobtype",
        label: "typ úvazku",
        benefit: "vyfiltruju jen relevantní typy práce",
      },
    },
    {
      ok: nonEmpty(preset?.salaryMin),
      item: {
        key: "salary_min", weight: 10, target: "preset", fieldAnchor: "#salary",
        label: "očekávaný plat",
        benefit: "seřadím nabídky podle tvého cíle",
      },
    },
    {
      ok: nonEmpty(profile?.skills),
      item: {
        key: "skills", weight: 5, target: "profile", fieldAnchor: "#skills",
        label: "dovednosti",
        benefit: "lépe spáruju tě s konkrétními rolemi",
      },
    },
    {
      ok: nonEmpty((preset as { seasonalPreference?: string } | null | undefined)?.seasonalPreference),
      item: {
        key: "seasonal_preference", weight: 5, target: "preset", fieldAnchor: "#seasonal",
        label: "sezónnost",
        benefit: "ukážu sezónní vs. stálé pozice podle preference",
      },
    },
  ];

  const percent = checks.reduce((sum, c) => sum + (c.ok ? c.item.weight : 0), 0);
  const missing = checks
    .filter(c => !c.ok)
    .map(c => c.item)
    .sort((a, b) => b.weight - a.weight);

  return { percent, missing };
}

/**
 * Heuristic: results are "weak" when:
 *   - fewer than 8 matches above score 50, OR
 *   - more than half of returned results are fallback / sparse / estimated-salary.
 */
export function areResultsWeak(jobs: EnhancedJob[]): { weak: boolean; strongCount: number } {
  if (!jobs || jobs.length === 0) return { weak: true, strongCount: 0 };
  const strong = jobs.filter(j => (j.matchScore ?? 0) >= 50);

  const weakSignals = jobs.filter(j => {
    const anyJ = j as unknown as Record<string, unknown>;
    return (
      anyJ.isFallback === true ||
      anyJ.isSparse === true ||
      anyJ.salaryEstimated === true ||
      anyJ.salary_estimated === true ||
      anyJ.salary_source === "estimated"
    );
  });

  const tooFewStrong = strong.length < 8;
  const mostlyWeak = weakSignals.length > jobs.length / 2;
  return { weak: tooFewStrong || mostlyWeak, strongCount: strong.length };
}