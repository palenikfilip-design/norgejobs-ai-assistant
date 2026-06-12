// Shared cost-tracking + daily-budget enforcement for all AI-calling edge functions.
// Rates are approximate published Lovable AI gateway prices, USD per 1M tokens.
const RATES: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash-lite": { in: 0.025, out: 0.10 },
  "google/gemini-3.1-flash-lite-preview": { in: 0.025, out: 0.10 },
  "google/gemini-2.5-flash": { in: 0.075, out: 0.30 },
  "google/gemini-2.5-pro": { in: 0.30, out: 2.50 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const r = RATES[model] ?? RATES["google/gemini-2.5-flash"];
  return (inputTokens / 1_000_000) * r.in + (outputTokens / 1_000_000) * r.out;
}

/** Returns true if there is still budget remaining for today. */
export async function hasBudgetRemaining(supabase: any): Promise<{ ok: boolean; spent: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("ai_daily_budget")
    .select("total_cost_usd, daily_limit_usd")
    .eq("date", today)
    .maybeSingle();
  const spent = Number(data?.total_cost_usd ?? 0);
  const limit = Number(data?.daily_limit_usd ?? 3.0);
  return { ok: spent < limit, spent, limit };
}

export interface AiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** Log a single AI call and increment the daily budget counter. Best-effort, never throws. */
export async function logAiCall(
  supabase: any,
  args: { function_name: string; model: string; usage?: AiUsage | null },
): Promise<number> {
  const inTok = Number(args.usage?.prompt_tokens ?? 0);
  const outTok = Number(args.usage?.completion_tokens ?? 0);
  const cost = estimateCost(args.model, inTok, outTok);
  try {
    await supabase.from("ai_call_log").insert({
      function_name: args.function_name,
      model: args.model,
      input_tokens: inTok,
      output_tokens: outTok,
      estimated_cost_usd: cost,
    });
    await supabase.rpc("ai_budget_increment", { _cost: cost });
  } catch (e) {
    console.error("[aiBudget] log failed", e);
  }
  return cost;
}

export const BUDGET_BLOCKED_MESSAGE_CS =
  "Leslie má dnes plno, zkus to prosím zítra.";