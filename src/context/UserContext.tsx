import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { type CandidateDimensions, defaultCandidateDimensions } from "@/types/candidateDimensions";
import { type LifestyleProfile, defaultLifestyleProfile } from "@/types/lifestyleProfile";
import { loadProfileFromDB, saveProfileToDB, loadPresetsFromDB, savePresetToDB, deletePresetFromDB } from "@/hooks/useProfileSync";
import { useInactivityLogout, getInactivityMinutes, setInactivityMinutes as persistInactivityMinutes, DEFAULT_INACTIVITY_MINUTES } from "@/hooks/useInactivityLogout";

export interface LanguageWithLevel {
  language: string;
  level: string;
  certificateUrl?: string;
  certificateName?: string;
}

export interface MatchWeights {
  skills: number;
  location: number;
  salary: number;
  jobType: number;
  bonus: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  skills: 40,
  location: 20,
  salary: 20,
  jobType: 10,
  bonus: 10,
};

/** User's personal profile — one per account */
export interface UserProfile {
  fullName: string;
  gender?: string;
  age?: number;
  country: string;
  languages: LanguageWithLevel[];
  workExperience: string;
  experienceLevel: string;
  profession: string;
  skills: string[];
  certifications: string[];
  personality?: string;
  dimensions: CandidateDimensions;
  lifestyleProfile: LifestyleProfile;
  appLanguage: string;
  termsAccepted: boolean;
}

export const defaultProfile: UserProfile = {
  fullName: "",
  country: "",
  languages: [],
  workExperience: "",
  experienceLevel: "any",
  profession: "",
  skills: [],
  certifications: [],
  dimensions: { ...defaultCandidateDimensions },
  lifestyleProfile: { ...defaultLifestyleProfile },
  appLanguage: "en",
  termsAccepted: false,
};

/** A saved search preset — multiple per account */
export interface SearchPreset {
  id: string;
  name: string;
  preferredJobType: string;
  preferredCountries: string[];
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: "monthly" | "hourly";
  housingPreference: boolean;
  desiredBonuses: string[];
  matchWeights: MatchWeights;
  active: boolean; // whether currently used for matching
  useLifestyleMatching: boolean;
  lifestyleWeight: number; // 0–50 (percentage)
  /** Selected job portal source IDs to scope search to. Empty = all. */
  preferredSources: string[];
  /** Geographic scope for portals. Multi-select. */
  preferredSourceScope: ("all" | "around_me" | "abroad" | "remote")[];
}

export const defaultPreset: Omit<SearchPreset, "id"> = {
  name: "",
  preferredJobType: "Full-time",
  preferredCountries: [],
  salaryMin: 0,
  salaryMax: 0,
  salaryPeriod: "monthly",
  housingPreference: false,
  desiredBonuses: [],
  matchWeights: { ...DEFAULT_MATCH_WEIGHTS },
  active: true,
  useLifestyleMatching: false,
  lifestyleWeight: 20,
  preferredSources: [],
  preferredSourceScope: ["all"],
};

/**
 * For backward compatibility: merge profile + preset into the shape
 * that job matching utilities expect (AvatarProfile).
 */
export interface AvatarProfile {
  id: string;
  name: string;
  fullName: string;
  gender?: string;
  age?: number;
  country: string;
  languages: LanguageWithLevel[];
  workExperience: string;
  experienceLevel: string;
  profession: string;
  skills: string[];
  preferredJobType: string;
  preferredCountries: string[];
  salaryMin: number;
  salaryMax: number;
  housingPreference: boolean;
  personality?: string;
  certifications: string[];
  desiredBonuses: string[];
  matchWeights: MatchWeights;
  lifestyleProfile: LifestyleProfile;
  useLifestyleMatching: boolean;
  lifestyleWeight: number;
}

export function mergeProfilePreset(profile: UserProfile, preset: SearchPreset): AvatarProfile {
  return {
    id: preset.id,
    name: preset.name,
    fullName: profile.fullName,
    gender: profile.gender,
    age: profile.age,
    country: profile.country,
    languages: profile.languages,
    workExperience: profile.workExperience,
    experienceLevel: profile.experienceLevel,
    profession: profile.profession,
    skills: profile.skills,
    certifications: profile.certifications,
    personality: profile.personality,
    preferredJobType: preset.preferredJobType,
    preferredCountries: preset.preferredCountries,
    salaryMin: preset.salaryMin,
    salaryMax: preset.salaryMax,
    housingPreference: preset.housingPreference,
    desiredBonuses: preset.desiredBonuses,
    matchWeights: preset.matchWeights,
    lifestyleProfile: profile.lifestyleProfile,
    useLifestyleMatching: preset.useLifestyleMatching,
    lifestyleWeight: preset.lifestyleWeight,
  };
}

