import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import type { DimensionValue } from "@/types/candidateDimensions";

interface DimensionSliderProps {
  label: string;
  description?: string;
  lowLabel?: string;
  highLabel?: string;
  dimension: DimensionValue;
  onChange: (dim: DimensionValue) => void;
}

const confidenceOptions: { value: DimensionValue["confidence"]; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "bg-red-500/20 text-red-600 border-red-500/30" },
  { value: "medium", label: "Med", color: "bg-amber-500/20 text-amber-600 border-amber-500/30" },
  { value: "high", label: "High", color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" },
];

const DimensionSlider = ({ label, description, lowLabel = "Low", highLabel = "High", dimension, onChange }: DimensionSliderProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
        </div>
        <span className="text-sm font-semibold text-foreground tabular-nums">{dimension.value}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">{lowLabel}</span>
        <div className="flex-1 relative">
          <Slider
            min={0}
            max={100}
            step={5}
            value={[dimension.value]}
            onValueChange={([v]) => onChange({ ...dimension, value: v })}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-px bg-red-accent/60"
          />
        </div>
        <span className="text-[10px] text-muted-foreground w-12 shrink-0">{highLabel}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground mr-1">Confidence:</span>
        {confidenceOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ ...dimension, confidence: opt.value })}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
              dimension.confidence === opt.value ? opt.color : "bg-secondary/50 text-muted-foreground border-transparent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DimensionSlider;
