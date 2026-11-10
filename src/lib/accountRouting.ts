export function accountRedirect(path: string, signedIn: boolean, employer: boolean): string | null {
  const employerArea = path === "/employer" || path.startsWith("/employer/");
  const seekerArea = /^\/(onboarding|dashboard|chat|profile|preset|presets|sources|premium|saved|cv|cover-letters|insights)(\/|$)/.test(path);
  if (!signedIn) return employerArea || seekerArea ? "/login" : null;
  if (employer && (seekerArea || ["/", "/login", "/signup", "/for-employers", "/auth/callback"].includes(path))) return "/employer/dashboard";
  if (!employer && (employerArea || path === "/auth/callback")) return "/dashboard";
  return null;
}