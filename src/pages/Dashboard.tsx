import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser, mergeProfilePreset } from "@/context/UserContext";
import { mockJobs } from "@/data/mockJobs";
import { matchJobsEnhanced, type EnhancedJob } from "@/utils/jobMatching";
import EnhancedJobCard from "@/components/EnhancedJobCard";
import PresetSwitcher from "@/components/PresetSwitcher";
import CoverLetterDialog from "@/components/CoverLetterDialog";
import ProfileCompletion from "@/components/ProfileCompletion";
import JobFiltersPanel from "@/components/JobFiltersPanel";
import { Button } from "@/components/ui/button";
import { MessageCircle, Bell, LogOut, Sparkles, BriefcaseBusiness, Filter } from "lucide-react";
import leslieAvatar from "@/assets/leslie-avatar.png";
import { type JobFilters, defaultFilters } from "@/types/jobFilters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const { user, activeAvatars, activePresets, logout } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const profile = user.profile;
  const firstName = profile.fullName.split(" ")[0] || "there";

  const [filters, setFilters] = useState<JobFilters>(defaultFilters);
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterJobTitle, setCoverLetterJobTitle] = useState("");

  // Match jobs using all active presets, deduplicate by job id, keep best score
  const matchedJobs = useMemo((): EnhancedJob[] => {
    if (activeAvatars.length === 0) {
      return mockJobs.map(j => ({
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
      const matched = matchJobsEnhanced(mockJobs, avatar);
      matched.forEach(job => {
        const existing = jobMap.get(job.id);
        if (!existing || job.matchScore > existing.matchScore) {
          jobMap.set(job.id, job);
        }
      });
    });
    return Array.from(jobMap.values()).sort((a, b) => b.matchScore - a.matchScore);
  }, [activeAvatars]);

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
    return jobs;
  }, [matchedJobs, filters]);

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
            <Button variant="ghost" size="icon" className="relative" onClick={() => {}}>
              <Bell className="w-5 h-5" />
              {user.notifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-gradient text-[10px] text-accent-foreground flex items-center justify-center font-bold">
                  {user.notifications}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
              <MessageCircle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={async () => { await logout(); navigate("/"); }}>
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
            <div>
              <h1 className="text-2xl font-bold text-foreground">Hi {firstName}! 👋</h1>
              <p className="text-muted-foreground mt-1">
                I found <span className="text-accent font-semibold">{filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}</span> that match your search presets.
                {filteredJobs.length > 0 && (
                  <span className="ml-1">
                    Your top match is <span className="font-semibold text-foreground">{filteredJobs[0]?.title}</span> with a {filteredJobs[0]?.matchScore}% match score!
                  </span>
                )}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/chat")}>
                <MessageCircle className="w-4 h-4 mr-1.5" />
                Chat with Leslie AI
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Search Presets */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-accent" />
                <h2 className="font-semibold text-foreground">Search Presets</h2>
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
                Create your first search preset to get personalized job matches.
              </p>
            )}
          </div>
        </motion.div>

        {/* Profile Completion */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <ProfileCompletion onEditProfile={() => navigate("/profile/edit")} />
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <JobFiltersPanel filters={filters} onFiltersChange={setFilters} onSearch={handleSearch} totalResults={filteredJobs.length} totalJobsCount={mockJobs.length} />
        </motion.div>

        {/* Job Matches */}
        <div className="mb-6 flex items-center gap-2">
          <BriefcaseBusiness className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-bold text-foreground">Top Job Matches</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {filteredJobs.map((job, i) => (
            <EnhancedJobCard key={job.id} job={job} index={i} userCurrency="CZK" onGenerateCoverLetter={handleGenerateCoverLetter} onSaveJob={handleSaveJob} />
          ))}
          {filteredJobs.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              No jobs match your current filters. Try adjusting your search criteria.
            </div>
          )}
        </div>
      </main>

      <CoverLetterDialog open={coverLetterOpen} onOpenChange={setCoverLetterOpen} coverLetter={coverLetter} isLoading={coverLetterLoading} jobTitle={coverLetterJobTitle} />
    </div>
  );
};

export default Dashboard;
