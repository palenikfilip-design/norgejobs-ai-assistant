import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieIcon,
  Brain,
  AlertTriangle,
  Lightbulb,
  CalendarDays,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser, mergeProfilePreset } from "@/context/UserContext";
import { mockJobs } from "@/data/mockJobs";
import { matchJobsEnhanced, type EnhancedJob } from "@/utils/jobMatching";
import { calculateSmartMatch } from "@/utils/smartMatch";
import { generateBoostSuggestions } from "@/utils/skillBooster";
import { usePreferenceProfile } from "@/hooks/usePreferenceProfile";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--primary))",
  "hsl(var(--chart-3, var(--accent)))",
  "hsl(var(--chart-4, var(--primary)))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--secondary-foreground))",
];

const inferIndustry = (job: { title: string; company: string; description: string }): string => {
  const text = `${job.title} ${job.company} ${job.description}`.toLowerCase();
  if (/(developer|engineer|software|frontend|backend|devops|data|tech|fintech|saas)/.test(text)) return "Tech / IT";
  if (/(nurse|doctor|medical|health|care|hospital)/.test(text)) return "Healthcare";
  if (/(driver|logistic|warehouse|delivery|truck)/.test(text)) return "Logistics";
  if (/(chef|cook|restaurant|hotel|barista|hospitality)/.test(text)) return "Hospitality";
  if (/(construction|electrician|plumber|builder|welder)/.test(text)) return "Construction";
  if (/(teacher|tutor|education|school)/.test(text)) return "Education";
  if (/(sales|marketing|account manager)/.test(text)) return "Sales / Marketing";
  if (/(finance|accountant|bank)/.test(text)) return "Finance";
  return "Other";
};

interface DailySnapshot {
  date: string;
  total: number;
  highMatch: number;
  avgScore: number;
  topIndustry: string;
}

const SNAPSHOT_KEY = "dailyInsightsSnapshot";

