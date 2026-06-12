import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Plus, Copy, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { prefillCvFromProfile } from "@/utils/cvPrefill";
import type { CvRecord } from "@/types/cv";

const CV = () => {
  const { supabaseUser } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cvs, setCvs] = useState<CvRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseUser?.id) return;
    (async () => {
      const { data } = await supabase
        .from("user_cvs")
        .select("*")
        .eq("user_id", supabaseUser.id)
        .order("updated_at", { ascending: false });
      setCvs((data as unknown as CvRecord[]) || []);
      setLoading(false);
    })();
  }, [supabaseUser?.id]);

  const createNew = async () => {
    if (!supabaseUser?.id) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,profession,current_residence,country,languages,skills,work_experience,certifications")
      .eq("user_id", supabaseUser.id)
      .maybeSingle();
    const prefilled = prefillCvFromProfile({
      email: supabaseUser.email,
      profile: (profile as any) || {},
    });
    const { data, error } = await supabase
      .from("user_cvs")
      .insert({
        user_id: supabaseUser.id,
        template: "modern",
        title: "Můj životopis",
        full_name: prefilled.full_name,
        headline: prefilled.headline,
        email: prefilled.email,
        phone: prefilled.phone,
        location: prefilled.location,
        summary: prefilled.summary,
        work_experience: prefilled.work_experience as any,
        education: prefilled.education as any,
        skills: prefilled.skills as any,
        languages: prefilled.languages as any,
        certifications: prefilled.certifications as any,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast({ title: "Nepovedlo se vytvořit CV", description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/cv/${data.id}`);
  };

  const duplicate = async (cv: CvRecord) => {
    if (!supabaseUser?.id) return;
    const { id, created_at, updated_at, ...rest } = cv as any;
    const { data, error } = await supabase
      .from("user_cvs")
      .insert({ ...rest, title: `${cv.title} (kopie)` })
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast({ title: "Nepovedlo se zkopírovat", variant: "destructive" });
      return;
    }
    navigate(`/cv/${data.id}`);
  };

  const remove = async (id: string) => {
    if (!confirm("Smazat tento životopis?")) return;
    await supabase.from("user_cvs").delete().eq("id", id);
    setCvs((cs) => cs.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Zpět
          </Link>
          <h1 className="text-lg font-semibold">Moje životopisy</h1>
          <Button onClick={createNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Nový</Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
        ) : cvs.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">Zatím nemáš žádný životopis</p>
              <p className="text-sm text-muted-foreground">Vytvořím ti jeden z tvého profilu — bez AI, jen data.</p>
            </div>
            <Button onClick={createNew}><Plus className="w-4 h-4 mr-1" /> Vytvořit první CV</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {cvs.map((cv) => (
              <div key={cv.id} className="border rounded-lg p-4 bg-card hover:border-accent/50 transition">
                <Link to={`/cv/${cv.id}`} className="block">
                  <div className="font-medium">{cv.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {cv.template} · upraveno {new Date(cv.updated_at).toLocaleDateString("cs-CZ")}
                  </div>
                </Link>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => duplicate(cv)}><Copy className="w-3 h-3 mr-1" /> Kopie</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(cv.id)} className="text-destructive"><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CV;