// Profile completion
export const getProfileCompletion = (profile: UserProfile): { percent: number; missing: string[] } => {
  const fields: { key: string; label: string; check: () => boolean }[] = [
    { key: "fullName", label: "Full Name", check: () => !!profile.fullName },
    { key: "gender", label: "Gender", check: () => !!profile.gender },
    { key: "age", label: "Age", check: () => !!profile.age },
    { key: "country", label: "Country", check: () => !!profile.country },
    { key: "languages", label: "Languages", check: () => profile.languages.length > 0 },
    { key: "profession", label: "Profession", check: () => !!profile.profession },
    { key: "skills", label: "Skills", check: () => profile.skills.length > 0 },
    { key: "experienceLevel", label: "Experience Level", check: () => !!profile.experienceLevel && profile.experienceLevel !== "any" },
    { key: "workExperience", label: "Work Experience", check: () => !!profile.workExperience },
    { key: "certifications", label: "Certifications", check: () => profile.certifications.length > 0 },
    { key: "personality", label: "Communication Tone", check: () => !!profile.personality },
  ];
  const missing = fields.filter(f => !f.check()).map(f => f.label);
  const filled = fields.length - missing.length;
  return { percent: Math.round((filled / fields.length) * 100), missing };
};

interface UserState {
  isAuthenticated: boolean;
  email: string;
  profile: UserProfile;
  presets: SearchPreset[];
  hasCompletedOnboarding: boolean;
  notifications: number;
}

interface UserContextType {
  user: UserState;
  supabaseUser: User | null;
  // Convenience: profile + active presets merged
  activeAvatars: AvatarProfile[];
  activePresets: SearchPreset[];
  login: (email: string) => void;
  loginWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  loginWithProvider: (provider: "google" | "apple") => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: UserProfile) => void;
  setOnboarded: () => void;
  addPreset: (preset: SearchPreset) => void;
  updatePreset: (preset: SearchPreset) => void;
  deletePreset: (id: string) => void;
  togglePreset: (id: string) => void;
  clearNotifications: () => void;
  loading: boolean;
  inactivityMinutes: number;
  setInactivityMinutes: (m: number) => void;
}

const defaultUser: UserState = {
  isAuthenticated: false,
  email: "",
  profile: { ...defaultProfile },
  presets: [],
  hasCompletedOnboarding: false,
  notifications: 3,
};

// Migrate old localStorage format
function migrateState(saved: any): UserState {
  if (saved.profile) {
    const merged = { ...defaultUser, ...saved } as UserState;
    merged.presets = (merged.presets || []).map((p: any) => ({
      ...p,
      preferredSourceScope: Array.isArray(p.preferredSourceScope)
        ? p.preferredSourceScope
        : p.preferredSourceScope
        ? [p.preferredSourceScope]
        : ["all"],
    }));
    return merged;
  }
  // Old format had "avatars" array
  const profile: UserProfile = { ...defaultProfile };
  const presets: SearchPreset[] = [];
  if (Array.isArray(saved.avatars) && saved.avatars.length > 0) {
    const a = saved.avatars[0];
    profile.fullName = a.fullName || "";
    profile.gender = a.gender;
    profile.age = a.age;
    profile.country = a.country || "";
    profile.languages = a.languages || [];
    profile.workExperience = a.workExperience || "";
    profile.experienceLevel = a.experienceLevel || "any";
    profile.profession = a.profession || "";
    profile.skills = a.skills || [];
    profile.certifications = a.certifications || [];
    profile.personality = a.personality;
    // Convert each old avatar into a preset
    saved.avatars.forEach((av: any, i: number) => {
      presets.push({
        id: av.id || crypto.randomUUID(),
        name: av.name || `Preset ${i + 1}`,
        preferredJobType: av.preferredJobType || "Full-time",
        preferredCountries: av.preferredCountries || [],
        salaryMin: av.salaryMin || 0,
        salaryMax: av.salaryMax || 0,
        housingPreference: av.housingPreference || false,
        desiredBonuses: av.desiredBonuses || [],
        matchWeights: av.matchWeights || { ...DEFAULT_MATCH_WEIGHTS },
        active: true,
        useLifestyleMatching: false,
        lifestyleWeight: 20,
        preferredSources: [],
        preferredSourceScope: ["all"],
      });
    });
  }
  return {
    ...defaultUser,
    isAuthenticated: saved.isAuthenticated ?? false,
    email: saved.email ?? "",
    profile,
    presets,
    hasCompletedOnboarding: saved.hasCompletedOnboarding ?? presets.length > 0,
    notifications: saved.notifications ?? 3,
  };
}

