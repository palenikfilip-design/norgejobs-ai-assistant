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
import type { CvData, CvRecord, CvTemplate, CvWorkEntry, CvEducationEntry, CvLanguageEntry, CvCertificationEntry } from "@/types/cv";
import { parseLanguages, parseCertifications, prefillCvFromProfile } from "@/utils/cvPrefill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

const LANGUAGE_LEVELS = [
  "Začátečník (A1)",
  "Základní (A2)",
  "Středně pokročilá (B1)",
  "Pokročilá (B2)",
  "Velmi pokročilá (C1)",
  "Rodilý mluvčí (C2)",
];

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
        languages: parseLanguages(r.languages),
        certifications: parseCertifications(r.certifications),
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

  // Languages
  const addLang = () => update("languages", [...data.languages, { name: "", level: "" }]);
  const updateLang = (i: number, patch: Partial<CvLanguageEntry>) =>
    update("languages", data.languages.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLang = (i: number) => update("languages", data.languages.filter((_, idx) => idx !== i));

  // Skills
  const [skillDraft, setSkillDraft] = useState("");
  const addSkill = () => {
    const v = skillDraft.trim();
    if (!v) return;
    if (!data.skills.includes(v)) update("skills", [...data.skills, v]);
    setSkillDraft("");
  };
  const removeSkill = (i: number) => update("skills", data.skills.filter((_, idx) => idx !== i));

  // Certifications
  const addCert = () => update("certifications", [...data.certifications, { name: "", year: "", issuer: "" }]);
  const updateCert = (i: number, patch: Partial<CvCertificationEntry>) =>
    update("certifications", data.certifications.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCert = (i: number) => update("certifications", data.certifications.filter((_, idx) => idx !== i));

  const loadFromProfile = async () => {
    if (!supabaseUser?.id) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, profession, current_residence, country, languages, skills, work_experience, certifications")
      .eq("user_id", supabaseUser.id)
      .maybeSingle();
    if (!prof) {
      toast({ title: "Profil nebyl nalezen", variant: "destructive" });
      return;
    }
    const prefill = prefillCvFromProfile({ email: supabaseUser.email ?? "", profile: prof as any });
    setData((d) => ({
      // keep already-filled fields, only fill empty ones + merge lists
      full_name: d.full_name || prefill.full_name,
      headline: d.headline || prefill.headline,
      email: d.email || prefill.email,
      phone: d.phone,
      location: d.location || prefill.location,
      summary: d.summary,
      work_experience: d.work_experience.length ? d.work_experience : prefill.work_experience,
      education: d.education,
      skills: Array.from(new Set([...d.skills, ...prefill.skills])),
      languages: d.languages.length ? d.languages : prefill.languages,
      certifications: d.certifications.length ? d.certifications : prefill.certifications,
    }));
    toast({ title: "Načteno z profilu" });
  };

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
          <Button onClick={loadFromProfile} size="sm" variant="outline" title="Doplnit chybějící údaje z tvého profilu">
            <Download className="w-4 h-4 mr-1" /> Načíst z profilu
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

          {/* Languages */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Jazyky</h2>
              <Button size="sm" variant="outline" onClick={addLang}><Plus className="w-4 h-4 mr-1" /> Přidat</Button>
            </div>
            {data.languages.length === 0 && (
              <p className="text-xs text-muted-foreground">Zatím žádné jazyky. Klikni "Přidat".</p>
            )}
            {data.languages.map((l, i) => (
              <div key={i} className="flex items-end gap-2 border rounded-md p-2">
                <div className="flex-1">
                  <Label className="text-xs">Jazyk</Label>
                  <Input value={l.name} placeholder="Angličtina" onChange={(e) => updateLang(i, { name: e.target.value })} />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Úroveň</Label>
                  <Select value={l.level || ""} onValueChange={(v) => updateLang(i, { level: v })}>
                    <SelectTrigger><SelectValue placeholder="Vyber úroveň" /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_LEVELS.map((lv) => <SelectItem key={lv} value={lv}>{lv}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeLang(i)} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </section>

          {/* Skills */}
          <section className="space-y-2">
            <h2 className="font-semibold">Dovednosti</h2>
            <div className="flex gap-2">
              <Input
                value={skillDraft}
                placeholder="např. JavaScript"
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              />
              <Button onClick={addSkill} variant="outline"><Plus className="w-4 h-4 mr-1" /> Přidat</Button>
            </div>
            {data.skills.length === 0 && (
              <p className="text-xs text-muted-foreground">Zatím žádné dovednosti.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {data.skills.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-sm">
                  {s}
                  <button onClick={() => removeSkill(i)} className="text-muted-foreground hover:text-destructive" aria-label={`Odebrat ${s}`}>×</button>
                </span>
              ))}
            </div>
          </section>

          {/* Certifications */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Certifikace</h2>
              <Button size="sm" variant="outline" onClick={addCert}><Plus className="w-4 h-4 mr-1" /> Přidat</Button>
            </div>
            {data.certifications.length === 0 && (
              <p className="text-xs text-muted-foreground">Zatím žádné certifikace.</p>
            )}
            {data.certifications.map((c, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3"><Label className="text-xs">Název</Label><Input value={c.name} onChange={(e) => updateCert(i, { name: e.target.value })} placeholder="Řidičský průkaz B" /></div>
                  <div className="col-span-2"><Label className="text-xs">Vydavatel (volitelné)</Label><Input value={c.issuer ?? ""} onChange={(e) => updateCert(i, { issuer: e.target.value })} /></div>
                  <div><Label className="text-xs">Rok (volitelné)</Label><Input value={c.year ?? ""} onChange={(e) => updateCert(i, { year: e.target.value })} placeholder="2024" /></div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeCert(i)} className="text-destructive"><Trash2 className="w-3 h-3 mr-1" /> Odebrat</Button>
              </div>
            ))}
          </section>
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