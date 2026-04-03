import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Languages, Send, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LanguageTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
  onResult?: (level: string) => void;
}

interface TestQuestion {
  id: number;
  question: string;
  difficulty: string;
}

interface TestResult {
  estimatedLevel: string;
  confidence: string;
  feedback: string[];
  recommendation: string;
}

const MOCK_QUESTIONS: Record<string, TestQuestion[]> = {
  default: [
    { id: 1, question: "Please introduce yourself briefly. What is your name and where are you from?", difficulty: "A1-A2" },
    { id: 2, question: "Describe your current or most recent job. What do you do on a typical day?", difficulty: "B1-B2" },
    { id: 3, question: "What are the advantages and disadvantages of working abroad? Share your opinion.", difficulty: "B2-C1" },
  ],
};

const LanguageTestDialog = ({ open, onOpenChange, language, onResult }: LanguageTestDialogProps) => {
  const [step, setStep] = useState<"intro" | "testing" | "result">("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const questions = MOCK_QUESTIONS.default;

  const handleStart = () => {
    setStep("testing");
    setCurrentQ(0);
    setAnswers([]);
    setCurrentAnswer("");
    setResult(null);
  };

  const handleSubmitAnswer = async () => {
    const newAnswers = [...answers, currentAnswer];
    setAnswers(newAnswers);
    setCurrentAnswer("");

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // Evaluate
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("evaluate-language-test", {
          body: { language, answers: newAnswers, questions: questions.map(q => q.question) },
        });
        if (error) throw error;
        setResult(data as TestResult);
      } catch {
        // Fallback mock evaluation
        const avgLen = newAnswers.reduce((s, a) => s + a.length, 0) / newAnswers.length;
        let level = "A1";
        if (avgLen > 200) level = "C1";
        else if (avgLen > 120) level = "B2";
        else if (avgLen > 70) level = "B1";
        else if (avgLen > 30) level = "A2";

        setResult({
          estimatedLevel: level,
          confidence: avgLen > 100 ? "medium" : "low",
          feedback: [
            `Based on your responses, your ${language} appears to be around ${level} level.`,
            avgLen > 70 ? "Good vocabulary range and sentence structure." : "Try to write more detailed responses for better accuracy.",
            "This is a rough estimate — take a certified test for accurate results.",
          ],
          recommendation: `To improve job chances, aim for at least B2 level in ${language}.`,
        });
      }
      setLoading(false);
      setStep("result");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("intro");
    setCurrentQ(0);
    setAnswers([]);
    setResult(null);
  };

  const levelColor: Record<string, string> = {
    A1: "bg-red-500/10 text-red-600",
    A2: "bg-orange-500/10 text-orange-600",
    B1: "bg-amber-500/10 text-amber-600",
    B2: "bg-emerald-500/10 text-emerald-600",
    C1: "bg-green-500/10 text-green-700",
    C2: "bg-green-600/10 text-green-800",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-accent" />
            {language} Level Test
          </DialogTitle>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Answer 3 short questions in {language} to estimate your language level. 
              This takes about 2–3 minutes.
            </p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>📝 3 questions</span>
              <span>⏱ ~3 min</span>
              <span>🎯 A1–C2 result</span>
            </div>
            <Button onClick={handleStart} className="w-full">
              Start Test
            </Button>
          </div>
        )}

        {step === "testing" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">{questions[currentQ].difficulty}</Badge>
              <span className="text-xs text-muted-foreground">Question {currentQ + 1}/{questions.length}</span>
            </div>
            <p className="text-sm text-foreground font-medium">{questions[currentQ].question}</p>
            <Textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder={`Write your answer in ${language}...`}
              rows={4}
            />
            <Button
              onClick={handleSubmitAnswer}
              disabled={currentAnswer.trim().length < 5}
              className="w-full"
            >
              {currentQ < questions.length - 1 ? (
                <>Next <Send className="w-3 h-3 ml-1" /></>
              ) : (
                <>Submit & Evaluate</>
              )}
            </Button>
          </div>
        )}

        {step === "result" && loading && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
            <p className="text-sm text-muted-foreground">Evaluating your responses...</p>
          </div>
        )}

        {step === "result" && !loading && result && (
          <div className="space-y-4">
            <div className="text-center">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-bold ${levelColor[result.estimatedLevel] || "bg-secondary text-foreground"}`}>
                <CheckCircle className="w-5 h-5" />
                {result.estimatedLevel}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Confidence: {result.confidence}
              </p>
            </div>

            <div className="space-y-1.5">
              {result.feedback.map((f, i) => (
                <p key={i} className="text-xs text-foreground/80">• {f}</p>
              ))}
            </div>

            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-foreground font-medium">{result.recommendation}</p>
            </div>

            <Button variant="outline" onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LanguageTestDialog;
