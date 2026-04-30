import { useMemo, useState, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, LogOut, Sparkles, BriefcaseBusiness, Filter, Globe, Crown, Eye, Bookmark, Loader2 } from "lucide-react";
import NotificationsPopover from "@/components/NotificationsPopover";
import leslieAvatar from "@/assets/leslie-avatar.png";
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
  const { t } = useTranslation();
  const { user, activeAvatars, activePresets, logout, supabaseUser } = useUser();
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
  const { matches: liveMatches, loading: liveLoading } = useLiveMatches(avatarForMatching);
  const liveJobs = useMemo(() => liveMatches.map(liveMatchToJob), [liveMatches]);
  const allJobs = useMemo(() => liveJobs, [liveJobs]);

  const [filters, setFilters] = useState<JobFilters>(defaultFilters);
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterJobTitle, setCoverLetterJobTitle] = useState("");
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
    const jobMap = new Map<string, EnhancedJob>();
    activeAvatars.forEach(avatar => {
      const matched = matchJobsEnhanced(allJobs, avatar);
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
  }, [activeAvatars, isPremium, interactions, preferences, allJobs]);

  const filteredJobs = useMemo(() => {
    let jobs = matchedJobs;
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
  }, [matchedJobs, filters, profile.country]);

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
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
        body: {
          jobTitle: job.title,
          company: job.company,
          location: `${job.city}, ${job.country}`,
          userProfile: { fullName: profile.fullName, skills: profile.skills, workExperience: profile.workExperience, languages: profile.languages.map(l => l.language) },
        },
      });
      if (error) throw error;
      setCoverLetter(data.coverLetter || "Unable to generate cover letter.");
    } catch (e: any) {
      console.error("Cover letter error:", e);
      setCoverLetter("Sorry, I couldn't generate a cover letter right now. Please try again later.");
      toast({ title: "Error generating cover letter", description: e.message, variant: "destructive" });
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
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={leslieAvatar} alt="Leslie AI" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-display font-bold text-foreground text-lg">Leslie AI</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <NotificationsPopover topJobs={filteredJobs} />

            <Button variant="ghost" size="icon" onClick={() => navigate("/saved")} aria-label={t("header.savedJobs")}>
              <Bookmark className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/chat")} aria-label={t("header.chat")}>
              <MessageCircle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={async () => { await logout(); navigate("/"); }} aria-label={t("header.logout")}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* AI Message */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="bg-card rounded-2xl p-6 flex items-start gap-4 border border-border shadow-sm">
            <img src={leslieAvatar} alt="Leslie AI" className="w-12 h-12 rounded-xl object-cover shrink-0" />
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
          {/* Job Sources shortcut */}
          <div className="mt-3 flex justify-end">
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
      </main>

      <CoverLetterDialog open={coverLetterOpen} onOpenChange={setCoverLetterOpen} coverLetter={coverLetter} isLoading={coverLetterLoading} jobTitle={coverLetterJobTitle} />
    </div>
  );
};

export default Dashboard;
