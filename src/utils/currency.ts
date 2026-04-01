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
