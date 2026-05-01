import { useMemo } from "react";
import { Filter, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export interface QuickFilters {
  countries: string[];
  categories: string[];
  /** "all" | "seasonal" | "permanent" */
  type: "all" | "seasonal" | "permanent";
}

export const defaultQuickFilters: QuickFilters = {
  countries: [],
  categories: [],
  type: "all",
};

interface QuickFilterBarProps {
  filters: QuickFilters;
  onChange: (next: QuickFilters) => void;
  availableCountries: string[];
  availableCategories: string[];
}

const TYPE_OPTIONS: Array<{ value: QuickFilters["type"]; label: string }> = [
  { value: "all", label: "Vše" },
  { value: "seasonal", label: "Sezónní" },
  { value: "permanent", label: "Trvalé" },
];

function MultiSelectPopover({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <span>{label}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">{selected.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-3 text-center">Žádné možnosti</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/10 cursor-pointer text-sm"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(opt)} />
                  <span className="flex-1 truncate">{opt}</span>
                </label>
              );
            })}
          </div>
        )}
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1 h-7 text-xs"
            onClick={() => onChange([])}
          >
            Vymazat
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

const QuickFilterBar = ({
  filters,
  onChange,
  availableCountries,
  availableCategories,
}: QuickFilterBarProps) => {
  const activeCount = useMemo(() => {
    let n = filters.countries.length + filters.categories.length;
    if (filters.type !== "all") n += 1;
    return n;
  }, [filters]);

  const clearAll = () =>
    onChange({ countries: [], categories: [], type: "all" });

  return (
    <div className="bg-card rounded-xl border border-border p-3 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-1">
          <Filter className="w-4 h-4 text-accent" />
          <span className="font-medium text-foreground">Filtry</span>
          {activeCount > 0 && (
            <Badge className="h-5 px-1.5 text-xs bg-accent text-accent-foreground sm:hidden">
              {activeCount}
            </Badge>
          )}
        </div>

        <MultiSelectPopover
          label="Země"
          options={availableCountries}
          selected={filters.countries}
          onChange={(countries) => onChange({ ...filters, countries })}
        />

        <MultiSelectPopover
          label="Kategorie"
          options={availableCategories}
          selected={filters.categories}
          onChange={(categories) => onChange({ ...filters, categories })}
        />

        {/* Type pills */}
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {TYPE_OPTIONS.map((opt) => {
            const active = filters.type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...filters, type: opt.value })}
                className={`text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && <Check className="w-3 h-3" />}
                {opt.label}
              </button>
            );
          })}
        </div>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground hover:text-foreground ml-auto"
            onClick={clearAll}
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Vymazat filtry
          </Button>
        )}
      </div>
    </div>
  );
};

export default QuickFilterBar;