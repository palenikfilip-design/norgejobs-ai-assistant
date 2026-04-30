import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, ChevronUp, X, Plus, MapPin, DollarSign, Globe, Languages, Briefcase, Gift, Home, Plane, Wifi, Building2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { JobFilters } from "@/types/jobFilters";
import {
  LANGUAGES as LANG_OPTIONS, LANGUAGE_LEVELS, PROFESSION_CATEGORIES, JOB_BONUSES,
} from "@/constants/jobRequirements";
import { COUNTRIES, COUNTRY_FLAGS } from "@/constants/countries";
import { JOB_SOURCE_CATALOG } from "@/data/jobSources";

interface JobFiltersPanelProps {
  filters: JobFilters;
  onFiltersChange: (filters: JobFilters) => void;
  onSearch: () => void;
  totalResults: number;
  totalJobsCount: number;
  /** Country of the current user (from profile). Used to compute "Around me" portals. */
  userCountry?: string;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  english: "🇬🇧", german: "🇩🇪", norwegian: "🇳🇴", swedish: "🇸🇪", danish: "🇩🇰",
  french: "🇫🇷", polish: "🇵🇱", czech: "🇨🇿", slovak: "🇸🇰", hungarian: "🇭🇺",
};

const JOB_TYPES = [
  { value: "all", label: "All Types" },
  { value: "Full-time", label: "Full-time" },
  { value: "Part-time", label: "Part-time" },
  { value: "Seasonal", label: "Seasonal" },
  { value: "Remote", label: "Remote" },
];

const SCOPE_TABS: { value: JobFilters["sourceScope"]; label: string; icon: typeof Home }[] = [
  { value: "all", label: "All", icon: Globe },
  { value: "around_me", label: "Around me", icon: Home },
  { value: "abroad", label: "Abroad", icon: Plane },
  { value: "remote", label: "Remote", icon: Wifi },
];

