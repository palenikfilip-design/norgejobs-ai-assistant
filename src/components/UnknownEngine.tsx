import { AlertCircle, HelpCircle, MessageCircle } from "lucide-react";
import type { UnknownField } from "@/utils/dimensionMatching";
import { Button } from "@/components/ui/button";

interface UnknownEngineProps {
  unknowns: UnknownField[];
  onAnswerQuestion?: (field: string) => void;
}

const UnknownEngine = ({ unknowns, onAnswerQuestion }: UnknownEngineProps) => {
  if (unknowns.length === 0) return null;

  return (
    <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/20">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">
          We're not sure about this match because:
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {unknowns.length} field{unknowns.length > 1 ? "s" : ""} have low confidence. Answer these questions to improve your match accuracy.
      </p>
      <div className="space-y-2">
        {unknowns.slice(0, 4).map((u) => (
          <div key={u.field} className="flex items-start gap-2 bg-card/50 rounded-lg p-3 border border-border/30">
            <HelpCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">{u.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{u.question}</p>
            </div>
            {onAnswerQuestion && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs shrink-0 h-7"
                onClick={() => onAnswerQuestion(u.field)}
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                Answer
              </Button>
            )}
          </div>
        ))}
      </div>
      {unknowns.length > 4 && (
        <p className="text-xs text-muted-foreground mt-2">
          +{unknowns.length - 4} more questions available
        </p>
      )}
    </div>
  );
};

export default UnknownEngine;
