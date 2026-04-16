import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { JobInteraction, JobPreference, UserPreferenceProfile } from "@/types/behaviorLearning";
import type { Job } from "@/data/mockJobs";
import { deriveUserPreferenceProfile } from "@/utils/behaviorLearning";

/**
 * Loads interactions, computes derived preference profile, and persists it.
 */
export function usePreferenceProfile(userId: string | null, jobs: Job[]) {
  const [interactions, setInteractions] = useState<JobInteraction[]>([]);
  const [preferences, setPreferences] = useState<JobPreference[]>([]);
  const [profile, setProfile] = useState<UserPreferenceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const [{ data: ints }, { data: prefs }] = await Promise.all([
      supabase.from("user_job_interactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      supabase.from("job_preferences").select("*").eq("user_id", userId),
    ]);
    const mappedInts: JobInteraction[] = (ints ?? []).map((i) => ({
      id: i.id, jobId: i.job_id, actionType: i.action_type as JobInteraction["actionType"],
      timeSpent: i.time_spent ?? 0, createdAt: i.created_at,
    }));
    const mappedPrefs: JobPreference[] = (prefs ?? []).map((p) => ({
      id: p.id, jobId: p.job_id, category: p.category as JobPreference["category"],
      notes: p.notes, createdAt: p.created_at,
    }));
    setInteractions(mappedInts);
    setPreferences(mappedPrefs);
    const derived = deriveUserPreferenceProfile(mappedInts, mappedPrefs, jobs);
    setProfile(derived);
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

  return { interactions, preferences, profile, loading, reload: load };
}
