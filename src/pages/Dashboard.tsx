import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { mockJobs, matchJobsToProfile } from "@/data/mockJobs";
import JobCard from "@/components/JobCard";
import JobFiltersPanel from "@/components/JobFiltersPanel";
import { Button } from "@/components/ui/button";
import { Bot, MessageCircle, Bell, LogOut, Sparkles, BriefcaseBusiness } from "lucide-react";
import { type JobFilters, defaultFilters } from "@/types/jobFilters";

const Dashboard = () => {
  const { user, logout, clearNotifications } = useUser();
  const navigate = useNavigate();
  const avatar = user.avatar;
  const firstName = avatar?.fullName.split(" ")[0] || "there";

  const [filters, setFilters] = useState<JobFilters>(defaultFilters);

  const matchedJobs = useMemo(() => {
    if (!avatar) return mockJobs.map((j) => ({ ...j, matchScore: 70, matchReason: "General match." }));
    return matchJobsToProfile(
      mockJobs,
      avatar.skills,
      avatar.preferredCountries,
      avatar.salaryMin,
      avatar.salaryMax,
      avatar.preferredJobType
    );
  }, [avatar]);

  const filteredJobs = useMemo(() => {
    let jobs = matchedJobs;

    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(kw) ||
        j.company.toLowerCase().includes(kw) ||
        j.description.toLowerCase().includes(kw)
      );
    }

    if (filters.location) {
      const loc = filters.location.toLowerCase();
      jobs = jobs.filter(j => j.city.toLowerCase().includes(loc));
    }

    if (filters.countries.length > 0) {
      jobs = jobs.filter(j =>
        filters.countries.some(c => c.toLowerCase() === j.country.toLowerCase())
      );
    }

    if (filters.jobType && filters.jobType !== "all") {
      jobs = jobs.filter(j => j.type.toLowerCase() === filters.jobType.toLowerCase());
    }

    if (filters.salaryMin) {
      jobs = jobs.filter(j => {
        const match = j.salary.match(/€([\d,]+)/);
        if (!match) return true;
        const salaryVal = parseInt(match[1].replace(/,/g, ""));
        return salaryVal >= (filters.salaryMin || 0);
      });
    }

    if (filters.salaryMax) {
      jobs = jobs.filter(j => {
        const matches = j.salary.match(/€([\d,]+)/g);
        if (!matches || matches.length < 2) return true;
        const maxVal = parseInt(matches[1].replace(/[€,]/g, ""));
        return maxVal <= (filters.salaryMax || Infinity);
      });
    }

    return jobs;
  }, [matchedJobs, filters]);

  const handleSearch = useCallback(() => {
    // Filtering is reactive via useMemo, no extra action needed
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-gradient flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-foreground text-lg">NorgeJobs AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative" onClick={clearNotifications}>
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
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="glass-card-elevated rounded-2xl p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-gradient flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Hi {firstName}! 👋</h1>
              <p className="text-muted-foreground mt-1">
                I found <span className="text-red-accent font-semibold">{filteredJobs.length} great job matches</span> for you today.
                {user.notifications > 0 && (
                  <span className="ml-1">You have {user.notifications} new notifications.</span>
                )}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/chat")}>
                <MessageCircle className="w-4 h-4 mr-1.5" />
                Chat with your AI Avatar
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Avatar Summary */}
        {avatar && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-red-accent" />
                <h2 className="font-display font-semibold text-foreground">Your Avatar Profile</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Looking for</span>
                  <p className="font-medium text-foreground">{avatar.preferredJobType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Countries</span>
                  <p className="font-medium text-foreground">{avatar.preferredCountries.join(", ")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Skills</span>
                  <p className="font-medium text-foreground">{avatar.skills.slice(0, 3).join(", ")}{avatar.skills.length > 3 ? "..." : ""}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Salary</span>
                  <p className="font-medium text-foreground">€{avatar.salaryMin.toLocaleString()} – €{avatar.salaryMax.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <JobFiltersPanel
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={handleSearch}
            totalResults={filteredJobs.length}
            totalJobsCount={mockJobs.length}
          />
        </motion.div>

        {/* Job Matches */}
        <div className="mb-6 flex items-center gap-2">
          <BriefcaseBusiness className="w-5 h-5 text-red-accent" />
          <h2 className="font-display text-xl font-bold text-foreground">Top Job Matches</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {filteredJobs.map((job, i) => (
            <JobCard key={job.id} job={job} index={i} />
          ))}
          {filteredJobs.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              No jobs match your current filters. Try adjusting your search criteria.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