const JobFiltersPanel = ({ filters, onFiltersChange, onSearch, totalResults, totalJobsCount, userCountry }: JobFiltersPanelProps) => {
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [pendingLanguage, setPendingLanguage] = useState("");
  const [pendingLanguageLevel, setPendingLanguageLevel] = useState("");
  const [customLanguageInput, setCustomLanguageInput] = useState("");
  const [showCustomLangInput, setShowCustomLangInput] = useState(false);
  const [customCountryInput, setCustomCountryInput] = useState("");
  const [showCustomCountryInput, setShowCustomCountryInput] = useState(false);

  const updateFilter = (key: keyof JobFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const addCountry = (country: string) => {
    if (!filters.countries.includes(country)) {
      updateFilter("countries", [...filters.countries, country]);
    }
  };
  const removeCountry = (country: string) => {
    updateFilter("countries", filters.countries.filter(c => c !== country));
  };

  const addLanguage = () => {
    const lang = showCustomLangInput ? customLanguageInput.trim().toLowerCase() : pendingLanguage;
    if (!lang || !pendingLanguageLevel) {
      toast({ title: "Select a language and level", variant: "destructive" });
      return;
    }
    if (filters.languages.some(l => l.language === lang)) {
      toast({ title: "Language already added", variant: "destructive" });
      return;
    }
    updateFilter("languages", [...filters.languages, { language: lang, level: pendingLanguageLevel }]);
    setPendingLanguage("");
    setPendingLanguageLevel("");
    setCustomLanguageInput("");
    setShowCustomLangInput(false);
  };
  const removeLanguage = (lang: string) => {
    updateFilter("languages", filters.languages.filter(l => l.language !== lang));
  };

  const addProfession = (prof: string) => {
    if (!filters.professionCategories.includes(prof)) {
      updateFilter("professionCategories", [...filters.professionCategories, prof]);
    }
  };
  const removeProfession = (prof: string) => {
    updateFilter("professionCategories", filters.professionCategories.filter(p => p !== prof));
  };

  const handleClearFilters = () => {
    onFiltersChange({
      keyword: "", location: "", countries: [], jobType: "",
      salaryMin: undefined, salaryMax: undefined, salaryType: "monthly",
      languages: [], experienceLevel: "", professionCategories: [], bonuses: [],
      sources: [], sourceScope: "all",
    });
  };

  const hasActiveFilters =
    filters.keyword || filters.location ||
    filters.countries.length > 0 ||
    (filters.jobType && filters.jobType !== "all") ||
    filters.salaryMin || filters.salaryMax ||
    filters.languages.length > 0 ||
    (filters.experienceLevel && filters.experienceLevel !== "any") ||
    filters.professionCategories.length > 0 ||
    filters.bonuses.length > 0 ||
    filters.sources.length > 0 ||
    filters.sourceScope !== "all";

  // Categorize portals based on user country and scope
  const userCountryLower = (userCountry || "").trim().toLowerCase();
  const portalsByScope = {
    around_me: JOB_SOURCE_CATALOG.filter(s =>
      userCountryLower && s.countries.some(c => c.toLowerCase() === userCountryLower)
    ),
    abroad: JOB_SOURCE_CATALOG.filter(s =>
      !userCountryLower || !s.countries.some(c => c.toLowerCase() === userCountryLower)
    ),
    remote: JOB_SOURCE_CATALOG.filter(s =>
      ["linkedin", "indeed", "eures"].includes(s.id)
    ),
    all: JOB_SOURCE_CATALOG,
  };
  const visiblePortals = portalsByScope[filters.sourceScope];

  const togglePortal = (id: string) => {
    const next = filters.sources.includes(id)
      ? filters.sources.filter(s => s !== id)
      : [...filters.sources, id];
    onFiltersChange({ ...filters, sources: next });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  const getLangLabel = (val: string) => {
    const flag = LANGUAGE_FLAGS[val] || "";
    const name = LANG_OPTIONS.find(l => l.value === val)?.label || val;
    return flag ? `${flag} ${name}` : name;
  };
  const getCountryLabel = (val: string) => {
    const flag = COUNTRY_FLAGS[val] || "";
    return flag ? `${flag} ${val}` : val;
  };
  const getProfLabel = (val: string) => PROFESSION_CATEGORIES.find(p => p.value === val)?.label || val;
  const availableCountries = COUNTRIES.filter(c => !filters.countries.includes(c.value));
  const availableProfessions = PROFESSION_CATEGORIES.filter(p => !filters.professionCategories.includes(p.value));

  return (
    <div className="bg-card rounded-xl shadow-md p-6 mb-8 border border-border">
      <h2 className="text-2xl font-bold text-foreground mb-5">Find Your Dream Job</h2>

      {/* Main search row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Input
            type="text" placeholder="Job title or keywords"
            value={filters.keyword} onChange={(e) => updateFilter("keyword", e.target.value)}
            onKeyDown={handleKeyDown} className="h-12 bg-background border-border text-foreground"
          />
        </div>
        <Select value={filters.jobType || "all"} onValueChange={(v) => updateFilter("jobType", v)}>
          <SelectTrigger className="h-12"><SelectValue placeholder="Job Type" /></SelectTrigger>
          <SelectContent>{JOB_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Portals filter — main visible filter */}
      <div className="mt-5">
        <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <Building2 size={16} className="text-accent" /> Portals
          {filters.sources.length > 0 && (
            <Badge variant="secondary" className="ml-1">{filters.sources.length}</Badge>
          )}
        </label>
        {/* Scope tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted rounded-lg w-fit mb-3">
          {SCOPE_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onFiltersChange({ ...filters, sourceScope: value })}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                filters.sourceScope === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
        {visiblePortals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {filters.sourceScope === "around_me" && !userCountry
              ? "Set your country in profile to see local portals."
              : "No portals available in this scope."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {visiblePortals.map(p => {
              const active = filters.sources.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePortal(p.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
        {filters.sources.length > 0 && (
          <button
            type="button"
            onClick={() => onFiltersChange({ ...filters, sources: [] })}
            className="text-xs text-muted-foreground hover:text-foreground mt-2 underline"
          >
            Clear portal selection
          </button>
        )}
      </div>

      {/* Advanced filters toggle */}
      <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-md bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors">
        {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {showAdvanced ? "Less filters" : "More filters (Country, Language, Profession...)"}
      </button>

      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-border space-y-5">
          {/* Location + Salary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><MapPin size={16} className="text-accent" /> Location / City</label>
              <Input type="text" placeholder="e.g. Oslo, Berlin, Zurich" value={filters.location} onChange={(e) => updateFilter("location", e.target.value)} onKeyDown={handleKeyDown} className="h-10 bg-background border-border text-foreground" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2"><DollarSign size={16} className="text-accent" />Salary range</label>
                <div className="flex bg-muted rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => updateFilter("salaryType", "monthly")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filters.salaryType === "monthly"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >€/month</button>
                  <button
                    type="button"
                    onClick={() => updateFilter("salaryType", "hourly")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filters.salaryType === "hourly"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >€/hour</button>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <Input type="number" placeholder="Min" value={filters.salaryMin || ""} onChange={(e) => updateFilter("salaryMin", e.target.value ? Number(e.target.value) : undefined)} className="h-10 w-28 bg-background border-border text-foreground" />
                <span className="text-muted-foreground">–</span>
                <Input type="number" placeholder="Max" value={filters.salaryMax || ""} onChange={(e) => updateFilter("salaryMax", e.target.value ? Number(e.target.value) : undefined)} className="h-10 w-28 bg-background border-border text-foreground" />
              </div>
            </div>
          </div>

          {/* Countries multi-select */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Globe size={16} className="text-accent" /> Countries</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {filters.countries.map(c => (
                <Badge key={c} variant="default" className="gap-1 pr-1">
                  {getCountryLabel(c)}
                  <button onClick={() => removeCountry(c)} className="ml-1 hover:text-destructive"><X size={14} /></button>
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="min-w-[200px]">
                <Select
                  value={showCustomCountryInput ? "custom" : ""}
                  onValueChange={(v) => {
                    if (v === "custom") {
                      setShowCustomCountryInput(true);
                    } else if (v) {
                      addCountry(v);
                      setShowCustomCountryInput(false);
                      setCustomCountryInput("");
                    }
                  }}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="+ Add country" /></SelectTrigger>
                  <SelectContent>
                    {availableCountries.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    <SelectItem value="custom">✏️ Other (type your own)</SelectItem>
                  </SelectContent>
                </Select>
                {showCustomCountryInput && (
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="Type country name..."
                      value={customCountryInput}
                      onChange={(e) => setCustomCountryInput(e.target.value)}
                      className="h-10 bg-background border-border text-foreground"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customCountryInput.trim()) {
                          addCountry(customCountryInput.trim());
                          setCustomCountryInput("");
                          setShowCustomCountryInput(false);
                        }
                      }}
                    />
                    <Button
                      type="button" variant="outline" size="sm" className="h-10"
                      onClick={() => {
                        if (customCountryInput.trim()) {
                          addCountry(customCountryInput.trim());
                          setCustomCountryInput("");
                          setShowCustomCountryInput(false);
                        }
                      }}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Languages multi-select */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Languages size={16} className="text-accent" /> Languages</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {filters.languages.map(l => (
                <Badge key={l.language} variant="default" className="gap-1 pr-1">
                  {getLangLabel(l.language)} ({l.level})
                  <button onClick={() => removeLanguage(l.language)} className="ml-1 hover:text-destructive"><X size={14} /></button>
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="min-w-[160px]">
                <Select
                  value={showCustomLangInput ? "custom" : pendingLanguage}
                  onValueChange={(v) => {
                    if (v === "custom") {
                      setShowCustomLangInput(true);
                      setPendingLanguage("");
                    } else {
                      setShowCustomLangInput(false);
                      setCustomLanguageInput("");
                      setPendingLanguage(v);
                    }
                  }}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="Language" /></SelectTrigger>
                  <SelectContent>
                    {LANG_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{LANGUAGE_FLAGS[l.value] ? `${LANGUAGE_FLAGS[l.value]} ` : ""}{l.label}</SelectItem>)}
                    <SelectItem value="custom">✏️ Other (type your own)</SelectItem>
                  </SelectContent>
                </Select>
                {showCustomLangInput && (
                  <Input placeholder="Type language..." value={customLanguageInput} onChange={(e) => setCustomLanguageInput(e.target.value)} className="h-10 mt-1 bg-background border-border text-foreground" autoFocus />
                )}
              </div>
              <div className="min-w-[200px]">
                <Select value={pendingLanguageLevel} onValueChange={setPendingLanguageLevel}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Level" /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLanguage} className="h-10">
                <Plus size={16} className="mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* Professions multi-select */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Briefcase size={16} className="text-accent" /> Profession Categories</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {filters.professionCategories.map(p => (
                <Badge key={p} variant="default" className="gap-1 pr-1">
                  {getProfLabel(p)}
                  <button onClick={() => removeProfession(p)} className="ml-1 hover:text-destructive"><X size={14} /></button>
                </Badge>
              ))}
            </div>
            {availableProfessions.length > 0 && (
              <Select value="" onValueChange={(v) => { if (v) addProfession(v); }}>
                <SelectTrigger className="h-10 max-w-xs"><SelectValue placeholder="+ Add profession" /></SelectTrigger>
                <SelectContent>
                  {availableProfessions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Bonuses / Benefits filter */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Gift size={16} className="text-accent" /> Bonuses & Benefits</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {filters.bonuses.map(b => (
                <Badge key={b} variant="default" className="gap-1 pr-1">
                  {JOB_BONUSES.find(jb => jb.value === b)?.label || b}
                  <button onClick={() => updateFilter("bonuses", filters.bonuses.filter(v => v !== b))} className="ml-1 hover:text-destructive"><X size={14} /></button>
                </Badge>
              ))}
            </div>
            {JOB_BONUSES.filter(b => !filters.bonuses.includes(b.value)).length > 0 && (
              <Select value="" onValueChange={(v) => { if (v) updateFilter("bonuses", [...filters.bonuses, v]); }}>
                <SelectTrigger className="h-10 max-w-xs"><SelectValue placeholder="+ Add bonus/benefit" /></SelectTrigger>
                <SelectContent>
                  {JOB_BONUSES.filter(b => !filters.bonuses.includes(b.value)).map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        <Button onClick={onSearch} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Search size={16} className="mr-2" />Search Jobs
        </Button>
        {hasActiveFilters && (
          <Button variant="outline" onClick={handleClearFilters} size="sm">Clear Filters</Button>
        )}
      </div>

      {/* Results count */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{totalResults}</span> job{totalResults !== 1 ? "s" : ""}
          {totalJobsCount > 0 && (
            <span className="ml-1">
              of <span className="font-semibold text-foreground">{totalJobsCount}</span> total
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default JobFiltersPanel;