const UserContext = createContext<UserContextType | null>(null);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be inside UserProvider");
  return ctx;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [inactivityMinutes, setInactivityMinutesState] = useState<number>(() => getInactivityMinutes());
  const [user, setUser] = useState<UserState>(() => {
    const saved = localStorage.getItem("leslieUser");
    if (saved) return migrateState(JSON.parse(saved));
    return defaultUser;
  });

  // Load profile from DB when authenticated
  const loadFromDB = useCallback(async (userId: string, email: string) => {
    const profileData = await loadProfileFromDB(userId);
    const presets = await loadPresetsFromDB(userId);
    if (profileData) {
      setUser((u) => ({
        ...u,
        isAuthenticated: true,
        email,
        profile: profileData.profile,
        hasCompletedOnboarding: profileData.hasCompletedOnboarding,
        presets,
      }));
    } else {
      setUser((u) => ({ ...u, isAuthenticated: true, email, presets }));
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        loadFromDB(session.user.id, session.user.email ?? "");
      } else if (event === "SIGNED_OUT") {
        // Only clear local state on explicit sign-out — not on transient
        // network failures during INITIAL_SESSION / TOKEN_REFRESHED.
        setUser(defaultUser);
        localStorage.removeItem("leslieUser");
      }
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        loadFromDB(session.user.id, session.user.email ?? "");
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [loadFromDB]);

  useEffect(() => {
    localStorage.setItem("leslieUser", JSON.stringify(user));
  }, [user]);

  const login = (email: string) => setUser((u) => ({ ...u, isAuthenticated: true, email }));

  const loginWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    return { error: error?.message ?? null };
  };

  const loginWithProvider = async (provider: "google" | "apple") => {
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + "/onboarding" } });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("leslieUser");
    setUser(defaultUser);
  };

  const updateProfile = (profile: UserProfile) => {
    setUser((u) => ({ ...u, profile }));
    if (supabaseUser) saveProfileToDB(supabaseUser.id, profile, user.hasCompletedOnboarding);
  };

  const setOnboarded = () => {
    setUser((u) => ({ ...u, hasCompletedOnboarding: true }));
    if (supabaseUser) saveProfileToDB(supabaseUser.id, user.profile, true);
  };

  const addPreset = (preset: SearchPreset) => {
    setUser((u) => ({ ...u, presets: [...u.presets, preset] }));
    if (supabaseUser) savePresetToDB(supabaseUser.id, preset);
  };

  const updatePreset = (preset: SearchPreset) => {
    setUser((u) => ({ ...u, presets: u.presets.map((p) => (p.id === preset.id ? preset : p)) }));
    if (supabaseUser) savePresetToDB(supabaseUser.id, preset);
  };

  const deletePreset = (id: string) => {
    setUser((u) => ({ ...u, presets: u.presets.filter((p) => p.id !== id) }));
    deletePresetFromDB(id);
  };

  const togglePreset = (id: string) => {
    setUser((u) => {
      const updated = u.presets.map((p) => (p.id === id ? { ...p, active: !p.active } : p));
      const toggled = updated.find((p) => p.id === id);
      if (supabaseUser && toggled) savePresetToDB(supabaseUser.id, toggled);
      return { ...u, presets: updated };
    });
  };

  const clearNotifications = () => setUser((u) => ({ ...u, notifications: 0 }));

  const activePresets = user.presets.filter((p) => p.active);
  const activeAvatars = activePresets.map((p) => mergeProfilePreset(user.profile, p));

  // Auto-logout after configured inactivity (only when signed in).
  useInactivityLogout(inactivityMinutes, !!supabaseUser, () => {
    logout();
  });

  const setInactivityMinutes = (m: number) => {
    setInactivityMinutesState(m);
    persistInactivityMinutes(m);
  };

  return (
    <UserContext.Provider
      value={{
        user,
        supabaseUser,
        activeAvatars,
        activePresets,
        login,
        loginWithEmail,
        signUpWithEmail,
        loginWithProvider,
        logout,
        updateProfile,
        setOnboarded,
        addPreset,
        updatePreset,
        deletePreset,
        togglePreset,
        clearNotifications,
        loading,
        inactivityMinutes,
        setInactivityMinutes,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
