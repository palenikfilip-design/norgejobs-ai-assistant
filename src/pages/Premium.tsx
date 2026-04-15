import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Infinity, Eye, FileText, Sparkles, Zap, Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { useUser } from "@/context/UserContext";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { supabaseUser } = useUser();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const { isActive, isCanceling, subscription } = useSubscription(supabaseUser?.id ?? null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast({
        title: "🎉 Welcome to Premium!",
        description: "Your subscription is being activated. It may take a moment.",
      });
    }
  }, [searchParams]);

  const handleCheckout = () => {
    if (!supabaseUser) {
      navigate("/login");
      return;
    }
    openCheckout({
      priceId: billingCycle === "monthly" ? "premium_monthly" : "premium_yearly",
      customerEmail: supabaseUser.email ?? undefined,
      customData: { userId: supabaseUser.id },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-foreground ml-2">Premium</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {isActive && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-6 bg-card rounded-xl border-2 border-accent text-center">
            <Crown className="w-10 h-10 text-accent mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-foreground mb-1">You're Premium!</h2>
            <p className="text-muted-foreground">
              {isCanceling
                ? `Your subscription will end on ${new Date(subscription?.currentPeriodEnd || "").toLocaleDateString()}.`
                : "You have unlimited access to all features."}
            </p>
          </motion.div>
        )}

        {!isActive && (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-gradient mb-4">
                <Crown className="w-8 h-8 text-accent-foreground" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-2">Unlock Your Full Potential</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                You've already seen how Leslie AI finds your best matches. Premium removes all limits so you never miss an opportunity.
              </p>
            </motion.div>

            {/* Billing toggle */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex justify-center mb-6">
              <div className="bg-card rounded-full border border-border p-1 flex gap-1">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${billingCycle === "monthly" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${billingCycle === "yearly" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                >
                  Yearly <span className="text-xs opacity-75">Save 33%</span>
                </button>
              </div>
            </motion.div>

            {/* Pricing card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
              <div className="bg-card rounded-xl border-2 border-accent p-6 text-center relative max-w-sm mx-auto">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-gradient text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
                  {billingCycle === "yearly" ? "BEST VALUE" : "FLEXIBLE"}
                </div>
                <h3 className="text-xl font-bold text-foreground mt-2 mb-1">Leslie Premium</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-foreground">
                    {billingCycle === "monthly" ? "$9.99" : "$6.66"}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  {billingCycle === "yearly" && (
                    <p className="text-sm text-muted-foreground mt-1">$79.99 billed annually</p>
                  )}
                </div>
                <ul className="text-left space-y-2 mb-6">
                  {["Unlimited job views", "Full job details", "AI cover letters", "Priority support", "Early access to features"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  className="w-full bg-accent-gradient text-accent-foreground"
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                >
                  <Crown className="w-5 h-5 mr-2" />
                  {checkoutLoading ? "Loading..." : "Get Premium"}
                </Button>
              </div>
            </motion.div>

            {/* Free vs Premium comparison */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
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

            {/* Smart messaging */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-center">
              <p className="text-muted-foreground text-sm">
                You've unlocked your top matches for today. We found more highly relevant jobs for you.
              </p>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
};

export default Premium;
