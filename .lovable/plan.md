# Archiles Admin Section — Phase 3

Complete admin control panel at `/admin/archiles/*`, gated to `palenik.filip@gmail.com` (404 otherwise). Czech-first UI, mobile-responsive, with confirmation modals on destructive actions.

## Architecture

```
/admin/archiles                  → Dashboard (overview + activity feed + quick actions)
/admin/archiles/review           → Review Queue (table + filters + bulk approve)
/admin/archiles/sources          → Sources management (+ "Ask Archiles" investigate mode)
/admin/archiles/chat             → Chat with Archiles (admin assistant)
/admin/archiles/autonomy         → Autonomy slider + per-feature toggles
/admin/stats                     → existing, linked from sidebar as "Statistics"
```

Shared `ArchilesLayout` component with left `Sidebar` (shadcn) + breadcrumb header. Gate via `useEffect` checking `supabase.auth.getUser()` email; mismatched users get `<NotFound />`.

## Database changes (one migration)

1. `archiles_chat_history` table:
   - `id`, `admin_id`, `message_role` (user/assistant/tool), `message_content`, `tool_calls jsonb`, `created_at`
   - RLS: admin role only (using `has_role`)
   - GRANT to authenticated + service_role
2. `archiles_autonomy_log` table (Recent autonomy changes):
   - `id`, `changed_by`, `old_values jsonb`, `new_values jsonb`, `created_at`
   - RLS: admin only
   - Trigger on `archiles_autonomy` UPDATE → insert log row
3. Make sure my user has `admin` role in `user_roles` (insert if missing) — needed for all admin RLS.

## Edge functions

1. **`chat-archiles`** — Gemini 2.5 Flash with function calling. System prompt as specified. Tools:
   - `query_catalog(filter, limit)` — whitelist columns/operators, read `public_jobs`
   - `analyze_source_health(source_id)` — aggregates from `public_jobs` + `ingest_logs`
   - `suggest_new_sources(criteria)` — AI generates suggestions, returns list
   - `find_duplicates()` — group by lower(title)+lower(company)
   - `explain_decision(job_id)` — fetch from `archiles_decisions` + job row
   - `propose_autonomy_change(reason)` — returns suggestion only
   - Persists messages to `archiles_chat_history`
2. **`archiles-investigate-source`** — input `{url?, company?, country?}`; detect ATS by URL patterns (Greenhouse/Lever/Workday/SmartRecruiters/Personio/Workable); test-fetch list endpoint with `limit=1`; return `{ats_type, config, sample_job}` or failure with reasons.

## Pages

### `ArchilesLayout.tsx`
Sidebar with NavLinks + active state. Gate by email check. Breadcrumb derived from route.

### Dashboard (`ArchilesDashboard.tsx`)
- 6 metric cards (2x3 grid, stacks on mobile): jobs in catalog (+ 7d delta), pending review, active sources, last enrichment ("X min ago"), avg trust score, sparse data %.
- Activity feed: last 20 `archiles_decisions` joined with `public_jobs` (title, source). Expandable card showing JSON.
- Quick actions: trigger ingest / enrichment catchup / open chat. Toast on success.

### Review Queue (`ArchilesReview.tsx`)
- Filters: source portal, trust range slider, completeness multi-select, confidence slider, country, has-salary toggle, red-flags toggle.
- Table with 20/page pagination. Bulk checkbox column. Expand row → detail panel with description, enrichment fields, formatted trust signals, archiles notes (warning highlight), edit panel.
- Approve & learn: diff edited vs archiles_choice → write to `archiles_decisions.admin_choice` + `resolved_at`, set `needs_review=false`.
- Bulk: approve selected / approve all on page / reject selected (sets `is_active=false`). Confirmation modal with 3s countdown for destructive.

### Sources (`ArchilesSources.tsx`)
- Table from `job_sources` with enhanced columns (last 24h jobs computed via query, avg trust score via aggregate query keyed by `source_id`).
- Tabs at top for add panel: "Manuální" form vs "Zeptat se Archila" (calls `archiles-investigate-source`, shows detection result + sample job + "Přidat zdroj" button).
- Run/Edit/Delete actions with confirmation.

### Chat (`ArchilesChat.tsx`)
- Reuse AI Elements-style layout from existing `Chat.tsx` patterns. Streamed responses via edge function.
- Render tool calls collapsed (accordion). Persists to `archiles_chat_history` (loaded on mount for current admin).

### Autonomy (`ArchilesAutonomy.tsx`)
- Main slider 0–100 with 5 labeled stops. Below: dynamic interpretation text.
- Per-feature: `auto_publish_threshold` slider, three toggles.
- "Uložit změny" → updates row 1; trigger logs to `archiles_autonomy_log`.
- Recent log table at bottom.

### Integration touches
- `Dashboard.tsx` / app header: if admin, show "Admin" link → `/admin/archiles`.
- `AdminStats.tsx`: add small "Archiles status" card showing `autonomy_level` and `needs_review` count.

## Technical notes

- All queries use existing `supabase` client; admin role enforces RLS for new tables.
- React Query (already installed) with 60s cache for dashboard metrics.
- Confirmation modal: small component with `AlertDialog` + countdown state.
- Toasts via `sonner`.
- Whitelist for `query_catalog`: columns `[title, company, country, source_portal, trust_score, data_completeness, needs_review, is_active, enriched_at, salary_normalized_eur, language_requirements, expat_openness, skill_level, category]`; operators `[eq, neq, gt, gte, lt, lte, in, is]`; mandatory `limit ≤ 100`.

## Out of scope (Phase 4)
- Backfill enrichment of full catalog.
- Auto-execution of suggested sources by Archiles.

## Verification after deploy
1. Visit each of 5 pages while logged in as me; confirm 404 as another user.
2. Chat: ask "What's the current state of the catalog?" — show response.
3. Investigate: `https://boards.greenhouse.io/discord` — show detected ATS=greenhouse, slug=discord, sample job.
4. Autonomy slider 0 → 25 → 0; verify DB + log entries.
5. Review Queue: show counts + 3 high / 3 low confidence samples.
