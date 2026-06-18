import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Send, User, ThumbsUp, ThumbsDown, ExternalLink, Plus, Sparkles, History, Trash2 } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import LeslieAvatar from "@/components/LeslieAvatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface JobCard {
  id: string;
  title: string;
  title_cs?: string | null;
  summary_cs?: string | null;
  company: string | null;
  location: string | null;
  country: string | null;
  salary_normalized_eur: number | null;
  salary_estimated_eur?: number | null;
  salary_is_estimated?: boolean | null;
  salary: string | null;
  currency: string | null;
  url: string;
  display_category: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  jobs?: JobCard[];
  preset_id?: string | null;
  preset_name?: string | null;
}

const WELCOME = "Ahoj! Jsem Leslie. Řekni mi, jakou práci hledáš v zahraničí – kam chceš jet, co umíš, kolik chceš brát – a já ti hned ukážu konkrétní nabídky z našeho katalogu.";

interface ConversationRow {
  id: string;
  title: string | null;
  created_at: string;
  last_message_at: string;
}

function relativeCs(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "právě teď";
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  if (d === 1) return "včera";
  if (d < 30) return `před ${d} dny`;
  const m = Math.floor(d / 30);
  if (m < 12) return `před ${m} měs.`;
  return `před ${Math.floor(d / 365)} r.`;
}

