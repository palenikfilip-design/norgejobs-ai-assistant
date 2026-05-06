import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Globe, Loader2, Search, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import NotFound from "./NotFound";

const ADMIN_EMAIL = "palenik.filip@gmail.com";

interface Portal {
  id: string;
  category: string;
  country: string | null;
  name: string;
  url: string;
  portal_type: string | null;
  job_categories: string | null;
  languages: string | null;
  api_info: string | null;
  scraping_terms: string | null;
  recommended_approach: string | null;
  priority: number | null;
  avg_salary: string | null;
  notes: string | null;
  housing_included: string | null;
  is_active: boolean;
}

const PortalsMap = () => {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const ok = user?.email === ADMIN_EMAIL;
      setAllowed(ok);
      if (!ok) return;
      const { data } = await supabase
        .from("job_portals_catalog" as any)
        .select("*")
        .order("priority", { ascending: false })
        .order("country", { ascending: true });
      setPortals((data as unknown as Portal[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(portals.map(p => p.category))).sort()],
    [portals]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return portals.filter(p => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!term) return true;
      return [p.name, p.country, p.url, p.notes, p.job_categories]
        .some(v => (v ?? "").toLowerCase().includes(term));
    });
  }, [portals, q, cat]);

  const grouped = useMemo(() => {
    const map = new Map<string, Portal[]>();
    for (const p of filtered) {
      const k = p.country || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!allowed) return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <Globe className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Mapa pracovních portálů</h1>
        <Badge variant="secondary" className="ml-auto">{portals.length}</Badge>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardContent className="pt-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat portál, zemi, kategorii…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <Button
                  key={c}
                  variant={cat === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCat(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          grouped.map(([country, items]) => (
            <Card key={country}>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {country}
                  <Badge variant="outline" className="text-xs">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map(p => (
                  <div
                    key={p.id}
                    className="flex flex-col md:flex-row md:items-start gap-2 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-sm hover:text-primary inline-flex items-center gap-1"
                        >
                          {p.name} <ExternalLink className="h-3 w-3" />
                        </a>
                        <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
                        {p.portal_type && (
                          <Badge variant="outline" className="text-[10px]">{p.portal_type}</Badge>
                        )}
                        {(p.priority ?? 0) > 0 && (
                          <span className="inline-flex items-center text-amber-500 text-xs">
                            {Array.from({ length: p.priority ?? 0 }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-current" />
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground break-all mt-0.5">{p.url}</div>
                      {p.job_categories && (
                        <div className="text-xs mt-1"><span className="text-muted-foreground">Obory: </span>{p.job_categories}</div>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1 text-muted-foreground">
                        {p.languages && <span>🗣 {p.languages}</span>}
                        {p.api_info && <span>{p.api_info}</span>}
                        {p.avg_salary && <span>💰 {p.avg_salary}</span>}
                        {p.housing_included && <span>🏠 {p.housing_included}</span>}
                      </div>
                      {p.notes && (
                        <div className="text-xs mt-1 italic text-muted-foreground">{p.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};

export default PortalsMap;