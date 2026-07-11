// Shared skill-level + location helpers. Imported by BOTH match-jobs and
// chat-leslie so the two job pipelines can never drift apart again.

export const MANAGEMENT_RE =
  /\b(manager|manaž(?:er)?|management|vedouc[ií]|head\s+of|chef\s+de|director|directeur|šéf|sef|leader|lead\b|supervisor|principal|coordinator\s+lead|koordinator|coordinator|chef|ledare|ansvarig|samordnare|arbetsledare|enhetschef|platschef|driftchef|gruppchef|teamchef|projektledare|byggledare|f[öo]rman|leiter|projektleiter|bauleiter|abteilungsleiter|filialleiter|teamleiter|meister)\b/i;

export const SKILLED_RE =
  /\b(specialist|specialista|engineer|engineering|ingenieur|ingeniør|inžen[ýi]r|ingenj[öo]r|developer|architect|analyst|analytiker|consultant|controller|accountant|accounting|auditor|nurse|registered\s+nurse|doctor|physician|pilot|avionic|hse|agronom(?:ist)?|horticultur(?:alist|ist|e)?|facilities|technician|technik(?!a)|technik\s+automatizace|automation\s+engineer|automatisierung|pharmacist|teacher|l[äa]rare|yrkesl[äa]rare|lehrer|professor|attorney|lawyer|odbornik|odborník|expert|strategist|strateg)\b/i;

export const MANUAL_TITLE_HINT_RE =
  /\b(cleaner|cleaning|úklid|uklid|housekeep|kitchen|kuchyň|kuchar|kuchař|dishwash|warehouse|sklad|picker|packer|porter|bagboy|baggage|ramp|laborer|labourer|dělník|delnik|pomocn|helper|harvest|sběrač|sklizeň|chambermaid|pokoj|seasonal\s+worker|server|servírka|cisnik|číšník|waiter|waitress|barista|hotel\s+staff|stagione)\b/i;

export const MANUAL_CATEGORIES = new Set([
  "hospitality", "gastronomy", "construction", "logistics", "transport",
  "agriculture", "manufacturing", "ski_resort", "skiresort", "aupair",
  "marine", "maritime", "cleaning",
]);

export type SkillClass = "manual" | "skilled" | "management" | "unknown";

export function classifyJobSkill(job: {
  title?: string | null;
  category?: string | null;
  display_category?: string | null;
}): SkillClass {
  const title = job.title ?? "";
  if (MANAGEMENT_RE.test(title)) return "management";
  if (SKILLED_RE.test(title)) return "skilled";
  if (MANUAL_TITLE_HINT_RE.test(title)) return "manual";
  const cat = String(job.category ?? job.display_category ?? "").toLowerCase().trim();
  if (cat && MANUAL_CATEGORIES.has(cat)) return "manual";
  return "unknown";
}

/**
 * Preferred entry point for match-time skill classification.
 * Reads the pre-computed `skill_class` stored during Archiles enrichment;
 * only falls back to regex for rows not yet enriched (skill_class IS NULL).
 * Keeps the two search paths (match-jobs + chat-leslie) consistent and
 * avoids re-running the regex on every request.
 */
export function getJobSkillClass(job: {
  skill_class?: string | null;
  title?: string | null;
  category?: string | null;
  display_category?: string | null;
}): SkillClass {
  const stored = typeof job.skill_class === "string" ? job.skill_class.toLowerCase() : "";
  if (stored === "manual" || stored === "skilled" || stored === "management" || stored === "unknown") {
    return stored as SkillClass;
  }
  return classifyJobSkill(job);
}

export const COUNTRY_ALIASES: Record<string, string[]> = {
  germany:     ["germany", "deutschland", "german"],
  austria:     ["austria", "österreich", "oesterreich", "austrian"],
  switzerland: ["switzerland", "schweiz", "suisse", "svizzera", "swiss"],
  czechia:     ["czechia", "czech republic", "česko", "cesko", "tschechien"],
  slovakia:    ["slovakia", "slovensko", "slowakei"],
  norway:      ["norway", "norge", "norwegen"],
  sweden:      ["sweden", "sverige", "schweden"],
  denmark:     ["denmark", "danmark", "dänemark"],
  iceland:     ["iceland", "island"],
  netherlands: ["netherlands", "holland", "nederland"],
  belgium:     ["belgium", "belgique", "belgië"],
  france:      ["france", "français"],
  italy:       ["italy", "italia"],
  spain:       ["spain", "españa", "espana"],
  portugal:    ["portugal"],
  poland:      ["poland", "polska", "polen"],
  finland:     ["finland", "suomi"],
  ireland:     ["ireland", "éire"],
  "united kingdom": ["united kingdom", "uk", "england", "britain", "scotland", "wales"],
};

const MULTI_COUNTRY_MARKERS = new Set(["multiple", "remote", "global", "", "unknown"]);

export function isMultiCountryBucket(country?: string | null): boolean {
  const c = String(country ?? "").toLowerCase().trim();
  if (!c) return true;
  if (MULTI_COUNTRY_MARKERS.has(c)) return true;
  return c.startsWith("remote");
}

export function locationMatchesAnyCountry(
  job: { location?: string | null; additional_locations?: unknown },
  countries: string[],
): boolean {
  if (countries.length === 0) return true;
  const haystackParts: string[] = [];
  if (job.location) haystackParts.push(String(job.location));
  const addl = (job as { additional_locations?: unknown }).additional_locations;
  if (Array.isArray(addl)) {
    for (const a of addl) if (typeof a === "string") haystackParts.push(a);
  }
  if (haystackParts.length === 0) return false;
  const haystack = haystackParts.join(" | ").toLowerCase();
  for (const c of countries) {
    const key = c.toLowerCase().trim();
    const aliases = COUNTRY_ALIASES[key] ?? [key];
    for (const alias of aliases) {
      if (haystack.includes(alias)) return true;
    }
  }
  return false;
}