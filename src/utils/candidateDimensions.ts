import { defaultCandidateDimensions, type CandidateDimensions } from "@/types/candidateDimensions";

export function normalizeCandidateDimensions(
  dimensions?: Partial<CandidateDimensions> | null,
): CandidateDimensions {
  const safeDimensions = (dimensions ?? {}) as Partial<CandidateDimensions>;

  return {
    ...defaultCandidateDimensions,
    ...safeDimensions,
    workStyle: {
      ...defaultCandidateDimensions.workStyle,
      ...(safeDimensions.workStyle ?? {}),
    },
    workPreferences: {
      ...defaultCandidateDimensions.workPreferences,
      ...(safeDimensions.workPreferences ?? {}),
    },
    lifestyle: {
      ...defaultCandidateDimensions.lifestyle,
      ...(safeDimensions.lifestyle ?? {}),
    },
    financial: {
      ...defaultCandidateDimensions.financial,
      ...(safeDimensions.financial ?? {}),
    },
  };
}
