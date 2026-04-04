import { useUser, SearchPreset, defaultPreset } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Filter, Plus, Trash2, Eye, EyeOff, Pencil } from "lucide-react";

const PresetSwitcher = () => {
  const { user, togglePreset, deletePreset } = useUser();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {user.presets.map((p) => (
        <div key={p.id} className="flex items-center gap-1">
          <button
            onClick={() => togglePreset(p.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
              p.active
                ? "bg-accent-gradient text-accent-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80 opacity-60"
            }`}
          >
            {p.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {p.name}
          </button>
          <button
            onClick={() => navigate(`/preset/edit/${p.id}`)}
            className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
          {user.presets.length > 0 && (
            <button
              onClick={() => deletePreset(p.id)}
              className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => navigate("/preset/new")} className="gap-1.5 h-8">
        <Plus className="w-3.5 h-3.5" /> New Preset
      </Button>
    </div>
  );
};

export default PresetSwitcher;
