import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { JobInteraction, JobPreference, UserPreferenceProfile } from "@/types/behaviorLearning";
import type { Job } from "@/data/mockJobs";
import { deriveUserPreferenceProfile } from "@/utils/behaviorLearning";

/** Keys the user can mute or override. */
export type LearnedKey =
  | "preferredSalary"
  | "preferredJobType"
  | "preferredEnvironment"
  | "preferredShiftType"
  | "stressTolerance"
  | "isolationPreference";

export interface LearnedOverrides {
  /** Manual value override per key. Stored as JSON-compatible primitives. */
  [key: string]: unknown;
}

/**
 * Loads interactions, computes derived preference profile, and persists it.
 */
export function usePreferenceProfile(userId: string | null, jobs: Job[]) {
  const [interactions, setInteractions] = useState<JobInteraction[]>([]);
  const [preferences, setPreferences] = useState<JobPreference[]>([]);
  const [profile, setProfile] = useState<UserPreferenceProfile | null>(null);
  const [muted, setMuted] = useState<LearnedKey[]>([]);
  const [overrides, setOverrides] = useState<LearnedOverrides>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const [{ data: ints }, { data: prefs }, { data: existing }] = await Promise.all([
      supabase.from("user_job_interactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      supabase.from("job_preferences").select("*").eq("user_id", userId),
      supabase.from("user_preference_profile").select("muted, overrides").eq("user_id", userId).maybeSingle(),
    ]);
    const mappedInts: JobInteraction[] = (ints ?? []).map((i) => ({
      id: i.id, jobId: i.job_id, actionType: i.action_type as JobInteraction["actionType"],
      timeSpent: i.time_spent ?? 0, createdAt: i.created_at,
    }));
    const mappedPrefs: JobPreference[] = (prefs ?? []).map((p) => ({
      id: p.id, jobId: p.job_id, category: p.category as JobPreference["category"],
      notes: p.notes, createdAt: p.created_at,
    }));
    const dbMuted = (existing?.muted as LearnedKey[] | null) ?? [];
    const dbOverrides = (existing?.overrides as LearnedOverrides | null) ?? {};
    setInteractions(mappedInts);
    setPreferences(mappedPrefs);
    setMuted(dbMuted);
    setOverrides(dbOverrides);
    const derived = deriveUserPreferenceProfile(mappedInts, mappedPrefs, jobs);
    setProfile(applyOverrides(derived, dbMuted, dbOverrides));
    setLoading(false);

    // Persist (best-effort, non-blocking)
    if (mappedInts.length || mappedPrefs.length) {
      void supabase.from("user_preference_profile").upsert({
        user_id: userId,
        preferred_salary_min: derived.preferredSalary.min,
        preferred_salary_max: derived.preferredSalary.max,
        salary_confidence: derived.preferredSalary.confidence,
        preferred_job_type: derived.preferredJobType.value,
        job_type_confidence: derived.preferredJobType.confidence,
        preferred_environment: derived.preferredEnvironment.value,
        environment_confidence: derived.preferredEnvironment.confidence,
        preferred_shift_type: derived.preferredShiftType.value,
        shift_confidence: derived.preferredShiftType.confidence,
        stress_tolerance: derived.stressTolerance.value,
        stress_confidence: derived.stressTolerance.confidence,
        isolation_preference: derived.isolationPreference.value,
        isolation_confidence: derived.isolationPreference.confidence,
        patterns: derived.patterns as never,
        conflicts: derived.conflicts as never,
        last_computed_at: derived.lastComputedAt,
      }, { onConflict: "user_id" });
    }
  }, [userId, jobs]);

  useEffect(() => { load(); }, [load]);

  /** Mute a learned dimension. Also wipes underlying signals so it does not immediately re-learn. */
  const muteLearned = useCallback(
    async (key: LearnedKey) => {
      if (!userId) return;
      const next = Array.from(new Set([...muted, key]));
      await supabase.from("user_preference_profile").upsert(
        { user_id: userId, muted: next as never },
        { onConflict: "user_id" },
      );
      // Soft-clean recent signals so the same pattern does not immediately re-emerge.
      // We delete the last 30 days of view/click interactions (lightest signals),
      // keeping explicit apply/save/favorite preferences intact.
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      await supabase
        .from("user_job_interactions")
        .delete()
        .eq("user_id", userId)
        .in("action_type", ["view", "click"])
        .gte("created_at", since);
      setMuted(next);
      await load();
    },
    [userId, muted, load],
  );

  /** Set or update a manual override for a learned dimension. */
  const setOverride = useCallback(
    async (key: LearnedKey, value: unknown) => {
      if (!userId) return;
      const next = { ...overrides, [key]: value };
      await supabase.from("user_preference_profile").upsert(
        { user_id: userId, overrides: next as never },
        { onConflict: "user_id" },
      );
      setOverrides(next);
      await load();
    },
    [userId, overrides, load],
  );

  return { interactions, preferences, profile, muted, overrides, loading, reload: load, muteLearned, setOverride };
}

