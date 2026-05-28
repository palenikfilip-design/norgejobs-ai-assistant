import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NotFound from "./NotFound";

const ADMIN_EMAIL = "palenik.filip@gmail.com";
const CACHE_TTL_MS = 60_000;

type AuthState = "loading" | "denied" | "ok";

interface OverviewStats {
  totalUsers: number;
  activeUsers7d: number;
  totalPresets: number;
  avgPresetsPerUser: number;
}

interface ScoreBucket {
  label: string;
  range: [number, number];
  count: number;
  color: string;
}

interface PresetCountBucket {
  label: string;
  count: number;
}

interface PresetActivityRow {
  id: string;
  name: string;
  user_email: string;
  countries: string[];
  last_used_at: string | null;
  match_count: number;
}

interface ExtractionRow {
  id: string;
  user_id: string;
  raw_message: string;
  extracted_data: Record<string, unknown>;
  routed_to: string;
  confidence: string;
  created_at: string;
}

interface SourceRow {
  id: string;
  name: string;
  tier: number;
  last_run_status: string | null;
  last_run_at: string | null;
  jobs_added_24h: number;
  jobs_added_total: number;
  unhealthy: boolean;
}

interface StatsBundle {
  overview: OverviewStats;
  scoreBuckets: ScoreBucket[];
  scoreTotal: number;
  scoreMedian: number;
  scoreAvg: number;
  presetCountBuckets: PresetCountBucket[];
  presetActivity: PresetActivityRow[];
  extractions: ExtractionRow[];
  extractionPct: { avatar: number; preset: number; both: number; none: number };
  sources: SourceRow[];
  sourcesHealthy: number;
  fetchedAt: number;
}

