---
name: Smart Paywall & Daily Limit System
description: Free users see 4 full jobs/day, rest are blurred. Premium = unlimited. Free unlocks via actions.
type: feature
---
- `user_access` table: is_premium, daily_view_limit (default 4), jobs_viewed_today, last_reset_date, free_unlocks
- Daily reset: on load, if last_reset_date !== today → reset counter
- Blurred cards show: title, company, location, match%, but blur salary/description/skills
- Free unlock actions: complete profile to 100%, invite friend, verify email → +1 unlock each
- Premium page at /premium with comparison table
- Smart messaging: "You've unlocked your top matches for today" not "Pay to see"
- Job view counted only on explicit click, not on scroll
- Paddle payment integration planned for Premium upgrade
