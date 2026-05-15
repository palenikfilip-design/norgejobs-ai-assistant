import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil } from "lucide-react";

const PresetSwitcher = () => {
  const { user, togglePreset, deletePreset } = useUser();
  const navigate = useNavigate();

  return (
    <div className="space-y-2">
      {user.presets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No presets yet — search runs on your profile alone. Add a preset to fine-tune results.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tick the presets you want to use right now. Untick to ignore — search keeps working without any preset.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {user.presets.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full border transition-all ${
              p.active
                ? "bg-accent/10 border-accent/40"
                : "bg-secondary/40 border-border opacity-70"
            }`}
          >
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={p.active}
                onCheckedChange={() => togglePreset(p.id)}
                aria-label={`Use ${p.name}`}
              />
              <span className="text-sm font-medium text-foreground">{p.name}</span>
            </label>
            <button
              type="button"
              onClick={() => navigate(`/preset/edit/${p.id}`)}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Edit preset"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => deletePreset(p.id)}
              className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Delete preset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => navigate("/preset/new")} className="gap-1.5 h-8 rounded-full">
          <Plus className="w-3.5 h-3.5" /> New Preset
        </Button>
      </div>
    </div>
  );
};

export default PresetSwitcher;
