import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithEmail, loginWithProvider } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await loginWithEmail(email, password);
    setIsLoading(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
  };

  const handleSocial = async (provider: "google" | "apple") => {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-gradient p-4 relative">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-gradient mb-4">
            <Bot className="w-7 h-7 text-accent-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-primary-foreground">NorgeJobs AI</h1>
          <p className="text-primary-foreground/60 mt-1">Welcome back to your AI assistant</p>
        </div>

        <div className="glass-card-elevated rounded-2xl p-8">
          {/* Social login buttons */}
          <div className="space-y-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-3 font-medium"
              onClick={() => handleSocial("google")}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-3 font-medium"
              onClick={() => handleSocial("apple")}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </Button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent-gradient text-accent-foreground hover:opacity-90 transition-opacity"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sign In
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-5">
            Don't have an account?{" "}
            <Link to="/signup" className="text-red-accent font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
