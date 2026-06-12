import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Trash2, Copy, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SavedLetter {
  id: string;
  job_title: string;
  company: string | null;
  location: string | null;
  language: string;
  content: string;
  created_at: string;
}

const CoverLetters = () => {
  const { supabaseUser } = useUser();
  const { toast } = useToast();
  const [items, setItems] = useState<SavedLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabaseUser?.id) return;
    (async () => {
      const { data } = await supabase
        .from("user_cover_letters")
        .select("id,job_title,company,location,language,content,created_at")
        .eq("user_id", supabaseUser.id)
        .order("created_at", { ascending: false });
      setItems((data as SavedLetter[]) || []);
      setLoading(false);
    })();
  }, [supabaseUser?.id]);

  const open = (l: SavedLetter) => { setOpenId(l.id); setDraft(l.content); };
  const save = async () => {
    if (!openId) return;
    setSaving(true);
    await supabase.from("user_cover_letters").update({ content: draft }).eq("id", openId);
    setItems((arr) => arr.map((x) => (x.id === openId ? { ...x, content: draft } : x)));
    setSaving(false);
    toast({ title: "Uloženo" });
  };
  const remove = async (id: string) => {
    await supabase.from("user_cover_letters").delete().eq("id", id);
    setItems((arr) => arr.filter((x) => x.id !== id));
    if (openId === id) setOpenId(null);
  };
  const copy = () => { navigator.clipboard.writeText(draft); toast({ title: "Zkopírováno" }); };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Zpět
          </Link>
          <h1 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Motivační dopisy</h1>
        </div>
      </header>
      <div className="max-w-5xl mx-auto p-4 grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Zatím žádné dopisy. Vygeneruj jeden z nabídky práce.
            </p>
          ) : items.map((l) => (
            <button
              key={l.id}
              onClick={() => open(l)}
              className={`w-full text-left border rounded-md p-3 hover:border-accent transition ${openId === l.id ? "border-accent bg-accent/5" : ""}`}
            >
              <div className="font-medium text-sm">{l.job_title}</div>
              <div className="text-xs text-muted-foreground">
                {[l.company, l.location].filter(Boolean).join(" · ")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(l.created_at).toLocaleDateString("cs-CZ")}
              </div>
            </button>
          ))}
        </div>
        <div>
          {openId ? (
            <div className="space-y-2">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[420px] text-sm" />
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Uložit
                </Button>
                <Button size="sm" variant="outline" onClick={copy}><Copy className="w-4 h-4 mr-1" /> Kopírovat</Button>
                <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => remove(openId)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Smazat
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8 border rounded-md">
              Vyber dopis vlevo
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoverLetters;