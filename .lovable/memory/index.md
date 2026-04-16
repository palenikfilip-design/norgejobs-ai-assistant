# Project Memory

## Core
- Modern futuristic aesthetic: Space Grotesk, glassmorphism, dark blue (#1F2937), red accents (#EF4444).
- High contrast interactive elements; all auth/onboarding pages must have visible back/close buttons.
- Supabase auth (Google, Apple, email) via `@lovable.dev/cloud-auth-js`.
- LocalStorage persistence (`leslieUser` in `UserContext`) split into `UserProfile` and `SearchPreset`.
- Target markets: NO, DE, AT, CZ, SK with remote support.
- Free tier: 4 full job views/day, rest blurred. Premium = unlimited.

## Memories
- [Project Vision](mem://project/vision) — Architecture concept separating user identity (Avatar) from multiple Search Presets
- [Assistant Persona](mem://ux/assistant-persona) — Leslie's visual identity, presence across UI, and configurable tone
- [Job Filtering](mem://features/job-filtering) — Advanced filtering capabilities on the dashboard
- [Navigation Patterns](mem://ux/navigation-patterns) — Mandatory back/close buttons on auth and onboarding pages
- [Usability Guidelines](mem://style/usability-guidelines) — High contrast and visibility requirements for interactive elements
- [Currency System](mem://features/currency-system) — Static exchange rates and monthly salary comparison
- [Cover Letter Generator](mem://features/cover-letter-generator) — AI cover letter generation via Supabase Edge Functions
- [Job Card Details](mem://features/job-card-details) — Content and layout of job listings (Match Score, Dimensions, Insights)
- [Data Persistence](mem://tech/data-persistence) — Data split (UserProfile/SearchPreset) and localStorage details
- [Cost of Living Insights](mem://features/cost-of-living-insights) — Real Value Insights calculations and country living cost benchmarks
- [Smart Match Score](mem://features/smart-match-score) — Formula and constraints for calculating the match score (0-100%)
- [Skill Booster](mem://features/skill-booster) — Gap analysis and actionable improvement suggestions
- [Avatar Onboarding](mem://features/avatar-onboarding) — 5-step onboarding flow and AI summary generation
- [Profile Management](mem://features/profile-management) — Routing and structure for editing profiles vs search presets
- [Search Presets](mem://features/search-presets) — Multi-preset management, aggregation, and deduplication logic
- [Chat Assistant](mem://features/chat-assistant) — Direct chat interface with Leslie for filtering and advice
- [Social Login](mem://auth/social-login) — Supabase Lovable Cloud auth with Google/Apple
- [Market Heat Index](mem://features/market-heat-index) — Competition visualization based on applicant-to-position ratio
- [Language AI Test](mem://features/language-ai-test) — 3-question conversation to estimate language proficiency (A1-C2)
- [Market Focus](mem://project/market-focus) — Target job markets and remote work support
- [Aesthetics](mem://style/aesthetics) — Modern futuristic UI, Space Grotesk, glassmorphism, color palette
- [Dimensional Profiling](mem://features/dimensional-profiling) — Profile structure (Work style, Lifestyle, Finance) with confidence levels
- [Unknown Engine](mem://features/unknown-engine) — Missing data handling and dynamic question generation
- [Job Sources Module](mem://features/job-sources-module) — Managing external job portals and URL detection
- [Behavior Learning](mem://features/behavior-learning) — Premium tracking, explicit prefs, snapshots, derived profile, re-ranking
- [Lifestyle Matching](mem://features/lifestyle-matching) — Optional lifestyle data in job matching with configurable weight
- [Paywall System](mem://features/paywall-system) — Free tier daily limit, blurred cards, Premium upgrade, free unlocks
