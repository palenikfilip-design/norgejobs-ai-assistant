/**
 * Map verbose English match-reason strings (produced by the local
 * jobMatching scorers) to short Czech pill labels (max 3 words) for
 * display on job cards. Anything already short / Czech (e.g. reasons
 * coming from cached_matches via the match-jobs Edge Function) passes
 * through unchanged but is still truncated to 3 words for safety.
 */

const EXACT: Record<string, string> = {
  "No specific skills required": "Bez požadavků",
  "No salary expectation set": "Plat OK",
  "Salary meets your expectations": "Vyhovující plat",
  "Salary is close to your expectations": "Slušný plat",
  "Remote job — work from anywhere": "Práce na dálku",
  "No location preference set": "Bez lokality",
  "No language requirement": "Bez jazyka",
  "Housing/accommodation provided": "Ubytování zdarma",
  "Remote — flexible lifestyle": "Flexibilní práce",
  "No local language required": "Bez místního jazyka",
  "Stable schedule — suitable for parents": "Stabilní rozvrh",
  "Night shift — matches your availability": "Noční směny",
  "Suitable for relocation": "Vhodné k přesunu",
  "Stable, predictable schedule": "Stabilní rozvrh",
  "Open to seasonal work": "Sezónní práce",
  "Flexible lifestyle — good fit for any location": "Flexibilní život",
  "General match based on your profile": "Obecná shoda",
};

function truncateWords(s: string, max = 3): string {
  const parts = s.trim().split(/\s+/);
  if (parts.length <= max) return s.trim();
  return parts.slice(0, max).join(" ");
}

export function toCzechPill(reason: string): string {
  if (!reason) return "";
  if (EXACT[reason]) return EXACT[reason];

  // Pattern-based reasons
  const skills = reason.match(/^Matches your (.+) skills$/i);
  if (skills) return "Tvoje dovednosti";

  const located = reason.match(/^Located in .+, your preferred country$/i);
  if (located) return "Tvoje země";

  const langMeets = reason.match(/^(.+) level meets requirement$/i);
  if (langMeets) return `${langMeets[1]} OK`;

  const typeMatch = reason.match(/^(.+) matches your preference$/i);
  if (typeMatch) return truncateWords(typeMatch[1], 3);

  const typeSimilar = reason.match(/^(.+) is similar to your preference$/i);
  if (typeSimilar) return truncateWords(typeSimilar[1], 3);

  return truncateWords(reason, 3);
}