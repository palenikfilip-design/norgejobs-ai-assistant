import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { JobPreference, PreferenceCategory } from "@/types/behaviorLearning";

export function useJobPreferences(userId: string | null) {
  const [preferences, setPreferences] = useState<JobPreference[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from("job_preferences")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    setPreferences(
      (data ?? []).map((p) => ({
        id: p.id,
        jobId: p.job_id,
        category: p.category as PreferenceCategory,
        notes: p.notes,
        createdAt: p.created_at,
      })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const setPreference = useCallback(
    async (jobId: string, category: PreferenceCategory) => {
      if (!userId) return;
      // Mutually exclusive: favorite/top_pick/not_interested replace each other on the same job.
      const exclusive: PreferenceCategory[] = ["favorite", "top_pick", "not_interested"];
      if (exclusive.includes(category)) {
        await supabase.from("job_preferences")
          .delete()
          .eq("user_id", userId)
          .eq("job_id", jobId)
          .in("category", exclusive);
      }
      const { error } = await supabase.from("job_preferences").insert({
        user_id: userId,
        job_id: jobId,
        category,
      });
      if (error && !error.message.includes("duplicate")) console.error("Set preference:", error);
      await load();
    },
    [userId, load],
  );

  const removePreference = useCallback(
    async (jobId: string, category: PreferenceCategory) => {
      if (!userId) return;
      await supabase.from("job_preferences")
        .delete()
        .eq("user_id", userId)
        .eq("job_id", jobId)
        .eq("category", category);
      await load();
    },
    [userId, load],
  );

  const togglePreference = useCallback(
    async (jobId: string, category: PreferenceCategory) => {
      const exists = preferences.some((p) => p.jobId === jobId && p.category === category);
      if (exists) await removePreference(jobId, category);
      else await setPreference(jobId, category);
    },
    [preferences, removePreference, setPreference],
  );

  const getCategoriesFor = useCallback(
    (jobId: string): PreferenceCategory[] =>
      preferences.filter((p) => p.jobId === jobId).map((p) => p.category),
    [preferences],
  );

  return { preferences, loading, setPreference, removePreference, togglePreference, getCategoriesFor, reload: load };
}
