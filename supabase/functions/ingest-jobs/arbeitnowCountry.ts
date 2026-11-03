// Maps Arbeitnow free-text location to a country name. Keep in sync with the
// one-off SQL backfill (same patterns). Returns null when unknown.
export const COUNTRY_PATTERNS: [string, RegExp][] = [
  ["Remote", /^(remote|homeoffice|home office|hybrid|remote job|.*\(remote\)|remote\s*-.*|emea|europe)$/i],
  ["United Kingdom", /\b(united kingdom|uk|england|scotland|wales|london|manchester|cardiff|cambridge|edinburgh|birmingham|bristol|leeds|glasgow|oxford)\b/i],
  ["Switzerland", /\b(switzerland|schweiz|suisse|z(ü|u)rich|bern|basel|lausanne|geneva|gen(è|e)ve|genf|nyon|lucerne|luzern|zug|winterthur|st\.? gallen|lugano)\b/i],
  ["Austria", /\b(austria|(ö|o)sterreich|wien|vienna|graz|linz|salzburg|innsbruck|klagenfurt)\b/i],
  ["France", /\b(france|paris|lyon|marseille|toulouse|lille|bordeaux|nantes|nice|strasbourg)\b/i],
  ["Netherlands", /\b(netherlands|nederland|amsterdam|rotterdam|utrecht|delft|eindhoven|the hague|den haag|veenendaal|groningen|leiden)\b/i],
  ["Belgium", /\b(belgium|brussels|bruxelles|antwerp|gent|ghent)\b/i],
  ["Spain", /\b(spain|madrid|barcelona|valencia)\b/i],
  ["Italy", /\b(italy|milan|milano|rome|roma)\b/i],
  ["Poland", /\b(poland|warsaw|warszawa|krak(ó|o)w|wroc(ł|l)aw)\b/i],
  ["Portugal", /\b(portugal|lisbon|lisboa|porto)\b/i],
  ["Ireland", /\b(ireland|dublin)\b/i],
  ["Germany", /\b(germany|deutschland|berlin|m(ü|u)nchen|munich|hamburg|k(ö|o)ln|cologne|frankfurt|stuttgart|d(ü|u)sseldorf|n(ü|u)rnberg|nuremberg|leipzig|bochum|m(ü|u)lheim|dresden|karlsruhe|dortmund|bremen|bonn|essen|mannheim|gilching|w(ü|u)rzburg|mainz|m(ü|u)nster|molbergen|augsburg|bielefeld|braunschweig|kiel|aachen|darmstadt|hannover|hanover|heidelberg|f(ü|u)rth|kassel|regensburg|wiesbaden|magdeburg|duisburg|wuppertal|gelsenkirchen|freiburg|ulm|erlangen|potsdam|rostock|l(ü|u)beck|halle|erfurt|jena|osnabr(ü|u)ck|oldenburg|ingolstadt|paderborn|koblenz|trier|saarbr(ü|u)cken|chemnitz|kaiserslautern|heilbronn|pforzheim|offenbach|neuss|krefeld|g(ö|o)ttingen|wolfsburg)\b/i],
];

export function arbeitnowCountry(location: string | null, remote: boolean): string | null {
  const loc = (location ?? "").trim();
  if (!loc) return remote ? "Remote" : null;
  for (const [country, re] of COUNTRY_PATTERNS) if (re.test(loc)) return country;
  return remote ? "Remote" : null;
}
