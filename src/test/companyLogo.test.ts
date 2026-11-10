import { expect, it } from "vitest";
import { publicLogoPath } from "../../supabase/functions/public-company-logo/access";

it("only signs stored bucket paths, not URLs or traversal", () => {
  expect(publicLogoPath("owner-id/logo.png")).toBe("owner-id/logo.png");
  for (const path of [null, "https://example.com/logo.png", "../secret", "/owner/logo.png", "logo.png"]) expect(publicLogoPath(path)).toBeNull();
});