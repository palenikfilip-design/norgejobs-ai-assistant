import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface AvatarProfile {
  fullName: string;
  age?: number;
  country: string;
  languages: string[];
  workExperience: string;
  skills: string[];
  preferredJobType: string;
  preferredCountries: string[];
  salaryMin: number;
  salaryMax: number;
  housingPreference: boolean;
  personality?: string;
}

interface UserState {
  isAuthenticated: boolean;
  email: string;
  avatar: AvatarProfile | null;
  hasCompletedOnboarding: boolean;
  notifications: number;
}

interface UserContextType {
  user: UserState;
  supabaseUser: User | null;
  login: (email: string) => void;
  loginWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  loginWithProvider: (provider: "google" | "apple") => Promise<void>;
  logout: () => Promise<void>;
  setAvatar: (avatar: AvatarProfile) => void;
  clearNotifications: () => void;
  loading: boolean;
}

const defaultUser: UserState = {
  isAuthenticated: false,
  email: "",
  avatar: null,
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
    return saved ? JSON.parse(saved) : defaultUser;
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

  const setAvatar = (avatar: AvatarProfile) =>
    setUser((u) => ({ ...u, avatar, hasCompletedOnboarding: true }));

  const clearNotifications = () =>
    setUser((u) => ({ ...u, notifications: 0 }));

  return (
    <UserContext.Provider
      value={{
        user,
        supabaseUser,
        login,
        loginWithEmail,
        signUpWithEmail,
        loginWithProvider,
        logout,
        setAvatar,
        clearNotifications,
        loading,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
