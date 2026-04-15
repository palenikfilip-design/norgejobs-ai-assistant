import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserAccess {
  isPremium: boolean;
  dailyViewLimit: number;
  jobsViewedToday: number;
  lastResetDate: string;
  freeUnlocksAvailable: number;
  freeUnlocksUsed: number;
}

const defaultAccess: UserAccess = {
  isPremium: false,
  dailyViewLimit: 4,
  jobsViewedToday: 0,
  lastResetDate: new Date().toISOString().split("T")[0],
  freeUnlocksAvailable: 0,
  freeUnlocksUsed: 0,
};

export function useUserAccess(userId: string | null) {
  const [access, setAccess] = useState<UserAccess>(defaultAccess);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const loadAccess = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("user_access")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      // Try to create one
      await supabase.from("user_access").insert({ user_id: userId });
      setAccess(defaultAccess);
      setLoading(false);
      return;
    }

    // Daily reset check
    let jobsViewedToday = data.jobs_viewed_today;
    let lastResetDate = data.last_reset_date;
    if (lastResetDate !== today) {
      jobsViewedToday = 0;
      lastResetDate = today;
      await supabase.from("user_access").update({
        jobs_viewed_today: 0,
        last_reset_date: today,
      }).eq("user_id", userId);
    }

    setAccess({
      isPremium: data.is_premium,
      dailyViewLimit: data.daily_view_limit,
      jobsViewedToday,
      lastResetDate,
      freeUnlocksAvailable: data.free_unlocks_available,
      freeUnlocksUsed: data.free_unlocks_used,
    });
    setLoading(false);
  }, [userId, today]);

  useEffect(() => { loadAccess(); }, [loadAccess]);

  const canViewJob = access.isPremium || access.jobsViewedToday < access.dailyViewLimit;
  const remainingViews = Math.max(0, access.dailyViewLimit - access.jobsViewedToday);

  const recordJobView = useCallback(async () => {
    if (!userId || access.isPremium) return;
    const newCount = access.jobsViewedToday + 1;
    setAccess(a => ({ ...a, jobsViewedToday: newCount }));
    await supabase.from("user_access").update({
      jobs_viewed_today: newCount,
    }).eq("user_id", userId);
  }, [userId, access.isPremium, access.jobsViewedToday]);

  const useFreedUnlock = useCallback(async () => {
    if (!userId || access.freeUnlocksAvailable <= 0) return false;
    const newAvailable = access.freeUnlocksAvailable - 1;
    const newUsed = access.freeUnlocksUsed + 1;
    setAccess(a => ({
      ...a,
      freeUnlocksAvailable: newAvailable,
      freeUnlocksUsed: newUsed,
      // Effectively increase the daily limit by 1 for this session
      dailyViewLimit: a.dailyViewLimit + 1,
    }));
    await supabase.from("user_access").update({
      free_unlocks_available: newAvailable,
      free_unlocks_used: newUsed,
      daily_view_limit: access.dailyViewLimit + 1,
    }).eq("user_id", userId);
    return true;
  }, [userId, access]);

  const addFreeUnlock = useCallback(async (count: number = 1) => {
    if (!userId) return;
    const newAvailable = access.freeUnlocksAvailable + count;
    setAccess(a => ({ ...a, freeUnlocksAvailable: newAvailable }));
    await supabase.from("user_access").update({
      free_unlocks_available: newAvailable,
    }).eq("user_id", userId);
  }, [userId, access.freeUnlocksAvailable]);

  return {
    access,
    loading,
    canViewJob,
    remainingViews,
    recordJobView,
    useFreedUnlock,
    addFreeUnlock,
    reload: loadAccess,
  };
}
