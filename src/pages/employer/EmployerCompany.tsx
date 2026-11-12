import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { isEmployer, resolveLogoUrl, slugify } from "@/lib/companies";

type Form = { name: string; country: string; description: string; website_url: string; instagram_url: string; contact_email: string; show_contact_email: boolean; logo_url: string | null; registration_number: string };
const empty: Form = { name: "", country: "", description: "", website_url: "", instagram_url: "", contact_email: "", show_contact_email: false, logo_url: null, registration_number: "" };

const EmployerCompany = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uid, setUid] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login");
      if (!(await isEmployer(user.id))) return navigate("/dashboard");
      setUid(user.id);
      const { data } = await supabase.from("companies").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setCompanyId(data.id);
        setForm({ name: data.name, country: data.country ?? "", description: data.description ?? "", website_url: data.website_url ?? "",
          instagram_url: data.instagram_url ?? "", contact_email: data.contact_email ?? user.email ?? "", show_contact_email: data.show_contact_email, logo_url: data.logo_url, registration_number: data.registration_number ?? "" });
        setNote(data.status === "draft" ? data.rejection_note : null);
        setPreview(await resolveLogoUrl(data.logo_url));
      } else setForm({ ...empty, contact_email: user.email ?? "" });
      setLoading(false);
    })();
  }, [navigate]);

  const set = (k: keyof Form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (file: File) => {
    if (!uid) return;
    const path = `${uid}/logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true });
    if (error) return toast({ title: "Nahrání selhalo", description: error.message, variant: "destructive" });
    setForm((f) => ({ ...f, logo_url: path }));
    setPreview(URL.createObjectURL(file));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    const payload = { ...form, registration_number: form.registration_number.trim() || null, status: "active" as const, user_id: uid };
    const res = companyId
      ? await supabase.from("companies").update(payload).eq("id", companyId)
      : await supabase.from("companies").insert({ ...payload, slug: `${slugify(form.name)}-${uid.slice(0, 6)}` });
    setSaving(false);
    if (res.error) return toast({ title: "Chyba", description: res.error.message, variant: "destructive" });
    navigate("/employer/dashboard");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background p-4">
      <form onSubmit={save} className="max-w-2xl mx-auto glass-card-elevated rounded-2xl p-8 space-y-5">
        <h1 className="font-display text-3xl font-bold">Profil firmy</h1>
        {note && <div className="rounded-xl border border-red-accent/40 bg-muted p-3 text-sm">Profil byl vrácen k úpravě: {note}</div>}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center">
            {preview ? <img src={preview} alt="Logo" className="w-full h-full object-contain" /> : <span className="text-xs text-muted-foreground">Logo</span>}
          </div>
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        <div className="space-y-2"><Label>Název firmy *</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="space-y-2"><Label>IČO / registrační číslo firmy</Label><Input maxLength={40} value={form.registration_number} onChange={(e) => set("registration_number", e.target.value)} /></div>
        <div className="space-y-2"><Label>Země</Label><Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Norway" /></div>
        <div className="space-y-2"><Label>Krátký popis</Label><Textarea maxLength={600} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
        <div className="space-y-2"><Label>Web</Label><Input type="url" value={form.website_url} onChange={(e) => set("website_url", e.target.value)} placeholder="https://" /></div>
        <div className="space-y-2"><Label>Instagram</Label><Input type="url" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} placeholder="https://instagram.com/..." /></div>
        <div className="space-y-2"><Label>Kontaktní e-mail</Label><Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></div>
        <div className="flex items-center gap-3"><Switch checked={form.show_contact_email} onCheckedChange={(v) => set("show_contact_email", v)} /><Label>Zobrazit e-mail veřejně</Label></div>
        <Button type="submit" disabled={saving} className="w-full bg-accent-gradient text-accent-foreground">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Uložit a odeslat ke schválení
        </Button>
      </form>
    </div>
  );
};
export default EmployerCompany;
