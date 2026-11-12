import { describe, it, expect } from "vitest";
import { companyReadyToPublish, sortQueue } from "@/lib/reviewQueue";

describe("review queue", () => {
  it("orders items oldest first", () => {
    const q = sortQueue([
      { kind: "job" as const, id: "b", at: "2026-11-10T10:00:00Z" },
      { kind: "company" as const, id: "a", at: "2026-11-01T10:00:00Z" },
    ]);
    expect(q.map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("blocks publishing for an unapproved company", () => {
    expect(companyReadyToPublish({ status: "active", approved_at: null })).toBe(false);
  });
  it("blocks publishing for a suspended company even if approved", () => {
    expect(companyReadyToPublish({ status: "suspended", approved_at: "2026-11-01" })).toBe(false);
  });
  it("allows publishing for an active approved company", () => {
    expect(companyReadyToPublish({ status: "active", approved_at: "2026-11-01" })).toBe(true);
  });
});
