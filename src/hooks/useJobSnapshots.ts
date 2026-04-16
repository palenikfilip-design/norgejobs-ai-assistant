import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { JobSnapshot } from "@/types/behaviorLearning";
import type { Job } from "@/data/mockJobs";
import { parseSalaryRange } from "@/utils/currency";

export function useJobSnapshots(userId: string | null) {
  const [snapshots, setSnapshots] = useState<JobSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from("job_snapshots")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setSnapshots(
      (data ?? []).map((s) => ({
        id: s.id,
        originalJobId: s.original_job_id,
        title: s.title,
        company: s.company,
        description: s.description,
        salaryMin: s.salary_min ? Number(s.salary_min) : null,
        salaryMax: s.salary_max ? Number(s.salary_max) : null,
        currency: s.currency,
        location: s.location,
        country: s.country,
        jobType: s.job_type,
        url: s.url,
        source: s.source,
        rawData: (s.raw_data as Record<string, unknown>) ?? {},
        isOriginalAvailable: s.is_original_available ?? true,
        createdAt: s.created_at,
      })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const createSnapshot = useCallback(
    async (job: Job) => {
      if (!userId) return false;
      const parsed = parseSalaryRange(job.salary);
      const { error } = await supabase.from("job_snapshots").upsert(
        {
          user_id: userId,
          original_job_id: job.id,
          title: job.title,
          company: job.company,
          description: job.description,
          salary_min: parsed?.min ?? null,
          salary_max: parsed?.max ?? null,
          currency: parsed?.currency ?? null,
          location: job.city,
          country: job.country,
          job_type: job.type,
          url: null,
          source: null,
          raw_data: job as never,
          is_original_available: true,
        },
        { onConflict: "user_id,original_job_id" },
      );
      if (error) {
        console.error("Snapshot error:", error);
        return false;
      }
      await load();
      return true;
    },
    [userId, load],
  );

  const removeSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!userId) return;
      await supabase.from("job_snapshots").delete().eq("id", snapshotId);
      await load();
    },
    [userId, load],
  );

  const hasSnapshot = useCallback(
    (jobId: string) => snapshots.some((s) => s.originalJobId === jobId),
    [snapshots],
  );

  return { snapshots, loading, createSnapshot, removeSnapshot, hasSnapshot, reload: load };
}
