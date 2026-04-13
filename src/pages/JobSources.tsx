import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Globe, Sparkles, Link2, ExternalLink, Zap } from "lucide-react";
import { type JobSource, getAutoSources, JOB_SOURCE_CATALOG, detectSourceFromUrl } from "@/data/jobSources";
import { useToast } from "@/hooks/use-toast";

const JobSources = () => {
  const { user, activePresets } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Gather all preferred countries from active presets
  const preferredCountries = useMemo(
    () => [...new Set(activePresets.flatMap((p) => p.preferredCountries))],
    [activePresets]
  );

  const autoSources = useMemo(() => getAutoSources(preferredCountries), [preferredCountries]);

  const [smartMode, setSmartMode] = useState(true);
  const [sources, setSources] = useState<JobSource[]>(() => [...autoSources]);
  const [customSources, setCustomSources] = useState<JobSource[]>([]);

  // Add custom source dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  // URL detection dialog
  const [detectUrl, setDetectUrl] = useState("");
  const [detectOpen, setDetectOpen] = useState(false);

  const allSources = smartMode ? sources : customSources;

  const toggleSource = (id: string) => {
    const setter = smartMode ? setSources : setCustomSources;
    setter((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  };

  const removeSource = (id: string) => {
    setCustomSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddCustom = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const id = `custom_${Date.now()}`;
    setCustomSources((prev) => [
      ...prev,
      {
        id,
        name: newName.trim(),
        type: "job_portal",
        base_url: newUrl.trim(),
        active: true,
        auto_assigned: false,
        countries: [],
        url_patterns: [new URL(newUrl.trim()).hostname.replace("www.", "")],
      },
    ]);
    setNewName("");
    setNewUrl("");
    setAddOpen(false);
    toast({ title: "Zdroj přidán", description: `${newName} byl přidán do vašich zdrojů.` });
  };

  const handleSwitchMode = (manual: boolean) => {
    setSmartMode(!manual);
    if (manual && customSources.length === 0) {
      // Seed manual list from auto sources
      setCustomSources([...sources.map((s) => ({ ...s, auto_assigned: false }))]);
    }
  };

  const handleDetectUrl = () => {
    if (!detectUrl.trim()) return;
    const sourceId = detectSourceFromUrl(detectUrl);
    if (!sourceId) {
      toast({
        title: "Zdroj nerozpoznán",
        description: "Tuto URL nelze přiřadit k žádnému známému portálu.",
        variant: "destructive",
      });
      return;
    }
    const isActive = allSources.some((s) => s.id === sourceId && s.active);
    if (isActive) {
      toast({ title: "Zdroj je aktivní", description: "Tento portál máte již zapnutý." });
    } else {
      const catalogEntry = JOB_SOURCE_CATALOG.find((s) => s.id === sourceId);
      toast({
        title: `Nalezeno: ${catalogEntry?.name}`,
        description: "Tento zdroj není aktivní. Zapněte ho v seznamu.",
      });
    }
    setDetectUrl("");
    setDetectOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Globe className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Zdroje práce</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Mode Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {smartMode ? (
                    <Sparkles className="h-4 w-4 text-primary" />
                  ) : (
                    <Zap className="h-4 w-4 text-accent-foreground" />
                  )}
                  <span className="font-semibold">
                    {smartMode ? "Smart mód (doporučené)" : "Manuální mód"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {smartMode
                    ? "Zdroje jsou vybrány automaticky na základě vašeho profilu."
                    : "Plná kontrola nad zdroji – přidávejte, odebírejte, zapínejte."}
                </p>
              </div>
              <Switch checked={!smartMode} onCheckedChange={handleSwitchMode} />
            </div>
          </CardContent>
        </Card>

        {/* URL Detection */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Ověřit URL nabídky</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.finn.no/job/..."
                value={detectUrl}
                onChange={(e) => setDetectUrl(e.target.value)}
              />
              <Button size="sm" onClick={handleDetectUrl}>
                Ověřit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sources List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {smartMode ? "Doporučené zdroje" : "Vaše zdroje"}
                </CardTitle>
                <CardDescription>
                  {smartMode
                    ? `Na základě zemí: ${preferredCountries.join(", ") || "globální"}`
                    : `${allSources.filter((s) => s.active).length} aktivních zdrojů`}
                </CardDescription>
              </div>
              {!smartMode && (
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" /> Přidat
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Přidat vlastní zdroj</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Název portálu</Label>
                        <Input
                          placeholder="Např. Monster.com"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>URL adresa</Label>
                        <Input
                          placeholder="https://www.monster.com"
                          value={newUrl}
                          onChange={(e) => setNewUrl(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddCustom} disabled={!newName.trim() || !newUrl.trim()}>
                        Přidat zdroj
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <AnimatePresence>
              {allSources.map((source) => (
                <motion.div
                  key={source.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{source.name}</span>
                        <Badge variant={source.auto_assigned ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                          {source.auto_assigned ? "Auto" : "Custom"}
                        </Badge>
                      </div>
                      <a
                        href={source.base_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        {source.base_url} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!smartMode && !source.auto_assigned && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeSource(source.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Switch
                      checked={source.active}
                      onCheckedChange={() => toggleSource(source.id)}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {allSources.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Žádné zdroje. Přidejte svůj první portál.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default JobSources;
