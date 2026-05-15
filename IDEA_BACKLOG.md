# IDEA_BACKLOG.md

DevSquad idea log. Append-only. Any agent can add. Format: `- [YYYY-MM-DD] [AGENT] idea — context`.

## Ideas
- [2026-05-15] [PM] Backlog initialized — awaiting first project brief from user.
- [2026-05-15] [PM] Bug 4 (open): ResultScreen/StreakResultScreen use localStorage username, not session username. Fix: prefer session.user.name when signed in, lock input.
- [2026-05-15] [PM] Bug 5 (open): HistoryTab timeAgo shows "0m ago" for <60s entries. Fix: add `if (m < 1) return 'just now'` before `m < 60` branch.
- [2026-05-15] [PM] Proper fix for ProfileCard stale username: build `/api/profile/me` endpoint (resolves via session.user.id → DB lookup). ProfileCard switches to fetching from this endpoint instead of using session.user.name. Eliminates 404-and-refresh flow entirely.
- [2026-05-15] [BACKEND] Stale worktree leftover `/Users/m3kh/projects/Dab Pose/.claude/worktrees/zen-cohen-c626b9` (lowercase 'p' path) — orphan from earlier session. Cleanup candidate, unrelated to current task.
- [2026-05-15] [BACKEND] Vercel GitHub auto-deploy hook not triggering on `git push origin main` — had to deploy manually via `vercel --prod`. Check Vercel project → Git integration (might be disconnected / token expired / branch filter misconfigured).
- [2026-05-15] [QA] Prod leaderboard pollution: FAKEit3 has 3 test-only entries (840 XX, 1312 JP, 5000 XX) from in-session verification. Doesn't displace any rank-#1 holder. Cleanup ideas: Redis ZREM on each member JSON + DB scores DELETE by id. Defer.
- [2026-05-15] [FRONTEND] Settings tab country form is still a 2-char text input. Replace with the same `CountryChip` component for consistency once the chip is battle-tested.
- [2026-05-15] [BACKEND] GSC sitemap submitted — wait 1–24h for "Discovered URLs" tally, 2–7d for indexed pages, 2–4w for Performance impressions. Re-check status; if "Couldn't fetch" or "Excluded" appears, inspect via URL Inspection.
- [2026-05-15] [BACKEND] Backfill script `scripts/backfill-total-dabs.ts` is destructive (SETs `lb:stats:dabs` from current sums). Safe to re-run only if INCRs since last run are all reflected in leaderboards; otherwise it will overwrite live counter. Add `--dry-run` default + explicit `--apply` flag if reuse becomes a concern.
- [2026-05-15] [FRONTEND] Auth pages currently only show value props on lg+ (left panel hidden on mobile). Mobile users see only the form with no context. Consider a slim mobile-only banner above the form on small screens, or float a tiny stat chip beside the title.
- [2026-05-15] [FRONTEND] /signup placeholder dropped the username charset hint. If invalid-username errors spike, restore "letters/numbers/_" hint as helper text under the input.
- [2026-05-15] [SECURITY] `defaultMode: "bypassPermissions"` set in project `.claude/settings.local.json`. File is gitignored so it stays per-machine. Revisit when sharing the project or moving to a less-trusted environment.
