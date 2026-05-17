import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser, UserProfile, defaultProfile } from "@/context/UserContext";
import type { LanguageWithLevel } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, X, Plus, Trash2, Save, Upload, FileText, Loader2 } from "lucide-react";
import { CalendarIcon } from "lucide-react";
import { format, parseISO, differenceInYears } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/constants/countries";
import { LANGUAGES, LANGUAGE_LEVELS, EXPERIENCE_LEVELS, PROFESSION_CATEGORIES } from "@/constants/jobRequirements";
import { useToast } from "@/hooks/use-toast";
import DimensionSlider from "@/components/DimensionSlider";
import type { CandidateDimensions, DimensionValue } from "@/types/candidateDimensions";
import { normalizeCandidateDimensions } from "@/utils/candidateDimensions";
import type { LifestyleProfile } from "@/types/lifestyleProfile";
import { defaultLifestyleProfile } from "@/types/lifestyleProfile";
import { Switch } from "@/components/ui/switch";
import InfoTooltip from "@/components/InfoTooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const PERSONALITY_TONES = ["Professional", "Friendly", "Direct"];

const SimpleTagSelector = ({
  options,
  selected,
  onChange,
  single = false,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  single?: boolean;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = selected.includes(opt);
      return (
        <button
          key={opt}
          type="button"
          onClick={() => {
            if (single) onChange(active ? [] : [opt]);
            else onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt]);
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${active ? "bg-accent-gradient text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
        >
          {opt}
          {active && <Check className="w-3 h-3 inline ml-1" />}
        </button>
      );
    })}
  </div>
);

const TagSelector = ({
  options,
  selected,
  onChange,
  single = false,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
  single?: boolean;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = selected.includes(opt.value);
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => {
            if (single) onChange(active ? [] : [opt.value]);
            else onChange(active ? selected.filter((s) => s !== opt.value) : [...selected, opt.value]);
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${active ? "bg-accent-gradient text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
        >
          {opt.label}
          {active && <Check className="w-3 h-3 inline ml-1" />}
        </button>
      );
    })}
  </div>
);

