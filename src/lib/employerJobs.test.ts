import { describe, it, expect } from "vitest";
import { completeness, employerSlugFromUrl } from "./employerJobs";

describe("employer job completeness", () => {
  it("required fields only = 60", () => expect(completeness({})).toBe(60));
  it("all optional fields = 100", () => expect(completeness({
    languages: [{}], experience: "1 rok", working_hours: "40h", food_provided: false, transport_provided: true,
    description: "x".repeat(150), benefits: ["a"],
  })).toBe(100));
});
describe("employerSlugFromUrl", () => {
  it("parses company link", () => expect(employerSlugFromUrl("/company/acme-12?job=1")).toBe("acme-12"));
  it("ignores scraped links", () => expect(employerSlugFromUrl("https://x.com/company/a")).toBeNull());
});

import { validContactOptions } from "./employerJobs";
describe("contact options", () => {
  it("requires at least one option", () => expect(validContactOptions([])).toBe(false));
  it("accepts cv, message and email", () => expect(validContactOptions(["cv", "message", "email"])).toBe(true));
  it("rejects unknown methods", () => expect(validContactOptions(["phone"])).toBe(false));
});
