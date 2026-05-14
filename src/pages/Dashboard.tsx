import { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useUser, mergeProfilePreset } from "@/context/UserContext";
import { matchJobsEnhanced, type EnhancedJob } from "@/utils/jobMatching";
import { useLiveMatches, liveMatchToJob } from "@/hooks/useLiveMatches";
import EnhancedJobCard from "@/components/EnhancedJobCard";
import BlurredJobCard from "@/components/BlurredJobCard";
import PresetSwitcher from "@/components/PresetSwitcher";
import CoverLetterDialog from "@/components/CoverLetterDialog";
import ProfileCompletion from "@/components/ProfileCompletion";
import JobFiltersPanel from "@/components/JobFiltersPanel";
import QuickFilterBar, { defaultQuickFilters, type QuickFilters } from "@/components/QuickFilterBar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, LogOut, Sparkles, BriefcaseBusiness, Filter, Globe, Crown, Eye, Bookmark, Loader2, RefreshCw, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotificationsPopover from "@/components/NotificationsPopover";
import LeslieAvatar from "@/components/LeslieAvatar";
import { type JobFilters, defaultFilters } from "@/types/jobFilters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useJobInteractions } from "@/hooks/useJobInteractions";
import { usePreferenceProfile } from "@/hooks/usePreferenceProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { computeBehaviorScore } from "@/utils/behaviorLearning";
import PatternInsightsPanel from "@/components/PatternInsightsPanel";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { user, activeAvatars, activePresets, logout, supabaseUser, inactivityMinutes, setInactivityMinutes } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const profile = user.profile;
  const firstName = profile.fullName.split(" ")[0] || "there";

  const { access, canViewJob, remainingViews, recordJobView, useFreedUnlock } = useUserAccess(supabaseUser?.id ?? null);
  const { isActive: isPremium } = useSubscription(supabaseUser?.id ?? null);
  const { track } = useJobInteractions(supabaseUser?.id ?? null);
  const { interactions, preferences } = usePreferenceProfile(supabaseUser?.id ?? null, []);
  // Live AI-matched jobs from public APIs (MPSV, NAV) — no DB storage
  const avatarForMatching = useMemo(() => {
    if (!profile.profession && !profile.country) return null;
    const a = activeAvatars[0];
    return {
      profession: profile.profession,
      country: profile.country,
      languages: profile.languages,
      experience_level: profile.experienceLevel,
      preferred_countries: a?.preferredCountries ?? [],
      preferred_job_type: a?.preferredJobType ?? null,
      salary_min: a?.salaryMin ?? null,
      salary_max: a?.salaryMax ?? null,
      desired_bonuses: a?.desiredBonuses ?? [],
    };
  }, [activeAvatars, profile]);
  const { matches: liveMatches, loading: liveLoading, refresh: refreshLiveMatches, lastUpdated, newlyAdded, hiddenCount, activeCount } = useLiveMatches(avatarForMatching);
  const liveJobs = useMemo(() => liveMatches.map(liveMatchToJob), [liveMatches]);
  const allJobs = useMemo(() => liveJobs, [liveJobs]);

  // Toast when refresh adds new offers
  useEffect(() => {
    if (newlyAdded == null) return;
    toast({
      title: `Přidáno ${newlyAdded} nových nabídek`,
    });
  }, [newlyAdded, toast]);

  const [filters, setFilters] = useState<JobFilters>(defaultFilters);
  const [quickFilters, setQuickFilters] = useState<QuickFilters>(() => {
    if (typeof window === "undefined") return defaultQuickFilters;
    try {
      const raw = localStorage.getItem("leslie_filters");
      if (!raw) return defaultQuickFilters;
      const parsed = JSON.parse(raw);
      return {
        countries: Array.isArray(parsed.countries) ? parsed.countries : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        type: ["all", "seasonal", "permanent"].includes(parsed.type) ? parsed.type : "all",
      };
    } catch {
      return defaultQuickFilters;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("leslie_filters", JSON.stringify(quickFilters));
    } catch {
      // ignore quota errors
    }
  }, [quickFilters]);
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterJobTitle, setCoverLetterJobTitle] = useState("");
  const [coverLetterUsed, setCoverLetterUsed] = useState<number | null>(null);
  const [coverLetterLimit, setCoverLetterLimit] = useState<number | null>(null);
  const [coverLetterIsPremium, setCoverLetterIsPremium] = useState(false);
  const [coverLetterLimitReached, setCoverLetterLimitReached] = useState(false);
  const [viewedJobIds, setViewedJobIds] = useState<Set<string>>(new Set());
  const [highlightPresetId, setHighlightPresetId] = useState<string>("all");


  // Match jobs using all active presets, deduplicate by job id, keep best score
  const matchedJobs = useMemo((): EnhancedJob[] => {
    if (activeAvatars.length === 0) {
      return allJobs.map(j => ({
        ...j,
        matchScore: 70,
        matchDetails: [],
        matchReasons: ["General match based on your profile"],
        negativeSignals: [],
        matchReason: "General match.",
        aiSummary: j.description,
      }));
    }
    const userCountry = (profile.country || "").trim().toLowerCase();
    const scopeFilter = (jobs: typeof allJobs, scope: string) => {
      if (scope === "all") return jobs;
      if (scope === "remote") {
        return jobs.filter(j => j.country.toLowerCase() === "remote" || j.type.toLowerCase() === "remote");
      }
      if (scope === "around_me" && userCountry) {
        return jobs.filter(j => j.country.toLowerCase() === userCountry);
      }
      if (scope === "abroad" && userCountry) {
        return jobs.filter(j => j.country.toLowerCase() !== userCountry && j.country.toLowerCase() !== "remote");
      }
      return jobs;
    };
    const jobMap = new Map<string, EnhancedJob>();
    activePresets.forEach((preset, idx) => {
      const avatar = activeAvatars[idx];
      if (!avatar) return;
      const scoped = scopeFilter(allJobs, preset.preferredSourceScope || "all");
      const matched = matchJobsEnhanced(scoped, avatar);
      matched.forEach(job => {
        const existing = jobMap.get(job.id);
        if (!existing || job.matchScore > existing.matchScore) {
          jobMap.set(job.id, job);
        }
      });
    });
    const arr = Array.from(jobMap.values());
    if (!isPremium || (interactions.length === 0 && preferences.length === 0)) {
      return arr.sort((a, b) => b.matchScore - a.matchScore);
    }
    // Behavior-aware re-ranking (Premium): blend match (70%) + behavior (30%)
    return arr
      .map((j) => {
        const bScore = computeBehaviorScore(j, interactions, preferences, allJobs);
        const finalScore = Math.round(j.matchScore * 0.7 + bScore * 0.3);
        return { ...j, matchScore: finalScore };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [activeAvatars, activePresets, profile.country, isPremium, interactions, preferences, allJobs]);

  const filteredJobs = useMemo(() => {
    let jobs = matchedJobs;
    // Quick filters (compact bar above the advanced panel)
    if (quickFilters.countries.length > 0) {
      const set = new Set(quickFilters.countries.map((c) => c.toLowerCase()));
      jobs = jobs.filter((j) => set.has((j.country ?? "").toLowerCase()));
    }
    if (quickFilters.categories.length > 0) {
      const set = new Set(quickFilters.categories.map((c) => c.toLowerCase()));
      jobs = jobs.filter((j) => {
        const cat = (j as { category?: string | null }).category;
        return cat ? set.has(cat.toLowerCase()) : false;
      });
    }
    if (quickFilters.type !== "all") {
      jobs = jobs.filter((j) => {
        const seasonal = (j as { isSeasonal?: boolean | null }).isSeasonal;
        if (seasonal == null) {
          // Fallback to job.type text when explicit flag missing
          const t = (j.type || "").toLowerCase();
          const looksSeasonal = t.includes("seasonal") || t.includes("sezón");
          return quickFilters.type === "seasonal" ? looksSeasonal : !looksSeasonal;
        }
        return quickFilters.type === "seasonal" ? seasonal : !seasonal;
      });
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      jobs = jobs.filter(j => j.title.toLowerCase().includes(kw) || j.company.toLowerCase().includes(kw) || j.description.toLowerCase().includes(kw));
    }
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      jobs = jobs.filter(j => j.city.toLowerCase().includes(loc));
    }
    if (filters.countries.length > 0) {
      jobs = jobs.filter(j => filters.countries.some(c => c.toLowerCase() === j.country.toLowerCase()));
    }
    if (filters.jobType && filters.jobType !== "all") {
      jobs = jobs.filter(j => j.type.toLowerCase() === filters.jobType.toLowerCase());
    }
    if (filters.salaryMin) {
      jobs = jobs.filter(j => { const m = j.salary.match(/€([\d,]+)/); if (!m) return true; return parseInt(m[1].replace(/,/g, "")) >= (filters.salaryMin || 0); });
    }
    if (filters.salaryMax) {
      jobs = jobs.filter(j => { const ms = j.salary.match(/€([\d,]+)/g); if (!ms || ms.length < 2) return true; return parseInt(ms[1].replace(/[€,]/g, "")) <= (filters.salaryMax || Infinity); });
    }
    // Source portal filter
    if (filters.sources.length > 0) {
      jobs = jobs.filter(j => j.sourceId && filters.sources.includes(j.sourceId));
    }
    // Geographic scope filter
    if (filters.sourceScope !== "all") {
      const userCountry = (profile.country || "").trim().toLowerCase();
      if (filters.sourceScope === "remote") {
        jobs = jobs.filter(j => j.country.toLowerCase() === "remote" || j.type.toLowerCase() === "remote");
      } else if (filters.sourceScope === "around_me" && userCountry) {
        jobs = jobs.filter(j => j.country.toLowerCase() === userCountry);
      } else if (filters.sourceScope === "abroad" && userCountry) {
        jobs = jobs.filter(j => j.country.toLowerCase() !== userCountry && j.country.toLowerCase() !== "remote");
      }
    }
    return jobs;
  }, [matchedJobs, filters, quickFilters, profile.country]);

  // Available options for the quick filter dropdowns — derived from loaded jobs
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    matchedJobs.forEach((j) => {
      if (j.country && j.country.trim()) set.add(j.country.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matchedJobs]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    matchedJobs.forEach((j) => {
      const cat = (j as { category?: string | null }).category;
      if (cat && cat.trim()) set.add(cat.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matchedJobs]);

  // Jobs scoped to selected preset (or all active) for the greeting summary
  const highlightJobs = useMemo((): EnhancedJob[] => {
    if (highlightPresetId === "all") return filteredJobs;
    const preset = activePresets.find((p) => p.id === highlightPresetId);
    if (!preset) return filteredJobs;
    const avatar = mergeProfilePreset(profile, preset);
    return matchJobsEnhanced(allJobs, avatar).sort((a, b) => b.matchScore - a.matchScore);
  }, [highlightPresetId, filteredJobs, activePresets, profile, allJobs]);

  const handleSearch = useCallback(() => {}, []);

  const handleGenerateCoverLetter = async (job: EnhancedJob) => {
    setCoverLetterJobTitle(job.title);
    setCoverLetterOpen(true);
    setCoverLetterLoading(true);
    setCoverLetter("");
    setCoverLetterUsed(null);
    setCoverLetterLimit(null);
    setCoverLetterIsPremium(false);
    setCoverLetterLimitReached(false);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
        body: {
          jobTitle: job.title,
          company: job.company,
          location: `${job.city}, ${job.country}`,
          jobId: job.id,
          language: i18n.language?.split("-")[0] || "cs",
        },
      });
      if (error) {
        // supabase-js wraps non-2xx; try to read structured error
        const ctx: any = (error as any).context;
        if (ctx?.status === 403) {
          setCoverLetterLimitReached(true);
          return;
        }
        throw error;
      }
      if (data?.error === "limit_reached") {
        setCoverLetterLimitReached(true);
        setCoverLetterUsed(data.used ?? null);
        setCoverLetterLimit(data.limit ?? null);
        return;
      }
      setCoverLetter(data.coverLetter || "Unable to generate cover letter.");
      setCoverLetterUsed(data.used ?? null);
      setCoverLetterLimit(data.limit ?? null);
      setCoverLetterIsPremium(!!data.isPremium);
    } catch (e: any) {
      console.error("Cover letter error:", e);
      setCoverLetter("Omlouvám se, dopis se teď nepodařilo vygenerovat. Zkus to prosím za chvíli.");
      toast({ title: "Chyba při generování dopisu", description: e.message, variant: "destructive" });
    } finally {
      setCoverLetterLoading(false);
    }
  };

  const handleSaveJob = (job: EnhancedJob) => {
    toast({ title: `${job.title} saved!`, description: "You can find it in your saved jobs." });
  };

  const handleJobCardClick = (jobId: string) => {
    void track(jobId, "click");
    if (viewedJobIds.has(jobId) || access.isPremium) {
      void track(jobId, "view");
      return;
    }
    setViewedJobIds(prev => new Set(prev).add(jobId));
    void track(jobId, "view");
    recordJobView();
  };

  const handleUnlockWithFree = async (jobId: string) => {
    const ok = await useFreedUnlock();
    if (ok) {
      setViewedJobIds(prev => new Set(prev).add(jobId));
      toast({ title: "Job unlocked!", description: "You used a free unlock." });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <LeslieAvatar className="w-8 h-8 shrink-0" />
            <span className="font-display font-bold text-foreground text-base sm:text-lg truncate">Leslie AI</span>
            {supabaseUser?.email === "palenik.filip@gmail.com" && (
              <div className="hidden md:flex items-center gap-1 ml-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={async () => {
                    const { error } = await supabase.functions.invoke("dev-grant", { body: { action: "premium" } });
                    if (error) {
                      toast({ title: "Premium error", description: error.message, variant: "destructive" });
                    } else {
                      toast({ title: "Premium aktivováno", description: "Obnov stránku pro projevení změn." });
                    }
                  }}
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Premium
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={async () => {
                    const { error } = await supabase.functions.invoke("dev-grant", { body: { action: "admin" } });
                    if (error) {
                      toast({ title: "Admin error", description: error.message, variant: "destructive" });
                    } else {
                      toast({ title: "Admin role přiřazena" });
                    }
                  }}
                >
                  Admin
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            <LanguageSwitcher />
            <NotificationsPopover topJobs={filteredJobs} />

            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10" onClick={() => navigate("/saved")} aria-label={t("header.savedJobs")}>
              <Bookmark className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10" onClick={() => navigate("/chat")} aria-label={t("header.chat")}>
              <MessageCircle className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10" aria-label={t("header.logout")}>
                  <LogOut className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Auto-odhlášení po neaktivitě
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={String(inactivityMinutes)}
                  onValueChange={(v) => setInactivityMinutes(Number(v))}
                >
                  <DropdownMenuRadioItem value="0">Vypnuto</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="15">15 minut</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30">30 minut</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="60">1 hodina</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="240">4 hodiny</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="1440">24 hodin</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} className="cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" /> Odhlásit se hned
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* AI Message */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="bg-card rounded-2xl p-6 flex items-start gap-4 border border-border shadow-sm">
            <LeslieAvatar shape="xl" className="w-12 h-12 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-bold text-foreground">{t("dashboard.greeting", { name: firstName })}</h1>
                {activePresets.length > 1 && (
                  <Select value={highlightPresetId} onValueChange={setHighlightPresetId}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder={t("dashboard.highlightScope")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("dashboard.allPresets")}</SelectItem>
                      {activePresets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name || t("dashboard.untitledPreset")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {(() => {
                const scope = highlightPresetId === "all"
                  ? null
                  : activePresets.find((p) => p.id === highlightPresetId);
                const total = highlightJobs.length;
                if (total === 0) {
                  return (
                    <p className="text-muted-foreground mt-1">
                      {t("dashboard.noMatches", { scope: scope ? t("dashboard.forPreset", { name: scope.name }) : "" })}
                    </p>
                  );
                }
                const high = highlightJobs.filter((j) => j.matchScore >= 80).length;
                const best = highlightJobs[0];
                const avg = Math.round(highlightJobs.reduce((s, j) => s + j.matchScore, 0) / total);
                return (
                  <p className="text-muted-foreground mt-1 leading-relaxed">
                    {scope ? <>{t("dashboard.forPreset", { name: scope.name }).trim()}: </> : null}
                    {t("dashboard.summary", { total, high, title: best.title, company: best.company, score: best.matchScore })}{" "}
                    {avg >= 70 ? t("dashboard.summaryStrong", { avg }) : t("dashboard.summaryWeak", { avg })}
                  </p>
                );
              })()}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
                  <MessageCircle className="w-4 h-4 mr-1.5" />
                  {t("dashboard.chatBtn")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/insights${highlightPresetId !== "all" ? `?presetId=${highlightPresetId}` : ""}`)}>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {t("dashboard.dailyHighlights")}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search Presets */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-accent" />
                <h2 className="font-semibold text-foreground">{t("dashboard.searchPresets")}</h2>
              </div>
            </div>
            <PresetSwitcher />
            {activePresets.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-4">
                {activePresets.map(p => (
                  <div key={p.id} className="bg-secondary/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground text-xs">{p.name}</span>
                    <p className="font-medium text-foreground text-xs mt-0.5">
                      {p.preferredCountries.join(", ") || "Any"} · {p.preferredJobType}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {user.presets.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {t("dashboard.createFirstPreset")}
              </p>
            )}
          </div>
          {/* Job Sources + manual refresh */}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Naposledy aktualizováno: {lastUpdated.toLocaleString("cs-CZ")}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshLiveMatches()}
              disabled={liveLoading || !avatarForMatching}
            >
              {liveLoading ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              Načíst nové nabídky
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/sources")}>
              <Globe className="w-4 h-4 mr-1.5" />
              {t("dashboard.jobSources")}
            </Button>
          </div>
        </motion.div>

        {/* Profile Completion */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <ProfileCompletion onEditProfile={() => navigate("/profile/edit")} />
        </motion.div>

        {/* Pattern insights — Behavior Learning */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mb-6">
          <PatternInsightsPanel />
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <QuickFilterBar
            filters={quickFilters}
            onChange={setQuickFilters}
            availableCountries={availableCountries}
            availableCategories={availableCategories}
          />
          <JobFiltersPanel filters={filters} onFiltersChange={setFilters} onSearch={handleSearch} totalResults={filteredJobs.length} totalJobsCount={allJobs.length} userCountry={profile.country} />
        </motion.div>

        {/* Daily limit banner */}
        {!access.isPremium && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-6">
            <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {remainingViews > 0
                      ? `${remainingViews} full job view${remainingViews !== 1 ? "s" : ""} remaining today`
                      : "You've used all free views for today"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {remainingViews > 0
                      ? "Click on a job to use a view"
                      : "Upgrade to Premium for unlimited access"}
                  </p>
                </div>
              </div>
              <Button size="sm" className="bg-accent-gradient text-accent-foreground" onClick={() => navigate("/premium")}>
                <Crown className="w-4 h-4 mr-1" />
                Premium
              </Button>
            </div>
          </motion.div>
        )}

        {/* Job Matches */}
        <div className="mb-6 flex items-center gap-2">
          <BriefcaseBusiness className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-bold text-foreground">{t("dashboard.topMatches")}</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {liveLoading && filteredJobs.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span>Načítám nabídky...</span>
            </div>
          )}
          {filteredJobs.map((job, i) => {
            const isViewed = viewedJobIds.has(job.id);
            const isWithinLimit = i < access.dailyViewLimit || access.isPremium;
            const showFull = access.isPremium || isViewed || (isWithinLimit && i < (access.jobsViewedToday + viewedJobIds.size));

            // First N jobs are always visible (already viewed today)
            if (access.isPremium || i < access.jobsViewedToday || isViewed) {
              return (
                <div key={job.id} onClick={() => handleJobCardClick(job.id)}>
                  <EnhancedJobCard job={job} index={i} userCurrency="CZK" onGenerateCoverLetter={handleGenerateCoverLetter} onSaveJob={handleSaveJob} />
                </div>
              );
            }

            // Jobs within remaining limit — show full but record on click
            if (canViewJob && !isViewed) {
              return (
                <div key={job.id} onClick={() => handleJobCardClick(job.id)}>
                  <EnhancedJobCard job={job} index={i} userCurrency="CZK" onGenerateCoverLetter={handleGenerateCoverLetter} onSaveJob={handleSaveJob} />
                </div>
              );
            }

            // Over limit — blurred
            return (
              <BlurredJobCard
                key={job.id}
                job={job}
                index={i}
                freeUnlocksAvailable={access.freeUnlocksAvailable}
                onUnlockWithFree={() => handleUnlockWithFree(job.id)}
              />
            );
          })}
          {!liveLoading && filteredJobs.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              {t("dashboard.noJobsFilters")}
            </div>
          )}
        </div>
        {hiddenCount > 0 && (
          <p className="mt-4 text-xs text-center text-muted-foreground">
            {Math.round((hiddenCount / Math.max(1, hiddenCount + activeCount)) * 100)}% nabídek skryto (již nejsou dostupné)
          </p>
        )}
      </main>

      <CoverLetterDialog
        open={coverLetterOpen}
        onOpenChange={setCoverLetterOpen}
        coverLetter={coverLetter}
        isLoading={coverLetterLoading}
        jobTitle={coverLetterJobTitle}
        used={coverLetterUsed}
        limit={coverLetterLimit}
        isPremium={coverLetterIsPremium}
        limitReached={coverLetterLimitReached}
      />
    </div>
  );
};

export default Dashboard;
