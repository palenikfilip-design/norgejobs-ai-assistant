import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser, AvatarProfile, DEFAULT_MATCH_WEIGHTS } from "@/context/UserContext";
import type { LanguageWithLevel } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Check, X, Plus, Trash2, Info, Save } from "lucide-react";
import { COUNTRIES } from "@/constants/countries";
import { LANGUAGES, LANGUAGE_LEVELS, EXPERIENCE_LEVELS, PROFESSION_CATEGORIES, JOB_BONUSES } from "@/constants/jobRequirements";
import { useToast } from "@/hooks/use-toast";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const JOB_TYPES = ["Full-time", "Part-time", "Seasonal", "Remote"];
const PERSONALITY_TONES = ["Professional", "Friendly", "Direct"];

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
            if (single) {
              onChange(active ? [] : [opt.value]);
            } else {
              onChange(active ? selected.filter((s) => s !== opt.value) : [...selected, opt.value]);
            }
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            active
              ? "bg-accent-gradient text-accent-foreground shadow-sm"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {opt.label}
          {active && <Check className="w-3 h-3 inline ml-1" />}
        </button>
      );
    })}
  </div>
);

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
            if (single) {
              onChange(active ? [] : [opt]);
            } else {
              onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt]);
            }
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            active
              ? "bg-accent-gradient text-accent-foreground shadow-sm"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {opt}
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
        <Button type="button" variant="outline" size="sm" onClick={addSkill}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
            {s}
            <button type="button" onClick={() => onChange(skills.filter((sk) => sk !== s))}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
    </div>
  );
};

const LanguageSelector = ({ languages, onChange }: { languages: LanguageWithLevel[]; onChange: (val: LanguageWithLevel[]) => void }) => {
  const addLanguage = () => onChange([...languages, { language: "", level: "B1" }]);
  const updateLang = (i: number, field: keyof LanguageWithLevel, val: string) => {
    const updated = [...languages];
    updated[i] = { ...updated[i], [field]: val };
    onChange(updated);
  };
  const removeLang = (i: number) => onChange(languages.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {languages.map((lang, i) => (
        <div key={i} className="flex gap-2 items-center">
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
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addLanguage}><Plus className="w-4 h-4 mr-1" /> Add Language</Button>
    </div>
  );
};

const MatchWeightsEditor = ({ weights, onChange }: { weights: typeof DEFAULT_MATCH_WEIGHTS; onChange: (w: typeof DEFAULT_MATCH_WEIGHTS) => void }) => {
  const total = weights.skills + weights.location + weights.salary + weights.jobType + weights.bonus;
  const categories = [
    { key: "skills" as const, label: "🎯 Skills", color: "text-green-600" },
    { key: "location" as const, label: "📍 Location", color: "text-blue-600" },
    { key: "salary" as const, label: "💰 Salary", color: "text-yellow-600" },
    { key: "jobType" as const, label: "💼 Job Type", color: "text-purple-600" },
    { key: "bonus" as const, label: "🎁 Bonus", color: "text-pink-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Info className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Adjust how important each factor is. Total should be 100.</p>
      </div>
      {categories.map(({ key, label, color }) => (
        <div key={key} className="space-y-1">
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${color}`}>{label}</span>
            <span className="text-sm font-bold text-foreground">{weights[key]}</span>
          </div>
          <Slider value={[weights[key]]} onValueChange={([val]) => onChange({ ...weights, [key]: val })} max={60} min={0} step={5} />
        </div>
      ))}
      <div className={`text-sm font-semibold text-center py-2 rounded-lg ${total === 100 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
        Total: {total} / 100 {total !== 100 && "(adjust to equal 100)"}
      </div>
    </div>
  );
};

const ProfileEdit = () => {
  const { activeAvatar, updateAvatar } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<AvatarProfile>(
    activeAvatar || {
      id: "",
      name: "",
      fullName: "",
      gender: undefined,
      age: undefined,
      country: "",
      languages: [],
      workExperience: "",
      experienceLevel: "any",
      profession: "",
      skills: [],
      preferredJobType: "Full-time",
      preferredCountries: [],
      salaryMin: 0,
      salaryMax: 0,
      housingPreference: false,
      personality: undefined,
      certifications: [],
      desiredBonuses: [],
      matchWeights: { ...DEFAULT_MATCH_WEIGHTS },
    }
  );

  const update = <K extends keyof AvatarProfile>(key: K, val: AvatarProfile[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  if (!activeAvatar) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No avatar selected.</p>
          <Button onClick={() => navigate("/onboarding")}>Create Avatar</Button>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    updateAvatar(form);
    toast({ title: "Profile updated!", description: "Your avatar profile has been saved." });
    navigate("/dashboard");
  };

  const countryOptions = COUNTRIES.map((c) => ({ value: c.value, label: c.label }));

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
          <p className="text-muted-foreground text-sm">Complete your profile to get better job matches</p>
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
              <Label>Avatar Name</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Norway Avatar" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <SimpleTagSelector options={GENDERS} selected={form.gender ? [form.gender] : []} onChange={(v) => update("gender", v[v.length - 1] || undefined)} single />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Age</Label>
              <Input type="number" value={form.age ?? ""} onChange={(e) => update("age", e.target.value ? Number(e.target.value) : undefined)} />
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

        {/* Job Preferences */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Job Preferences</h2>
          <div className="space-y-2">
            <Label>Preferred Job Type</Label>
            <SimpleTagSelector options={JOB_TYPES} selected={[form.preferredJobType]} onChange={(v) => update("preferredJobType", v[v.length - 1] || "Full-time")} single />
          </div>
          <div className="space-y-2">
            <Label>Preferred Countries</Label>
            <TagSelector options={countryOptions} selected={form.preferredCountries} onChange={(v) => update("preferredCountries", v)} />
          </div>
          <div className="space-y-2">
            <Label>Salary Expectation (€/year)</Label>
            <div className="flex gap-3 items-center">
              <Input type="number" value={form.salaryMin || ""} onChange={(e) => update("salaryMin", Number(e.target.value))} className="w-28" placeholder="Min" />
              <span className="text-muted-foreground">to</span>
              <Input type="number" value={form.salaryMax || ""} onChange={(e) => update("salaryMax", Number(e.target.value))} className="w-28" placeholder="Max" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Desired Bonuses</Label>
            <TagSelector options={JOB_BONUSES} selected={form.desiredBonuses} onChange={(v) => update("desiredBonuses", v)} />
          </div>
        </section>

        {/* Lifestyle */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Lifestyle & Tone</h2>
          <div className="space-y-2">
            <Label>Communication Tone</Label>
            <SimpleTagSelector options={PERSONALITY_TONES} selected={form.personality ? [form.personality] : []} onChange={(v) => update("personality", v[v.length - 1] || undefined)} single />
          </div>
          <div className="space-y-2">
            <Label>Housing needed?</Label>
            <button type="button" onClick={() => update("housingPreference", !form.housingPreference)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${form.housingPreference ? "bg-accent-gradient text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {form.housingPreference ? "Yes, I need housing" : "No, I have my own"}
            </button>
          </div>
        </section>

        {/* Match Weights */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Match Priority</h2>
          <p className="text-xs text-muted-foreground">Customize what matters most for your job matching.</p>
          <MatchWeightsEditor weights={form.matchWeights} onChange={(w) => update("matchWeights", w)} />
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
