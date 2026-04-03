export interface BoostSuggestion {
  type: "skill" | "language" | "certification" | "experience";
  name: string;
  currentLevel?: string;
  targetLevel?: string;
  estimatedImpact: number; // percentage points
  action: string;
  actionCta: string;
}

export function generateBoostSuggestions(
  missingRequirements: string[],
  totalMaxScore: number = 100
): BoostSuggestion[] {
  const suggestions: BoostSuggestion[] = [];

  for (const req of missingRequirements) {
    if (req.startsWith("Skill:")) {
      const skill = req.replace("Skill: ", "");
      suggestions.push({
        type: "skill",
        name: skill,
        estimatedImpact: Math.min(15, Math.round(30 / Math.max(missingRequirements.filter(r => r.startsWith("Skill:")).length, 1))),
        action: `Learn ${skill} through online courses or practice projects`,
        actionCta: "Find course",
      });
    } else if (req.startsWith("Language:")) {
      const match = req.match(/Language:\s*(.+?)\s*\((\w+)\)/);
      if (match) {
        suggestions.push({
          type: "language",
          name: match[1],
          targetLevel: match[2],
          estimatedImpact: Math.min(20, Math.round(25 / Math.max(missingRequirements.filter(r => r.startsWith("Language:")).length, 1))),
          action: `Improve your ${match[1]} to ${match[2]} level`,
          actionCta: "Test your level",
        });
      }
    } else if (req.startsWith("Certification:")) {
      const cert = req.replace("Certification: ", "");
      suggestions.push({
        type: "certification",
        name: cert,
        estimatedImpact: Math.min(10, Math.round(15 / Math.max(missingRequirements.filter(r => r.startsWith("Certification:")).length, 1))),
        action: `Get certified in ${cert}`,
        actionCta: "Find certification",
      });
    } else if (req.startsWith("Experience:")) {
      const exp = req.replace("Experience: ", "");
      suggestions.push({
        type: "experience",
        name: exp,
        estimatedImpact: 10,
        action: "Gain more experience through internships or projects",
        actionCta: "Improve profile",
      });
    }
  }

  return suggestions.sort((a, b) => b.estimatedImpact - a.estimatedImpact).slice(0, 5);
}