/** Apply user mutes + manual overrides to the derived profile. */
function applyOverrides(
  profile: UserPreferenceProfile,
  muted: LearnedKey[],
  overrides: LearnedOverrides,
): UserPreferenceProfile {
  const p: UserPreferenceProfile = JSON.parse(JSON.stringify(profile));
  const mute = new Set(muted);

  const blank = { value: null as never, confidence: 0 };
  if (mute.has("preferredJobType")) p.preferredJobType = blank;
  if (mute.has("preferredEnvironment")) p.preferredEnvironment = blank;
  if (mute.has("preferredShiftType")) p.preferredShiftType = blank;
  if (mute.has("stressTolerance")) p.stressTolerance = blank;
  if (mute.has("isolationPreference")) p.isolationPreference = blank;
  if (mute.has("preferredSalary")) p.preferredSalary = { min: null, max: null, confidence: 0 };

  // Explicit overrides — confidence 1.0 (user said so).
  const ov = overrides;
  if (typeof ov.preferredJobType === "string") p.preferredJobType = { value: ov.preferredJobType, confidence: 1 };
  if (typeof ov.preferredEnvironment === "string") p.preferredEnvironment = { value: ov.preferredEnvironment, confidence: 1 };
  if (typeof ov.preferredShiftType === "string") p.preferredShiftType = { value: ov.preferredShiftType, confidence: 1 };
  if (typeof ov.stressTolerance === "number") p.stressTolerance = { value: ov.stressTolerance, confidence: 1 };
  if (typeof ov.isolationPreference === "number") p.isolationPreference = { value: ov.isolationPreference, confidence: 1 };
  if (ov.preferredSalary && typeof ov.preferredSalary === "object") {
    const s = ov.preferredSalary as { min?: number; max?: number };
    if (typeof s.min === "number" || typeof s.max === "number") {
      p.preferredSalary = { min: s.min ?? null, max: s.max ?? null, confidence: 1 };
    }
  }

  // Re-derive human-readable patterns after override/mute.
  const patterns: string[] = [];
  if (p.preferredSalary.min && p.preferredSalary.confidence > 0.4)
    patterns.push(`Preferuješ platy v rozmezí ${Math.round(p.preferredSalary.min / 1000)}k–${Math.round((p.preferredSalary.max ?? 0) / 1000)}k EUR`);
  if (p.preferredJobType.value && p.preferredJobType.confidence > 0.4)
    patterns.push(`Zaměřuješ se na pozice typu ${p.preferredJobType.value}`);
  if (p.preferredShiftType.value && p.preferredShiftType.confidence > 0.4)
    patterns.push(`Vybíráš ${p.preferredShiftType.value === "day" ? "denní" : p.preferredShiftType.value} směny`);
  if (p.preferredEnvironment.value && p.preferredEnvironment.confidence > 0.4)
    patterns.push(`Preferuješ prostředí: ${p.preferredEnvironment.value}`);
  if (p.stressTolerance.value !== null && p.stressTolerance.confidence > 0.4)
    patterns.push(p.stressTolerance.value < 40 ? "Vybíráš pozice s nízkým stresem" : p.stressTolerance.value > 65 ? "Zvládáš vysoký stres" : "Středně náročné pozice");
  p.patterns = patterns;
  return p;
}
