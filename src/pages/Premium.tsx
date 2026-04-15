import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Infinity, Eye, FileText, Sparkles, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Infinity, title: "Unlimited job views", desc: "See every job detail, every day — no daily limits." },
  { icon: Eye, title: "Full job details", desc: "Salary, description, skills, match analysis — all unlocked." },
  { icon: FileText, title: "AI cover letters", desc: "Generate unlimited personalized cover letters." },
  { icon: Sparkles, title: "Advanced matching", desc: "Lifestyle matching and dimensional profiling included." },
  { icon: Zap, title: "Priority support", desc: "Get help faster when you need it." },
  { icon: Shield, title: "Early access", desc: "Be first to try new features and improvements." },
];

const Premium = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-foreground ml-2">Premium</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-gradient mb-4">
            <Crown className="w-8 h-8 text-accent-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Unlock Your Full Potential</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            You've already seen how Leslie AI finds your best matches. Premium removes all limits so you never miss an opportunity.
          </p>
        </motion.div>

        {/* Free vs Premium comparison */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-3">Free</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Full profile (Job Avatar)</li>
                <li>✓ Job matching</li>
                <li>✓ 4 full job views/day</li>
                <li className="text-muted-foreground/50">✗ Unlimited views</li>
                <li className="text-muted-foreground/50">✗ Priority support</li>
              </ul>
            </div>
            <div className="bg-card rounded-xl border-2 border-accent p-5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-gradient text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
                RECOMMENDED
              </div>
              <h3 className="font-semibold text-foreground mb-3">Premium</h3>
              <ul className="space-y-2 text-sm text-foreground">
                <li>✓ Everything in Free</li>
                <li>✓ Unlimited job views</li>
                <li>✓ Full job details</li>
                <li>✓ AI cover letters</li>
                <li>✓ Priority support</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Features grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {features.map((f, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4 text-center">
                <f.icon className="w-6 h-6 text-accent mx-auto mb-2" />
                <h4 className="font-medium text-foreground text-sm">{f.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center">
          <p className="text-muted-foreground text-sm mb-4">
            You've unlocked your top matches for today. We found more highly relevant jobs for you.
          </p>
          <Button size="lg" className="bg-accent-gradient text-accent-foreground px-8">
            <Crown className="w-5 h-5 mr-2" />
            Get Premium
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Payment processing will be available soon. Stay tuned!
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default Premium;
