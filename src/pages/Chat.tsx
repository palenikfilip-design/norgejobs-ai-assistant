import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { mockJobs } from "@/data/mockJobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, ArrowLeft, Send, User } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function generateResponse(text: string, userName: string, skills: string[], countries: string[]): string {
  const lower = text.toLowerCase();

  if (lower.includes("norway") || lower.includes("norge")) {
    const norwayJobs = mockJobs.filter((j) => j.country === "Norway");
    if (norwayJobs.length > 0) {
      return `I found ${norwayJobs.length} jobs in Norway for you:\n\n${norwayJobs
        .map((j) => `• **${j.title}** at ${j.company} (${j.city}) — ${j.salary}`)
        .join("\n")}\n\nWould you like me to tell you more about any of these?`;
    }
    return "I don't have Norway jobs matching your profile right now, but I'm always scanning for new opportunities!";
  }

  if (lower.includes("skill") || lower.includes("improve") || lower.includes("learn")) {
    const suggestions = ["Cloud Computing (AWS/Azure)", "Data Analysis", "Project Management", "Communication Skills"];
    return `Based on your current skills (${skills.slice(0, 3).join(", ")}), here are skills that could boost your profile:\n\n${suggestions.map((s) => `• **${s}**`).join("\n")}\n\nThese are in high demand in ${countries.join(" and ")}.`;
  }

  if (lower.includes("germany") || lower.includes("berlin") || lower.includes("munich")) {
    const germanyJobs = mockJobs.filter((j) => j.country === "Germany");
    return germanyJobs.length > 0
      ? `Here are jobs in Germany:\n\n${germanyJobs.map((j) => `• **${j.title}** at ${j.company} (${j.city}) — ${j.salary}`).join("\n")}`
      : "No German jobs match your current profile, but I'll keep looking!";
  }

  if (lower.includes("austria")) {
    const austriaJobs = mockJobs.filter((j) => j.country === "Austria");
    return austriaJobs.length > 0
      ? `Here are jobs in Austria:\n\n${austriaJobs.map((j) => `• **${j.title}** at ${j.company} (${j.city}) — ${j.salary}`).join("\n")}`
      : "No Austrian jobs right now, but I'm on it!";
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return `Hey ${userName}! 👋 I'm your NorgeJobs AI assistant. I can help you find jobs, suggest skills to learn, or answer questions about working abroad. What would you like to know?`;
  }

  if (lower.includes("salary") || lower.includes("pay") || lower.includes("money")) {
    return `Salaries vary by country and role. In Norway, tech roles typically pay €50,000–€80,000, while manual labor ranges €28,000–€45,000. Would you like me to find jobs within your salary expectations?`;
  }

  return `That's a great question, ${userName}! I'm still learning, but here's what I can help with:\n\n• Find jobs by country\n• Suggest skills to improve\n• Compare salaries\n• Explain job requirements\n\nTry asking "Find me jobs in Norway" or "What skills should I improve?"`;
}

const Chat = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const avatar = user.avatar;
  const firstName = avatar?.fullName.split(" ")[0] || "there";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${firstName}! 👋 I'm your NorgeJobs AI assistant. Ask me anything about job opportunities, skills, or working abroad. How can I help you today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    setTimeout(() => {
      const response = generateResponse(text, firstName, avatar?.skills || [], avatar?.preferredCountries || []);
      setMessages((m) => [...m, { id: (Date.now() + 1).toString(), role: "assistant", content: response }]);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-lg bg-accent-gradient flex items-center justify-center">
            <Bot className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <p className="font-display font-semibold text-foreground text-sm">NorgeJobs AI</p>
            <p className="text-xs text-muted-foreground">Your job assistant</p>
          </div>
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
                <div className="w-8 h-8 rounded-lg bg-accent-gradient flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-accent-foreground" />
                </div>
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
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-card/80 backdrop-blur-xl border-t border-border/50 p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask me anything about jobs..."
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="bg-accent-gradient text-accent-foreground hover:opacity-90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="max-w-2xl mx-auto mt-2 flex gap-2 overflow-x-auto">
          {["Find me jobs in Norway", "What skills should I improve?", "Jobs in Germany"].map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
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
