import { motion } from "framer-motion";
import { MapPin, Banknote, Briefcase, Sparkles } from "lucide-react";
import type { Job } from "@/data/mockJobs";

interface JobCardProps {
  job: Job;
  index: number;
}

const JobCard = ({ job, index }: JobCardProps) => {
  const scoreColor =
    (job.matchScore ?? 0) >= 85
      ? "text-emerald-500"
      : (job.matchScore ?? 0) >= 70
      ? "text-amber-500"
      : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="glass-card-elevated rounded-xl p-5 hover:shadow-lg transition-all duration-300 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-foreground text-lg truncate group-hover:text-red-accent transition-colors">
            {job.title}
          </h3>
          <p className="text-muted-foreground text-sm">{job.company}</p>
        </div>
        {job.matchScore !== undefined && (
          <div className="flex items-center gap-1 ml-3 shrink-0">
            <Sparkles className="w-4 h-4 text-red-accent" />
            <span className={`font-display font-bold text-lg ${scoreColor}`}>
              {job.matchScore}%
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          {job.city}, {job.country}
        </span>
        <span className="flex items-center gap-1">
          <Banknote className="w-3.5 h-3.5" />
          {job.salary}
        </span>
        <span className="flex items-center gap-1">
          <Briefcase className="w-3.5 h-3.5" />
          {job.type}
        </span>
      </div>

      <p className="text-sm text-foreground/80 mb-3 line-clamp-2">
        {job.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {job.skills.map((skill) => (
          <span
            key={skill}
            className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
          >
            {skill}
          </span>
        ))}
      </div>

      {job.matchReason && (
        <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5 border border-border/30">
          <span className="font-medium text-foreground">Why this fits you:</span>{" "}
          {job.matchReason}
        </div>
      )}
    </motion.div>
  );
};

export default JobCard;
