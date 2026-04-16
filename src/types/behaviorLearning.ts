export type InteractionAction = "view" | "click" | "apply" | "save" | "reject" | "unsave";

export type PreferenceCategory =
  | "favorite"
  | "top_pick"
  | "not_interested"
  | "applied"
  | "saved_for_later";

export interface JobInteraction {
  id: string;
  jobId: string;
  actionType: InteractionAction;
  timeSpent: number;
  createdAt: string;
}

export interface JobPreference {
  id: string;
  jobId: string;
  category: PreferenceCategory;
  notes?: string | null;
  createdAt: string;
}

export interface JobSnapshot {
  id: string;
  originalJobId: string;
  title: string;
  company: string | null;
  description: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  location: string | null;
  country: string | null;
  jobType: string | null;
  url: string | null;
  source: string | null;
  rawData: Record<string, unknown>;
  isOriginalAvailable: boolean;
  createdAt: string;
}

export interface DerivedPreferenceField<T = number | string> {
  value: T | null;
  confidence: number; // 0-1
}

export interface UserPreferenceProfile {
  preferredSalary: { min: number | null; max: number | null; confidence: number };
  preferredJobType: DerivedPreferenceField<string>;
  preferredEnvironment: DerivedPreferenceField<string>;
  preferredShiftType: DerivedPreferenceField<string>;
  stressTolerance: DerivedPreferenceField<number>;
  isolationPreference: DerivedPreferenceField<number>;
  patterns: string[];
  conflicts: string[];
  lastComputedAt: string | null;
}

export const PREFERENCE_LABELS: Record<PreferenceCategory, { label: string; emoji: string }> = {
  favorite: { label: "Favorite", emoji: "❤️" },
  top_pick: { label: "Top Pick", emoji: "⭐" },
  not_interested: { label: "Not for me", emoji: "❌" },
  applied: { label: "Applied", emoji: "✅" },
  saved_for_later: { label: "Saved", emoji: "💾" },
};