const DailyInsights = () => {
  const navigate = useNavigate();
  const { activeAvatars, activePresets, user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);

  const presetIdParam = searchParams.get("presetId") ?? "all";
  const setPresetId = (id: string) => {
    if (id === "all") setSearchParams({});
    else setSearchParams({ presetId: id });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Avatars to use for matching: scoped to single preset OR all active
  const scopedAvatars = useMemo(() => {
    if (presetIdParam === "all") return activeAvatars;
    const p = activePresets.find((x) => x.id === presetIdParam);
    if (!p) return activeAvatars;
    return [mergeProfilePreset(user.profile, p)];
  }, [presetIdParam, activeAvatars, activePresets, user.profile]);

  const scopeLabel = useMemo(() => {
    if (presetIdParam === "all") return null;
    return activePresets.find((x) => x.id === presetIdParam)?.name ?? null;
  }, [presetIdParam, activePresets]);

  const matchedJobs = useMemo((): EnhancedJob[] => {
    if (scopedAvatars.length === 0) {
      return mockJobs.map((j) => ({
        ...j,
        matchScore: 70,
        matchDetails: [],
        matchReasons: [],
        negativeSignals: [],
        matchReason: "",
        aiSummary: j.description,
      }));
    }
    const map = new Map<string, EnhancedJob>();
    scopedAvatars.forEach((a) => {
      matchJobsEnhanced(mockJobs, a).forEach((j) => {
        const ex = map.get(j.id);
        if (!ex || j.matchScore > ex.matchScore) map.set(j.id, j);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.matchScore - a.matchScore);
  }, [scopedAvatars]);

  const { profile: behaviorProfile } = usePreferenceProfile(userId, mockJobs);

  const top5 = matchedJobs.slice(0, 5);
  const total = matchedJobs.length;

  // Build "why it matches" reason for each top job
  const topReasons = useMemo(() => {
    if (activeAvatars.length === 0) return new Map<string, string>();
    const m = new Map<string, string>();
    top5.forEach((job) => {
      const r = calculateSmartMatch(job, activeAvatars[0]);
      m.set(job.id, r.topReasons.slice(0, 3).join(" + ") || "Strong overall fit");
    });
    return m;
  }, [top5, activeAvatars]);

  const industryData = useMemo(() => {
    const counts = new Map<string, number>();
    matchedJobs.forEach((j) => {
      const key = inferIndustry(j);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [matchedJobs]);

  const matchBuckets = useMemo(() => {
    const buckets = [
      { range: "80-100%", min: 80, max: 100, count: 0 },
      { range: "60-79%", min: 60, max: 79, count: 0 },
      { range: "<60%", min: 0, max: 59, count: 0 },
    ];
    matchedJobs.forEach((j) => {
      const b = buckets.find((x) => j.matchScore >= x.min && j.matchScore <= x.max);
      if (b) b.count++;
    });
    return buckets;
  }, [matchedJobs]);

  const avgScore = useMemo(
    () => (total ? Math.round(matchedJobs.reduce((s, j) => s + j.matchScore, 0) / total) : 0),
    [matchedJobs, total]
  );

  // Yesterday snapshot from localStorage
  const [yesterday, setYesterday] = useState<DailySnapshot | null>(null);
  useEffect(() => {
    if (!total) return;
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    const prev: DailySnapshot | null = raw ? JSON.parse(raw) : null;
    if (prev && prev.date !== today) setYesterday(prev);
    const snap: DailySnapshot = {
      date: today,
      total,
      highMatch: matchBuckets[0].count,
      avgScore,
      topIndustry: industryData[0]?.name ?? "—",
    };
    if (!prev || prev.date !== today) {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    }
  }, [total, avgScore, matchBuckets, industryData]);

  // Skill gap suggestions from top job's missing reqs
  const skillSuggestions = useMemo(() => {
    if (activeAvatars.length === 0 || top5.length === 0) return [];
    const r = calculateSmartMatch(top5[0], activeAvatars[0]);
    return generateBoostSuggestions(r.missingRequirements).slice(0, 2);
  }, [top5, activeAvatars]);

  // Opportunity alerts
  const expiringHigh = useMemo(
    () => matchedJobs.filter((j) => j.matchScore >= 85 && (j.avgDaysToFill ?? 99) <= 14).length,
    [matchedJobs]
  );

  const trendDelta = (curr: number, prev?: number) => {
    if (prev === undefined || prev === null) return null;
    return curr - prev;
  };

  const renderDelta = (delta: number | null, suffix = "") => {
    if (delta === null) return <span className="text-xs text-muted-foreground">no data yet</span>;
    if (delta === 0)
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Minus className="w-3 h-3" /> same as yesterday
        </span>
      );
    const Up = delta > 0;
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium ${
          Up ? "text-accent" : "text-destructive"
        }`}
      >
        {Up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {Up ? "+" : ""}
        {delta}
        {suffix} vs yesterday
      </span>
    );
  };

  const labelShift = (s: string | null) =>
    s === "day" ? "day shifts" : s === "night" ? "night shifts" : s ?? "flexible shifts";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h1 className="font-display font-bold text-lg text-foreground">Daily Highlights</h1>
            </div>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">
            <CalendarDays className="w-3 h-3 mr-1" />
            {new Date().toLocaleDateString()}
          </Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* 1. Best matches */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold text-foreground">🔥 Best matches of the day</h2>
          </div>
          <Card className="p-5">
            {top5.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {top5.map((job, i) => (
                  <li key={job.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {job.company} · {job.city}, {job.country}
                        </p>
                        <p className="text-xs text-accent mt-1 italic">
                          Why: {topReasons.get(job.id) ?? "Strong overall fit"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-lg font-bold text-accent">{job.matchScore}%</span>
                      <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>
                        View
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </motion.section>

        {/* 2 + 3. Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">📈 Market trends</h2>
            </div>
            <Card className="p-5">
              {industryData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data.</p>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={industryData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {industryData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: number, n: string) => [
                            `${v} (${Math.round((v / total) * 100)}%)`,
                            n,
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-foreground mt-2 text-center">
                    <span className="font-semibold">{total} new jobs</span> · Most growing:{" "}
                    <span className="font-semibold text-accent">{industryData[0]?.name}</span>
                  </p>
                </>
              )}
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">📊 Match distribution</h2>
            </div>
            <Card className="p-5">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={matchBuckets}>
                    <XAxis dataKey="range" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {matchBuckets.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-foreground mt-2 text-center">
                Today you have <span className="font-semibold text-accent">{matchBuckets[0].count} high-quality matches</span>
              </p>
            </Card>
          </motion.section>
        </div>

        {/* 4. Behavioral insight */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-foreground">🧠 Behavioral insight</h2>
          </div>
          <Card className="p-5">
            {!behaviorProfile || behaviorProfile.patterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Interact with more jobs (save, apply, reject) and we'll learn your preferences.
              </p>
            ) : (
              <>
                <p className="text-sm text-foreground mb-2">You seem to prefer:</p>
                <ul className="space-y-1">
                  {behaviorProfile.preferredShiftType.value && (
                    <li className="text-sm">
                      ✓ <span className="font-semibold">{labelShift(behaviorProfile.preferredShiftType.value)}</span>
                    </li>
                  )}
                  {behaviorProfile.stressTolerance.value !== null && (
                    <li className="text-sm">
                      ✓{" "}
                      <span className="font-semibold">
                        {behaviorProfile.stressTolerance.value < 40
                          ? "Lower-stress roles"
                          : behaviorProfile.stressTolerance.value > 65
                            ? "Higher-intensity roles"
                            : "Moderate-stress roles"}
                      </span>
                    </li>
                  )}
                  {behaviorProfile.preferredSalary.min && (
                    <li className="text-sm">
                      ✓ Salary around{" "}
                      <span className="font-semibold">
                        €{Math.round(behaviorProfile.preferredSalary.min / 1000)}k–€
                        {Math.round((behaviorProfile.preferredSalary.max ?? 0) / 1000)}k
                      </span>
                    </li>
                  )}
                  {behaviorProfile.preferredEnvironment.value && (
                    <li className="text-sm">
                      ✓ Environment:{" "}
                      <span className="font-semibold">{behaviorProfile.preferredEnvironment.value}</span>
                    </li>
                  )}
                </ul>
              </>
            )}
          </Card>
        </motion.section>

        {/* 5 + 6. Alerts + Skill gap */}
        <div className="grid gap-6 md:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">⚠️ Opportunity alerts</h2>
            </div>
            <Card className="p-5 space-y-2">
              {expiringHigh > 0 && (
                <p className="text-sm text-foreground">
                  🔥 <span className="font-semibold">{expiringHigh} jobs above 85%</span> are filling fast — apply soon.
                </p>
              )}
              {yesterday && avgScore > yesterday.avgScore && (
                <p className="text-sm text-foreground">
                  ✨ Your matches are{" "}
                  <span className="font-semibold text-accent">better than yesterday</span> (+
                  {avgScore - yesterday.avgScore} pts avg).
                </p>
              )}
              {expiringHigh === 0 && (!yesterday || avgScore <= yesterday.avgScore) && (
                <p className="text-sm text-muted-foreground">No urgent alerts today.</p>
              )}
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">🧩 Skill gap insight</h2>
            </div>
            <Card className="p-5 space-y-3">
              {skillSuggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Your profile already covers the top job's requirements. 🎉
                </p>
              ) : (
                skillSuggestions.map((s, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-foreground">
                        Improve <span className="font-semibold">{s.name}</span> → unlock{" "}
                        <span className="font-semibold text-accent">+{s.estimatedImpact}%</span> more jobs
                      </p>
                      <p className="text-xs text-muted-foreground">{s.action}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate("/profile/edit")}>
                      {s.actionCta}
                    </Button>
                  </div>
                ))
              )}
            </Card>
          </motion.section>
        </div>

        {/* 7. Trend vs yesterday */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-foreground">📅 Trend vs yesterday</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs text-muted-foreground mb-1">New jobs</p>
              <p className="text-2xl font-bold text-foreground">{total}</p>
              {renderDelta(trendDelta(total, yesterday?.total))}
            </Card>
            <Card className="p-5">
              <p className="text-xs text-muted-foreground mb-1">Avg match quality</p>
              <p className="text-2xl font-bold text-foreground">{avgScore}%</p>
              {renderDelta(trendDelta(avgScore, yesterday?.avgScore), "%")}
            </Card>
            <Card className="p-5">
              <p className="text-xs text-muted-foreground mb-1">High-quality (80%+)</p>
              <p className="text-2xl font-bold text-foreground">{matchBuckets[0].count}</p>
              {renderDelta(trendDelta(matchBuckets[0].count, yesterday?.highMatch))}
            </Card>
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default DailyInsights;
