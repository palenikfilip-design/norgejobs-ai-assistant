import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Banknote, Briefcase, Sparkles, ExternalLink, FileText, Heart, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EnhancedJob } from "@/utils/jobMatching";
import { parseSalaryRange, getMultiCurrencyDisplay, formatCurrency, convertCurrency, type CurrencyCode } from "@/utils/currency";
import { getCostOfLivingInsight } from "@/utils/costOfLiving";
import RealValueInsight from "@/components/RealValueInsight";
import SmartMatchScore from "@/components/SmartMatchScore";
import MarketHeatIndex from "@/components/MarketHeatIndex";
import SkillBooster from "@/components/SkillBooster";
import LanguageTestDialog from "@/components/LanguageTestDialog";
import DimensionBreakdown from "@/components/DimensionBreakdown";
import UnknownEngine from "@/components/UnknownEngine";
import InfoTooltip from "@/components/InfoTooltip";
import JobActionBar from "@/components/JobActionBar";
import { calculateSmartMatch } from "@/utils/smartMatch";
import { calculateDimensionMatch, detectUnknowns } from "@/utils/dimensionMatching";
import { defaultJobDimensions } from "@/types/candidateDimensions";
import { generateBoostSuggestions } from "@/utils/skillBooster";
import { useUser } from "@/context/UserContext";

interface EnhancedJobCardProps {
  job: EnhancedJob;
  index: number;
  userCurrency?: CurrencyCode;
  onGenerateCoverLetter?: (job: EnhancedJob) => void;
  onSaveJob?: (job: EnhancedJob) => void;
}

