# Avatar + Presets Architecture Migration

Large refactor separating identity (avatar) from search intent (presets). 9 coordinated parts touching DB schema, data migration, edge functions, dashboard, onboarding, and chat.

## Part 1 — Extend `user_presets` schema

Migration adds columns:
- `seasonal_preference text` ('permanent'|'summer'|'winter'|'any')
- `duration_preference text` ('any'|'1-3 months'|'3-6 months'|'6+ months')
- `language_requirements jsonb default '[]'`
- `description text null`
- `last_used_at timestamptz null`
- `learning_data jsonb default '{}'`

Add code comments in `src/context/UserContext.tsx` and `useProfileSync.ts` documenting AVATAR vs PRESET separation.

## Part 2 — Data migration

In the same SQL migration, for every profile with non-empty `avatar_json` AND no existing preset:
- Insert one preset `name='Můj první preset'`, `active=true`
- Map `avatar_json.languages_spoken → language_requirements`
- Map `avatar_json.min_salary → salary_min`
- Map `avatar_json.seasonal_preference` ("3 months" → "3-6 months", "permanent" → "permanent", else "any")
- Map any country hints into `preferred_countries`

Keep `avatar_json` column intact (backup).

## Part 3 — `cached_matches.preset_id`

Migration adds `preset_id uuid null`. Backfill existing rows to the user's active preset. Update unique constraint to `(user_id, job_url, preset_id)` if exists, else just add column.

## Part 4 — Edge function updates

`match-jobs/index.ts`:
- Accept `{ avatar, preset, language }` instead of just `{ avatar }`
- Restructure Gemini prompt with AVATAR / PRESET / JOB sections
- Return matches unchanged

`match-jobs-all-users/index.ts`:
- For each profile, fetch active preset (`user_presets where user_id and active=true limit 1`); skip if none
- Pass both to match-jobs
- Insert cached_matches with `preset_id`
- Cache check scoped to `(user_id, preset_id)`

## Part 5 — Dashboard preset switcher

`src/pages/Dashboard.tsx` + new `PresetSelector` component:
- Dropdown of user's presets (highlights active)
- "+ Nový preset" → `/preset/new`
- On switch: update `active` flags (single active), set `last_used_at=now()`, mark `needs_rescore=false`, reload
- `useLiveMatches` filters by active preset_id; if zero rows, invoke `match-jobs` for that preset

## Part 6 — `/presets` management page

New `src/pages/Presets.tsx` + route in `App.tsx`:
- Cards: name (inline edit), description, summary (countries/salary/type/seasonal), last_used_at, match count
- Actions: Použít / Upravit (→ `/preset/edit/:id`) / Smazat (confirm)
- "+ Nový preset"

## Part 7 — Two-phase onboarding

Refactor `src/pages/Onboarding.tsx`:
- Phase 1 questions → save to `profiles` (avatar fields)
- Transition message
- Phase 2 questions → insert into `user_presets` with `active=true`

Update i18n `onboarding.questions` to two arrays (`avatarQuestions`, `presetQuestions`) + transition copy.

## Part 8 — Chat extraction routing

`supabase/functions/extract-preferences/index.ts`:
- Classify each extracted fact as `identity` or `search`
- Identity → patch `profiles`
- Search → patch active preset
- Ambiguous → return clarifying question for chat UI

`chat-leslie` surfaces clarifying questions in conversation.

## Part 9 — Verification

After deploy:
- Run SQL: count presets created
- Run match-jobs-all-users
- Report sample row, preset count, errors

## Technical notes

Files touched (≈15):
- `supabase/migrations/<new>.sql` (schema + data migration + cached_matches.preset_id + backfill)
- `supabase/functions/match-jobs/index.ts`
- `supabase/functions/match-jobs-all-users/index.ts`
- `supabase/functions/extract-preferences/index.ts`
- `src/context/UserContext.tsx`, `src/hooks/useProfileSync.ts`, `src/hooks/useLiveMatches.ts`
- `src/pages/Dashboard.tsx`, `src/pages/Onboarding.tsx`, `src/pages/Presets.tsx` (new), `src/App.tsx`
- `src/components/PresetSelector.tsx` (new), reuse `PresetSwitcher` where possible
- `src/i18n/locales/*.json`

Risks:
- Existing `cached_matches` upsert uses `onConflict: "user_id,job_url"` — must update to include preset_id or that constraint stays and we just add the column without unique change. I'll keep existing conflict key and add preset_id as a regular nullable column (rows already cached map to active preset via backfill).
- `avatar_json` not deleted; UI gradually stops reading it.

Estimated single large changeset; will run migration first, then code edits in parallel batches.