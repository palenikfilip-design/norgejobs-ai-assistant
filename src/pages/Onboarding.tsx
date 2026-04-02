import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, AvatarProfile, DEFAULT_MATCH_WEIGHTS } from "@/context/UserContext";
import type { LanguageWithLevel } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Bot, ArrowRight, ArrowLeft, Check, X, Plus, Trash2, Info } from "lucide-react";
import { COUNTRIES } from "@/constants/countries";
import { LANGUAGES, LANGUAGE_LEVELS, EXPERIENCE_LEVELS, PROFESSION_CATEGORIES, JOB_BONUSES } from "@/constants/jobRequirements";

const JOB_TYPES = ["Full-time", "Part-time", "Seasonal", "Remote"];
const PERSONALITY_TONES = ["Professional", "Friendly", "Direct"];

const TagSelector = ({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = selected.includes(opt.value);
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() =>
            onChange(active ? selected.filter((s) => s !== opt.value) : [...selected, opt.value])
          }
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
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = selected.includes(opt);
      return (
        <button
          key={opt}
          type="button"
          onClick={() =>
            onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])
          }
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

const SkillInput = ({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (val: string[]) => void;
}) => {
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
        {skills.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-secondary text-secondary-foreground"
          >
            {s}
            <button type="button" onClick={() => onChange(skills.filter((sk) => sk !== s))}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

const LanguageSelector = ({
  languages,
  onChange,
}: {
  languages: LanguageWithLevel[];
  onChange: (val: LanguageWithLevel[]) => void;
}) => {
  const addLanguage = () => {
    onChange([...languages, { language: "", level: "B1" }]);
  };
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
          <select
            value={lang.language}
            onChange={(e) => updateLang(i, "language", e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-1"
          >
            <option value="">Select language</option>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <select
            value={lang.level}
            onChange={(e) => updateLang(i, "level", e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-48"
          >
            {LANGUAGE_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <Button type="button" variant="ghost" size="icon" onClick={() => removeLang(i)}>
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addLanguage}>
        <Plus className="w-4 h-4 mr-1" /> Add Language
      </Button>
    </div>
  );
};

const MatchWeightsEditor = ({
  weights,
  onChange,
}: {
  weights: typeof DEFAULT_MATCH_WEIGHTS;
  onChange: (w: typeof DEFAULT_MATCH_WEIGHTS) => void;
}) => {
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
        <p className="text-xs text-muted-foreground">
          Adjust how important each factor is for your job matching. Total should be 100.
        </p>
      </div>
      {categories.map(({ key, label, color }) => (
        <div key={key} className="space-y-1">
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${color}`}>{label}</span>
            <span className="text-sm font-bold text-foreground">{weights[key]}</span>
          </div>
          <Slider
            value={[weights[key]]}
            onValueChange={([val]) => onChange({ ...weights, [key]: val })}
            max={60}
            min={0}
            step={5}
          />
        </div>
      ))}
      <div className={`text-sm font-semibold text-center py-2 rounded-lg ${total === 100 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
        Total: {total} / 100 {total !== 100 && "(adjust to equal 100)"}
      </div>
    </div>
  );
};

const TOTAL_STEPS = 6;

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const { addAvatar } = useUser();
  const navigate = useNavigate();

  const [form, setForm] = useState<AvatarProfile>({
    id: crypto.randomUUID(),
    name: "",
    fullName: "",
    age: undefined,
    country: "",
    languages: [],
    workExperience: "",
    experienceLevel: "any",
    profession: "",
    skills: [],
    preferredJobType: "Full-time",
    preferredCountries: [],
    salaryMin: 25000,
    salaryMax: 60000,
    housingPreference: false,
    personality: undefined,
    desiredBonuses: [],
    matchWeights: { ...DEFAULT_MATCH_WEIGHTS },
  });

  const update = <K extends keyof AvatarProfile>(key: K, val: AvatarProfile[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const canNext = () => {
    if (step === 0) return form.fullName.length > 0 && form.country.length > 0;
    if (step === 1) return form.languages.length > 0 && form.languages.every(l => l.language);
    if (step === 2) return form.profession.length > 0;
    if (step === 3) return form.preferredCountries.length > 0;
    if (step === 4) return true; // personality is optional
    if (step === 5) {
      const total = form.matchWeights.skills + form.matchWeights.location + form.matchWeights.salary + form.matchWeights.jobType + form.matchWeights.bonus;
      return total === 100 && form.name.length > 0;
    }
    return true;
  };

  const handleFinish = () => {
    addAvatar(form);
    navigate("/dashboard");
  };

  const countryOptions = COUNTRIES.map((c) => ({ value: c.value, label: c.label }));

  const steps = [
    // Step 0: Basics
    <div key="basics" className="space-y-5">
      <div className="space-y-2">
        <Label>Full Name *</Label>
        <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Your full name" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Age (optional)</Label>
          <Input type="number" value={form.age ?? ""} onChange={(e) => update("age", e.target.value ? Number(e.target.value) : undefined)} placeholder="25" />
        </div>
        <div className="space-y-2">
          <Label>Country of Origin *</Label>
          <Input value={form.country} onChange={(e) => update("country", e.target.value)} placeholder="e.g. Poland" />
        </div>
      </div>
    </div>,

    // Step 1: Languages
    <div key="languages" className="space-y-5">
      <div className="space-y-2">
        <Label>Languages & Levels *</Label>
        <p className="text-xs text-muted-foreground">Add each language you speak with your proficiency level</p>
        <LanguageSelector languages={form.languages} onChange={(v) => update("languages", v)} />
      </div>
    </div>,

    // Step 2: Experience & Skills
    <div key="experience" className="space-y-5">
      <div className="space-y-2">
        <Label>Profession Category *</Label>
        <TagSelector options={PROFESSION_CATEGORIES} selected={form.profession ? [form.profession] : []} onChange={(v) => update("profession", v[v.length - 1] || "")} />
      </div>
      <div className="space-y-2">
        <Label>Experience Level</Label>
        <TagSelector options={EXPERIENCE_LEVELS} selected={[form.experienceLevel]} onChange={(v) => update("experienceLevel", v[v.length - 1] || "any")} />
      </div>
      <div className="space-y-2">
        <Label>Work Experience</Label>
        <Textarea
          value={form.workExperience}
          onChange={(e) => update("workExperience", e.target.value)}
          placeholder="Briefly describe your work experience..."
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Skills</Label>
        <SkillInput skills={form.skills} onChange={(v) => update("skills", v)} />
      </div>
    </div>,

    // Step 3: Preferences
    <div key="preferences" className="space-y-5">
      <div className="space-y-2">
        <Label>Preferred Job Type</Label>
        <SimpleTagSelector options={JOB_TYPES} selected={[form.preferredJobType]} onChange={(v) => update("preferredJobType", v[v.length - 1] || "Full-time")} />
      </div>
      <div className="space-y-2">
        <Label>Preferred Countries *</Label>
        <p className="text-xs text-muted-foreground">💡 Tip: Create separate avatars for different countries for better matching!</p>
        <TagSelector options={countryOptions} selected={form.preferredCountries} onChange={(v) => update("preferredCountries", v)} />
      </div>
      <div className="space-y-2">
        <Label>Salary Expectation (€/year)</Label>
        <div className="flex gap-3 items-center">
          <Input type="number" value={form.salaryMin} onChange={(e) => update("salaryMin", Number(e.target.value))} className="w-28" />
          <span className="text-muted-foreground">to</span>
          <Input type="number" value={form.salaryMax} onChange={(e) => update("salaryMax", Number(e.target.value))} className="w-28" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Desired Bonuses</Label>
        <TagSelector options={JOB_BONUSES} selected={form.desiredBonuses} onChange={(v) => update("desiredBonuses", v)} />
      </div>
    </div>,

    // Step 4: Lifestyle & Tone
    <div key="lifestyle" className="space-y-5">
      <div className="space-y-2">
        <Label>Communication Tone</Label>
        <p className="text-xs text-muted-foreground">How should your AI avatar talk to you?</p>
        <SimpleTagSelector
          options={PERSONALITY_TONES}
          selected={form.personality ? [form.personality] : []}
          onChange={(v) => update("personality", v[v.length - 1] || undefined)}
        />
      </div>
      <div className="space-y-2">
        <Label>Housing needed?</Label>
        <button
          type="button"
          onClick={() => update("housingPreference", !form.housingPreference)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            form.housingPreference ? "bg-accent-gradient text-accent-foreground" : "bg-secondary text-secondary-foreground"
          }`}
        >
          {form.housingPreference ? "Yes, I need housing" : "No, I have my own"}
        </button>
      </div>
    </div>,


    // Step 5: Match Weights & Finalize
    <div key="finalize" className="space-y-5">
      <div className="space-y-2">
        <Label>Avatar Name *</Label>
        <p className="text-xs text-muted-foreground">Give this avatar a name (e.g. "Norway Jobs", "Remote Developer")</p>
        <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder='e.g. "My Norway Avatar"' />
      </div>

      <div className="space-y-2">
        <Label>Match Priority</Label>
        <p className="text-xs text-muted-foreground">
          Customize what matters most to you. E.g. moving to Norway without specific skills? Put more weight on Location!
        </p>
        <MatchWeightsEditor weights={form.matchWeights} onChange={(w) => update("matchWeights", w)} />
      </div>

      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-accent-gradient flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">{form.name || "Your AI Avatar"}</h3>
            <p className="text-xs text-muted-foreground">AI Summary</p>
          </div>
        </div>
        <div className="text-sm text-foreground/80 leading-relaxed bg-secondary/30 rounded-lg p-3 italic">
          "{form.fullName || "You"} is a motivated {PROFESSION_CATEGORIES.find(p => p.value === form.profession)?.label?.toLowerCase() || "professional"}{form.skills.length > 0 ? `, skilled in ${form.skills.slice(0, 3).join(", ")}` : ""}, looking for {form.preferredJobType.toLowerCase()} opportunities{form.preferredCountries.length > 0 ? ` in ${form.preferredCountries.join(" and ")}` : " abroad"}, with a salary expectation of €{form.salaryMin.toLocaleString()} – €{form.salaryMax.toLocaleString()}/year.{form.housingPreference ? " Housing assistance is important." : ""}{form.personality ? ` Communication style: ${form.personality.toLowerCase()}.` : ""}"
        </div>
      </div>
    </div>,
  ];

  const stepTitles = ["About You", "Languages", "Experience & Skills", "Job Preferences", "Lifestyle & Tone", "Finalize Avatar"];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
      >
        <X className="w-5 h-5" />
      </Button>

      <div className="w-full max-w-lg">
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= step ? "bg-accent-gradient" : "bg-border"
              }`}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-elevated rounded-2xl p-8 max-h-[75vh] overflow-y-auto"
        >
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-foreground">
              {stepTitles[step]}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Step {step + 1} of {TOTAL_STEPS}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            {step < TOTAL_STEPS - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="bg-accent-gradient text-accent-foreground hover:opacity-90"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={!canNext()}
                className="bg-accent-gradient text-accent-foreground hover:opacity-90"
              >
                Create Avatar
                <Check className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Onboarding;
