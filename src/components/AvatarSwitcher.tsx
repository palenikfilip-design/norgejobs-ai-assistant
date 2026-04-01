import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, Plus, Trash2 } from "lucide-react";

const AvatarSwitcher = () => {
  const { user, activeAvatar, setActiveAvatar, deleteAvatar } = useUser();
  const navigate = useNavigate();

  if (user.avatars.length <= 1) {
    return (
      <Button variant="outline" size="sm" onClick={() => navigate("/onboarding")} className="gap-1.5">
        <Plus className="w-4 h-4" /> New Avatar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {user.avatars.map((a) => (
        <div key={a.id} className="flex items-center gap-1">
          <button
            onClick={() => setActiveAvatar(a.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
              a.id === activeAvatar?.id
                ? "bg-accent-gradient text-accent-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            {a.name}
          </button>
          {user.avatars.length > 1 && (
            <button
              onClick={() => deleteAvatar(a.id)}
              className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => navigate("/onboarding")} className="gap-1.5 h-8">
        <Plus className="w-3.5 h-3.5" /> New
      </Button>
    </div>
  );
};

export default AvatarSwitcher;