function anonymize(s: string): string {
  if (!s) return "?***";
  return `${s.slice(0, 3)}***`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "teď";
  if (m < 60) return `před ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `před ${h} h`;
  const d = Math.round(h / 24);
  return `před ${d} d`;
}

function bucketColor(label: string): string {
  switch (label) {
    case "0-20": return "bg-red-500";
    case "21-40": return "bg-orange-500";
    case "41-60": return "bg-yellow-500";
    case "61-80": return "bg-lime-500";
    case "81-100": return "bg-green-500";
    default: return "bg-muted";
  }
}

let cache: { data: StatsBundle; ts: number } | null = null;

async function loadStats(): Promise<StatsBundle> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [
    usersRes,
    activeIntRes,
    activeMatchRes,
    presetsAllRes,
    scoresRes,
    presetsForRecentRes,
    extractionsRes,
    sourcesRes,
    matchCountsRes,
    profilesRes,
    jobs24hRes,
  ] = await Promise.all([
    supabase.from("profiles").select("user_id", { count: "exact", head: true }),
    supabase
      .from("user_job_interactions")
      .select("user_id, created_at")
      .gte("created_at", sevenDaysAgo)
      .limit(50000),
    supabase
      .from("cached_matches")
      .select("user_id, created_at")
      .gte("created_at", sevenDaysAgo)
      .limit(50000),
    supabase.from("user_presets").select("id, user_id, name, preferred_countries, last_used_at"),
    supabase
      .from("cached_matches")
      .select("score")
      .gte("created_at", sevenDaysAgo)
      .limit(50000),
    supabase
      .from("user_presets")
      .select("id, user_id, name, preferred_countries, last_used_at")
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("chat_extractions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("job_sources").select("*"),
    supabase.from("cached_matches").select("preset_id").limit(50000),
    supabase.from("profiles").select("user_id, full_name"),
    supabase
      .from("public_jobs")
      .select("source_id, created_at")
      .gte("created_at", oneDayAgo)
      .limit(50000),
  ]);

  // Overview
  const totalUsers = usersRes.count ?? 0;
  const activeFromInt = new Set(
    ((activeIntRes.data as Array<{ user_id: string }> | null) ?? []).map((r) => r.user_id),
  );
  const activeFromMatch = new Set(
    ((activeMatchRes.data as Array<{ user_id: string }> | null) ?? []).map((r) => r.user_id),
  );
  const activeSet = activeFromInt.size > 0 ? activeFromInt : activeFromMatch;
  const activeUsers7d = activeSet.size;

  const allPresets = (presetsAllRes.data as Array<{ id: string; user_id: string }> | null) ?? [];
  const totalPresets = allPresets.length;
  const usersWithPreset = new Set(allPresets.map((p) => p.user_id));
  const avgPresetsPerUser = usersWithPreset.size === 0 ? 0 : totalPresets / usersWithPreset.size;

  // Scores
  const scores = ((scoresRes.data as Array<{ score: number }> | null) ?? []).map((r) => r.score ?? 0);
  const buckets: ScoreBucket[] = [
    { label: "0-20", range: [0, 20], count: 0, color: "bg-red-500" },
    { label: "21-40", range: [21, 40], count: 0, color: "bg-orange-500" },
    { label: "41-60", range: [41, 60], count: 0, color: "bg-yellow-500" },
    { label: "61-80", range: [61, 80], count: 0, color: "bg-lime-500" },
    { label: "81-100", range: [81, 100], count: 0, color: "bg-green-500" },
  ];
  for (const s of scores) {
    const b = buckets.find((x) => s >= x.range[0] && s <= x.range[1]);
    if (b) b.count += 1;
  }
  const scoreTotal = scores.length;
  const sorted = [...scores].sort((a, b) => a - b);
  const scoreMedian = sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
  const scoreAvg = sorted.length === 0 ? 0 : Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);

  // Preset count distribution
  const presetsPerUser = new Map<string, number>();
  for (const p of allPresets) {
    presetsPerUser.set(p.user_id, (presetsPerUser.get(p.user_id) ?? 0) + 1);
  }
  const one = [...presetsPerUser.values()].filter((n) => n === 1).length;
  const two = [...presetsPerUser.values()].filter((n) => n === 2).length;
  const threePlus = [...presetsPerUser.values()].filter((n) => n >= 3).length;
  const presetCountBuckets: PresetCountBucket[] = [
    { label: "1 preset", count: one },
    { label: "2 presety", count: two },
    { label: "3+ presetů", count: threePlus },
  ];

  // Preset activity (top 10 by last_used_at)
  const recent = (presetsForRecentRes.data as Array<{
    id: string;
    user_id: string;
    name: string;
    preferred_countries: unknown;
    last_used_at: string | null;
  }> | null) ?? [];
  const matchCountByPreset = new Map<string, number>();
  for (const r of ((matchCountsRes.data as Array<{ preset_id: string | null }> | null) ?? [])) {
    if (!r.preset_id) continue;
    matchCountByPreset.set(r.preset_id, (matchCountByPreset.get(r.preset_id) ?? 0) + 1);
  }
  const profMap = new Map<string, string>();
  for (const p of ((profilesRes.data as Array<{ user_id: string; full_name: string | null }> | null) ?? [])) {
    profMap.set(p.user_id, p.full_name ?? "");
  }
  const presetActivity: PresetActivityRow[] = recent.map((r) => ({
    id: r.id,
    name: r.name || "(bez názvu)",
    user_email: anonymize(profMap.get(r.user_id) || r.user_id),
    countries: Array.isArray(r.preferred_countries) ? (r.preferred_countries as string[]) : [],
    last_used_at: r.last_used_at,
    match_count: matchCountByPreset.get(r.id) ?? 0,
  }));

  // Extractions
  const extractions = ((extractionsRes.data as ExtractionRow[] | null) ?? []);
  const totalExtr = extractions.length || 1;
  const cnt = { avatar: 0, preset: 0, both: 0, none: 0 };
  for (const e of extractions) {
    if (e.routed_to === "avatar") cnt.avatar += 1;
    else if (e.routed_to === "preset") cnt.preset += 1;
    else if (e.routed_to === "both") cnt.both += 1;
    else cnt.none += 1;
  }
  const extractionPct = {
    avatar: Math.round((cnt.avatar / totalExtr) * 100),
    preset: Math.round((cnt.preset / totalExtr) * 100),
    both: Math.round((cnt.both / totalExtr) * 100),
    none: Math.round((cnt.none / totalExtr) * 100),
  };

  // Sources
  const jobs24hBySource = new Map<string, number>();
  for (const j of ((jobs24hRes.data as Array<{ source_id: string | null }> | null) ?? [])) {
    if (!j.source_id) continue;
    jobs24hBySource.set(j.source_id, (jobs24hBySource.get(j.source_id) ?? 0) + 1);
  }
  const tierIntervalH = (tier: number) => (tier <= 1 ? 6 : tier === 2 ? 24 : 72);
  const sources: SourceRow[] = ((sourcesRes.data as Array<{
    id: string;
    name: string;
    tier: number;
    last_run_status: string | null;
    last_run_at: string | null;
    jobs_added_total: number;
  }> | null) ?? []).map((s) => {
    const ageH = s.last_run_at ? (Date.now() - new Date(s.last_run_at).getTime()) / 3_600_000 : Infinity;
    const unhealthy = s.last_run_status === "error" || ageH > tierIntervalH(s.tier) * 2;
    return {
      id: s.id,
      name: s.name,
      tier: s.tier,
      last_run_status: s.last_run_status,
      last_run_at: s.last_run_at,
      jobs_added_24h: jobs24hBySource.get(s.id) ?? 0,
      jobs_added_total: s.jobs_added_total ?? 0,
      unhealthy,
    };
  });
  const sourcesHealthy = sources.filter((s) => !s.unhealthy).length;

  return {
    overview: { totalUsers, activeUsers7d, totalPresets, avgPresetsPerUser },
    scoreBuckets: buckets,
    scoreTotal,
    scoreMedian,
    scoreAvg,
    presetCountBuckets,
    presetActivity,
    extractions,
    extractionPct,
    sources,
    sourcesHealthy,
    fetchedAt: now,
  };
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-display font-semibold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function WhyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md bg-muted/50 border border-border/50 p-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Proč to sleduji: </span>
      {children}
    </div>
  );
}

function RoutedBadge({ to }: { to: string }) {
  const map: Record<string, string> = {
    avatar: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    preset: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
    both: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    none: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${map[to] ?? map.none}`}>
      {to}
    </span>
  );
}

