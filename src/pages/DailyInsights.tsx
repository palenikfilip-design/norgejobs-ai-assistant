import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, TrendingUp, BarChart3, PieChart as PieIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { mockJobs } from "@/data/mockJobs";
import { matchJobsEnhanced, type EnhancedJob } from "@/utils/jobMatching";
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

const DailyInsights = () => {
  const navigate = useNavigate();
  const { activeAvatars } = useUser();

  const matchedJobs = useMemo((): EnhancedJob[] => {
    if (activeAvatars.length === 0) {
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
    activeAvatars.forEach((a) => {
      matchJobsEnhanced(mockJobs, a).forEach((j) => {
        const ex = map.get(j.id);
        if (!ex || j.matchScore > ex.matchScore) map.set(j.id, j);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.matchScore - a.matchScore);
  }, [activeAvatars]);

  const top5 = matchedJobs.slice(0, 5);

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
      { range: "90-100%", min: 90, max: 100, count: 0 },
      { range: "80-89%", min: 80, max: 89, count: 0 },
      { range: "60-79%", min: 60, max: 79, count: 0 },
      { range: "40-59%", min: 40, max: 59, count: 0 },
      { range: "0-39%", min: 0, max: 39, count: 0 },
    ];
    matchedJobs.forEach((j) => {
      const b = buckets.find((x) => j.matchScore >= x.min && j.matchScore <= x.max);
      if (b) b.count++;
    });
    return buckets;
  }, [matchedJobs]);

  const total = matchedJobs.length;

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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Top matches */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold text-foreground">Best matches of the day</h2>
          </div>
          <Card className="p-5">
            {top5.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {top5.map((job, i) => (
                  <li key={job.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {job.company} · {job.city}, {job.country}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
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

        <div className="grid gap-6 md:grid-cols-2">
          {/* Industry pie */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">Jobs by industry</h2>
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
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {total} total jobs · {industryData[0]?.name} leads with{" "}
                    {Math.round(((industryData[0]?.value ?? 0) / total) * 100)}%
                  </p>
                </>
              )}
            </Card>
          </motion.section>

          {/* Match score buckets */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">Match score distribution</h2>
            </div>
            <Card className="p-5">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={matchBuckets}>
                    <XAxis
                      dataKey="range"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      allowDecimals={false}
                    />
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
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {matchBuckets[0].count + matchBuckets[1].count} jobs above 80% match
              </p>
            </Card>
          </motion.section>
        </div>
      </main>
    </div>
  );
};

export default DailyInsights;
