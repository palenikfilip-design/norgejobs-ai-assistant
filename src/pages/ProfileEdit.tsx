import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser, UserProfile, defaultProfile } from "@/context/UserContext";
import type { LanguageWithLevel } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, X, Plus, Trash2, Save, Upload, FileText, Loader2 } from "lucide-react";
import { COUNTRIES } from "@/constants/countries";
import { LANGUAGES, LANGUAGE_LEVELS, EXPERIENCE_LEVELS, PROFESSION_CATEGORIES } from "@/constants/jobRequirements";
import { useToast } from "@/hooks/use-toast";
import DimensionSlider from "@/components/DimensionSlider";
import type { CandidateDimensions, DimensionValue } from "@/types/candidateDimensions";

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
        <button key={opt} type="button"
          onClick={() => { if (single) onChange(active ? [] : [opt]); else onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt]); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${active ? "bg-accent-gradient text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
          {opt}{active && <Check className="w-3 h-3 inline ml-1" />}
        </button>
      );
    })}
  </div>
);

const TagSelector = ({
  options, selected, onChange, single = false,
}: { options: { value: string; label: string }[]; selected: string[]; onChange: (val: string[]) => void; single?: boolean }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = selected.includes(opt.value);
      return (
        <button key={opt.value} type="button"
          onClick={() => { if (single) onChange(active ? [] : [opt.value]); else onChange(active ? selected.filter((s) => s !== opt.value) : [...selected, opt.value]); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${active ? "bg-accent-gradient text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
          {opt.label}{active && <Check className="w-3 h-3 inline ml-1" />}
        </button>
      );
    })}
  </div>
);

const SkillInput = ({ skills, onChange }: { skills: string[]; onChange: (val: string[]) => void }) => {
  const [input, setInput] = useState("");
  const addSkill = () => { const t = input.trim(); if (t && !skills.includes(t)) { onChange([...skills, t]); setInput(""); } };
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input placeholder="e.g. React, Welding, Driving..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
        <Button type="button" variant="outline" size="sm" onClick={addSkill}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
            {s}<button type="button" onClick={() => onChange(skills.filter((sk) => sk !== s))}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
    </div>
  );
};

