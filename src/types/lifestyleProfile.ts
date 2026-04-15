/** Lifestyle & Availability profile for life-compatible job matching */
export interface LifestyleProfile {
  relationshipStatus: "single" | "relationship" | "married";
  hasChildren: boolean;
  childrenCount: number;
  youngestChildAge: "0-3" | "4-10" | "11+" | "";

  canWorkShifts: boolean;
  canWorkNights: boolean;
  weekendAvailability: "full" | "limited" | "none";

  willingToRelocate: boolean;

  prefersStableSchedule: boolean;
  openToSeasonalJobs: boolean;
}

export const defaultLifestyleProfile: LifestyleProfile = {
  relationshipStatus: "single",
  hasChildren: false,
  childrenCount: 0,
  youngestChildAge: "",

  canWorkShifts: true,
  canWorkNights: false,
  weekendAvailability: "limited",

  willingToRelocate: true,

  prefersStableSchedule: false,
  openToSeasonalJobs: true,
};

/** Check if user has meaningful lifestyle data filled */
export function hasLifestyleData(lp?: LifestyleProfile | null): boolean {
  if (!lp) return false;
  // Consider it "filled" if at least relationship or children or availability is non-default
  return (
    lp.relationshipStatus !== "single" ||
    lp.hasChildren ||
    !lp.canWorkShifts ||
    lp.canWorkNights ||
    lp.weekendAvailability !== "limited" ||
    !lp.willingToRelocate ||
    lp.prefersStableSchedule ||
    !lp.openToSeasonalJobs
  );
}