const SkillInput = ({ skills, onChange }: { skills: string[]; onChange: (val: string[]) => void }) => {
  const [input, setInput] = useState("");

  const addSkill = () => {
    const trimmed = input.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input
          placeholder="e.g. React, Welding, Driving..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
        />
        <Button type="button" variant="outline" size="sm" onClick={addSkill}>
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
            {skill}
            <button type="button" onClick={() => onChange(skills.filter((current) => current !== skill))}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

const LanguageSelector = ({ languages, onChange }: { languages: LanguageWithLevel[]; onChange: (val: LanguageWithLevel[]) => void }) => {
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const addLanguage = () => onChange([...languages, { language: "", level: "B1" }]);

  const updateLang = (index: number, field: keyof LanguageWithLevel, value: string) => {
    const updated = [...languages];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeLang = (index: number) => onChange(languages.filter((_, currentIndex) => currentIndex !== index));

  const handleUpload = async (index: number, file: File) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setUploading(index);
    const extension = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("language-certificates").upload(path, file);

    if (!error) {
      const updated = [...languages];
      updated[index] = { ...updated[index], certificateUrl: path, certificateName: file.name };
      onChange(updated);
    }

    setUploading(null);
  };

  const handleRemoveCert = async (index: number) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const language = languages[index];

    if (language.certificateUrl) {
      await supabase.storage.from("language-certificates").remove([language.certificateUrl]);
    }

    const updated = [...languages];
    updated[index] = { ...updated[index], certificateUrl: undefined, certificateName: undefined };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {languages.map((lang, index) => (
        <div key={index} className="space-y-2 p-3 rounded-lg border border-border/50 bg-secondary/10">
          <div className="flex gap-2 items-center">
            <select
              value={lang.language}
              onChange={(e) => updateLang(index, "language", e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-1"
            >
              <option value="">Select language</option>
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
            <select
              value={lang.level}
              onChange={(e) => updateLang(index, "level", e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-48"
            >
              {LANGUAGE_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeLang(index)}>
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="flex items-center gap-2 pl-1">
            {lang.certificateUrl ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-md px-2 py-1">
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span className="truncate max-w-[180px]">{lang.certificateName || "Certificate"}</span>
                <button type="button" onClick={() => handleRemoveCert(index)} className="text-destructive hover:text-destructive/80">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  ref={(element) => {
                    fileRefs.current[index] = element;
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(index, file);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7"
                  disabled={uploading === index}
                  onClick={() => fileRefs.current[index]?.click()}
                >
                  {uploading === index ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                  {uploading === index ? "Uploading..." : "Add certificate"}
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addLanguage}>
        <Plus className="w-4 h-4 mr-1" /> Add Language
      </Button>
    </div>
  );
};

const normalizeProfile = (profile?: UserProfile): UserProfile => ({
  ...defaultProfile,
  ...(profile ?? defaultProfile),
  dimensions: normalizeCandidateDimensions(profile?.dimensions),
  lifestyleProfile: { ...defaultLifestyleProfile, ...(profile?.lifestyleProfile ?? {}) },
  languages: profile?.languages ?? [],
  skills: profile?.skills ?? [],
  certifications: profile?.certifications ?? [],
  professions:
    profile?.professions && profile.professions.length > 0
      ? profile.professions
      : profile?.profession
      ? [{ category: profile.profession, experienceLevel: profile.experienceLevel || "any" }]
      : [],
});

const ProfileEdit = () => {
  const { user, updateProfile, loading } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<UserProfile>(() => normalizeProfile(user.profile));
  const [saved, setSaved] = useState(false);

  const savedProfile = useMemo(() => normalizeProfile(user.profile), [user.profile, loading]);

  useEffect(() => {
    if (!loading) {
      setForm(normalizeProfile(user.profile));
      setSaved(false);
    }
  }, [loading, user.profile]);

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(savedProfile);
  }, [form, savedProfile]);

  // Browser tab close / refresh guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // React Router navigation guard (useBlocker requires a data router; we
  // currently use BrowserRouter, so fall back to the beforeunload guard above).
  const blocker = { state: "unblocked" as string, reset: () => {}, proceed: () => {} };

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const updateDim = (group: keyof CandidateDimensions, field: string, dimension: DimensionValue) =>
    setForm((current) => ({
      ...current,
      dimensions: {
        ...current.dimensions,
        [group]: { ...((current.dimensions[group] ?? {}) as any), [field]: dimension },
      },
    }));

  const handleSave = () => {
    setSaved(true);
    const normalized = normalizeProfile(form);
    // Keep legacy single-value fields in sync with first selected profession
    const first = normalized.professions?.[0];
    if (first) {
      normalized.profession = first.category;
      normalized.experienceLevel = first.experienceLevel;
    }
    updateProfile(normalized);
    toast({ title: "Profile updated!", description: "Your profile has been saved." });
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-accent-gradient text-accent-foreground hover:opacity-90">
            <Save className="w-4 h-4 mr-1" /> Save Changes
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-1">Edit Profile</h1>
          <p className="text-muted-foreground text-sm">Your personal info & skills — shared across all search presets</p>
        </motion.div>

        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country of Origin</Label>
              <select
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select country</option>
                {COUNTRIES.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <SimpleTagSelector options={GENDERS} selected={form.gender ? [form.gender] : []} onChange={(value) => update("gender", value[value.length - 1] || undefined)} single />
          </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !form.dateOfBirth && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {form.dateOfBirth ? format(parseISO(form.dateOfBirth), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.dateOfBirth ? parseISO(form.dateOfBirth) : undefined}
                    onSelect={(d) => {
                      if (!d) {
                        update("dateOfBirth", undefined);
                        update("age", undefined);
                        return;
                      }
                      const iso = format(d, "yyyy-MM-dd");
                      update("dateOfBirth", iso);
                      update("age", differenceInYears(new Date(), d));
                    }}
                    captionLayout="dropdown-buttons"
                    fromYear={1925}
                    toYear={new Date().getFullYear()}
                    defaultMonth={form.dateOfBirth ? parseISO(form.dateOfBirth) : new Date(2000, 0, 1)}
                    disabled={(date) => date > new Date() || date < new Date("1925-01-01")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {form.dateOfBirth && (
                <span className="text-sm text-muted-foreground">
                  Age: <span className="text-foreground font-medium">{differenceInYears(new Date(), parseISO(form.dateOfBirth))}</span>
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Languages</h2>
          <LanguageSelector languages={form.languages} onChange={(value) => update("languages", value)} />
        </section>

        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Experience & Skills</h2>
          <div className="space-y-3">
            <Label>Profession Categories</Label>
            <p className="text-xs text-muted-foreground">Select one or more — each will let you set its own experience level.</p>
            <div className="flex flex-wrap gap-2">
              {PROFESSION_CATEGORIES.map((opt) => {
                const list = form.professions ?? [];
                const active = list.some((p) => p.category === opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? list.filter((p) => p.category !== opt.value)
                        : [...list, { category: opt.value, experienceLevel: "any" }];
                      update("professions", next);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${active ? "bg-accent-gradient text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                  >
                    {opt.label}
                    {active && <Check className="w-3 h-3 inline ml-1" />}
                  </button>
                );
              })}
            </div>
            {(form.professions ?? []).length > 0 && (
              <div className="space-y-2 pt-2">
                {(form.professions ?? []).map((item, idx) => {
                  const label = PROFESSION_CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category;
                  return (
                    <div
                      key={item.category}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-secondary/10"
                    >
                      <span className="text-sm font-medium flex-1">{label}</span>
                      <select
                        value={item.experienceLevel}
                        onChange={(e) => {
                          const next = [...(form.professions ?? [])];
                          next[idx] = { ...item, experienceLevel: e.target.value };
                          update("professions", next);
                        }}
                        className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {EXPERIENCE_LEVELS.map((lvl) => (
                          <option key={lvl.value} value={lvl.value}>
                            {lvl.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => update("professions", (form.professions ?? []).filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Work Experience</Label>
            <Textarea value={form.workExperience} onChange={(e) => update("workExperience", e.target.value)} placeholder="Describe your work experience..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Skills</Label>
            <SkillInput skills={form.skills} onChange={(value) => update("skills", value)} />
          </div>
          <div className="space-y-2">
            <Label>Certifications</Label>
            <SkillInput skills={form.certifications} onChange={(value) => update("certifications", value)} />
          </div>
        </section>

        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">🧠 Work Style</h2>
          <p className="text-xs text-muted-foreground">How do you work best? Set your confidence level for each.</p>
          <DimensionSlider label="Independence" description="How much do you prefer working alone?" lowLabel="Team" highLabel="Solo" dimension={form.dimensions.workStyle.independence_level} onChange={(value) => updateDim("workStyle", "independence_level", value)} />
          <DimensionSlider label="Stress Tolerance" description="How well do you handle pressure?" lowLabel="Low" highLabel="High" dimension={form.dimensions.workStyle.stress_tolerance} onChange={(value) => updateDim("workStyle", "stress_tolerance", value)} />
          <DimensionSlider label="Routine vs Dynamic" description="Do you prefer predictable or changing tasks?" lowLabel="Routine" highLabel="Dynamic" dimension={form.dimensions.workStyle.routine_vs_dynamic} onChange={(value) => updateDim("workStyle", "routine_vs_dynamic", value)} />
          <DimensionSlider label="Social Need" description="How important is socializing at work?" lowLabel="Low" highLabel="High" dimension={form.dimensions.workStyle.social_need} onChange={(value) => updateDim("workStyle", "social_need", value)} />
          <DimensionSlider label="Authority Acceptance" description="How comfortable are you with strict hierarchy?" lowLabel="Flat" highLabel="Hierarchical" dimension={form.dimensions.workStyle.authority_acceptance} onChange={(value) => updateDim("workStyle", "authority_acceptance", value)} />
        </section>

        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">⚙️ Work Preferences</h2>
          <DimensionSlider label="Physical vs Mental" description="What type of work suits you?" lowLabel="Mental" highLabel="Physical" dimension={form.dimensions.workPreferences.physical_vs_mental} onChange={(value) => updateDim("workPreferences", "physical_vs_mental", value)} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preferred Shift</Label>
              <select
                value={form.dimensions.workPreferences.shift_type}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    dimensions: {
                      ...current.dimensions,
                      workPreferences: { ...current.dimensions.workPreferences, shift_type: e.target.value as any },
                    },
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="day">Day shift</option>
                <option value="night">Night shift</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Hours per Week</Label>
              <Input
                type="number"
                value={form.dimensions.workPreferences.hours_per_week}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    dimensions: {
                      ...current.dimensions,
                      workPreferences: {
                        ...current.dimensions.workPreferences,
                        hours_per_week: Number(e.target.value) || 40,
                      },
                    },
                  }))
                }
              />
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">🌍 Lifestyle</h2>
          <div className="space-y-2">
            <Label>Climate Preference</Label>
            <div className="flex gap-2">
              {(["cold", "moderate", "warm"] as const).map((climate) => (
                <button
                  key={climate}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      dimensions: {
                        ...current.dimensions,
                        lifestyle: { ...current.dimensions.lifestyle, climate_tolerance: climate },
                      },
                    }))
                  }
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${form.dimensions.lifestyle.climate_tolerance === climate ? "bg-accent-gradient text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                >
                  {climate}
                </button>
              ))}
            </div>
          </div>
          <DimensionSlider label="Isolation Tolerance" description="How well do you handle being alone?" lowLabel="Need people" highLabel="Love solitude" dimension={form.dimensions.lifestyle.isolation_tolerance} onChange={(value) => updateDim("lifestyle", "isolation_tolerance", value)} />
          <DimensionSlider label="Nature vs City" description="Where do you prefer to live?" lowLabel="City" highLabel="Nature" dimension={form.dimensions.lifestyle.nature_vs_city} onChange={(value) => updateDim("lifestyle", "nature_vs_city", value)} />
          <DimensionSlider label="Nightlife Need" description="How important is social/nightlife?" lowLabel="Not important" highLabel="Very important" dimension={form.dimensions.lifestyle.nightlife_need} onChange={(value) => updateDim("lifestyle", "nightlife_need", value)} />
        </section>

        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">💰 Financial Preferences</h2>
          <DimensionSlider label="Risk Tolerance" description="Are you okay with variable income?" lowLabel="Stable" highLabel="Variable OK" dimension={form.dimensions.financial.risk_tolerance} onChange={(value) => updateDim("financial", "risk_tolerance", value)} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monthly Savings Goal (€)</Label>
              <Input
                type="number"
                value={form.dimensions.financial.savings_goal}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    dimensions: {
                      ...current.dimensions,
                      financial: {
                        ...current.dimensions.financial,
                        savings_goal: Number(e.target.value) || 0,
                      },
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Spending Pattern</Label>
              <select
                value={form.dimensions.financial.spending_pattern}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    dimensions: {
                      ...current.dimensions,
                      financial: { ...current.dimensions.financial, spending_pattern: e.target.value as any },
                    },
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="low">Low spender</option>
                <option value="medium">Medium</option>
                <option value="high">High spender</option>
              </select>
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground">👨‍👩‍👧 Lifestyle & Availability</h2>
            <InfoTooltip content="Lifestyle data helps match you with jobs that fit your personal life. This is optional and can be toggled per search preset." />
          </div>
          <p className="text-xs text-muted-foreground">Optional — helps find jobs compatible with your life situation.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Relationship Status</Label>
              <select
                value={form.lifestyleProfile.relationshipStatus}
                onChange={(e) => setForm(f => ({ ...f, lifestyleProfile: { ...f.lifestyleProfile, relationshipStatus: e.target.value as any } }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="single">Single</option>
                <option value="relationship">In a relationship</option>
                <option value="married">Married</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Weekend Availability</Label>
              <select
                value={form.lifestyleProfile.weekendAvailability}
                onChange={(e) => setForm(f => ({ ...f, lifestyleProfile: { ...f.lifestyleProfile, weekendAvailability: e.target.value as any } }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="full">Fully available</option>
                <option value="limited">Limited</option>
                <option value="none">Not available</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.lifestyleProfile.hasChildren}
                onCheckedChange={(v) => setForm(f => ({ ...f, lifestyleProfile: { ...f.lifestyleProfile, hasChildren: v, childrenCount: v ? Math.max(1, f.lifestyleProfile.childrenCount) : 0 } }))}
              />
              Has children
            </label>
          </div>

          {form.lifestyleProfile.hasChildren && (
            <div className="grid grid-cols-2 gap-4 pl-2 border-l-2 border-accent/30">
              <div className="space-y-2">
                <Label>Number of children</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.lifestyleProfile.childrenCount}
                  onChange={(e) => setForm(f => ({ ...f, lifestyleProfile: { ...f.lifestyleProfile, childrenCount: Number(e.target.value) || 1 } }))}
                  className="w-20"
                />
              </div>
              <div className="space-y-2">
                <Label>Youngest child age</Label>
                <select
                  value={form.lifestyleProfile.youngestChildAge}
                  onChange={(e) => setForm(f => ({ ...f, lifestyleProfile: { ...f.lifestyleProfile, youngestChildAge: e.target.value as any } }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="0-3">0–3 years</option>
                  <option value="4-10">4–10 years</option>
                  <option value="11+">11+ years</option>
                </select>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label>Work flexibility</Label>
            <div className="flex flex-wrap gap-4">
              {[
                { key: "canWorkShifts" as const, label: "Can work shifts" },
                { key: "canWorkNights" as const, label: "Can work nights" },
                { key: "willingToRelocate" as const, label: "Willing to relocate" },
                { key: "prefersStableSchedule" as const, label: "Prefers stable schedule" },
                { key: "openToSeasonalJobs" as const, label: "Open to seasonal jobs" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.lifestyleProfile[key]}
                    onCheckedChange={(v) => setForm(f => ({ ...f, lifestyleProfile: { ...f.lifestyleProfile, [key]: v } }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Communication Tone</h2>
          <SimpleTagSelector options={PERSONALITY_TONES} selected={form.personality ? [form.personality] : []} onChange={(value) => update("personality", value[value.length - 1] || undefined)} single />
        </section>

        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={handleSave} className="bg-accent-gradient text-accent-foreground hover:opacity-90">
            <Save className="w-4 h-4 mr-1" /> Save Changes
          </Button>
        </div>
      </main>

      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Stay on page
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blocker.proceed?.()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                handleSave();
                blocker.proceed?.();
              }}
              className="bg-accent-gradient text-accent-foreground hover:opacity-90"
            >
              Save & leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfileEdit;
