import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import leslieAvatar from "@/assets/leslie-avatar.png";

interface ChatMsg {
  role: "assistant" | "user";
  content: string;
}

const QUESTIONS: string[] = [
  "Ahoj! Jsem Leslie, tvůj asistent pro hledání práce v zahraničí. Začneme — do které země bys chtěl/a jet pracovat?",
  "Skvělé. Jaký typ práce hledáš? (gastronomie, stavebnictví, IT, sezónní, péče o děti…)",
  "Jakými jazyky se domluvíš?",
  "Hledáš sezónní práci na pár měsíců, nebo trvalou pozici?",
  "A poslední — jaký minimální plat tě zajímá? (v EUR za měsíc, můžeš nechat prázdné)",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: QUESTIONS[0] },
  ]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0); // index of the question awaiting an answer
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Skip if user is not signed in OR already has a non-empty avatar_json
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!u.user) {
        navigate("/login");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("avatar_json")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const av = prof?.avatar_json as Record<string, unknown> | null | undefined;
      const hasAvatar = av && typeof av === "object" && Object.keys(av).length > 0;
      if (hasAvatar) {
        navigate("/dashboard");
        return;
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, submitting]);

  const finalize = async (allMessages: ChatMsg[]) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("extract-preferences", {
        body: { messages: allMessages },
      });
      if (error) throw error;
      toast({ title: "Hotovo!", description: "Připravuji tvoje nabídky…" });
      navigate("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("extract-preferences failed:", msg);
      toast({
        title: "Něco se pokazilo",
        description: "Tvoje odpovědi jsem nestihla uložit. Zkus to prosím znovu.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    // Allow empty answer only on the last question (salary)
    if (!text && step !== QUESTIONS.length - 1) return;
    if (submitting) return;

    const userMsg: ChatMsg = { role: "user", content: text || "(přeskočeno)" };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");

    const nextStep = step + 1;
    if (nextStep < QUESTIONS.length) {
      // Ask the next question with a small delay to feel conversational
      setSubmitting(true);
      await new Promise((r) => setTimeout(r, 400));
      const withQ: ChatMsg[] = [
        ...next,
        { role: "assistant", content: QUESTIONS[nextStep] },
      ];
      setMessages(withQ);
      setStep(nextStep);
      setSubmitting(false);
    } else {
      // All answers collected — extract & redirect
      const closing: ChatMsg[] = [
        ...next,
        { role: "assistant", content: "Děkuji! Ukládám tvoje preference a hledám nabídky…" },
      ];
      setMessages(closing);
      setStep(nextStep);
      await finalize(closing);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const progress = Math.min(step, QUESTIONS.length);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            aria-label="Zpět"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={leslieAvatar} alt="Leslie AI" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-display font-semibold text-foreground">Leslie</span>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {progress}/{QUESTIONS.length}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 pt-4 pb-2">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 py-2">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <img
                  src={leslieAvatar}
                  alt="Leslie"
                  className="w-8 h-8 rounded-lg object-cover shrink-0 mt-0.5"
                />
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-accent text-accent-foreground rounded-br-sm"
                    : "bg-card border border-border text-foreground rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
          {submitting && step >= QUESTIONS.length && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pl-10">
              <Loader2 className="w-4 h-4 animate-spin" />
              Ukládám…
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="sticky bottom-0 bg-background pt-3 pb-4 flex items-center gap-2"
        >
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              step >= QUESTIONS.length
                ? "Hotovo!"
                : step === QUESTIONS.length - 1
                  ? "Napiš částku nebo nech prázdné…"
                  : "Napiš svou odpověď…"
            }
            disabled={submitting || step >= QUESTIONS.length}
            className="h-11"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={
              submitting ||
              step >= QUESTIONS.length ||
              (step !== QUESTIONS.length - 1 && !input.trim())
            }
            aria-label="Odeslat"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}