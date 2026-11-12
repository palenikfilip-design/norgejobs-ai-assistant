export type QueueKind = "company" | "job" | "report";
export interface QueueItem { kind: QueueKind; id: string; at: string }

/** Merge review items into one queue, oldest first. */
export function sortQueue<T extends QueueItem>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** An offer can only go live once its company is active and approved. */
export function companyReadyToPublish(c: { status: string; approved_at: string | null } | null | undefined) {
  return !!c && c.status === "active" && !!c.approved_at;
}

export const REPORT_REASONS: Record<string, string> = {
  invalid_info: "Neplatné nebo zavádějící údaje",
  upfront_fees: "Vyžaduje poplatky předem",
  no_longer_available: "Nabídka už neexistuje",
  scam: "Podezření na podvod",
  discrimination: "Diskriminace",
  other: "Jiné",
};

export type ReviewEvent = "job_approved" | "job_rejected" | "company_approved" | "company_rejected";