const Chat = () => {
  const { user, supabaseUser } = useUser();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const avatar = user.profile;
  const firstName = avatar?.fullName.split(" ")[0] || "kámo";

  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike">>({});
  const [ratingDetails, setRatingDetails] = useState<Record<string, { action: "like" | "dislike"; title: string; company: string | null; country: string | null; category: string | null }>>({});
  const [pendingRatingsSent, setPendingRatingsSent] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Array<ConversationRow & { message_count: number }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => { inputRef.current?.focus(); }, [sending]);

  const loadConversationMessages = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from("leslie_chat_history")
      .select("id,message_role,message_content,metadata,preset_id,created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (error || !data) {
      setMessages([{ id: "welcome", role: "assistant", content: WELCOME }]);
      return;
    }
    const loaded: Message[] = data
      .filter((r) => r.message_role === "user" || r.message_role === "assistant")
      .map((r) => {
        const meta = (r.metadata ?? {}) as { jobs?: JobCard[]; preset_name?: string | null };
        return {
          id: r.id,
          role: r.message_role as "user" | "assistant",
          content: r.message_content,
          jobs: meta.jobs ?? undefined,
          preset_id: r.preset_id ?? undefined,
          preset_name: meta.preset_name ?? undefined,
        };
      });
    setMessages([{ id: "welcome", role: "assistant", content: WELCOME }, ...loaded]);
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!supabaseUser) return [] as ConversationRow[];
    const { data: convs } = await supabase
      .from("leslie_conversations")
      .select("id,title,created_at,last_message_at")
      .is("deleted_at", null)
      .order("last_message_at", { ascending: false });
    if (!convs) return [];
    const ids = convs.map((c) => c.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: hist } = await supabase
        .from("leslie_chat_history")
        .select("conversation_id")
        .in("conversation_id", ids);
      (hist ?? []).forEach((h) => {
        const k = h.conversation_id as string;
        if (k) counts[k] = (counts[k] ?? 0) + 1;
      });
    }
    setConversations(convs.map((c) => ({ ...c, message_count: counts[c.id] ?? 0 })));
    return convs as ConversationRow[];
  }, [supabaseUser]);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const convs = await refreshConversations();
      if (convs.length > 0) {
        setConversationId(convs[0].id);
        await loadConversationMessages(convs[0].id);
      } else {
        setConversationId(crypto.randomUUID());
      }
    })();
  }, [supabaseUser, refreshConversations, loadConversationMessages]);

  const newConversation = async () => {
    setConversationId(crypto.randomUUID());
    setMessages([{ id: "welcome", role: "assistant", content: WELCOME }]);
    setReactions({});
    setRatingDetails({});
    setPendingRatingsSent(false);
    setInput("");
    setHistoryOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const switchConversation = async (id: string) => {
    setHistoryOpen(false);
    setConversationId(id);
    setReactions({});
    setRatingDetails({});
    setPendingRatingsSent(false);
    await loadConversationMessages(id);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("leslie_conversations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) {
      await newConversation();
    }
  };

  const reactToJob = async (job: JobCard, presetId: string | null | undefined, action: "like" | "dislike") => {
    if (!supabaseUser) return;
    setReactions((r) => ({ ...r, [job.id]: action }));
    setRatingDetails((r) => ({
      ...r,
      [job.id]: {
        action,
        title: job.title_cs || job.title,
        company: job.company,
        country: job.country,
        category: job.display_category,
      },
    }));
    setPendingRatingsSent(false);
    await supabase.from("user_job_interactions").insert({
      user_id: supabaseUser.id,
      job_id: job.id,
      action_type: action,
      metadata: { source: "leslie", preset_id: presetId ?? null, country: job.country, category: job.display_category },
    });
  };

  const sendMessage = async (raw?: string, opts?: { includeRatings?: boolean; visibleText?: string }) => {
    const text = (raw ?? input).trim();
    if ((!text && !opts?.includeRatings) || sending) return;

    const visibleText = opts?.visibleText ?? text;
    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: visibleText };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);

    const ratingsPayload = opts?.includeRatings ? Object.values(ratingDetails) : [];

    try {
      const { data, error } = await supabase.functions.invoke("chat-leslie", {
        body: {
          messages: next.filter((m) => m.id !== "welcome").map((m) => ({ role: m.role, content: m.content })),
          userName: firstName,
          ratings: ratingsPayload,
          conversation_id: conversationId,
        },
      });
      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        toast({
          title: "Chyba",
          description: status === 429 ? "Moc rychle. Zkus to za chvíli." : status === 402 ? "Došly kredity." : "Něco se pokazilo.",
          variant: "destructive",
        });
        setSending(false);
        return;
      }
      const d = data as { reply?: string; jobs?: JobCard[]; preset_id?: string | null; preset_name?: string | null; conversation_id?: string };
      if (d?.conversation_id && d.conversation_id !== conversationId) {
        setConversationId(d.conversation_id);
      }
      setMessages((m) => [...m, {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: d?.reply || "...",
        jobs: d?.jobs,
        preset_id: d?.preset_id,
        preset_name: d?.preset_name,
      }]);
      refreshConversations();
      if (opts?.includeRatings) {
        setPendingRatingsSent(true);
        setRatingDetails({});
      }
    } catch (e) {
      console.error("chat-leslie call failed:", e);
      toast({ title: "Chyba", description: "Něco se pokazilo.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const ratingsCount = Object.keys(ratingDetails).length;
  const showDoneButton = ratingsCount >= 2 && !sending && !pendingRatingsSent;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <LeslieAvatar className="w-8 h-8" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-foreground text-sm truncate">{t("chat.title", { defaultValue: "Leslie" })}</p>
            <p className="text-xs text-muted-foreground truncate">Vyhledávač práce v zahraničí</p>
          </div>
          <Button variant="ghost" size="sm" onClick={newConversation} className="text-xs">
            <Plus className="w-4 h-4 mr-1" /> Nová
          </Button>
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
              <div className={`max-w-[85%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
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
                {msg.role === "assistant" && msg.preset_name && (
                  <div className="text-xs text-muted-foreground px-1">📌 Preset: <strong>{msg.preset_name}</strong></div>
                )}
                {msg.role === "assistant" && msg.jobs && msg.jobs.length > 0 && (
                  <div className="w-full space-y-2 mt-1">
                    {msg.jobs.map((job) => (
                      <div key={job.id} className="glass-card rounded-xl p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{job.title_cs || job.title}</p>
                            {job.title_cs && job.title_cs !== job.title && (
                              <p className="text-[11px] text-muted-foreground/70 italic truncate">orig: {job.title}</p>
                            )}
                            <p className="text-xs text-muted-foreground truncate">
                              {job.company ? `${job.company} · ` : ""}{job.location || job.country || ""}
                            </p>
                            {(() => {
                              if (job.salary_normalized_eur) {
                                return (
                                  <p className="text-xs text-accent mt-0.5">
                                    ~{job.salary_normalized_eur.toLocaleString()} €/měs
                                  </p>
                                );
                              }
                              if (job.salary_is_estimated && job.salary_estimated_eur) {
                                return (
                                  <p className="text-xs text-muted-foreground italic mt-0.5">
                                    odhad ~{job.salary_estimated_eur.toLocaleString()} €/měs (plat neuveden)
                                  </p>
                                );
                              }
                              if (job.salary) {
                                return <p className="text-xs text-accent mt-0.5">{job.salary}</p>;
                              }
                              return null;
                            })()}
                            {job.summary_cs && (
                              <p className="text-xs text-foreground/80 mt-1 line-clamp-2">{job.summary_cs}</p>
                            )}
                          </div>
                          <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant={reactions[job.id] === "like" ? "default" : "outline"} className="h-7 px-2"
                            onClick={() => reactToJob(job, msg.preset_id, "like")}>
                            <ThumbsUp className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant={reactions[job.id] === "dislike" ? "default" : "outline"} className="h-7 px-2"
                            onClick={() => reactToJob(job, msg.preset_id, "dislike")}>
                            <ThumbsDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
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
          {showDoneButton && (
            <div className="flex justify-center pt-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => sendMessage("", {
                  includeRatings: true,
                  visibleText: `Ohodnotil jsem ${ratingsCount} nabídek — co dál?`,
                })}
              >
                <Sparkles className="w-4 h-4 mr-1" /> Hotovo, co dál?
              </Button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-card/80 backdrop-blur-xl border-t border-border/50 p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Napiš, co hledáš..."
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
      </div>
    </div>
  );
};

export default Chat;
