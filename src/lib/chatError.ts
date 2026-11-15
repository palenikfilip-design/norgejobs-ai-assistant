export async function readChatError(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === "function") {
    try {
      const body = await context.clone().json();
      if (typeof body.message === "string" && body.message.trim()) return body.message;
    } catch { /* Fall back only when the server did not return a safe message. */ }
  }
  return "Zprávu se nepodařilo odeslat. Zkus to prosím později.";
}