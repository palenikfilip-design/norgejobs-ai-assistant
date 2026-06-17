import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, Sparkles, Globe, MessageCircle, MessagesSquare, Search, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LeslieAvatar from "@/components/LeslieAvatar";
import leslieFullBody from "@/assets/leslie-fullbody.png";
import { supabase } from "@/integrations/supabase/client";

// Feature flag for testimonials section (flip to true once we have real ones)
const SHOW_TESTIMONIALS = false;

type LeslieStats = {
  active_sources?: number;
  active_companies?: number;
  countries_covered?: number;
  total_active_jobs?: number;
  quality_active_jobs?: number;
  total_positions?: number;
  quality_total_positions?: number;
  last_ingest_run?: string | null;
};

/** Lightweight count-up: animates from 0 → value over ~1s using rAF. */
function CountUp({ value, locale }: { value: number | null; locale: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value == null) return;
    const start = performance.now();
    const duration = 1000;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value == null) return <span>—</span>;
  return <span>{display.toLocaleString(locale)}</span>;
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<LeslieStats | null>(null);

  useEffect(() => {
    supabase.functions
      .invoke("get-leslie-stats")
      .then(({ data, error }) => {
        if (!error && data) setStats(data as LeslieStats);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user.isAuthenticated && user.hasCompletedOnboarding) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const currentLang = i18n.resolvedLanguage === "en" ? "en" : "cs";
  const numberLocale = currentLang === "cs" ? "cs-CZ" : "en-US";

  // Keep <html lang> in sync with active language
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = currentLang;
    }
  }, [currentLang]);

  const features = [
    { icon: Bot, title: t("landing.feat1Title"), desc: t("landing.feat1Desc") },
    { icon: Sparkles, title: t("landing.feat2Title"), desc: t("landing.feat2Desc") },
    { icon: Globe, title: t("landing.feat3Title"), desc: t("landing.feat3Desc") },
    { icon: MessageCircle, title: t("landing.feat4Title"), desc: t("landing.feat4Desc") },
  ];

  // Show the real catalog size; enrichment progress is shown as a subtitle.
  const jobCount = stats?.total_active_jobs ?? stats?.quality_active_jobs ?? null;
  const qualityCount = stats?.quality_active_jobs ?? null;
  const companies = stats?.active_companies ?? null;
  const countries = stats?.countries_covered ?? null;
  const sources = stats?.active_sources ?? 9;

  const steps = [
    { num: "1", icon: MessagesSquare, title: t("landing.step1Title"), desc: t("landing.step1Desc") },
    {
      num: "2",
      icon: Search,
      title: t("landing.step2Title"),
      desc: t("landing.step2Desc", { sources, companies: companies ?? "—" }),
    },
    { num: "3", icon: CheckCircle2, title: t("landing.step3Title"), desc: t("landing.step3Desc") },
  ];

  // "Updated X minutes ago" caption
  const updatedCaption = (() => {
    if (!stats?.last_ingest_run) return null;
    const ts = new Date(stats.last_ingest_run).getTime();
    if (Number.isNaN(ts)) return null;
    const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (minutes < 1) return t("landing.updatedJustNow");
    return t("landing.updatedAgo", { minutes });
  })();

  return (
    <div className="min-h-screen">
      {/* Top bar with language switcher */}
      <div className="absolute top-0 right-0 z-20 p-4 flex items-center gap-1 text-sm">
        <button
          onClick={() => i18n.changeLanguage("cs")}
          className={`px-2 py-1 rounded transition ${currentLang === "cs" ? "text-primary-foreground font-semibold" : "text-primary-foreground/50 hover:text-primary-foreground/80"}`}
          aria-label="Čeština"
        >
          🇨🇿 CS
        </button>
        <span className="text-primary-foreground/30">|</span>
        <button
          onClick={() => i18n.changeLanguage("en")}
          className={`px-2 py-1 rounded transition ${currentLang === "en" ? "text-primary-foreground font-semibold" : "text-primary-foreground/50 hover:text-primary-foreground/80"}`}
          aria-label="English"
        >
          🇬🇧 EN
        </button>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-gradient">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-accent/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-navy-light/40 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-28">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
            {/* Leslie Avatar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="flex-shrink-0 hidden md:block"
            >
              <div className="relative">
                {/* Soft glow behind the figure */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-accent-gradient rounded-full blur-3xl opacity-30 animate-pulse pointer-events-none" />
                <div className="absolute inset-x-8 bottom-2 h-6 bg-black/40 blur-xl rounded-full pointer-events-none" />
                <img
                  src={leslieFullBody}
                  alt="Leslie AI Assistant"
                  width={1080}
                  height={1920}
                  className="relative w-56 md:w-72 lg:w-80 h-auto drop-shadow-2xl select-none"
                  draggable={false}
                />
                <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-accent-gradient rounded-full p-2 shadow-lg">
                  <Sparkles className="w-5 h-5 text-accent-foreground" />
                </div>
              </div>
            </motion.div>

            {/* Text content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center md:text-left flex-1 min-w-0"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground/80 text-sm mb-6">
                <Sparkles className="w-4 h-4 text-red-accent" />
                {t("landing.badge")}
              </div>

              <h1 className="font-display text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-5">
                {t("landing.hiIm")} <span className="text-gradient-accent">Leslie</span>
                <br />
                <span className="text-3xl md:text-5xl">{t("landing.tagline")}</span>
              </h1>

              <p className="text-lg md:text-xl text-primary-foreground/60 max-w-xl mb-8">
                {t("landing.intro")}
              </p>

              {/* Stats hierarchy */}
              <div className="mb-8">
                <div className="rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 p-5 md:p-6">
                  <div className="text-center">
                    <div className="font-display font-bold text-gradient-accent text-5xl md:text-6xl leading-none">
                      <CountUp value={jobCount} locale={numberLocale} />
                    </div>
                    <div className="mt-2 text-primary-foreground/70 text-sm md:text-base">
                      {t("landing.activeJobsLabel")}
                    </div>
                    {qualityCount != null && jobCount != null && qualityCount < jobCount && (
                      <div className="mt-1 text-primary-foreground/50 text-xs md:text-sm">
                        {t("landing.qualitySubtitle", { count: qualityCount })}
                      </div>
                    )}
                  </div>
                  <div className="mt-5 pt-5 border-t border-primary-foreground/10 grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-xl md:text-2xl font-display font-semibold text-primary-foreground">
                        🏢 <CountUp value={companies} locale={numberLocale} />
                      </div>
                      <div className="text-[11px] md:text-xs text-primary-foreground/60 mt-1">
                        {t("landing.employersLabel")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xl md:text-2xl font-display font-semibold text-primary-foreground">
                        🌍 <CountUp value={countries} locale={numberLocale} />
                      </div>
                      <div className="text-[11px] md:text-xs text-primary-foreground/60 mt-1">
                        {t("landing.countriesLabel")}
                      </div>
                    </div>
                  </div>
                  {updatedCaption && (
                    <div className="mt-4 text-[11px] text-primary-foreground/40 text-center">
                      {updatedCaption}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Button
                  size="lg"
                  className="bg-accent-gradient text-accent-foreground hover:opacity-90 text-base px-8"
                  onClick={() => navigate("/signup")}
                >
                  {t("landing.ctaCreate")}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 text-base px-8"
                  onClick={() => navigate("/login")}
                >
                  {t("landing.ctaLogin")}
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Jak to funguje — 3 steps */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              {t("landing.howTitle")}
            </h2>
            <p className="text-muted-foreground text-lg">{t("landing.howSubtitle")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card-elevated rounded-xl p-7 relative"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-display font-bold text-lg leading-none w-9 h-9 rounded-full bg-accent-gradient text-accent-foreground flex items-center justify-center shrink-0">
                    {s.num}
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-primary-foreground/5 border border-border flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-red-accent" />
                  </div>
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2 text-lg">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials (hidden behind feature flag until we have real ones) */}
      {SHOW_TESTIMONIALS && (
        <section className="py-20 bg-card border-t border-border">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-10 text-center">
              {t("landing.testimonialsTitle")}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Testimonial cards rendered here once data is available */}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              {t("landing.featuresTitle")}
            </h2>
            <p className="text-muted-foreground text-lg">
              {t("landing.featuresSub")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card-elevated rounded-xl p-6 text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-gradient flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6 text-accent-foreground" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-navy-gradient">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <LeslieAvatar
            shape="circle"
            className="w-20 h-20 mx-auto mb-6 border-2 border-primary-foreground/20 block"
          />
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            {t("landing.ctaReadyTitle")}
          </h2>
          <p className="text-primary-foreground/60 text-lg mb-8">
            {t("landing.ctaReadySub")}
          </p>
          <Button
            size="lg"
            className="bg-accent-gradient text-accent-foreground hover:opacity-90 text-base px-10"
            onClick={() => navigate("/signup")}
          >
            {t("landing.ctaReadyBtn")}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-3">
          <div className="inline-flex items-center gap-2 justify-center">
            <div className="w-7 h-7 rounded-lg bg-accent-gradient flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">Leslie AI</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("landing.footerBetaNote")}
          </p>
          <p className="text-xs text-muted-foreground/80">
            {t("landing.footerBuiltSolo")}
          </p>
          <p className="text-[11px] text-muted-foreground/60">© 2026 Leslie AI</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
