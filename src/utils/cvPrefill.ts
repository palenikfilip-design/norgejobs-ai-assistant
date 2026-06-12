import type { CvData, CvWorkEntry } from "@/types/cv";

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
    languages: asStringArray(p.languages),
    skills: asStringArray(p.skills),
    work_experience: parseWorkExperience(p.work_experience),
    education: [],
    certifications: asStringArray(p.certifications),
  };
}