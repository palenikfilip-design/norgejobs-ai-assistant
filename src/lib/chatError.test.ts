import { describe, expect, it } from "vitest";
import { readChatError } from "./chatError";
import { AiGatewayError, gatewayFetch, gatewayErrorResponse, parseGatewayFailure } from "../../supabase/functions/_shared/aiGateway";

describe("AI terminal error handling", () => {
  it("preserves credit_limit_reached 403, safe reason and non-retryable status", () => {
    const failure = parseGatewayFailure(403, JSON.stringify({ type: "credit_limit_reached", message: "Workspace credit limit reached" }));
    const response = gatewayErrorResponse(new AiGatewayError(failure), {});
    expect(response?.status).toBe(403);
    expect(failure).toEqual({ status: 403, error: "credit_limit_reached", message: "Workspace credit limit reached", retryable: false });
  });
  it("reads the server reason rather than a generic invocation error", async () => {
    const context = new Response(JSON.stringify({ message: "Workspace credit limit reached" }), { status: 403 });
    expect(await readChatError({ context })).toBe("Workspace credit limit reached");
    expect(await context.json()).toEqual({ message: "Workspace credit limit reached" });
  });
  it("persists a denied call and blocks later invocations without another provider request", async () => {
    let row: any = null;
    let calls = 0;
    const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }), upsert: async (value: any) => { row = value; return { error: null }; } }) };
    const transport: typeof fetch = async () => { calls++; return new Response(JSON.stringify({ type: "credit_limit_reached", message: "Workspace credit limit reached" }), { status: 403 }); };
    await expect(gatewayFetch(db, "https://example.test", {}, transport)).rejects.toBeInstanceOf(AiGatewayError);
    expect(row.paused).toBe(true);
    await expect(gatewayFetch(db, "https://example.test", {}, transport)).rejects.toBeInstanceOf(AiGatewayError);
    expect(calls).toBe(1);
  });
});