import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, AvatarProfile } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bot, ArrowRight, ArrowLeft, Check, X } from "lucide-react";

const COUNTRIES = ["Norway", "Germany", "Austria", "Sweden", "Denmark", "Finland", "Netherlands", "Switzerland"];
const LANGUAGES = ["English", "Norwegian", "German", "Polish", "Spanish", "French", "Ukrainian", "Romanian", "Arabic"];
const JOB_TYPES = ["Full-time", "Part-time", "Seasonal"];
const PERSONALITY_OPTIONS = ["Introvert", "Extrovert", "Structured", "Flexible"];

const TagSelector = ({
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

const TOTAL_STEPS = 4;

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const { setAvatar } = useUser();
  const navigate = useNavigate();

  const [form, setForm] = useState<AvatarProfile>({
    fullName: "",
    age: undefined,
    country: "",
    languages: [],
    workExperience: "",
    skills: [],
    preferredJobType: "Full-time",
    preferredCountries: [],
    salaryMin: 25000,
    salaryMax: 60000,
    housingPreference: false,
    personality: undefined,
  });

  const update = <K extends keyof AvatarProfile>(key: K, val: AvatarProfile[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const canNext = () => {
    if (step === 0) return form.fullName.length > 0 && form.country.length > 0;
    if (step === 1) return form.languages.length > 0;
    if (step === 2) return form.skills.length > 0;
    return form.preferredCountries.length > 0;
  };

  const handleFinish = () => {
    setAvatar(form);
    navigate("/dashboard");
  };

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
      <div className="space-y-2">
        <Label>Languages *</Label>
        <TagSelector options={LANGUAGES} selected={form.languages} onChange={(v) => update("languages", v)} />
      </div>
    </div>,

    // Step 1: Experience
    <div key="experience" className="space-y-5">
      <div className="space-y-2">
        <Label>Work Experience</Label>
        <Textarea
          value={form.workExperience}
          onChange={(e) => update("workExperience", e.target.value)}
          placeholder="Briefly describe your work experience, or paste your CV summary..."
          rows={5}
        />
      </div>
      <div className="space-y-2">
        <Label>Skills *</Label>
        <SkillInput skills={form.skills} onChange={(v) => update("skills", v)} />
      </div>
    </div>,

    // Step 2: Preferences
    <div key="preferences" className="space-y-5">
      <div className="space-y-2">
        <Label>Preferred Job Type</Label>
        <div className="flex gap-2">
          {JOB_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update("preferredJobType", t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                form.preferredJobType === t
                  ? "bg-accent-gradient text-accent-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Preferred Countries *</Label>
        <TagSelector options={COUNTRIES} selected={form.preferredCountries} onChange={(v) => update("preferredCountries", v)} />
      </div>
      <div className="space-y-2">
        <Label>Salary Expectation (€/year)</Label>
        <div className="flex gap-3 items-center">
          <Input type="number" value={form.salaryMin} onChange={(e) => update("salaryMin", Number(e.target.value))} className="w-28" />
          <span className="text-muted-foreground">to</span>
          <Input type="number" value={form.salaryMax} onChange={(e) => update("salaryMax", Number(e.target.value))} className="w-28" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Label>Need housing?</Label>
        <button
          type="button"
          onClick={() => update("housingPreference", !form.housingPreference)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            form.housingPreference ? "bg-accent-gradient text-accent-foreground" : "bg-secondary text-secondary-foreground"
          }`}
        >
          {form.housingPreference ? "Yes" : "No"}
        </button>
      </div>
    </div>,

    // Step 3: Personality
    <div key="personality" className="space-y-5">
      <div className="space-y-2">
        <Label>Personality (optional)</Label>
        <p className="text-sm text-muted-foreground">Help us understand your work style</p>
        <TagSelector
          options={PERSONALITY_OPTIONS}
          selected={form.personality ? [form.personality] : []}
          onChange={(v) => update("personality", v[v.length - 1] || undefined)}
        />
      </div>

      <div className="glass-card rounded-xl p-5 mt-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-accent-gradient flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Your AI Avatar</h3>
            <p className="text-xs text-muted-foreground">Preview</p>
          </div>
        </div>
        <div className="text-sm text-foreground/80 space-y-1">
          <p><strong>{form.fullName || "..."}</strong> from {form.country || "..."}</p>
          <p>Languages: {form.languages.join(", ") || "..."}</p>
          <p>Skills: {form.skills.join(", ") || "..."}</p>
          <p>Looking for: {form.preferredJobType} in {form.preferredCountries.join(", ") || "..."}</p>
          <p>Salary: €{form.salaryMin.toLocaleString()} – €{form.salaryMax.toLocaleString()}</p>
        </div>
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
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
          className="glass-card-elevated rounded-2xl p-8"
        >
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-foreground">
              {["About You", "Experience & Skills", "Job Preferences", "Almost Done!"][step]}
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
