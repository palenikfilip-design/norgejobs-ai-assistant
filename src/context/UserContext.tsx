import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
  login: (email: string) => void;
  logout: () => void;
  setAvatar: (avatar: AvatarProfile) => void;
  clearNotifications: () => void;
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
  const [user, setUser] = useState<UserState>(() => {
    const saved = localStorage.getItem("norgeJobsUser");
    return saved ? JSON.parse(saved) : defaultUser;
  });

  useEffect(() => {
    localStorage.setItem("norgeJobsUser", JSON.stringify(user));
  }, [user]);

  const login = (email: string) =>
    setUser((u) => ({ ...u, isAuthenticated: true, email }));

  const logout = () => {
    localStorage.removeItem("norgeJobsUser");
    setUser(defaultUser);
  };

  const setAvatar = (avatar: AvatarProfile) =>
    setUser((u) => ({ ...u, avatar, hasCompletedOnboarding: true }));

  const clearNotifications = () =>
    setUser((u) => ({ ...u, notifications: 0 }));

  return (
    <UserContext.Provider value={{ user, login, logout, setAvatar, clearNotifications }}>
      {children}
    </UserContext.Provider>
  );
};
