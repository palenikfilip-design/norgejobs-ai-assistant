// Fixed registry: colours belong to category identities, never daily ranks.
export const CATEGORY_COLOURS: Readonly<Record<string, string>> = {
  "Tech / IT": "hsl(var(--category-blue))",
  Healthcare: "hsl(var(--category-terracotta))",
  Logistics: "hsl(var(--category-sage))",
  Hospitality: "hsl(var(--category-mustard))",
  Construction: "hsl(var(--category-lavender))",
  Education: "hsl(var(--category-teal))",
  "Sales / Marketing": "hsl(var(--category-rose))",
  Finance: "hsl(var(--category-olive))",
  Agriculture: "hsl(var(--category-sand))",
  Manufacturing: "hsl(var(--category-slate))",
};

export const OTHER_CATEGORY_COLOUR = "hsl(var(--category-other))";

export interface CategoryCount { name: string; value: number }

export function getCategoryColour(name: string): string {
  return CATEGORY_COLOURS[name] ?? OTHER_CATEGORY_COLOUR;
}

export function buildCategorySlices(counts: CategoryCount[]) {
  const ranked = counts.filter(({ name, value }) => value > 0 && name !== "Other" && name !== "Ostatní")
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const total = counts.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const top = ranked.slice(0, 7);
  const other = total - top.reduce((sum, item) => sum + item.value, 0);
  return [...top, ...(other > 0 ? [{ name: "Ostatní", value: other }] : [])]
    .map((item) => ({ ...item, colour: getCategoryColour(item.name), percentage: total ? item.value / total * 100 : 0 }));
}