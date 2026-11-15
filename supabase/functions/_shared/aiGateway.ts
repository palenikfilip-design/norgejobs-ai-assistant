// Server-only durable circuit breaker. No retries or model/endpoint substitution.
export interface GatewayFailure {
  status: number;
  error: string;
  message: string;
  retryable: boolean;
}

export function parseGatewayFailure(status: number, text: string): GatewayFailure {
  let body: { type?: unknown; message?: unknown; props?: { retryable?: boolean } } = {};
  try { body = JSON.parse(text); } catch { /* Never expose unstructured upstream bodies. */ }
  return {
    status,
    error: typeof body.type === "string" ? body.type : "ai_gateway_error",
    message: typeof body.message === "string" ? body.message : "AI service request failed.",
    retryable: body.props?.retryable !== false && (status === 429 || status >= 500),
  };
}

export class AiGatewayError extends Error {
  constructor(public failure: GatewayFailure) { super(failure.message); }
}

export function gatewayErrorResponse(error: unknown, headers: Record<string, string>): Response | null {
  if (!(error instanceof AiGatewayError)) return null;
  return new Response(JSON.stringify(error.failure), {
    status: error.failure.status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export async function assertGatewayActive(db: any): Promise<void> {
  const { data, error } = await db.from("ai_gateway_state")
    .select("paused,status,error_type,message").eq("id", true).maybeSingle();
  if (error) throw new AiGatewayError({ status: 503, error: "ai_pause_check_failed", message: "AI availability could not be checked.", retryable: false });
  if (data?.paused) throw new AiGatewayError({ status: data.status, error: data.error_type, message: data.message, retryable: false });
}

export async function gatewayFetch(db: any, input: string, init: RequestInit, transport: typeof fetch = fetch): Promise<Response> {
  await assertGatewayActive(db);
  const response = await transport(input, init);
  if (!response.ok) {
    const failure = parseGatewayFailure(response.status, await response.text());
    if (response.status === 402 || response.status === 403) {
      const { error } = await db.from("ai_gateway_state").upsert({
        id: true, paused: true, status: failure.status, error_type: failure.error,
        message: failure.message, updated_at: new Date().toISOString(),
      });
      if (error) console.error("AI pause persistence failed");
    }
    throw new AiGatewayError(failure);
  }
  return response;
}