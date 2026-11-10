import { supabase } from "@/integrations/supabase/client";

export const TRUST_LABELS: Record<string, string> = { new: "Nová firma", verified: "Ověřená", gold: "Gold partner" };

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "firma";
}

/** logo_url is either an absolute URL or a path in the private company-logos bucket. */
export async function resolveLogoUrl(logo: string | null | undefined): Promise<string | null> {
  if (!logo) return null;
  if (/^https?:\/\//.test(logo)) return logo;
  const { data } = await supabase.storage.from("company-logos").createSignedUrl(logo, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

export async function isEmployer(userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "employer").maybeSingle();
  if (error) throw error;
  return !!data;
}
