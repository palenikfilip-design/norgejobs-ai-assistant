import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  content: string;
  className?: string;
}

const InfoTooltip = ({ content, className = "" }: InfoTooltipProps) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-2.5 h-2.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default InfoTooltip;
