import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowLeft, BarChart3, Users, Briefcase, MousePointerClick, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NotFound from "./NotFound";

const ADMIN_EMAIL = "palenik.filip@gmail.com";

interface DauPoint {
  date: string;
  users: number;
}

interface SourcePoint {
  source: string;
  count: number;
}

interface ClickedJob {
  source_url: string;
  title: string | null;
  source_portal: string;
  clicks: number;
}

interface AdminStats {
  totalUsers: number;
  totalJobs: number;
  dau: DauPoint[];
  sources: SourcePoint[];
  topClicked: ClickedJob[];
  signupsToday: number;
  signupsThisWeek: number;
  retention7d: { eligible: number; active: number; pct: number };
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-display font-semibold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function MiniBarChart({ data, labelKey, valueKey }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey] ?? 0)));
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const v = Number(d[valueKey] ?? 0);
        const label = String(d[labelKey] ?? "");
        const pct = (v / max) * 100;
        return (
          <div key={`${label}-${i}`} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-xs text-muted-foreground truncate" title={label}>
              {label}
            </div>
            <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <div className="w-12 text-right text-xs tabular-nums font-medium">{v}</div>
          </div>
        );
      })}
    </div>
  );
}

function DauChart({ data }: { data: DauPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.users));
  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((d) => {
        const h = (d.users / max) * 100;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full bg-accent/70 hover:bg-accent rounded-t-sm transition-colors"
                style={{ height: `${Math.max(2, h)}%` }}
                title={`${d.date}: ${d.users} active`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Admin() {
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Auth gate — email must match
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const email = data.user?.email?.toLowerCase() ?? "";
      if (email === ADMIN_EMAIL.toLowerCase()) {
        setAuthState("ok");
      } else {
        setAuthState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Load stats once authorized
  useEffect(() => {
    if (authState !== "ok") return;
    let cancelled = false;
    (async () => {
      setLoadingStats(true);
      setError(null);
      try {
        const now = new Date();
        const startOf = (d: Date) => {
          const x = new Date(d);
          x.setHours(0, 0, 0, 0);
          return x;
        };
        const today0 = startOf(now);
        const day7Ago = new Date(today0);
        day7Ago.setDate(day7Ago.getDate() - 7);
        const day30Ago = new Date(today0);
        day30Ago.setDate(day30Ago.getDate() - 30);
        const day14Ago = new Date(today0);
        day14Ago.setDate(day14Ago.getDate() - 14);

        // Run independent queries in parallel
        const [
          usersRes,
          jobsRes,
          dauRes,
          sourcesRes,
          clicksRes,
          signupsTodayRes,
          signupsWeekRes,
          cohortRes,
        ] = await Promise.all([
          // Total registered users
          supabase.from("profiles").select("user_id", { count: "exact", head: true }),
          // Total jobs (public_jobs has no is_active column — count all rows)
          supabase.from("public_jobs").select("id", { count: "exact", head: true }),
          // DAU last 30d — pull recent rows and bucket client-side
          supabase
            .from("cached_matches")
            .select("user_id, created_at")
            .gte("created_at", day30Ago.toISOString())
            .limit(50000),
          // Jobs by source
          supabase
            .from("public_jobs")
            .select("source_portal")
            .limit(50000),
          // Clicked jobs
          supabase
            .from("job_matches")
            .select("source_url, title, source_portal, clicked_at")
            .not("clicked_at", "is", null)
            .limit(50000),
          // Signups today
          supabase
            .from("profiles")
            .select("user_id", { count: "exact", head: true })
            .gte("created_at", today0.toISOString()),
          // Signups in the last 7 days
          supabase
            .from("profiles")
            .select("user_id", { count: "exact", head: true })
            .gte("created_at", day7Ago.toISOString()),
          // 7-day retention cohort: users who signed up 7-14 days ago
          supabase
            .from("profiles")
            .select("user_id, created_at")
            .gte("created_at", day14Ago.toISOString())
            .lt("created_at", day7Ago.toISOString())
            .limit(50000),
        ]);

        if (cancelled) return;

        const totalUsers = usersRes.count ?? 0;
        const totalJobs = jobsRes.count ?? 0;

        // DAU buckets
        const dauMap = new Map<string, Set<string>>();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today0);
          d.setDate(d.getDate() - i);
          dauMap.set(d.toISOString().slice(0, 10), new Set());
        }
        ((dauRes.data as Array<{ user_id: string; created_at: string }> | null) ?? []).forEach((row) => {
          const key = row.created_at.slice(0, 10);
          if (dauMap.has(key)) dauMap.get(key)!.add(row.user_id);
        });
        const dau: DauPoint[] = Array.from(dauMap.entries()).map(([date, set]) => ({
          date,
          users: set.size,
        }));

        // Sources tally
        const srcCounts = new Map<string, number>();
        ((sourcesRes.data as Array<{ source_portal: string | null }> | null) ?? []).forEach((row) => {
          const k = row.source_portal ?? "unknown";
          srcCounts.set(k, (srcCounts.get(k) ?? 0) + 1);
        });
        const sources: SourcePoint[] = Array.from(srcCounts.entries())
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count);

        // Top clicks
        type ClickRow = { source_url: string; title: string | null; source_portal: string };
        const clickMap = new Map<string, ClickedJob>();
        ((clicksRes.data as ClickRow[] | null) ?? []).forEach((row) => {
          const existing = clickMap.get(row.source_url);
          if (existing) {
            existing.clicks += 1;
          } else {
            clickMap.set(row.source_url, {
              source_url: row.source_url,
              title: row.title,
              source_portal: row.source_portal,
              clicks: 1,
            });
          }
        });
        const topClicked = Array.from(clickMap.values())
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 10);

        // 7-day retention: of users created 7-14 days ago, how many have any
        // cached_match created at least 7 days after signup?
        type CohortRow = { user_id: string; created_at: string };
        const cohort = ((cohortRes.data as CohortRow[] | null) ?? []);
        let activeAfter7 = 0;
        if (cohort.length > 0) {
          const ids = cohort.map((c) => c.user_id);
          const { data: act } = await supabase
            .from("cached_matches")
            .select("user_id, created_at")
            .in("user_id", ids)
            .limit(50000);
          const byUser = new Map<string, Date[]>();
          ((act as Array<{ user_id: string; created_at: string }> | null) ?? []).forEach((r) => {
            const arr = byUser.get(r.user_id) ?? [];
            arr.push(new Date(r.created_at));
            byUser.set(r.user_id, arr);
          });
          for (const c of cohort) {
            const signup = new Date(c.created_at);
            const threshold = new Date(signup);
            threshold.setDate(threshold.getDate() + 7);
            const acts = byUser.get(c.user_id) ?? [];
            if (acts.some((d) => d >= threshold)) activeAfter7 += 1;
          }
        }
        const retention7d = {
          eligible: cohort.length,
          active: activeAfter7,
          pct: cohort.length === 0 ? 0 : Math.round((activeAfter7 / cohort.length) * 100),
        };

        setStats({
          totalUsers,
          totalJobs,
          dau,
          sources,
          topClicked,
          signupsToday: signupsTodayRes.count ?? 0,
          signupsThisWeek: signupsWeekRes.count ?? 0,
          retention7d,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("admin stats failed", msg);
        setError(msg);
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authState]);

  const dauTotal = useMemo(() => stats?.dau.reduce((s, p) => s + p.users, 0) ?? 0, [stats]);

  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (authState === "denied") {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="font-display font-semibold text-foreground">Admin · Analytics</h1>
            <p className="text-xs text-muted-foreground">Internal dashboard — refreshed on load</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {loadingStats && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading stats…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm p-3">
            Failed to load: {error}
          </div>
        )}

        {stats && (
          <>
            {/* Top KPI grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Users className="w-4 h-4" />}
                label="Total users"
                value={stats.totalUsers.toLocaleString()}
                hint="profiles rows"
              />
              <StatCard
                icon={<Briefcase className="w-4 h-4" />}
                label="Total jobs"
                value={stats.totalJobs.toLocaleString()}
                hint="public_jobs rows"
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="Signups today"
                value={stats.signupsToday.toLocaleString()}
                hint={`${stats.signupsThisWeek.toLocaleString()} this week`}
              />
              <StatCard
                icon={<BarChart3 className="w-4 h-4" />}
                label="7-day retention"
                value={`${stats.retention7d.pct}%`}
                hint={`${stats.retention7d.active}/${stats.retention7d.eligible} cohort active`}
              />
            </section>

            {/* DAU */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Daily active users · last 30 days</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Distinct users with new matches per day · {dauTotal.toLocaleString()} total active days
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <DauChart data={stats.dau} />
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{formatDayLabel(stats.dau[0]?.date ?? "")}</span>
                  <span>{formatDayLabel(stats.dau[stats.dau.length - 1]?.date ?? "")}</span>
                </div>
              </CardContent>
            </Card>

            {/* Bottom row: sources + top clicks */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Jobs by source</CardTitle>
                  <p className="text-xs text-muted-foreground">Grouped by source_portal</p>
                </CardHeader>
                <CardContent>
                  {stats.sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No jobs ingested yet.</p>
                  ) : (
                    <MiniBarChart data={stats.sources as unknown as Record<string, unknown>[]} labelKey="source" valueKey="count" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MousePointerClick className="w-4 h-4" /> Top 10 clicked jobs
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">From job_matches.clicked_at</p>
                </CardHeader>
                <CardContent>
                  {stats.topClicked.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No clicks tracked yet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {stats.topClicked.map((j, i) => (
                        <li key={j.source_url} className="flex items-start gap-3 text-sm">
                          <span className="w-5 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
                          <a
                            href={j.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 min-w-0 truncate hover:text-accent"
                            title={j.title ?? j.source_url}
                          >
                            {j.title ?? j.source_url}
                            <span className="block text-[10px] text-muted-foreground truncate">{j.source_portal}</span>
                          </a>
                          <span className="text-xs font-medium tabular-nums shrink-0">{j.clicks}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}