import { describe, expect, it } from "vitest";
import { accountRedirect } from "@/lib/accountRouting";

describe("account route separation", () => {
  it("keeps employers out of onboarding and every seeker page", () => {
    for (const path of ["/onboarding", "/dashboard", "/chat", "/profile/edit", "/preset/new", "/presets", "/sources", "/premium", "/saved", "/cv", "/cv/123", "/cover-letters", "/insights"]) {
      expect(accountRedirect(path, true, true)).toBe("/employer/dashboard");
    }
  });
  it("blocks job seekers from employer pages", () => {
    expect(accountRedirect("/employer/company", true, false)).toBe("/dashboard");
    expect(accountRedirect("/employer/dashboard", true, false)).toBe("/dashboard");
  });
  it("keeps company pages public", () => {
    expect(accountRedirect("/company/example", false, false)).toBeNull();
  });
  it("routes confirmed employer sessions to their area", () => {
    expect(accountRedirect("/auth/callback", true, true)).toBe("/employer/dashboard");
    expect(accountRedirect("/employer/company", true, true)).toBeNull();
  });
  it("requires login before company setup", () => {
    expect(accountRedirect("/employer/company", false, false)).toBe("/login");
  });
});