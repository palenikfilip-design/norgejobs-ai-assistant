export function publicLogoPath(value: unknown): string | null {
  if (typeof value !== "string" || !value || /^https?:\/\//i.test(value) || value.includes("..") || value.startsWith("/") || !value.includes("/")) return null;
  return value;
}