// Static exchange rates (mock) — base: EUR
const RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.09,
  NOK: 11.5,
  CZK: 25,
  GBP: 0.86,
  SEK: 11.2,
  DKK: 7.46,
  CHF: 0.97,
  PLN: 4.32,
};

export type CurrencyCode = keyof typeof RATES;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€", USD: "$", NOK: "kr", CZK: "Kč", GBP: "£",
  SEK: "kr", DKK: "kr", CHF: "CHF", PLN: "zł",
};

export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  const inEur = amount / (RATES[from] || 1);
  return inEur * (RATES[to] || 1);
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const rounded = Math.round(amount);
  return `${symbol}${rounded.toLocaleString("en-US")}`;
}

/** Parse salary string like "€55,000 – €72,000" and return [min, max, currency] */
export function parseSalaryRange(salary: string): { min: number; max: number; currency: CurrencyCode } | null {
  const matches = salary.match(/([€$£]|kr|Kč|CHF|zł)?\s*([\d,]+)/g);
  if (!matches || matches.length === 0) return null;

  const symbolToCurrency: Record<string, CurrencyCode> = {
    "€": "EUR", "$": "USD", "£": "GBP", "kr": "NOK", "Kč": "CZK", "CHF": "CHF", "zł": "PLN",
  };

  // Detect currency from salary string
  let currency: CurrencyCode = "EUR";
  for (const [sym, code] of Object.entries(symbolToCurrency)) {
    if (salary.includes(sym)) { currency = code; break; }
  }

  const values = matches.map(m => parseInt(m.replace(/[^0-9]/g, ""), 10)).filter(v => !isNaN(v));
  if (values.length === 0) return null;

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    currency,
  };
}

/** Convert salary to multiple currencies for display */
export function getMultiCurrencyDisplay(min: number, max: number, fromCurrency: CurrencyCode, targetCurrencies: CurrencyCode[] = ["EUR", "USD", "NOK"]): Array<{ currency: CurrencyCode; min: number; max: number; label: string }> {
  return targetCurrencies
    .filter(c => c !== fromCurrency)
    .map(to => ({
      currency: to,
      min: Math.round(convertCurrency(min, fromCurrency, to)),
      max: Math.round(convertCurrency(max, fromCurrency, to)),
      label: `${formatCurrency(convertCurrency(min, fromCurrency, to), to)} – ${formatCurrency(convertCurrency(max, fromCurrency, to), to)}`,
    }));
}

/**
 * EUR-per-unit conversion rates for displaying a salary in EUR alongside
 * its original currency. Refresh manually each quarter (last update:
 * 2026-Q2). Source: ECB reference rates, rounded.
 */
const EUR_RATES: Record<string, number> = {
  EUR: 1,
  CZK: 0.040,
  NOK: 0.085,
  SEK: 0.090,
  GBP: 1.18,
  USD: 0.92,
  CHF: 1.06,
  PLN: 0.23,
  DKK: 0.134,
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // ISO codes
  CZ: "CZK", NO: "NOK", SE: "SEK", GB: "GBP", UK: "GBP", US: "USD",
  CH: "CHF", PL: "PLN", DK: "DKK",
  // Names (lowercased lookup)
  czechia: "CZK", "czech republic": "CZK", česko: "CZK", "česká republika": "CZK",
  norway: "NOK", norsko: "NOK",
  sweden: "SEK", švédsko: "SEK",
  "united kingdom": "GBP", england: "GBP", britain: "GBP",
  "united states": "USD", usa: "USD",
  switzerland: "CHF", švýcarsko: "CHF",
  poland: "PLN", polsko: "PLN",
  denmark: "DKK", dánsko: "DKK",
};

function detectCurrencyFromString(s: string): string | null {
  const map: Array<[RegExp, string]> = [
    [/€|\beur\b/i, "EUR"],
    [/kč|\bczk\b/i, "CZK"],
    [/\bnok\b/i, "NOK"],
    [/\bsek\b/i, "SEK"],
    [/£|\bgbp\b/i, "GBP"],
    [/\$|\busd\b/i, "USD"],
    [/\bchf\b/i, "CHF"],
    [/zł|\bpln\b/i, "PLN"],
    [/\bdkk\b/i, "DKK"],
    [/\bkr\b/i, "NOK"], // generic "kr" → assume NOK (Norway is primary market)
  ];
  for (const [re, code] of map) if (re.test(s)) return code;
  return null;
}

function detectCurrencyFromCountry(country: string): string | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (COUNTRY_TO_CURRENCY[trimmed.toUpperCase()]) return COUNTRY_TO_CURRENCY[trimmed.toUpperCase()];
  return COUNTRY_TO_CURRENCY[trimmed.toLowerCase()] ?? null;
}

/**
 * Format a raw salary string with an EUR approximation appended.
 * - Empty / null / "neuvedeno" → "Plat neuvedeno"
 * - Already in EUR → returned as-is
 * - Other detected currency → "<original> (≈ X €)"
 * - Unknown currency → returned as-is (no conversion)
 */
export function formatSalaryWithEur(salary: string | null | undefined, country: string | null | undefined): string {
  if (!salary || !salary.trim() || /neuveden/i.test(salary) || /not specified/i.test(salary)) {
    return "Plat neuvedeno";
  }
  const currency =
    detectCurrencyFromString(salary) ??
    detectCurrencyFromCountry(country ?? "");
  if (!currency || currency === "EUR") return salary.trim();

  const rate = EUR_RATES[currency];
  if (!rate) return salary.trim();

  const nums = salary.match(/[\d][\d.,\s]*/g);
  if (!nums || nums.length === 0) return salary.trim();
  const parsed = nums
    .map((n) => parseFloat(n.replace(/\s/g, "").replace(/,/g, "")))
    .filter((v) => !isNaN(v) && v > 0);
  if (parsed.length === 0) return salary.trim();

  const avg = parsed.reduce((s, v) => s + v, 0) / parsed.length;
  const eur = Math.round(avg * rate);
  return `${salary.trim()} (≈ ${eur.toLocaleString("en-US")} €)`;
}