const LanguageSelector = ({ languages, onChange }: { languages: LanguageWithLevel[]; onChange: (val: LanguageWithLevel[]) => void }) => {
  const addLanguage = () => onChange([...languages, { language: "", level: "B1" }]);
  const updateLang = (i: number, field: keyof LanguageWithLevel, val: string) => { const u = [...languages]; u[i] = { ...u[i], [field]: val }; onChange(u); };
  const removeLang = (i: number) => onChange(languages.filter((_, idx) => idx !== i));
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleUpload = async (i: number, file: File) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(i);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("language-certificates").upload(path, file);
    if (!error) {
      const u = [...languages];
      u[i] = { ...u[i], certificateUrl: path, certificateName: file.name };
      onChange(u);
    }
    setUploading(null);
  };

  const handleRemoveCert = async (i: number) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const lang = languages[i];
    if (lang.certificateUrl) {
      await supabase.storage.from("language-certificates").remove([lang.certificateUrl]);
    }
    const u = [...languages];
    u[i] = { ...u[i], certificateUrl: undefined, certificateName: undefined };
    onChange(u);
  };

  return (
    <div className="space-y-3">
      {languages.map((lang, i) => (
        <div key={i} className="space-y-2 p-3 rounded-lg border border-border/50 bg-secondary/10">
          <div className="flex gap-2 items-center">
            <select value={lang.language} onChange={(e) => updateLang(i, "language", e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-1">
              <option value="">Select language</option>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <select value={lang.level} onChange={(e) => updateLang(i, "level", e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-48">
              {LANGUAGE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeLang(i)}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
          </div>
          {/* Certificate upload */}
          <div className="flex items-center gap-2 pl-1">
            {lang.certificateUrl ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-md px-2 py-1">
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span className="truncate max-w-[180px]">{lang.certificateName || "Certificate"}</span>
                <button type="button" onClick={() => handleRemoveCert(i)} className="text-destructive hover:text-destructive/80">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  ref={(el) => { fileRefs.current[i] = el; }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(i, f); }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7"
                  disabled={uploading === i}
                  onClick={() => fileRefs.current[i]?.click()}
                >
                  {uploading === i ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                  {uploading === i ? "Uploading..." : "Add certificate"}
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addLanguage}><Plus className="w-4 h-4 mr-1" /> Add Language</Button>
    </div>
  );
};

const ProfileEdit = () => {
  const { user, updateProfile } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<UserProfile>({ ...user.profile });

  const update = <K extends keyof UserProfile>(key: K, val: UserProfile[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const updateDim = (group: keyof CandidateDimensions, field: string, dim: DimensionValue) =>
    setForm((f) => ({
      ...f,
      dimensions: {
        ...f.dimensions,
        [group]: { ...(f.dimensions[group] as any), [field]: dim },
      },
    }));

  const handleSave = () => {
    updateProfile(form);
    toast({ title: "Profile updated!", description: "Your profile has been saved." });
    navigate("/dashboard");
  };

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

        {/* Basic Info */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country of Origin</Label>
              <select value={form.country} onChange={(e) => update("country", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Select country</option>
                {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <SimpleTagSelector options={GENDERS} selected={form.gender ? [form.gender] : []} onChange={(v) => update("gender", v[v.length - 1] || undefined)} single />
          </div>
          <div className="space-y-2 w-32">
            <Label>Age</Label>
            <Input type="number" value={form.age ?? ""} onChange={(e) => update("age", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
        </section>

        {/* Languages */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Languages</h2>
          <LanguageSelector languages={form.languages} onChange={(v) => update("languages", v)} />
        </section>

        {/* Experience & Skills */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Experience & Skills</h2>
          <div className="space-y-2">
            <Label>Profession Category</Label>
            <TagSelector options={PROFESSION_CATEGORIES} selected={form.profession ? [form.profession] : []} onChange={(v) => update("profession", v[v.length - 1] || "")} single />
          </div>
          <div className="space-y-2">
            <Label>Experience Level</Label>
            <TagSelector options={EXPERIENCE_LEVELS} selected={[form.experienceLevel]} onChange={(v) => update("experienceLevel", v[v.length - 1] || "any")} single />
          </div>
          <div className="space-y-2">
            <Label>Work Experience</Label>
            <Textarea value={form.workExperience} onChange={(e) => update("workExperience", e.target.value)} placeholder="Describe your work experience..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Skills</Label>
            <SkillInput skills={form.skills} onChange={(v) => update("skills", v)} />
          </div>
          <div className="space-y-2">
            <Label>Certifications</Label>
            <SkillInput skills={form.certifications} onChange={(v) => update("certifications", v)} />
          </div>
        </section>

        {/* Work Style Dimensions */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">🧠 Work Style</h2>
          <p className="text-xs text-muted-foreground">How do you work best? Set your confidence level for each.</p>
          <DimensionSlider label="Independence" description="How much do you prefer working alone?" lowLabel="Team" highLabel="Solo" dimension={form.dimensions.workStyle.independence_level} onChange={(d) => updateDim("workStyle", "independence_level", d)} />
          <DimensionSlider label="Stress Tolerance" description="How well do you handle pressure?" lowLabel="Low" highLabel="High" dimension={form.dimensions.workStyle.stress_tolerance} onChange={(d) => updateDim("workStyle", "stress_tolerance", d)} />
          <DimensionSlider label="Routine vs Dynamic" description="Do you prefer predictable or changing tasks?" lowLabel="Routine" highLabel="Dynamic" dimension={form.dimensions.workStyle.routine_vs_dynamic} onChange={(d) => updateDim("workStyle", "routine_vs_dynamic", d)} />
          <DimensionSlider label="Social Need" description="How important is socializing at work?" lowLabel="Low" highLabel="High" dimension={form.dimensions.workStyle.social_need} onChange={(d) => updateDim("workStyle", "social_need", d)} />
          <DimensionSlider label="Authority Acceptance" description="How comfortable are you with strict hierarchy?" lowLabel="Flat" highLabel="Hierarchical" dimension={form.dimensions.workStyle.authority_acceptance} onChange={(d) => updateDim("workStyle", "authority_acceptance", d)} />
        </section>

        {/* Work Preferences */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">⚙️ Work Preferences</h2>
          <DimensionSlider label="Physical vs Mental" description="What type of work suits you?" lowLabel="Mental" highLabel="Physical" dimension={form.dimensions.workPreferences.physical_vs_mental} onChange={(d) => updateDim("workPreferences", "physical_vs_mental", d)} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preferred Shift</Label>
              <select value={form.dimensions.workPreferences.shift_type} onChange={(e) => setForm(f => ({ ...f, dimensions: { ...f.dimensions, workPreferences: { ...f.dimensions.workPreferences, shift_type: e.target.value as any } } }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="day">Day shift</option>
                <option value="night">Night shift</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Hours per Week</Label>
              <Input type="number" value={form.dimensions.workPreferences.hours_per_week} onChange={(e) => setForm(f => ({ ...f, dimensions: { ...f.dimensions, workPreferences: { ...f.dimensions.workPreferences, hours_per_week: Number(e.target.value) || 40 } } }))} />
            </div>
          </div>
        </section>

        {/* Lifestyle */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">🌍 Lifestyle</h2>
          <div className="space-y-2">
            <Label>Climate Preference</Label>
            <div className="flex gap-2">
              {(["cold", "moderate", "warm"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, dimensions: { ...f.dimensions, lifestyle: { ...f.dimensions.lifestyle, climate_tolerance: c } } }))} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${form.dimensions.lifestyle.climate_tolerance === c ? "bg-accent-gradient text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>{c}</button>
              ))}
            </div>
          </div>
          <DimensionSlider label="Isolation Tolerance" description="How well do you handle being alone?" lowLabel="Need people" highLabel="Love solitude" dimension={form.dimensions.lifestyle.isolation_tolerance} onChange={(d) => updateDim("lifestyle", "isolation_tolerance", d)} />
          <DimensionSlider label="Nature vs City" description="Where do you prefer to live?" lowLabel="City" highLabel="Nature" dimension={form.dimensions.lifestyle.nature_vs_city} onChange={(d) => updateDim("lifestyle", "nature_vs_city", d)} />
          <DimensionSlider label="Nightlife Need" description="How important is social/nightlife?" lowLabel="Not important" highLabel="Very important" dimension={form.dimensions.lifestyle.nightlife_need} onChange={(d) => updateDim("lifestyle", "nightlife_need", d)} />
        </section>

        {/* Financial */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">💰 Financial Preferences</h2>
          <DimensionSlider label="Risk Tolerance" description="Are you okay with variable income?" lowLabel="Stable" highLabel="Variable OK" dimension={form.dimensions.financial.risk_tolerance} onChange={(d) => updateDim("financial", "risk_tolerance", d)} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monthly Savings Goal (€)</Label>
              <Input type="number" value={form.dimensions.financial.savings_goal} onChange={(e) => setForm(f => ({ ...f, dimensions: { ...f.dimensions, financial: { ...f.dimensions.financial, savings_goal: Number(e.target.value) || 0 } } }))} />
            </div>
            <div className="space-y-2">
              <Label>Spending Pattern</Label>
              <select value={form.dimensions.financial.spending_pattern} onChange={(e) => setForm(f => ({ ...f, dimensions: { ...f.dimensions, financial: { ...f.dimensions.financial, spending_pattern: e.target.value as any } } }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="low">Low spender</option>
                <option value="medium">Medium</option>
                <option value="high">High spender</option>
              </select>
            </div>
          </div>
        </section>

        {/* Tone */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Communication Tone</h2>
          <SimpleTagSelector options={PERSONALITY_TONES} selected={form.personality ? [form.personality] : []} onChange={(v) => update("personality", v[v.length - 1] || undefined)} single />
        </section>

        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={handleSave} className="bg-accent-gradient text-accent-foreground hover:opacity-90">
            <Save className="w-4 h-4 mr-1" /> Save Changes
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ProfileEdit;
