import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CoverLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverLetter: string;
  isLoading: boolean;
  jobTitle: string;
}

const CoverLetterDialog = ({ open, onOpenChange, coverLetter, isLoading, jobTitle }: CoverLetterDialogProps) => {
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(coverLetter);
    toast({ title: "Copied to clipboard!" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cover Letter — {jobTitle}</DialogTitle>
          <DialogDescription>AI-generated cover letter for this position</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <span className="ml-2 text-muted-foreground">Generating your cover letter...</span>
          </div>
        ) : (
          <>
            <div className="whitespace-pre-line text-sm text-foreground leading-relaxed bg-secondary/30 rounded-lg p-4 border border-border/30">
              {coverLetter}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-1" /> Copy
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CoverLetterDialog;
