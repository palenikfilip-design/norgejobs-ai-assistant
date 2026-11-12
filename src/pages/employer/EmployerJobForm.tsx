import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";
import { CURRENCIES, JOB_CATEGORIES, SKILL_LEVELS, type SkillLevel, JOB_TYPES, LANG_LEVELS, completeness, type EmployerJobStatus } from "@/lib/employerJobs";

type Lang = { language: string; level: string };
type Form = {
  title: string; category: string; skill_class: SkillLevel | ""; country: string; city: string; job_type: string; start_immediately: boolean; start_date: string;
  duration: string; salary_amount: string; salary_currency: string; salary_period: "hour" | "month";
  accommodation_provided: boolean; accommodation_cost: string; languages: Lang[]; experience: string;
  working_hours: string; food_provided: boolean | null; transport_provided: boolean | null; description: string;
  benefits: string; expiry_date: string;
};
const empty: Form = {
  title: "", category: "", skill_class: "", country: "", city: "", job_type: "seasonal", start_immediately: false, start_date: "", duration: "",
  salary_amount: "", salary_currency: "EUR", salary_period: "month", accommodation_provided: false, accommodation_cost: "",
  languages: [], experience: "", working_hours: "", food_provided: null, transport_provided: null, description: "",
  benefits: "", expiry_date: "",
};
const sel = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const TriState = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) => (
  <select className={sel} value={value == null ? "" : value ? "yes" : "no"}
    onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "yes")}>
    <option value="">Neuvedeno</option><option value="yes">Ano</option><option value="no">Ne</option>
  </select>
);

const EmployerJobForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [status, setStatus] = useState<EmployerJobStatus>("draft");
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectionNote, setRejectionNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");
      const { data: c } = await supabase.from("companies").select("id,status").eq("user_id", user.id).maybeSingle();
      if (!c || c.status === "draft") return navigate("/employer/company");
      setCompanyId(c.id);
      if (id) {
        const { data: j } = await supabase.from("employer_jobs").select("*").eq("id", id).maybeSingle();
        if (!j) return navigate("/employer/dashboard");
        setStatus(j.status as EmployerJobStatus);
        setRejectionNote(j.status === "draft" ? j.rejection_note : null);
        setForm({
          title: j.title, category: j.category ?? "", skill_class: (j.skill_class as SkillLevel) ?? "", country: j.country, city: j.city, job_type: j.job_type, start_immediately: j.start_immediately,
          start_date: j.start_date ?? "", duration: j.duration, salary_amount: String(j.salary_amount),
          salary_currency: j.salary_currency, salary_period: j.salary_period as "hour" | "month",
          accommodation_provided: j.accommodation_provided, accommodation_cost: j.accommodation_cost?.toString() ?? "",
          languages: (j.languages as Lang[]) ?? [], experience: j.experience ?? "", working_hours: j.working_hours ?? "",
          food_provided: j.food_provided, transport_provided: j.transport_provided, description: j.description ?? "",
          benefits: ((j.benefits as string[]) ?? []).join(", "), expiry_date: j.expiry_date ?? "",
        });
      }
      setLoading(false);
    })();
  }, [id, navigate]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const benefitList = form.benefits.split(",").map((b) => b.trim()).filter(Boolean);
  const score = useMemo(() => completeness({ ...form, benefits: benefitList, languages: form.languages.filter((l) => l.language.trim()) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form]);

  const save = async (target: "draft" | "pending_review" | "keep") => {
    if (!companyId) return;
    if (target !== "draft" && !form.category)
      return toast({ title: "Vyber kategorii práce", variant: "destructive" });
    if (target !== "draft" && !form.start_immediately && !form.start_date)
      return toast({ title: "Vyplň datum nástupu", variant: "destructive" });
    setSaving(true);
    const payload = {
      company_id: companyId, title: form.title, category: form.category || null,
      skill_class: form.skill_class || null, country: form.country, city: form.city, job_type: form.job_type,
      start_immediately: form.start_immediately, start_date: form.start_immediately ? null : form.start_date || null,
      duration: form.duration, salary_amount: Number(form.salary_amount), salary_currency: form.salary_currency,
      salary_period: form.salary_period, accommodation_provided: form.accommodation_provided,
      accommodation_cost: form.accommodation_provided && form.accommodation_cost ? Number(form.accommodation_cost) : null,
      languages: form.languages.filter((l) => l.language.trim()), experience: form.experience || null,
      working_hours: form.working_hours || null, food_provided: form.food_provided, transport_provided: form.transport_provided,
      description: form.description || null, benefits: benefitList, expiry_date: form.expiry_date || null,
      ...(target === "keep" ? {} : { status: target }),
    };
    const res = id
      ? await supabase.from("employer_jobs").update(payload).eq("id", id)
      : await supabase.from("employer_jobs").insert(payload);
    setSaving(false);
    if (res.error) return toast({ title: "Uložení selhalo", description: res.error.message, variant: "destructive" });
    toast({ title: target === "pending_review" ? "Odesláno ke schválení" : "Uloženo" });
    navigate("/employer/dashboard");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  const isPublished = status === "published";

  return (
    <div className="min-h-screen bg-background p-4">
      <form onSubmit={(e) => { e.preventDefault(); save(isPublished ? "keep" : "pending_review"); }}
        className="max-w-2xl mx-auto glass-card-elevated rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{id ? "Upravit nabídku" : "Nová nabídka"}</h1>
          {rejectionNote && <div className="rounded-xl border border-red-accent/40 bg-muted p-3 text-sm">Důvod vrácení: {rejectionNote}. Uprav nabídku a odešli ji znovu ke schválení.</div>}
          <Button asChild variant="ghost" size="sm"><Link to="/employer/dashboard">Zpět</Link></Button>
        </div>

        <div className="sticky top-2 z-10 rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm font-medium"><span>Nabídka je vyplněná na {score} %</span></div>
          <Progress value={score} />
          <p className="text-xs text-muted-foreground">Kompletní nabídky se párují přesněji.</p>
        </div>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Základní údaje</h2>
          <div className="space-y-2"><Label>Název pozice *</Label><Input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Kuchař/ka" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="category">Kategorie práce *</Label>
              <select id="category" required className={sel} value={form.category} onChange={(e) => set("category", e.target.value)}>
                <option value="" disabled>Vyber kategorii</option>
                {JOB_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
            <div className="space-y-2"><Label htmlFor="skill_class">Úroveň</Label>
              <select id="skill_class" className={sel} value={form.skill_class} onChange={(e) => set("skill_class", e.target.value as SkillLevel | "")}>
                <option value="">Neuvedeno</option>
                {SKILL_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Země *</Label><Input required value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Austria" /></div>
            <div className="space-y-2"><Label>Město *</Label><Input required value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ischgl" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Typ práce *</Label>
              <select className={sel} value={form.job_type} onChange={(e) => set("job_type", e.target.value)}>
                {JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div className="space-y-2"><Label>Doba trvání *</Label><Input required value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="Zimní sezóna, 4 měsíce" /></div>
          </div>
          <div className="space-y-2">
            <Label>Nástup *</Label>
            <div className="flex items-center gap-3"><Switch checked={form.start_immediately} onCheckedChange={(v) => set("start_immediately", v)} /><span className="text-sm">Ihned</span></div>
            {!form.start_immediately && <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Mzda a ubytování</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-3 sm:col-span-1"><Label>Částka *</Label><Input required type="number" min="0" step="0.01" value={form.salary_amount} onChange={(e) => set("salary_amount", e.target.value)} /></div>
            <div className="space-y-2"><Label>Měna *</Label>
              <select className={sel} value={form.salary_currency} onChange={(e) => set("salary_currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="space-y-2"><Label>Za *</Label>
              <select className={sel} value={form.salary_period} onChange={(e) => set("salary_period", e.target.value as "hour" | "month")}>
                <option value="month">měsíc</option><option value="hour">hodinu</option></select></div>
          </div>
          <div className="flex items-center gap-3"><Switch checked={form.accommodation_provided} onCheckedChange={(v) => set("accommodation_provided", v)} /><span className="text-sm">Ubytování zajištěno *</span></div>
          {form.accommodation_provided && (
            <div className="space-y-2"><Label>Cena ubytování měsíčně (0 = zdarma)</Label><Input type="number" min="0" value={form.accommodation_cost} onChange={(e) => set("accommodation_cost", e.target.value)} /></div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Doplňující informace</h2>
          <div className="space-y-2">
            <Label>Požadované jazyky</Label>
            {form.languages.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input value={l.language} placeholder="Němčina" onChange={(e) => set("languages", form.languages.map((x, j) => j === i ? { ...x, language: e.target.value } : x))} />
                <select className={`${sel} w-24`} value={l.level} onChange={(e) => set("languages", form.languages.map((x, j) => j === i ? { ...x, level: e.target.value } : x))}>
                  {LANG_LEVELS.map((lv) => <option key={lv}>{lv}</option>)}</select>
                <Button type="button" variant="ghost" size="icon" aria-label="Odebrat jazyk" onClick={() => set("languages", form.languages.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => set("languages", [...form.languages, { language: "", level: "B1" }])}><Plus className="w-4 h-4 mr-1" />Přidat jazyk</Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Praxe</Label><Input value={form.experience} onChange={(e) => set("experience", e.target.value)} placeholder="Bez praxe / 1 rok" /></div>
            <div className="space-y-2"><Label>Pracovní doba</Label><Input value={form.working_hours} onChange={(e) => set("working_hours", e.target.value)} placeholder="45 h týdně, 6 dní" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Strava zajištěna</Label><TriState value={form.food_provided} onChange={(v) => set("food_provided", v)} /></div>
            <div className="space-y-2"><Label>Doprava zajištěna</Label><TriState value={form.transport_provided} onChange={(v) => set("transport_provided", v)} /></div>
          </div>
          <div className="space-y-2"><Label>Popis práce</Label><Textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="space-y-2"><Label>Benefity (oddělené čárkou)</Label><Input value={form.benefits} onChange={(e) => set("benefits", e.target.value)} placeholder="Skipas, spropitné, bonus na konci sezóny" /></div>
          <div className="space-y-2"><Label>Platnost do</Label><Input type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
            <p className="text-xs text-muted-foreground">Když nevyplníš, nabídka platí 60 dní.</p></div>
        </section>

        <div className="flex flex-wrap gap-3 pt-2">
          {isPublished ? (
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Uložit změny</Button>
          ) : (<>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Odeslat ke schválení</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => save("draft")}>Uložit koncept</Button>
          </>)}
        </div>
        {isPublished && <p className="text-xs text-muted-foreground">U nových firem projdou změny znovu schválením; do té doby zůstává zveřejněná původní verze.</p>}
      </form>
    </div>
  );
};
export default EmployerJobForm;
