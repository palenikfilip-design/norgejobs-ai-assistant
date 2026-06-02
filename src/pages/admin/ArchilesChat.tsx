import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, ChevronDown, ChevronRight } from "lucide-react";
import ArchilesLayout from "./ArchilesLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Msg {
  id?: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: any;
  created_at?: string;
}

export default function ArchilesChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [openTools, setOpenTools] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setAdminId(data.user.id);
      supabase
        .from("archiles_chat_history")
        .select("id, message_role, message_content, tool_calls, created_at")
        .eq("admin_id", data.user.id)
        .order("created_at", { ascending: true })
        .limit(100)
        .then(({ data: rows }) => {
          setMessages((rows ?? []).map((r: any) => ({
            id: r.id,
            role: r.message_role,
            content: r.message_content,
            tool_calls: r.tool_calls,
            created_at: r.created_at,
          })));
        });
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const { data, error } = await supabase.functions.invoke("chat-archiles", {
        body: { messages: [...messages, userMsg].map(({ role, content, tool_calls }) => ({ role, content, tool_calls })) },
      });
      if (error) throw error;
      const reply: Msg = { role: "assistant", content: data.reply ?? "", tool_calls: data.tool_calls };
      setMessages((m) => [...m, reply]);
    } catch (e: any) {
      toast.error(`Chat selhal: ${e.message ?? e}`);
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Něco se pokazilo. Zkus znova." }]);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending]);

  return (
    <ArchilesLayout title="Chat s Archilem">
      <Card className="flex flex-col" style={{ minHeight: "calc(100vh - 220px)" }}>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Zeptej se Archila na cokoli ohledně katalogu. Třeba: „Jaký je stav katalogu?", „Najdi mi norské sezónní zdroje", „Proč má Stripe jen 50 trust score?".
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={
                m.role === "user"
                  ? "max-w-[80%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                  : "max-w-[85%] text-sm whitespace-pre-wrap"
              }>
                {m.content}
                {m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                  <div className="mt-2 border border-border rounded">
                    <button
                      onClick={() => setOpenTools((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                      className="w-full flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40"
                    >
                      {openTools.has(i) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Tool calls ({m.tool_calls.length})
                    </button>
                    {openTools.has(i) && (
                      <pre className="text-xs bg-muted/20 p-2 overflow-x-auto max-h-64">{JSON.stringify(m.tool_calls, null, 2)}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Archiles přemýšlí…
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>
        <div className="p-3 border-t border-border flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Napiš zprávu… (Enter pro odeslání)"
            rows={2}
            className="resize-none"
          />
          <Button onClick={send} disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </ArchilesLayout>
  );
}