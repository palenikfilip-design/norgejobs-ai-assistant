---
name: Lifestyle Matching Layer
description: Optional lifestyle data (family, availability, flexibility) integrated into job matching with per-preset toggle and weight slider
type: feature
---
- LifestyleProfile interface in src/types/lifestyleProfile.ts
- Fields: relationshipStatus, hasChildren, childrenCount, youngestChildAge, canWorkShifts, canWorkNights, weekendAvailability, willingToRelocate, prefersStableSchedule, openToSeasonalJobs
- Stored in UserProfile.lifestyleProfile, persisted via dimensions JSON in DB
- Per-preset: useLifestyleMatching (bool) + lifestyleWeight (0–50%)
- 3-layer matching: Skills+Experience (always), Job Preferences (always), Lifestyle (optional)
- When enabled: FINAL = BASE * (1 - weight) + lifestyle_score * weight
- Lifestyle scoring considers: children vs night shifts, shift flexibility, weekend availability, relocation willingness, schedule stability, seasonal openness
- UI: Profile Edit has "Lifestyle & Availability" section; Preset Edit has toggle + slider
