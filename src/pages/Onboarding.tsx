import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, defaultProfile, type UserProfile } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Bot, Check, X, ChevronRight, ChevronLeft, Sparkles, Plus } from "lucide-react";
import { COUNTRIES } from "@/constants/countries";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const LANG_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const EXP_LEVELS = ["Entry", "Junior", "Mid", "Senior", "Lead"];
const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Seasonal"];
const PERSONALITIES = ["Professional", "Friendly", "Direct"];

const TOTAL_STEPS = 5;

const Onboarding = () => {
  const { updateProfile, setOnboarded } = useUser();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<UserProfile>({ ...defaultProfile });
  const [newLang, setNewLang] = useState("");
  const [newLangLevel, setNewLangLevel] = useState("B1");
  const [newSkill, setNewSkill] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  const update = <K extends keyof UserProfile>(key: K, val: UserProfile[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const addLanguage = () => {
    if (!newLang.trim()) return;
    update("languages", [...form.languages, { language: newLang.trim(), level: newLangLevel }]);
    setNewLang("");
    setNewLangLevel("B1");
  };

  const removeLanguage = (idx: number) => {
    update("languages", form.languages.filter((_, i) => i !== idx));
  };

  const addSkill = () => {
    if (!newSkill.trim() || form.skills.includes(newSkill.trim())) return;
    update("skills", [...form.skills, newSkill.trim()]);
    setNewSkill("");
  };

  const removeSkill = (s: string) => update("skills", form.skills.filter((x) => x !== s));

  const canNext = () => {
    if (step === 1) return form.fullName.length > 0 && form.country.length > 0;
    return true;
  };

  const handleFinish = () => {
    updateProfile(form);
    setShowSummary(true);
  };

  const handleGoToDashboard = () => {
    setOnboarded();
    navigate("/dashboard");
  };

  const progress = showSummary ? 100 : Math.round((step / TOTAL_STEPS) * 100);
  const firstName = form.fullName.split(" ")[0] || "there";

  // Generate AI summary text
  const summaryText = `You are a ${form.personality?.toLowerCase() || "motivated"} ${form.experienceLevel !== "any" ? form.experienceLevel + "-level" : ""} professional${form.profession ? ` in ${form.profession}` : ""}${form.skills.length > 0 ? ` with skills in ${form.skills.slice(0, 3).join(", ")}` : ""}, looking for ${form.languages.length > 0 ? "international " : ""}opportunities${form.country ? ` from ${form.country}` : ""}. ${form.languages.length > 0 ? `You speak ${form.languages.map(l => `${l.language} (${l.level})`).join(", ")}.` : ""}`;

  if (showSummary) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg"
        >
          <div className="glass-card-elevated rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-gradient flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-accent-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Hi {firstName}, your AI avatar is ready! 🎉
            </h2>
            <p className="text-muted-foreground mb-6">I found your first job matches.</p>

            <div className="bg-secondary/30 rounded-xl p-4 text-left mb-6 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-foreground">Leslie AI says:</span>
              </div>
              <p className="text-sm text-foreground/80 italic">"{summaryText}"</p>
            </div>

            <Button onClick={handleGoToDashboard} className="bg-accent-gradient text-accent-foreground hover:opacity-90 w-full">
              Go to Dashboard
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

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
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step} of {TOTAL_STEPS}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="glass-card-elevated rounded-2xl p-8"
          >
            {/* STEP 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-5">
                <StepHeader icon={<Bot />} title="Basic Info" subtitle="Let's start with the basics" />
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Your full name" />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <div className="flex flex-wrap gap-2">
                    {GENDERS.map((g) => (
                      <ChipButton key={g} selected={form.gender === g} onClick={() => update("gender", form.gender === g ? undefined : g)} label={g} />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Age</Label>
                    <Input type="number" value={form.age ?? ""} onChange={(e) => update("age", e.target.value ? Number(e.target.value) : undefined)} placeholder="25" />
                  </div>
                  <div className="space-y-2">
                    <Label>Country of Origin *</Label>
                    <select value={form.country} onChange={(e) => update("country", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Languages</Label>
                  <div className="flex gap-2">
                    <Input value={newLang} onChange={(e) => setNewLang(e.target.value)} placeholder="e.g. English" className="flex-1" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLanguage())} />
                    <select value={newLangLevel} onChange={(e) => setNewLangLevel(e.target.value)} className="w-20 rounded-md border border-input bg-background px-2 text-sm">
                      {LANG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <Button type="button" size="icon" variant="outline" onClick={addLanguage}><Plus className="w-4 h-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.languages.map((l, i) => (
                      <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeLanguage(i)}>
                        {l.language} ({l.level}) <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Work Profile */}
            {step === 2 && (
              <div className="space-y-5">
                <StepHeader icon={<Bot />} title="Work Profile" subtitle="Tell me about your experience" />
                <div className="space-y-2">
                  <Label>Profession / Field</Label>
                  <Input value={form.profession} onChange={(e) => update("profession", e.target.value)} placeholder="e.g. Software Developer, Logistics" />
                </div>
                <div className="space-y-2">
                  <Label>Skills</Label>
                  <div className="flex gap-2">
                    <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="e.g. JavaScript, Forklift" className="flex-1" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
                    <Button type="button" size="icon" variant="outline" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.skills.map((s) => (
                      <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => removeSkill(s)}>
                        {s} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Experience Level</Label>
                  <div className="flex flex-wrap gap-2">
                    {EXP_LEVELS.map((l) => (
                      <ChipButton key={l} selected={form.experienceLevel === l} onClick={() => update("experienceLevel", l)} label={l} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Work Experience (brief description)</Label>
                  <textarea value={form.workExperience} onChange={(e) => update("workExperience", e.target.value)} placeholder="Briefly describe your work history..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-none" />
                </div>
              </div>
            )}

            {/* STEP 3: Job Preferences — now handled via search presets, show hint */}
            {step === 3 && (
              <div className="space-y-5">
                <StepHeader icon={<Bot />} title="Job Preferences" subtitle="You'll set these up as Search Presets after onboarding" />
                <div className="bg-secondary/30 rounded-lg p-4 text-sm text-muted-foreground border border-border/30">
                  <p className="font-medium text-foreground mb-1">💡 Search Presets</p>
                  <p>
                    After creating your profile, you'll create <span className="font-semibold text-foreground">Search Presets</span> — 
                    each one targets a specific job market (e.g. "Norway Tech", "Germany Logistics").
                  </p>
                  <p className="mt-2">Each preset lets you set:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Target countries</li>
                    <li>Salary expectations (any currency)</li>
                    <li>Job type preference</li>
                    <li>Custom match weight priorities</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label>Certifications (optional)</Label>
                  <Input
                    placeholder="e.g. IELTS, AWS, Driving License"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !form.certifications.includes(val)) {
                          update("certifications", [...form.certifications, val]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {form.certifications.map((c) => (
                      <Badge key={c} variant="secondary" className="cursor-pointer" onClick={() => update("certifications", form.certifications.filter(x => x !== c))}>
                        {c} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Lifestyle */}
            {step === 4 && (
              <div className="space-y-5">
                <StepHeader icon={<Bot />} title="Lifestyle & Preferences" subtitle="Help me understand what matters to you" />
                <div className="space-y-4">
                  <ToggleQuestion label="Are you open to physical / manual work?" value={form.workExperience.includes("[physical:yes]")} onChange={(v) => {
                    const base = form.workExperience.replace(/\[physical:(yes|no)\]/g, "").trim();
                    update("workExperience", v ? `${base} [physical:yes]` : `${base} [physical:no]`);
                  }} />
                </div>
                <div className="bg-secondary/30 rounded-lg p-4 text-sm text-muted-foreground border border-border/30">
                  <p className="font-medium text-foreground mb-1">🏠 Housing & Remote preferences</p>
                  <p>These options are available per Search Preset, so you can have different preferences for different countries.</p>
                </div>
              </div>
            )}

            {/* STEP 5: Personality */}
            {step === 5 && (
              <div className="space-y-5">
                <StepHeader icon={<Sparkles />} title="Avatar Personality" subtitle="Choose how Leslie AI communicates with you" />
                <div className="space-y-3">
                  {PERSONALITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => update("personality", p)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        form.personality === p
                          ? "border-accent bg-accent/10 shadow-sm"
                          : "border-border bg-secondary/20 hover:bg-secondary/40"
                      }`}
                    >
                      <span className="font-medium text-foreground">{p}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p === "Professional" && "Formal, structured advice and recommendations."}
                        {p === "Friendly" && "Warm, encouraging tone with helpful suggestions."}
                        {p === "Direct" && "Straight to the point, no fluff."}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="text-muted-foreground"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              {step < TOTAL_STEPS ? (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext()}
                  className="bg-accent-gradient text-accent-foreground hover:opacity-90"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={!canNext()}
                  className="bg-accent-gradient text-accent-foreground hover:opacity-90"
                >
                  Create My Avatar
                  <Check className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// Sub-components

function StepHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="w-10 h-10 rounded-xl bg-accent-gradient flex items-center justify-center">
        {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-accent-foreground" })}
      </div>
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

function ChipButton({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        selected
          ? "bg-accent-gradient text-accent-foreground shadow-sm"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      }`}
    >
      {label}
      {selected && <Check className="w-3 h-3 inline ml-1" />}
    </button>
  );
}

function ToggleQuestion({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
        value ? "border-accent bg-accent/10" : "border-border bg-secondary/20 hover:bg-secondary/40"
      }`}
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${value ? "bg-accent justify-end" : "bg-muted justify-start"}`}>
        <div className="w-4 h-4 rounded-full bg-background shadow mx-1" />
      </div>
    </button>
  );
}

import React from "react";

export default Onboarding;