function ExtractionItem({ row }: { row: ExtractionRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0 py-2 text-sm">
      <div className="flex items-start gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground w-20 shrink-0">{relativeTime(row.created_at)}</span>
        <span className="text-xs font-mono w-20 shrink-0">{anonymize(row.user_id)}</span>
        <RoutedBadge to={row.routed_to} />
        <span className="flex-1 min-w-[200px] text-foreground truncate" title={row.raw_message}>
          {row.raw_message.slice(0, 80) || "—"}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          JSON
        </button>
      </div>
      {open && (
        <pre className="mt-2 text-[11px] bg-muted/50 p-2 rounded overflow-auto max-h-64">
{JSON.stringify(row.extracted_data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AdminStats() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const email = data.user?.email?.toLowerCase() ?? "";
      setAuthState(email === ADMIN_EMAIL.toLowerCase() ? "ok" : "denied");
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (!force && cache && Date.now() - cache.ts < CACHE_TTL_MS) {
        setStats(cache.data);
      } else {
        const data = await loadStats();
        cache = { data, ts: Date.now() };
        setStats(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authState === "ok") refresh();
  }, [authState, refresh]);

  const scoreMax = useMemo(
    () => Math.max(1, ...(stats?.scoreBuckets.map((b) => b.count) ?? [1])),
    [stats],
  );
  const presetMax = useMemo(
    () => Math.max(1, ...(stats?.presetCountBuckets.map((b) => b.count) ?? [1])),
    [stats],
  );

  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }
  if (authState === "denied") return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Zpět">
            <Link to="/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-semibold text-foreground truncate">Admin · Leslie Stats</h1>
            <p className="text-xs text-muted-foreground">
              {stats ? `Načteno ${relativeTime(new Date(stats.fetchedAt).toISOString())}` : "Načítám…"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm p-3">
            {error}
          </div>
        )}

        {/* SECTION 1 */}
        <section>
          <h2 className="font-display font-semibold mb-3">Přehled</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Uživatelé" value={stats?.overview.totalUsers ?? "—"} />
            <MetricCard label="Aktivní 7d" value={stats?.overview.activeUsers7d ?? "—"} hint="distinct user_id" />
            <MetricCard label="Presety celkem" value={stats?.overview.totalPresets ?? "—"} />
            <MetricCard
              label="Ø presetů / user"
              value={stats ? stats.overview.avgPresetsPerUser.toFixed(2) : "—"}
              hint="z uživatelů s ≥1 presetem"
            />
          </div>
        </section>

        {/* SECTION 2 */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Distribuce match score (posledních 7 dní)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Celkem {stats?.scoreTotal ?? 0} skórovaných · medián {stats?.scoreMedian ?? 0} · průměr {stats?.scoreAvg ?? 0}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.scoreBuckets.map((b) => {
                  const pct = stats.scoreTotal === 0 ? 0 : Math.round((b.count / stats.scoreTotal) * 100);
                  const w = (b.count / scoreMax) * 100;
                  return (
                    <div key={b.label} className="flex items-center gap-3">
                      <div className="w-16 text-xs text-muted-foreground tabular-nums">{b.label}</div>
                      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                        <div className={`h-full ${bucketColor(b.label)}`} style={{ width: `${Math.max(2, w)}%` }} />
                      </div>
                      <div className="w-24 text-right text-xs tabular-nums">
                        {b.count} <span className="text-muted-foreground">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <WhyNote>
                Pokud je většina jobů 40–60, Gemini moc rozdává průměry — prompt potřebuje doladit.
                Pokud je distribuce bimodální (hodně nízkých + hodně vysokých), funguje dobře.
              </WhyNote>
            </CardContent>
          </Card>
        </section>

        {/* SECTION 3 */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Kolik lidí používá víc než 1 preset</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.presetCountBuckets.map((b) => {
                  const w = (b.count / presetMax) * 100;
                  return (
                    <div key={b.label} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground">{b.label}</div>
                      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${Math.max(2, w)}%` }} />
                      </div>
                      <div className="w-16 text-right text-xs tabular-nums">{b.count} uživ.</div>
                    </div>
                  );
                })}
              </div>
              <WhyNote>
                Pokud 80 %+ má jeden preset, two-phase onboarding nepotřebuješ.
                Pokud 30 %+ má 2+, má smysl ho dokončit.
              </WhyNote>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aktivita presetů (top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              {stats && stats.presetActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádné presety zatím.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {stats?.presetActivity.map((p) => (
                    <li key={p.id} className="flex items-start gap-2 border-b border-border/50 pb-2 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.user_email} · {p.countries.slice(0, 3).join(", ") || "—"}
                        </div>
                      </div>
                      <div className="text-right text-xs shrink-0">
                        <div>{relativeTime(p.last_used_at)}</div>
                        <div className="text-muted-foreground">{p.match_count} matchů</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* SECTION 4 */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Posledních 20 extrakcí preferencí z chatu</CardTitle>
              <p className="text-xs text-muted-foreground">
                Posledních {stats?.extractions.length ?? 0}: {stats?.extractionPct.preset ?? 0}% routed to preset,{" "}
                {stats?.extractionPct.avatar ?? 0}% to avatar, {stats?.extractionPct.both ?? 0}% to both
                {stats && stats.extractionPct.none > 0 ? `, ${stats.extractionPct.none}% none` : ""}
              </p>
            </CardHeader>
            <CardContent>
              {stats && stats.extractions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Zatím žádné extrakce — tabulka <code>chat_extractions</code> je nová a začne se plnit při použití chatu.
                </p>
              ) : (
                <div>{stats?.extractions.map((r) => <ExtractionItem key={r.id} row={r} />)}</div>
              )}
              <WhyNote>
                Sleduj, jestli věty typu „umím anglicky a chci do Norska“ jsou správně routed to both.
                Pokud Leslie pravidelně routuje špatně, prompt v <code>extract-preferences</code> potřebuje upravit.
              </WhyNote>
            </CardContent>
          </Card>
        </section>

        {/* SECTION 5 */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Zdroje dat</CardTitle>
              <p className="text-xs text-muted-foreground">
                {stats?.sourcesHealthy ?? 0} / {stats?.sources.length ?? 0} zdrojů aktivních a zdravých
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 pr-2">Zdroj</th>
                    <th className="text-left py-2 pr-2">Tier</th>
                    <th className="text-left py-2 pr-2">Status</th>
                    <th className="text-left py-2 pr-2">Last run</th>
                    <th className="text-right py-2 pr-2">24h</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.sources.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b border-border/30 ${s.unhealthy ? "bg-red-500/10 text-red-700 dark:text-red-300" : ""}`}
                    >
                      <td className="py-2 pr-2 font-medium truncate max-w-[200px]" title={s.name}>{s.name}</td>
                      <td className="py-2 pr-2">{s.tier}</td>
                      <td className="py-2 pr-2">{s.last_run_status ?? "—"}</td>
                      <td className="py-2 pr-2">{relativeTime(s.last_run_at)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{s.jobs_added_24h}</td>
                      <td className="py-2 text-right tabular-nums">{s.jobs_added_total}</td>
                    </tr>
                  ))}
                  {stats && stats.sources.length === 0 && (
                    <tr><td colSpan={6} className="py-3 text-muted-foreground text-center">Žádné zdroje.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}