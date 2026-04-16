import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { InteractionAction } from "@/types/behaviorLearning";

/**
 * Records user interactions with jobs (view/click/apply/save/reject/unsave).
 * Fire-and-forget: never blocks the UI.
 */
export function useJobInteractions(userId: string | null) {
  const track = useCallback(
    async (jobId: string, actionType: InteractionAction, timeSpent = 0, metadata: Record<string, unknown> = {}) => {
      if (!userId) return;
      const { error } = await supabase.from("user_job_interactions").insert({
        user_id: userId,
        job_id: jobId,
        action_type: actionType,
        time_spent: Math.round(timeSpent),
        metadata: metadata as never,
      });
      if (error) console.error("Track interaction error:", error);
    },
    [userId],
  );

  return { track };
}
