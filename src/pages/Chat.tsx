import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Send, User } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import LeslieAvatar from "@/components/LeslieAvatar";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const Chat = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const avatar = user.profile;
  const firstName = avatar?.fullName.split(" ")[0] || "there";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("chat.welcome", { name: firstName }),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Refresh the welcome line when the UI language changes (only if it's
  // still the only message — otherwise leave the existing conversation).
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0].id !== "welcome") return prev;
      return [{ id: "welcome", role: "assistant", content: t("chat.welcome", { name: firstName }) }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const sendMessage = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending) return;

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-leslie", {
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          userName: firstName,
        },
      });

      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        if (status === 429) {
          toast({ title: t("chat.errorTitle"), description: t("chat.rateLimited"), variant: "destructive" });
        } else if (status === 402) {
          toast({ title: t("chat.errorTitle"), description: t("chat.paymentRequired"), variant: "destructive" });
        } else {
          toast({ title: t("chat.errorTitle"), description: t("chat.errorDesc"), variant: "destructive" });
        }
        setSending(false);
        return;
      }

      const reply: string = (data as { reply?: string })?.reply ?? "";
      setMessages((m) => [
        ...m,
        { id: `a_${Date.now()}`, role: "assistant", content: reply || t("chat.errorDesc") },
      ]);
    } catch (e) {
      console.error("chat-leslie call failed:", e);
      toast({ title: t("chat.errorTitle"), description: t("chat.errorDesc"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/dashboard");
            }}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <LeslieAvatar className="w-8 h-8" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-foreground text-sm truncate">{t("chat.title")}</p>
            <p className="text-xs text-muted-foreground truncate">{t("chat.subtitle")}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i === messages.length - 1 ? 0.1 : 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <LeslieAvatar className="w-8 h-8 shrink-0 mt-0.5" />
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-navy text-primary-foreground rounded-br-md"
                    : "glass-card rounded-bl-md"
                }`}
              >
                {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                  part.startsWith("**") && part.endsWith("**") ? (
                    <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pl-11">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("chat.thinking")}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-card/80 backdrop-blur-xl border-t border-border/50 p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={t("chat.placeholder")}
            disabled={sending}
            className="flex-1"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="bg-accent-gradient text-accent-foreground hover:opacity-90"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <div className="max-w-2xl mx-auto mt-2 flex gap-2 overflow-x-auto">
          {((t("chat.suggestions", { returnObjects: true, defaultValue: [] }) as unknown as string[]) ?? []).map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={sending}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Chat;
