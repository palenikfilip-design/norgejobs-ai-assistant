import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser, SearchPreset, DEFAULT_MATCH_WEIGHTS, defaultPreset } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Check, Save, Info, Home, Plane, Wifi, Globe, Building2 } from "lucide-react";
import { COUNTRIES } from "@/constants/countries";
import { JOB_BONUSES } from "@/constants/jobRequirements";
import { JOB_SOURCE_CATALOG } from "@/data/jobSources";
import { useToast } from "@/hooks/use-toast";
import { hasLifestyleData } from "@/types/lifestyleProfile";
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

const JOB_TYPES = ["Full-time", "Part-time", "Seasonal", "Remote"];

const SCOPE_TABS: { value: SearchPreset["preferredSourceScope"]; label: string; icon: typeof Home }[] = [
  { value: "around_me", label: "Home", icon: Home },
  { value: "abroad", label: "Abroad", icon: Plane },
  { value: "remote", label: "Remote", icon: Wifi },
  { value: "all", label: "All", icon: Globe },
];

const SCOPE_HERO: { value: SearchPreset["preferredSourceScope"]; label: string; desc: string; icon: typeof Home }[] = [
  { value: "around_me", label: "Home", desc: "Práce v mé zemi — typicky dlouhodobé pozice", icon: Home },
  { value: "abroad", label: "Abroad", desc: "Práce v cizině — často sezónní / krátkodobé", icon: Plane },
  { value: "remote", label: "Remote", desc: "Práce odkudkoliv — distanční role", icon: Wifi },
  { value: "all", label: "All", desc: "Vše dohromady, bez geografického omezení", icon: Globe },
];

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
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            active ? "bg-accent-gradient text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
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
            if (single) onChange(active ? [] : [opt]);
            else onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt]);
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            active ? "bg-accent-gradient text-accent-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {opt}
          {active && <Check className="w-3 h-3 inline ml-1" />}
        </button>
      );
    })}
  </div>
);

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
        <p className="text-xs text-muted-foreground">Adjust how important each factor is for this preset. Total should be 100.</p>
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

