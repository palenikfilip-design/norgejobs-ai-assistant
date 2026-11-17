import { describe, expect, it } from "vitest";
import { buildCategorySlices, getCategoryColour, OTHER_CATEGORY_COLOUR } from "./categoryCharts";

describe("category slices", () => {
  it("keeps the top seven and sums the remaining counts into Ostatní", () => {
    const names = ["Tech / IT", "Healthcare", "Logistics", "Hospitality", "Construction", "Education", "Sales / Marketing", "Finance", "Agriculture", "Manufacturing"];
    const slices = buildCategorySlices(names.map((name, i) => ({ name, value: 10 - i })));
    expect(slices).toHaveLength(8);
    expect(slices.slice(0, 7).map(s => s.value)).toEqual([10, 9, 8, 7, 6, 5, 4]);
    expect(slices[7]).toMatchObject({ name: "Ostatní", value: 6, colour: OTHER_CATEGORY_COLOUR });
    expect(slices.reduce((sum, s) => sum + s.percentage, 0)).toBeCloseTo(100);
  });
  it("preserves category colours when rankings change", () => {
    const before = buildCategorySlices([{ name: "Healthcare", value: 10 }, { name: "Tech / IT", value: 2 }]);
    const after = buildCategorySlices([{ name: "Tech / IT", value: 20 }, { name: "Healthcare", value: 1 }]);
    expect(before.find(s => s.name === "Healthcare")?.colour).toBe("hsl(var(--category-terracotta))");
    expect(after.find(s => s.name === "Healthcare")?.colour).toBe(before[0].colour);
    expect(new Set(before.map(s => s.colour)).size).toBe(2);
    expect(getCategoryColour("Ostatní")).toBe(OTHER_CATEGORY_COLOUR);
  });
  it("merges uncategorised jobs into Ostatní without dropping their count", () => {
    expect(buildCategorySlices([{ name: "Tech / IT", value: 3 }, { name: "Other", value: 2 }])[1]).toMatchObject({ name: "Ostatní", value: 2, percentage: 40 });
    expect(buildCategorySlices([])).toEqual([]);
  });
});