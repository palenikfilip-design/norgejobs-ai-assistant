import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface LanguageWithLevel {
  language: string;
  level: string;
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

export interface AvatarProfile {
  id: string;
  name: string; // avatar name like "Norway Avatar"
  fullName: string;
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
  desiredBonuses: string[];
  matchWeights: MatchWeights;
}

interface UserState {
  isAuthenticated: boolean;
  email: string;
  avatars: AvatarProfile[];
  activeAvatarId: string | null;
  hasCompletedOnboarding: boolean;
  notifications: number;
}

interface UserContextType {
  user: UserState;
  supabaseUser: User | null;
  activeAvatar: AvatarProfile | null;
  login: (email: string) => void;
  loginWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  loginWithProvider: (provider: "google" | "apple") => Promise<void>;
  logout: () => Promise<void>;
  addAvatar: (avatar: AvatarProfile) => void;
  updateAvatar: (avatar: AvatarProfile) => void;
  setActiveAvatar: (id: string) => void;
  deleteAvatar: (id: string) => void;
  clearNotifications: () => void;
  loading: boolean;
}

const defaultUser: UserState = {
  isAuthenticated: false,
  email: "",
  avatars: [],
  activeAvatarId: null,
  hasCompletedOnboarding: false,
  notifications: 3,
};

const UserContext = createContext<UserContextType | null>(null);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be inside UserProvider");
  return ctx;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserState>(() => {
    const saved = localStorage.getItem("norgeJobsUser");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultUser, ...parsed, avatars: Array.isArray(parsed.avatars) ? parsed.avatars : [] };
    }
    return defaultUser;
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        setUser((u) => ({
          ...u,
          isAuthenticated: true,
          email: session.user.email ?? "",
        }));
      } else {
        setUser(defaultUser);
        localStorage.removeItem("norgeJobsUser");
      }
      setLoading(false);
    });

    // THEN check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        setUser((u) => ({
          ...u,
          isAuthenticated: true,
          email: session.user.email ?? "",
        }));
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("norgeJobsUser", JSON.stringify(user));
  }, [user]);

  const login = (email: string) =>
    setUser((u) => ({ ...u, isAuthenticated: true, email }));

  const loginWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  };

  const loginWithProvider = async (provider: "google" | "apple") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/onboarding" },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("norgeJobsUser");
    setUser(defaultUser);
  };

  const addAvatar = (avatar: AvatarProfile) =>
    setUser((u) => ({
      ...u,
      avatars: [...u.avatars, avatar],
      activeAvatarId: avatar.id,
      hasCompletedOnboarding: true,
    }));

  const updateAvatar = (avatar: AvatarProfile) =>
    setUser((u) => ({
      ...u,
      avatars: u.avatars.map((a) => (a.id === avatar.id ? avatar : a)),
    }));

  const setActiveAvatar = (id: string) =>
    setUser((u) => ({ ...u, activeAvatarId: id }));

  const deleteAvatar = (id: string) =>
    setUser((u) => {
      const filtered = u.avatars.filter((a) => a.id !== id);
      return {
        ...u,
        avatars: filtered,
        activeAvatarId: filtered.length > 0 ? filtered[0].id : null,
      };
    });

  const activeAvatar = user.avatars.find((a) => a.id === user.activeAvatarId) ?? null;

  const clearNotifications = () =>
    setUser((u) => ({ ...u, notifications: 0 }));

  return (
    <UserContext.Provider
      value={{
        user,
        supabaseUser,
        activeAvatar,
        login,
        loginWithEmail,
        signUpWithEmail,
        loginWithProvider,
        logout,
        addAvatar,
        updateAvatar,
        setActiveAvatar,
        deleteAvatar,
        clearNotifications,
        loading,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
