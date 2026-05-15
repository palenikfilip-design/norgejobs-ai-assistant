import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { UserProfile, SearchPreset } from "@/context/UserContext";
import { defaultProfile, DEFAULT_MATCH_WEIGHTS } from "@/context/UserContext";
import { normalizeCandidateDimensions } from "@/utils/candidateDimensions";
import { defaultLifestyleProfile } from "@/types/lifestyleProfile";

/** Load profile from database */
export async function loadProfileFromDB(userId: string): Promise<{
  profile: UserProfile;
  hasCompletedOnboarding: boolean;
} | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    profile: {
      fullName: data.full_name || "",
      gender: data.gender || undefined,
      age: data.age || undefined,
      country: data.country || "",
      languages: (data.languages as any[]) || [],
      profession: data.profession || "",
      skills: (data.skills as string[]) || [],
      experienceLevel: data.experience_level || "any",
      workExperience: data.work_experience || "",
      certifications: (data.certifications as string[]) || [],
      personality: data.personality || undefined,
      dimensions: normalizeCandidateDimensions(data.dimensions as any),
      lifestyleProfile: (data.dimensions as any)?.lifestyleProfile || { ...defaultLifestyleProfile },
      appLanguage: (data.dimensions as any)?.appLanguage || "en",
      termsAccepted: (data.dimensions as any)?.termsAccepted || false,
    },
    hasCompletedOnboarding: data.has_completed_onboarding || false,
  };
}

/** Save profile to database */
export async function saveProfileToDB(userId: string, profile: UserProfile, hasCompletedOnboarding: boolean) {
  const { error } = await supabase
    .from("profiles")
    .upsert({
      user_id: userId,
      full_name: profile.fullName,
      gender: profile.gender || null,
      age: profile.age || null,
      country: profile.country,
      languages: profile.languages as any,
      profession: profile.profession,
      skills: profile.skills as any,
      experience_level: profile.experienceLevel,
      work_experience: profile.workExperience,
      certifications: profile.certifications as any,
      personality: profile.personality || null,
      dimensions: normalizeCandidateDimensions(profile.dimensions) as any,
      has_completed_onboarding: hasCompletedOnboarding,
    }, { onConflict: "user_id" });

  if (error) console.error("Error saving profile:", error);
}

/** Load presets from database */
export async function loadPresetsFromDB(userId: string): Promise<SearchPreset[]> {
  const { data, error } = await supabase
    .from("user_presets")
    .select("*")
    .eq("user_id", userId);

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    preferredJobType: p.preferred_job_type,
    preferredCountries: (p.preferred_countries as string[]) || [],
    salaryMin: Number(p.salary_min) || 0,
    salaryMax: Number(p.salary_max) || 0,
    salaryPeriod: ((p.match_weights as any)?.salaryPeriod === "hourly" ? "hourly" : "monthly"),
    salaryCurrency: (p.match_weights as any)?.salaryCurrency || "EUR",
    housingPreference: p.housing_preference,
    desiredBonuses: (p.desired_bonuses as string[]) || [],
    matchWeights: { ...DEFAULT_MATCH_WEIGHTS, ...((p.match_weights as any) || {}) },
    active: p.active,
    useLifestyleMatching: (p.match_weights as any)?.useLifestyleMatching ?? false,
    lifestyleWeight: (p.match_weights as any)?.lifestyleWeight ?? 20,
    preferredSources: (p.match_weights as any)?.preferredSources ?? [],
    preferredSourceScope: (() => {
      const raw = (p.match_weights as any)?.preferredSourceScope;
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") return [raw];
      return ["all"];
    })(),
  }));
}

/** Save a single preset */
export async function savePresetToDB(userId: string, preset: SearchPreset) {
  const { error } = await supabase.from("user_presets").upsert({
    id: preset.id,
    user_id: userId,
    name: preset.name,
    preferred_job_type: preset.preferredJobType,
    preferred_countries: preset.preferredCountries as any,
    salary_min: preset.salaryMin,
    salary_max: preset.salaryMax,
    housing_preference: preset.housingPreference,
    desired_bonuses: preset.desiredBonuses as any,
    match_weights: {
      ...preset.matchWeights,
      useLifestyleMatching: preset.useLifestyleMatching,
      lifestyleWeight: preset.lifestyleWeight,
      preferredSources: preset.preferredSources,
      preferredSourceScope: preset.preferredSourceScope,
      salaryPeriod: preset.salaryPeriod,
      salaryCurrency: preset.salaryCurrency,
    } as any,
    active: preset.active,
  });
  if (error) console.error("Error saving preset:", error);
}

/** Delete a preset */
export async function deletePresetFromDB(presetId: string) {
  const { error } = await supabase.from("user_presets").delete().eq("id", presetId);
  if (error) console.error("Error deleting preset:", error);
}
