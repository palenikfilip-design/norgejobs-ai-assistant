import type { CvData, CvWorkEntry, CvLanguageEntry, CvCertificationEntry } from "@/types/cv";

const asStringArray = (v: unknown): string[] => {
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          const name = (o.language ?? o.name ?? o.skill ?? o.title ?? "") as string;
          const level = (o.level ?? o.proficiency ?? "") as string;
          return level ? `${name} (${level})` : String(name);
        }
        return "";
      })
      .filter((s) => s.trim().length > 0);
  }
  if (typeof v === "string" && v.trim()) return v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  return [];
};

export const parseLanguages = (v: unknown): CvLanguageEntry[] => {
  if (Array.isArray(v)) {
    return v
      .map((x): CvLanguageEntry | null => {
        if (typeof x === "string") {
          const m = x.match(/^(.+?)\s*[\(\-–—]\s*([^)]+?)\)?$/);
          if (m) return { name: m[1].trim(), level: m[2].trim() };
          return { name: x.trim(), level: "" };
        }
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          const name = String(o.language ?? o.name ?? "").trim();
          const level = String(o.level ?? o.proficiency ?? "").trim();
          if (!name) return null;
          return { name, level };
        }
        return null;
      })
      .filter((e): e is CvLanguageEntry => !!e && e.name.length > 0);
  }
  if (typeof v === "string" && v.trim()) {
    return v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).map((s) => ({ name: s, level: "" }));
  }
  return [];
};

export const parseCertifications = (v: unknown): CvCertificationEntry[] => {
  if (Array.isArray(v)) {
    return v
      .map((x): CvCertificationEntry | null => {
        if (typeof x === "string") return x.trim() ? { name: x.trim() } : null;
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          const name = String(o.name ?? o.title ?? o.certification ?? "").trim();
          if (!name) return null;
          const year = o.year != null ? String(o.year) : undefined;
          const issuer = o.issuer != null ? String(o.issuer) : undefined;
          return { name, year, issuer };
        }
        return null;
      })
      .filter((e): e is CvCertificationEntry => !!e);
  }
  if (typeof v === "string" && v.trim()) {
    return v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).map((s) => ({ name: s }));
  }
  return [];
};

const parseWorkExperience = (text: string | null | undefined): CvWorkEntry[] => {
  if (!text || !text.trim()) return [];
  // Split on blank lines or bullets; each chunk becomes a single entry's description.
  const chunks = text.split(/\n\s*\n+/).map((c) => c.trim()).filter(Boolean);
  if (chunks.length === 0) return [];
  return chunks.map((chunk) => {
    // Try to detect "Title — Company (period)" on first line
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    const first = lines[0] || "";
    const rest = lines.slice(1).join("\n");
    const m = first.match(/^(.+?)\s*[—\-–|@]\s*(.+?)(?:\s*\(([^)]+)\))?$/);
    if (m) {
      return {
        position: m[1]?.trim() || "",
        company: m[2]?.trim() || "",
        period: m[3]?.trim() || "",
        description: rest,
      };
    }
    return { position: "", company: "", period: "", description: chunk };
  });
};

export function prefillCvFromProfile(args: {
  email?: string | null;
  profile: {
    full_name?: string | null;
    profession?: string | null;
    current_residence?: string | null;
    country?: string | null;
    languages?: unknown;
    skills?: unknown;
    work_experience?: string | null;
    certifications?: unknown;
  };
}): CvData {
  const p = args.profile || ({} as any);
  return {
    full_name: p.full_name || "",
    headline: p.profession || "",
    email: args.email || "",
    phone: "",
    location: p.current_residence || p.country || "",
    summary: "",
    languages: parseLanguages(p.languages),
    skills: asStringArray(p.skills),
    work_experience: parseWorkExperience(p.work_experience),
    education: [],
    certifications: parseCertifications(p.certifications),
  };
}