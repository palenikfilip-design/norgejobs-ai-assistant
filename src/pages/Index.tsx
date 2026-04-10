import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, Sparkles, Globe, BriefcaseBusiness, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import leslieAvatar from "@/assets/leslie-avatar.png";

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

        <div className="relative max-w-5xl mx-auto px-4 py-24 md:py-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground/80 text-sm mb-8">
              <Sparkles className="w-4 h-4 text-red-accent" />
              AI-Powered Job Matching
            </div>

            <h1 className="font-display text-5xl md:text-7xl font-bold text-primary-foreground leading-tight mb-6">
              Your AI Job
              <br />
              <span className="text-gradient-accent">Avatar</span> Awaits
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/60 max-w-2xl mx-auto mb-10">
              Create an AI-powered professional avatar that finds the perfect job opportunities abroad — matched to your skills, preferences, and goals.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-accent-gradient text-accent-foreground hover:opacity-90 text-base px-8"
                onClick={() => navigate("/signup")}
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 text-base px-8"
                onClick={() => navigate("/login")}
              >
                Sign In
              </Button>
            </div>
          </motion.div>
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
          <div className="w-16 h-16 rounded-2xl bg-accent-gradient flex items-center justify-center mx-auto mb-6">
            <BriefcaseBusiness className="w-8 h-8 text-accent-foreground" />
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Ready to find your dream job abroad?
          </h2>
          <p className="text-primary-foreground/60 text-lg mb-8">
            Join thousands of professionals using AI to discover opportunities in Scandinavia and Europe.
          </p>
          <Button
            size="lg"
            className="bg-accent-gradient text-accent-foreground hover:opacity-90 text-base px-10"
            onClick={() => navigate("/signup")}
          >
            Create Your Avatar
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
