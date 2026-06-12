import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Printer, Loader2, Trash2, Eye, Pencil, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CvPreview from "@/components/cv/CvPreview";
import type { CvData, CvRecord, CvTemplate, CvWorkEntry, CvEducationEntry } from "@/types/cv";

const TEMPLATES: { id: CvTemplate; label: string; desc: string }[] = [
  { id: "modern", label: "Moderní", desc: "Čisté, s červeným akcentem" },
  { id: "classic", label: "Klasická", desc: "Tradiční, vážné" },
  { id: "creative", label: "Kreativní", desc: "Barevné bloky" },
];

const CVEditor = () => {
  const { id } = useParams<{ id: string }>();
  const { supabaseUser } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [polishing, setPolishing] = useState<string | null>(null);
  const [title, setTitle] = useState("Můj životopis");
  const [template, setTemplate] = useState<CvTemplate>("modern");
  const [data, setData] = useState<CvData>({
    full_name: "", headline: "", email: "", phone: "", location: "", summary: "",
    work_experience: [], education: [], skills: [], languages: [], certifications: [],
  });
  const saveTimer = useRef<number | null>(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!supabaseUser?.id || !id) return;
    (async () => {
      const { data: row, error } = await supabase.from("user_cvs").select("*").eq("id", id).maybeSingle();
      if (error || !row) {
        toast({ title: "Životopis nenalezen", variant: "destructive" });
        navigate("/cv");
        return;
      }
      const r = row as unknown as CvRecord;
      setTitle(r.title || "Můj životopis");
      setTemplate((r.template as CvTemplate) || "modern");
      setData({
        full_name: r.full_name || "",
        headline: r.headline || "",
        email: r.email || "",
        phone: r.phone || "",
        location: r.location || "",
        summary: r.summary || "",
        work_experience: Array.isArray(r.work_experience) ? r.work_experience : [],
        education: Array.isArray(r.education) ? r.education : [],
        skills: Array.isArray(r.skills) ? r.skills : [],
        languages: Array.isArray(r.languages) ? r.languages : [],
        certifications: Array.isArray(r.certifications) ? r.certifications : [],
      });
      setLoading(false);
      hasLoaded.current = true;
    })();
  }, [supabaseUser?.id, id, navigate, toast]);

  // Debounced auto-save
  useEffect(() => {
    if (!hasLoaded.current || !id) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      await supabase.from("user_cvs").update({
        title, template,
        full_name: data.full_name, headline: data.headline, email: data.email, phone: data.phone,
        location: data.location, summary: data.summary,
        work_experience: data.work_experience as any,
        education: data.education as any,
        skills: data.skills as any,
        languages: data.languages as any,
        certifications: data.certifications as any,
      }).eq("id", id);
      setSaving(false);
    }, 800);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [data, template, title, id]);

  const update = <K extends keyof CvData>(k: K, v: CvData[K]) => setData((d) => ({ ...d, [k]: v }));

  const polish = async (kind: "summary" | "headline" | "work", text: string, key: string): Promise<string | null> => {
    if (!text.trim()) {
      toast({ title: "Nejdřív něco napiš", description: "AI vylepšení potřebuje výchozí text." });
      return null;
    }
    setPolishing(key);
    try {
      const { data: res, error } = await supabase.functions.invoke("polish-cv-text", {
        body: { text, kind, language: "cs" },
      });
      if (error) {
        const ctx: any = (error as any).context;
        if (ctx?.status === 403) toast({ title: "Měsíční limit AI dosažen", variant: "destructive" });
        else toast({ title: "AI vylepšení selhalo", variant: "destructive" });
        return null;
      }
      if (res?.error) {
        toast({ title: res.error === "limit_reached" ? "Měsíční limit AI dosažen" : "AI vylepšení selhalo", variant: "destructive" });
        return null;
      }
      toast({ title: "Vylepšeno ✨" });
      return res?.polished ?? null;
    } catch (e: any) {
      toast({ title: "AI vylepšení selhalo", description: e?.message, variant: "destructive" });
      return null;
    } finally {
      setPolishing(null);
    }
  };

  const addWork = () => update("work_experience", [...data.work_experience, { position: "", company: "", period: "", description: "" }]);
  const updateWork = (i: number, patch: Partial<CvWorkEntry>) =>
    update("work_experience", data.work_experience.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  const removeWork = (i: number) => update("work_experience", data.work_experience.filter((_, idx) => idx !== i));

  const addEdu = () => update("education", [...data.education, { school: "", degree: "", period: "", description: "" }]);
  const updateEdu = (i: number, patch: Partial<CvEducationEntry>) =>
    update("education", data.education.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const removeEdu = (i: number) => update("education", data.education.filter((_, idx) => idx !== i));

  const listInput = (label: string, value: string[], onChange: (v: string[]) => void, placeholder: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        value={value.join(", ")}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
      />
      <p className="text-xs text-muted-foreground">Odděluj čárkou</p>
    </div>
  );

  const preview = useMemo(() => <CvPreview data={data} template={template} />, [data, template]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }

  return (
    <div className="min-h-screen bg-background cv-page">
      <header className="border-b print:hidden sticky top-0 bg-background z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link to="/cv" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Zpět
          </Link>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs h-9" />
          <div className="flex gap-1 ml-auto">
            {TEMPLATES.map((t) => (
              <Button key={t.id} variant={template === t.id ? "default" : "outline"} size="sm" onClick={() => setTemplate(t.id)}>
                {t.label}
              </Button>
            ))}
          </div>
          <Button onClick={() => window.print()} size="sm" variant="default">
            <Printer className="w-4 h-4 mr-1" /> Stáhnout PDF
          </Button>
          <span className="text-xs text-muted-foreground w-20 text-right">
            {saving ? "Ukládám…" : "Uloženo"}
          </span>
        </div>
        <div className="lg:hidden border-t flex">
          <button onClick={() => setTab("edit")} className={`flex-1 py-2 text-sm flex items-center justify-center gap-1 ${tab === "edit" ? "bg-accent/10 text-accent" : ""}`}>
            <Pencil className="w-4 h-4" /> Editor
          </button>
          <button onClick={() => setTab("preview")} className={`flex-1 py-2 text-sm flex items-center justify-center gap-1 ${tab === "preview" ? "bg-accent/10 text-accent" : ""}`}>
            <Eye className="w-4 h-4" /> Náhled
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-6 p-4 print:p-0 print:max-w-none print:grid-cols-1 print:gap-0">
        {/* Editor */}
        <div className={`space-y-6 print:hidden ${tab === "edit" ? "" : "hidden lg:block"}`}>
          <section className="space-y-3">
            <h2 className="font-semibold">Osobní údaje</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Jméno</Label><Input value={data.full_name} onChange={(e) => update("full_name", e.target.value)} /></div>
              <div><Label>Pozice / titulek</Label><Input value={data.headline} onChange={(e) => update("headline", e.target.value)} /></div>
              <div><Label>Email</Label><Input value={data.email} onChange={(e) => update("email", e.target.value)} /></div>
              <div><Label>Telefon</Label><Input value={data.phone} onChange={(e) => update("phone", e.target.value)} /></div>
              <div className="col-span-2"><Label>Lokalita</Label><Input value={data.location} onChange={(e) => update("location", e.target.value)} /></div>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Shrnutí</h2>
              <Button size="sm" variant="ghost" disabled={polishing === "summary"} onClick={async () => {
                const out = await polish("summary", data.summary, "summary");
                if (out) update("summary", out);
              }}>
                {polishing === "summary" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Vylepšit
              </Button>
            </div>
            <Textarea rows={4} value={data.summary} onChange={(e) => update("summary", e.target.value)} placeholder="Krátký odstavec o tobě…" />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Pracovní zkušenosti</h2>
              <Button size="sm" variant="outline" onClick={addWork}><Plus className="w-4 h-4 mr-1" /> Přidat</Button>
            </div>
            {data.work_experience.map((w, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Pozice</Label><Input value={w.position} onChange={(e) => updateWork(i, { position: e.target.value })} /></div>
                  <div><Label className="text-xs">Firma</Label><Input value={w.company} onChange={(e) => updateWork(i, { company: e.target.value })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Období (od – do)</Label><Input value={w.period} onChange={(e) => updateWork(i, { period: e.target.value })} placeholder="2022 – nyní" /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Popis</Label>
                    <Button size="sm" variant="ghost" disabled={polishing === `work-${i}`} onClick={async () => {
                      const out = await polish("work", w.description, `work-${i}`);
                      if (out) updateWork(i, { description: out });
                    }}>
                      {polishing === `work-${i}` ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                      Vylepšit
                    </Button>
                  </div>
                  <Textarea rows={3} value={w.description} onChange={(e) => updateWork(i, { description: e.target.value })} />
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeWork(i)} className="text-destructive"><Trash2 className="w-3 h-3 mr-1" /> Odebrat</Button>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Vzdělání</h2>
              <Button size="sm" variant="outline" onClick={addEdu}><Plus className="w-4 h-4 mr-1" /> Přidat</Button>
            </div>
            {data.education.map((e, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Škola</Label><Input value={e.school} onChange={(ev) => updateEdu(i, { school: ev.target.value })} /></div>
                  <div><Label className="text-xs">Titul / obor</Label><Input value={e.degree} onChange={(ev) => updateEdu(i, { degree: ev.target.value })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Období</Label><Input value={e.period} onChange={(ev) => updateEdu(i, { period: ev.target.value })} /></div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeEdu(i)} className="text-destructive"><Trash2 className="w-3 h-3 mr-1" /> Odebrat</Button>
              </div>
            ))}
          </section>

          {listInput("Dovednosti", data.skills, (v) => update("skills", v), "JavaScript, Excel, …")}
          {listInput("Jazyky", data.languages, (v) => update("languages", v), "Čeština C2, Angličtina B2")}
          {listInput("Certifikace", data.certifications, (v) => update("certifications", v), "Řidičský průkaz B, …")}
        </div>

        {/* Preview */}
        <div className={`${tab === "preview" ? "" : "hidden lg:block"} print:block`}>
          <div className="cv-preview-frame">{preview}</div>
        </div>
      </div>
    </div>
  );
};

export default CVEditor;