const EnhancedJobCard = ({ job, index, userCurrency = "CZK", onGenerateCoverLetter, onSaveJob }: EnhancedJobCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [langTestOpen, setLangTestOpen] = useState(false);
  const [langTestLang, setLangTestLang] = useState("English");
  const { activeAvatars, user } = useUser();
  const activeAvatar = activeAvatars[0] ?? null;

  const scoreColor = job.matchScore >= 80
    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
    : job.matchScore >= 60
    ? "text-amber-500 bg-amber-500/10 border-amber-500/30"
    : "text-red-500 bg-red-500/10 border-red-500/30";

  const scoreLabel = job.matchScore >= 80 ? "Great Match" : job.matchScore >= 60 ? "Good Match" : "Low Match";

  const parsedRaw = parseSalaryRange(job.salary);
  // Treat near-zero / nonsense salaries as "not specified"
  const hasRealSalary = !!parsedRaw && (parsedRaw.max ?? parsedRaw.min ?? 0) > 100;
  const parsed = hasRealSalary ? parsedRaw : null;
  const salaryDisplay = hasRealSalary && parsed
    ? `${formatCurrency(parsed.min / 12, parsed.currency)} – ${formatCurrency(parsed.max / 12, parsed.currency)}/month`
    : "Neuvedeno";
  const monthlyConverted = parsed && userCurrency !== parsed.currency
    ? `≈ ${formatCurrency(convertCurrency(parsed.min / 12, parsed.currency, userCurrency), userCurrency)} – ${formatCurrency(convertCurrency(parsed.max / 12, parsed.currency, userCurrency), userCurrency)}/month`
    : null;

  const costInsight = useMemo(() => {
    if (!parsed) return null;
    return getCostOfLivingInsight(job.country, job.title, parsed.min, parsed.max);
  }, [job.country, job.title, parsed?.min, parsed?.max]);

  // Location: drop empty / "—" city
  const cleanCity = job.city && job.city.trim() && job.city.trim() !== "—" ? job.city.trim() : null;
  const cleanCountry = job.country && job.country.trim() && job.country.trim() !== "—" ? job.country.trim() : null;
  const locationDisplay = [cleanCity, cleanCountry].filter(Boolean).join(", ") || "Neuvedeno";

  // URL safety
  const rawUrl = job.sourceUrl || "";
  const validUrl =
    rawUrl &&
    /^https?:\/\//i.test(rawUrl) &&
    !/lovableproject\.com/i.test(rawUrl) &&
    !/lovable\.app/i.test(rawUrl)
      ? rawUrl
      : null;

  // Smart Match
  const smartMatch = useMemo(() => {
    if (!activeAvatar) return null;
    return calculateSmartMatch(job, activeAvatar);
  }, [job, activeAvatar]);

  // Skill Booster
  const boostSuggestions = useMemo(() => {
    if (!smartMatch) return [];
    return generateBoostSuggestions(smartMatch.missingRequirements);
  }, [smartMatch]);

  // Dimension matching
  const dimMatch = useMemo(() => {
    const jobDims = job.dimensions ?? defaultJobDimensions;
    return calculateDimensionMatch(user.profile.dimensions, jobDims);
  }, [job, user.profile.dimensions]);

  // Unknown fields
  const unknowns = useMemo(() => detectUnknowns(user.profile.dimensions), [user.profile.dimensions]);

  const handleSave = () => {
    setSaved(!saved);
    onSaveJob?.(job);
  };

  const handleTestLanguage = (language: string) => {
    setLangTestLang(language);
    setLangTestOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.4 }}
        className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-lg leading-tight">{job.title}</h3>
              <p className="text-muted-foreground text-sm mt-0.5">{job.company}</p>
            </div>
            <div className={`flex flex-col items-center px-3 py-2 rounded-lg border ${scoreColor} relative`}>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold leading-none">{job.matchScore}% shoda</span>
                <InfoTooltip content="Match Score ukazuje, jak dobře tato pozice odpovídá tvému profilu. 80%+ = skvělý match, 60-79% = dobrý match, pod 60% = nízká shoda." />
              </div>
              <span className="text-[10px] font-medium mt-0.5">{scoreLabel}</span>
            </div>
          </div>

          {/* Match reasons */}
          {Array.isArray(job.matchReasons) && job.matchReasons.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2 mb-3">
              {job.matchReasons.map((r, idx) => (
                <span
                  key={`${idx}-${r}`}
                  className="text-xs px-2 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-full"
                >
                  {r}
                </span>
              ))}
            </div>
          )}

          {/* Hard filter warning */}
          {job.hardFiltered && (
            <div className="flex items-center gap-1.5 mb-2 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span className="text-xs font-medium text-destructive">Not fully eligible — {job.hardFilterReason}</span>
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-3">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{locationDisplay}</span>
            <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.type}</span>
          </div>

          {/* Market Heat Index */}
          {job.applicants != null && job.positions != null && (
            <div className="mb-3">
              <MarketHeatIndex
                applicants={job.applicants}
                positions={job.positions}
                avgDaysToFill={job.avgDaysToFill}
              />
            </div>
          )}

          {/* Salary section */}
          <div className="bg-secondary/50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Banknote className="w-4 h-4 text-accent" />
              <span className="font-medium text-foreground text-sm">{salaryDisplay}</span>
              <InfoTooltip content="Měsíční plat v originální měně inzerátu. Pokud se tvá měna liší, přepočet je uveden níže." />
            </div>
            {monthlyConverted && (
              <p className="text-sm font-medium text-accent ml-5.5">{monthlyConverted}</p>
            )}
          </div>

          {/* AI Summary */}
          <p className="text-sm text-foreground/80 mb-3">{job.aiSummary}</p>

          {/* Real Value Insight */}
          {hasRealSalary && costInsight && (
            <div className="mb-3">
              <RealValueInsight insight={costInsight} userCurrency={userCurrency} />
            </div>
          )}

          {/* Skills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {job.skills.map(skill => (
              <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
            ))}
          </div>

          {/* Why this match */}
          <div className="bg-secondary/30 rounded-lg p-3 border border-border/30 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="font-medium text-foreground text-sm">Why this job fits you</span>
              <InfoTooltip content="AI analýza shrnuje klíčové důvody, proč ti tato pozice sedí (zelené) a kde mohou být slabší stránky (oranžové)." />
            </div>
            <ul className="space-y-1">
              {job.matchReasons.slice(0, 3).map((r, i) => (
                <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                  <TrendingUp className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                  {r}
                </li>
              ))}
              {job.negativeSignals.slice(0, 2).map((r, i) => (
                <li key={`neg-${i}`} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <TrendingDown className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {/* Skill Booster */}
          {boostSuggestions.length > 0 && (
            <div className="mb-3">
              <SkillBooster suggestions={boostSuggestions} onTestLanguage={handleTestLanguage} />
            </div>
          )}

          {/* Expanded: Smart Match + Dimension Breakdown */}
          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-3 space-y-3">
              {smartMatch && (
                <div className="bg-secondary/20 rounded-lg p-3 border border-border/20">
                  <h4 className="text-xs font-semibold text-foreground mb-2">Smart Match Breakdown</h4>
                  <SmartMatchScore result={smartMatch} />
                </div>
              )}
              <div className="bg-secondary/20 rounded-lg p-3 border border-border/20">
                <DimensionBreakdown categories={dimMatch.categories} overallScore={dimMatch.overallScore} overallConfidence={dimMatch.overallConfidence} />
              </div>
              {unknowns.length > 0 && (
                <UnknownEngine unknowns={unknowns} onAnswerQuestion={() => {}} />
              )}
            </motion.div>
          )}

          {/* Toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Less details" : "Smart match breakdown"}
          </button>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {validUrl ? (
              <Button variant="outline" size="sm" className="text-xs" asChild>
                <a href={validUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-1" />View Full Job
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="text-xs" disabled>
                <ExternalLink className="w-3 h-3 mr-1" />URL not available
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onGenerateCoverLetter?.(job)}>
              <FileText className="w-3 h-3 mr-1" />Cover Letter
            </Button>
            <JobActionBar job={job} />

          </div>
        </div>
      </motion.div>

      <LanguageTestDialog
        open={langTestOpen}
        onOpenChange={setLangTestOpen}
        language={langTestLang}
      />
    </>
  );
};

export default EnhancedJobCard;
