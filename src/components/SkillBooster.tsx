import { TrendingUp, BookOpen, Award, Languages, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import InfoTooltip from "@/components/InfoTooltip";
import type { BoostSuggestion } from "@/utils/skillBooster";

interface SkillBoosterProps {
  suggestions: BoostSuggestion[];
  onTestLanguage?: (language: string) => void;
}

const typeIcon = {
  skill: BookOpen,
  language: Languages,
  certification: Award,
  experience: Briefcase,
};

const SkillBooster = ({ suggestions, onTestLanguage }: SkillBoosterProps) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp className="w-4 h-4 text-accent" />
        <span className="font-medium text-foreground text-sm">Increase your chances</span>
        <InfoTooltip content="Skill Booster analyzuje, jaké dovednosti, jazyky nebo certifikace ti chybí pro tuto pozici, a navrhne konkrétní kroky ke zlepšení." />
      </div>
      <div className="space-y-2">
        {suggestions.map((s, i) => {
          const Icon = typeIcon[s.type];
          return (
            <div key={i} className="flex items-start gap-2 bg-background/50 rounded-md p-2">
              <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{s.name}</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    +{s.estimatedImpact}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{s.action}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-6 px-2 shrink-0"
                onClick={() => {
                  if (s.type === "language" && onTestLanguage) {
                    onTestLanguage(s.name);
                  }
                }}
              >
                {s.actionCta}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SkillBooster;
