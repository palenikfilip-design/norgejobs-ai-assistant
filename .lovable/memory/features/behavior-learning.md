---
name: behavior-learning
description: Premium-only system that tracks job interactions, learns user preferences, manages explicit categorization (favorite/top_pick/saved/applied/rejected) and opt-in snapshots, and re-ranks jobs by behavior alignment.
type: feature
---
**Tables:** `user_job_interactions`, `job_preferences`, `job_snapshots` (opt-in only via 📌), `user_preference_profile` (derived).

**Hooks:**
- `useJobInteractions` — fire-and-forget tracking (view/click/apply/save/reject/unsave).
- `useJobPreferences` — explicit categories; favorite/top_pick/not_interested are mutually exclusive per job.
- `useJobSnapshots` — opt-in copies (NOT automatic on save).
- `usePreferenceProfile` — loads interactions+prefs, derives `UserPreferenceProfile`, persists to DB.

**Logic (`src/utils/behaviorLearning.ts`):**
- `computeBehaviorScore(job, interactions, prefs, jobs)` → 0-100 based on similarity to positively/negatively signaled jobs.
- `deriveUserPreferenceProfile` → salary band, job type, environment, shift, stress, isolation; each with confidence 0-1. Detects patterns and conflicts (e.g. "wants high salary but picks low-stress").

**UI:**
- `JobActionBar` (in `EnhancedJobCard`) — ❤️ ⭐ 💾 ❌ 📌 with Premium lock icon + redirect to /premium.
- `PatternInsightsPanel` (Dashboard) — shows learned patterns, conflict warnings, suggestion buttons (suggestion-only, never auto-modifies profile).
- `/saved` page — tabs: Favorites / Top Picks / Saved / Applied / Rejected / Snapshots.

**Ranking:** Dashboard re-ranks Premium users using `0.7 * matchScore + 0.3 * behaviorScore` once any signals exist.

**Gating:** All actions and re-ranking are Premium-only via `useSubscription`.

**Auto-adjust policy:** Suggestions only — user must explicitly confirm. No automatic profile mutation.
