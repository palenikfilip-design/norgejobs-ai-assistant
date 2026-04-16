import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Banknote, Briefcase, Pin, Trash2, ExternalLink, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/context/UserContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useJobPreferences } from "@/hooks/useJobPreferences";
import { useJobSnapshots } from "@/hooks/useJobSnapshots";
import { mockJobs, type Job } from "@/data/mockJobs";
import { useToast } from "@/hooks/use-toast";
import type { PreferenceCategory } from "@/types/behaviorLearning";

const TAB_DEFS: { value: PreferenceCategory; label: string; emoji: string }[] = [
  { value: "favorite", label: "Favorites", emoji: "❤️" },
  { value: "top_pick", label: "Top Picks", emoji: "⭐" },
  { value: "saved_for_later", label: "Saved", emoji: "💾" },
  { value: "applied", label: "Applied", emoji: "✅" },
  { value: "not_interested", label: "Rejected", emoji: "❌" },
];

const SavedJobs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supabaseUser } = useUser();
  const userId = supabaseUser?.id ?? null;
  const { isActive: isPremium, loading: subLoading } = useSubscription(userId);
  const { preferences, removePreference } = useJobPreferences(userId);
  const { snapshots, removeSnapshot } = useJobSnapshots(userId);

  const jobLookup = useMemo(() => Object.fromEntries(mockJobs.map((j) => [j.id, j])) as Record<string, Job>, []);

  if (!subLoading && !isPremium) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <Crown className="w-12 h-12 text-accent mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Saved Jobs je Premium funkce</h1>
          <p className="text-muted-foreground">
            Ulož si oblíbené pozice, vytvoř snapshoty a nech systém učit se tvé preference. Vše dostupné s Premium předplatným.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Zpět</Button>
            <Button className="bg-accent-gradient text-accent-foreground" onClick={() => navigate("/premium")}>
              <Crown className="w-4 h-4 mr-1" /> Get Premium
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const jobsByCategory = (cat: PreferenceCategory) =>
    preferences
      .filter((p) => p.category === cat)
      .map((p) => ({ pref: p, job: jobLookup[p.jobId] }))
      .filter((x) => x.job);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-lg">Saved Jobs</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="favorite" className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            {TAB_DEFS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs sm:text-sm">
                {t.emoji} {t.label} ({jobsByCategory(t.value).length})
              </TabsTrigger>
            ))}
            <TabsTrigger value="snapshots" className="text-xs sm:text-sm">
              📌 Snapshots ({snapshots.length})
            </TabsTrigger>
          </TabsList>

          {TAB_DEFS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="space-y-3 mt-4">
              {jobsByCategory(t.value).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Zatím žádné. Klikni na {t.emoji} {t.label} u libovolné pozice na dashboardu.
                </div>
              ) : (
                jobsByCategory(t.value).map(({ pref, job }, i) => (
                  <motion.div
                    key={pref.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                      <p className="text-sm text-muted-foreground">{job.company}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.city}, {job.country}</span>
                        <span className="flex items-center gap-1"><Banknote className="w-3 h-3" />{job.salary}</span>
                        <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.type}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        await removePreference(pref.jobId, pref.category);
                        toast({ title: "Odstraněno" });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))
              )}
            </TabsContent>
          ))}

          <TabsContent value="snapshots" className="space-y-3 mt-4">
            {snapshots.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Žádné snapshoty. Klikni na 📌 u pozice, kterou chceš zachovat i po smazání zdroje.
              </div>
            ) : (
              snapshots.map((s, i) => {
                const stillExists = !!jobLookup[s.originalJobId];
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Pin className="w-4 h-4 text-emerald-500 fill-emerald-500" />
                          <h3 className="font-semibold text-foreground truncate">{s.title}</h3>
                          {!stillExists && (
                            <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-xs">
                              Zdroj smazán
                            </Badge>
                          )}
                        </div>
                        {s.company && <p className="text-sm text-muted-foreground">{s.company}</p>}
                        {s.description && <p className="text-sm text-foreground/80 line-clamp-2 mt-1">{s.description}</p>}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                          {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}, {s.country}</span>}
                          {(s.salaryMin || s.salaryMax) && (
                            <span className="flex items-center gap-1">
                              <Banknote className="w-3 h-3" />
                              {s.salaryMin?.toLocaleString()} – {s.salaryMax?.toLocaleString()} {s.currency}
                            </span>
                          )}
                          {s.jobType && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{s.jobType}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {s.url && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={s.url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={async () => { await removeSnapshot(s.id); toast({ title: "Snapshot smazán" }); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SavedJobs;
