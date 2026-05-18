import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, Sparkles, Globe, BriefcaseBusiness, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import LeslieAvatar from "@/components/LeslieAvatar";
import { supabase } from "@/integrations/supabase/client";

const features = [
  {
    icon: Bot,
    title: "AI Avatar",
    desc: "Create your professional AI profile that understands your skills and goals.",
  },
  {
    icon: Sparkles,
    title: "Smart Matching",
    desc: "Get personalized job recommendations with match scores.",
  },
  {
    icon: Globe,
    title: "Work Abroad",
    desc: "Find opportunities in Norway, Germany, Austria and more.",
  },
  {
    icon: MessageCircle,
    title: "AI Assistant",
    desc: "Chat with your avatar for career advice and job search help.",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [jobCount, setJobCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("public_jobs")
      .select("*", { count: "exact", head: true })
      .then(({ count }) => setJobCount(count ?? 0));
  }, []);

  useEffect(() => {
    if (user.isAuthenticated && user.hasCompletedOnboarding) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen">
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
              className="flex-shrink-0"
            >
              <div className="relative">
                <div className="absolute -inset-3 bg-accent-gradient rounded-full blur-xl opacity-40 animate-pulse" />
                <LeslieAvatar
                  alt="Leslie AI Assistant"
                  shape="circle"
                  className="relative w-36 h-36 md:w-48 md:h-48 border-4 border-primary-foreground/20 shadow-2xl"
                />
                <div className="absolute -bottom-2 -right-2 bg-accent-gradient rounded-full p-2 shadow-lg">
                  <Sparkles className="w-5 h-5 text-accent-foreground" />
                </div>
              </div>
            </motion.div>

            {/* Text content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center md:text-left"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground/80 text-sm mb-6">
                <Sparkles className="w-4 h-4 text-red-accent" />
                Meet Leslie — Your AI Career Assistant
              </div>

              <h1 className="font-display text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-5">
                Hi, I'm <span className="text-gradient-accent">Leslie</span>
                <br />
                <span className="text-3xl md:text-5xl">Your job search starts here</span>
              </h1>

              <p className="text-lg md:text-xl text-primary-foreground/60 max-w-xl mb-8">
                I'll learn your skills, preferences and goals — then find the best job opportunities abroad, tailored just for you.
              </p>

              {jobCount !== null && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-gradient/20 border border-red-accent/30 text-primary-foreground text-sm mb-8">
                  <BriefcaseBusiness className="w-4 h-4 text-red-accent" />
                  <span className="font-semibold text-gradient-accent">{jobCount.toLocaleString()}</span>
                  <span className="text-primary-foreground/70">jobs ready for AI scoring</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Button
                  size="lg"
                  className="bg-accent-gradient text-accent-foreground hover:opacity-90 text-base px-8"
                  onClick={() => navigate("/signup")}
                >
                  Create Free Account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 text-base px-8"
                  onClick={() => navigate("/login")}
                >
                  I Already Have an Account
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              How it works
            </h2>
            <p className="text-muted-foreground text-lg">
              From profile to perfect job match in minutes
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
            Ready to find your dream job abroad?
          </h2>
          <p className="text-primary-foreground/60 text-lg mb-8">
            Let Leslie guide you — from profile to perfect match in minutes.
          </p>
          <Button
            size="lg"
            className="bg-accent-gradient text-accent-foreground hover:opacity-90 text-base px-10"
            onClick={() => navigate("/signup")}
          >
            Create Your Profile
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-gradient flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">Leslie AI</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Leslie AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
