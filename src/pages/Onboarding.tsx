import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser, AvatarProfile, DEFAULT_MATCH_WEIGHTS } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Check, X } from "lucide-react";
import { COUNTRIES } from "@/constants/countries";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

const Onboarding = () => {
  const { addAvatar } = useUser();
  const navigate = useNavigate();

  const [form, setForm] = useState<AvatarProfile>({
    id: crypto.randomUUID(),
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
  });

  const update = <K extends keyof AvatarProfile>(key: K, val: AvatarProfile[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const canFinish = form.fullName.length > 0 && form.country.length > 0;

  const handleFinish = () => {
    const avatar = {
      ...form,
      name: form.fullName + " Avatar",
    };
    addAvatar(avatar);
    navigate("/dashboard");
  };

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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-elevated rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent-gradient flex items-center justify-center">
              <Bot className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Create Your Avatar</h2>
              <p className="text-muted-foreground text-sm">
                Start with basics — you can complete your profile later
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="flex flex-wrap gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => update("gender", form.gender === g ? undefined : g)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      form.gender === g
                        ? "bg-accent-gradient text-accent-foreground shadow-sm"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {g}
                    {form.gender === g && <Check className="w-3 h-3 inline ml-1" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Age</Label>
                <Input
                  type="number"
                  value={form.age ?? ""}
                  onChange={(e) => update("age", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="25"
                />
              </div>
              <div className="space-y-2">
                <Label>Country of Origin *</Label>
                <select
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-secondary/30 rounded-lg p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">💡 Complete your profile later</p>
              <p>
                After creating your avatar, you can add languages, skills, work experience,
                job preferences and more. Your profile completion percentage will guide you.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-8">
            <Button
              onClick={handleFinish}
              disabled={!canFinish}
              className="bg-accent-gradient text-accent-foreground hover:opacity-90"
            >
              Create Avatar
              <Check className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Onboarding;
