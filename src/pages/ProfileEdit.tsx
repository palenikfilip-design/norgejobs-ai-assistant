import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser, UserProfile, defaultProfile } from "@/context/UserContext";
import type { LanguageWithLevel } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, X, Plus, Trash2, Save } from "lucide-react";
import { COUNTRIES } from "@/constants/countries";
import { LANGUAGES, LANGUAGE_LEVELS, EXPERIENCE_LEVELS, PROFESSION_CATEGORIES } from "@/constants/jobRequirements";
import { useToast } from "@/hooks/use-toast";

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

const ProfileEdit = () => {
  const { user, updateProfile } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<UserProfile>({ ...user.profile });

  const update = <K extends keyof UserProfile>(key: K, val: UserProfile[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

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