const PresetEdit = () => {
  const { user, addPreset, updatePreset } = useUser();
  const hasLifestyle = hasLifestyleData(user.profile.lifestyleProfile);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();

  const isNew = !id || id === "new";
  const existing = !isNew ? user.presets.find(p => p.id === id) : null;

  const [form, setForm] = useState<SearchPreset>(
    existing || {
      id: crypto.randomUUID(),
      ...defaultPreset,
    }
  );
  const [saved, setSaved] = useState(false);

  const initialForm = useMemo(() => existing || { id: form.id, ...defaultPreset }, []);

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Note: in-app navigation blocking requires a data router; we keep only the
  // browser-level beforeunload guard above. Dialog stays unused for now.
  const blocker = { state: "unblocked" as const, reset: () => {}, proceed: () => {} };

  const update = <K extends keyof SearchPreset>(key: K, val: SearchPreset[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const canSave = form.name.length > 0;

  const handleSave = () => {
    setSaved(true);
    if (isNew || !existing) {
      addPreset(form);
      toast({ title: "Preset created!", description: `"${form.name}" has been added to your library.` });
    } else {
      updatePreset(form);
      toast({ title: "Preset updated!", description: `"${form.name}" has been saved.` });
    }
    navigate("/dashboard");
  };

  const countryOptions = COUNTRIES.map((c) => ({ value: c.value, label: c.label }));

  const userCountryLower = (user.profile.country || "").trim().toLowerCase();
  const portalsByScope: Record<SearchPreset["preferredSourceScope"], typeof JOB_SOURCE_CATALOG> = {
    around_me: JOB_SOURCE_CATALOG.filter((s) =>
      userCountryLower && s.countries.some((c) => c.toLowerCase() === userCountryLower)
    ),
    abroad: JOB_SOURCE_CATALOG.filter((s) =>
      !userCountryLower || !s.countries.some((c) => c.toLowerCase() === userCountryLower)
    ),
    remote: JOB_SOURCE_CATALOG.filter((s) => ["linkedin", "indeed", "eures"].includes(s.id)),
    all: JOB_SOURCE_CATALOG,
  };
  const visiblePortals = portalsByScope[form.preferredSourceScope];

  const togglePortal = (id: string) => {
    const next = form.preferredSources.includes(id)
      ? form.preferredSources.filter((s) => s !== id)
      : [...form.preferredSources, id];
    update("preferredSources", next);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave} className="bg-accent-gradient text-accent-foreground hover:opacity-90">
            <Save className="w-4 h-4 mr-1" /> {isNew ? "Create Preset" : "Save Changes"}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {isNew ? "New Search Preset" : `Edit "${existing?.name}"`}
          </h1>
          <p className="text-muted-foreground text-sm">
            Define search preferences for a specific job market or goal
          </p>
        </motion.div>

        {/* Preset Name */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Preset Name</h2>
          <Input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Norway Jobs, Germany Tech, Remote Work..."
          />
        </section>

        {/* Search Scope — primary filter */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground">Kde chceš pracovat?</h2>
            <InfoTooltip content="Hlavní filtr presetu. Home = nabídky v tvé zemi (převážně dlouhodobé). Abroad = nabídky v cizině (často sezónní). Remote = bez ohledu na zemi." />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SCOPE_HERO.map(({ value, label, desc, icon: Icon }) => {
              const active = form.preferredSourceScope === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => update("preferredSourceScope", value)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    active
                      ? "bg-accent-gradient text-accent-foreground border-transparent shadow-md"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} />
                    <span className="font-semibold text-sm">{label}</span>
                    {active && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </div>
                  <p className={`text-[11px] leading-snug ${active ? "opacity-90" : "text-muted-foreground"}`}>
                    {desc}
                  </p>
                </button>
              );
            })}
          </div>
          {form.preferredSourceScope === "around_me" && !user.profile.country && (
            <p className="text-xs text-yellow-500">⚠️ Doplň si zemi v profilu, aby Home filtr fungoval správně.</p>
          )}
        </section>

        {/* Job Preferences */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Job Preferences</h2>
          <div className="space-y-2">
            <Label>Preferred Job Type</Label>
            <SimpleTagSelector options={JOB_TYPES} selected={[form.preferredJobType]} onChange={(v) => update("preferredJobType", v[v.length - 1] || "Full-time")} single />
          </div>
          <div className="space-y-2">
            <Label>Target Countries</Label>
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
          <div className="space-y-2">
            <Label>Housing needed?</Label>
            <button type="button" onClick={() => update("housingPreference", !form.housingPreference)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${form.housingPreference ? "bg-accent-gradient text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {form.housingPreference ? "Yes, I need housing" : "No, I have my own"}
            </button>
          </div>
        </section>

        {/* Portals */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-foreground">Portals</h2>
            <InfoTooltip content="Choose which job portals this preset should search. Around me uses portals from your profile country." />
          </div>
          <div className="flex flex-wrap gap-1.5 p-1 bg-muted rounded-lg w-fit">
            {SCOPE_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => update("preferredSourceScope", value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  form.preferredSourceScope === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
          {visiblePortals.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {form.preferredSourceScope === "around_me" && !user.profile.country
                ? "Set your country in profile to see local portals."
                : "No portals available in this scope."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visiblePortals.map((p) => {
                const active = form.preferredSources.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePortal(p.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {p.name}
                    {active && <Check className="w-3 h-3 inline ml-1" />}
                  </button>
                );
              })}
            </div>
          )}
          {form.preferredSources.length > 0 && (
            <button
              type="button"
              onClick={() => update("preferredSources", [])}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear portal selection
            </button>
          )}
        </section>

        {/* Lifestyle Matching */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground">🧬 Lifestyle Matching</h2>
            <InfoTooltip content="When enabled, your lifestyle data (family, availability, flexibility) influences job match scores. Set the weight to control how much it matters." />
          </div>
          {!hasLifestyle && (
            <p className="text-xs text-yellow-500">⚠️ Fill your lifestyle profile first to enable this feature.</p>
          )}
          <div className="flex items-center gap-3">
            <Switch
              checked={form.useLifestyleMatching && hasLifestyle}
              disabled={!hasLifestyle}
              onCheckedChange={(v) => update("useLifestyleMatching", v)}
            />
            <span className="text-sm text-foreground">Include lifestyle data in matching</span>
          </div>
          {form.useLifestyleMatching && hasLifestyle && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Lifestyle importance</span>
                <span className="text-sm font-bold text-foreground">{form.lifestyleWeight}%</span>
              </div>
              <Slider
                value={[form.lifestyleWeight]}
                onValueChange={([val]) => update("lifestyleWeight", val)}
                max={50}
                min={0}
                step={5}
              />
              <p className="text-xs text-muted-foreground">0% = ignored, 50% = half of match score comes from lifestyle fit</p>
            </div>
          )}
        </section>

        {/* Match Weights */}
        <section className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Match Priority</h2>
          <p className="text-xs text-muted-foreground">Customize what matters most for this search preset.</p>
          <MatchWeightsEditor weights={form.matchWeights} onChange={(w) => update("matchWeights", w)} />
        </section>

        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={handleSave} disabled={!canSave} className="bg-accent-gradient text-accent-foreground hover:opacity-90">
            <Save className="w-4 h-4 mr-1" /> {isNew ? "Create Preset" : "Save Changes"}
          </Button>
        </div>
      </main>

      <AlertDialog open={false}>
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

export default PresetEdit;
