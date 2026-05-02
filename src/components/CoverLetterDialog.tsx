import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface CoverLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverLetter: string;
  isLoading: boolean;
  jobTitle: string;
  used?: number | null;
  limit?: number | null;
  isPremium?: boolean;
  limitReached?: boolean;
}

const CoverLetterDialog = ({
  open, onOpenChange, coverLetter, isLoading, jobTitle,
  used, limit, isPremium, limitReached,
}: CoverLetterDialogProps) => {
  const { toast } = useToast();
  const [text, setText] = useState(coverLetter);

  useEffect(() => { setText(coverLetter); }, [coverLetter]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast({ title: "Zkopírováno do schránky" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Motivační dopis — {jobTitle}</DialogTitle>
          <DialogDescription>
            {isPremium
              ? "Pro: neomezené generování"
              : limit != null && used != null
                ? `Použito ${used} / ${limit} tento měsíc`
                : "AI vygeneroval personalizovaný dopis. Můžeš ho upravit."}
          </DialogDescription>
        </DialogHeader>

        {limitReached ? (
          <div className="py-8 text-center space-y-4">
            <Crown className="w-10 h-10 mx-auto text-amber-500" />
            <div>
              <p className="font-medium text-foreground">Měsíční limit dosažen</p>
              <p className="text-sm text-muted-foreground mt-1">
                Free účet má 3 dopisy / měsíc. Pro nabízí neomezené generování.
              </p>
            </div>
            <Button asChild>
              <Link to="/premium">Aktivovat Pro</Link>
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <span className="ml-2 text-muted-foreground">Generuji motivační dopis…</span>
          </div>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[320px] text-sm leading-relaxed"
            />
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-1" /> Kopírovat
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CoverLetterDialog;
