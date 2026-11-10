import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, ShieldCheck, Loader2, ArrowLeft } from "lucide-react";

const ForEmployers = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/employer/company`, data: { user_type: "employer" } },
    });
    setLoading(false);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    if (data.session) navigate("/employer/company");
    else setSent(true);
  };

  return (
    <div className="min-h-screen bg-navy-gradient p-4 text-primary-foreground">
      <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:bg-primary-foreground/10">
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center py-10">
        <section>
          <p className="text-red-accent font-semibold uppercase tracking-wider text-sm mb-3">Pro zaměstnavatele</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Najdi spolehlivé lidi z Česka a Slovenska</h1>
          <p className="text-primary-foreground/70 mb-8">Vytvoř si firemní profil na Leslie. Tvoje firma, logo a odkazy se zobrazí uchazečům, kteří hledají práci v zahraničí.</p>
          <ul className="space-y-4">
            {[[Building2, "Veřejná stránka firmy s logem, webem a Instagramem"], [Users, "Tisíce uchazečů hledajících sezónní i stálou práci"], [ShieldCheck, "Ověření firmy zvyšuje důvěru uchazečů"]].map(([I, t], i) => {
              const Icon = I as typeof Building2;
              return <li key={i} className="flex gap-3 items-center"><Icon className="w-5 h-5 text-red-accent" /><span>{t as string}</span></li>;
            })}
          </ul>
        </section>
        <div className="glass-card-elevated rounded-2xl p-8 text-foreground">
          {sent ? (
            <div className="text-center space-y-2">
              <h2 className="font-display text-2xl font-bold">Zkontroluj e-mail</h2>
              <p className="text-muted-foreground">Poslali jsme ti potvrzovací odkaz. Po potvrzení nastavíš profil firmy.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <h2 className="font-display text-2xl font-bold">Firemní registrace</h2>
              <div className="space-y-2"><Label htmlFor="em">Pracovní e-mail</Label>
                <Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="pw">Heslo</Label>
                <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" disabled={loading} className="w-full bg-accent-gradient text-accent-foreground">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Vytvořit firemní účet
              </Button>
              <p className="text-center text-sm text-muted-foreground">Už máš účet? <Link to="/login" className="text-red-accent font-medium">Přihlásit se</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default ForEmployers;
