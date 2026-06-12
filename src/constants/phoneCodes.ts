export interface PhoneCode {
  code: string; // dial code with leading +
  country: string;
  flag: string;
}

/** Phone dial codes for all supported countries (sorted by country name). */
export const PHONE_CODES: PhoneCode[] = [
  { country: "Australia", flag: "🇦🇺", code: "+61" },
  { country: "Austria", flag: "🇦🇹", code: "+43" },
  { country: "Belgium", flag: "🇧🇪", code: "+32" },
  { country: "Canada", flag: "🇨🇦", code: "+1" },
  { country: "Czech Republic", flag: "🇨🇿", code: "+420" },
  { country: "Denmark", flag: "🇩🇰", code: "+45" },
  { country: "Finland", flag: "🇫🇮", code: "+358" },
  { country: "France", flag: "🇫🇷", code: "+33" },
  { country: "Germany", flag: "🇩🇪", code: "+49" },
  { country: "Great Britain", flag: "🇬🇧", code: "+44" },
  { country: "Greece", flag: "🇬🇷", code: "+30" },
  { country: "Hungary", flag: "🇭🇺", code: "+36" },
  { country: "Iceland", flag: "🇮🇸", code: "+354" },
  { country: "Ireland", flag: "🇮🇪", code: "+353" },
  { country: "Italy", flag: "🇮🇹", code: "+39" },
  { country: "Japan", flag: "🇯🇵", code: "+81" },
  { country: "Luxembourg", flag: "🇱🇺", code: "+352" },
  { country: "Netherlands", flag: "🇳🇱", code: "+31" },
  { country: "New Zealand", flag: "🇳🇿", code: "+64" },
  { country: "Norway", flag: "🇳🇴", code: "+47" },
  { country: "Poland", flag: "🇵🇱", code: "+48" },
  { country: "Portugal", flag: "🇵🇹", code: "+351" },
  { country: "Qatar", flag: "🇶🇦", code: "+974" },
  { country: "Singapore", flag: "🇸🇬", code: "+65" },
  { country: "Slovakia", flag: "🇸🇰", code: "+421" },
  { country: "Spain", flag: "🇪🇸", code: "+34" },
  { country: "Sweden", flag: "🇸🇪", code: "+46" },
  { country: "Switzerland", flag: "🇨🇭", code: "+41" },
  { country: "United Arab Emirates", flag: "🇦🇪", code: "+971" },
  { country: "USA", flag: "🇺🇸", code: "+1" },
];

/** Sorted by dial-code numeric value (handy for some pickers). */
export const PHONE_CODES_BY_NUMBER = [...PHONE_CODES].sort(
  (a, b) => parseInt(a.code.slice(1), 10) - parseInt(b.code.slice(1), 10),
);

/** Split a phone string into (prefix, rest). Falls back to ("", phone). */
export function splitPhone(phone: string): { prefix: string; rest: string } {
  if (!phone) return { prefix: "", rest: "" };
  const trimmed = phone.trim();
  // sort by code length desc so +420 matches before +4
  const codes = [...new Set(PHONE_CODES.map((p) => p.code))].sort((a, b) => b.length - a.length);
  for (const c of codes) {
    if (trimmed.startsWith(c)) {
      return { prefix: c, rest: trimmed.slice(c.length).trim() };
    }
  }
  return { prefix: "", rest: trimmed };
}

export function joinPhone(prefix: string, rest: string): string {
  const r = (rest || "").trim();
  if (!prefix) return r;
  if (!r) return prefix;
  return `${prefix} ${r}`;
}