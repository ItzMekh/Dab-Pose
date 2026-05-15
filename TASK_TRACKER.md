# TASK_TRACKER.md

DevSquad task log. Updated by all agents on assign / start / complete.

## Legend
- [ ] pending
- [~] in progress
- [x] done

## Tasks
- [x] Initialize DevSquad workspace — owner: [PM]
- [x] Inspect state (git, worktree, memory) — owner: [PM]+[BACKEND]
- [x] Apply ProfileCard.tsx vertical redesign + JWT-refresh-on-404 to local main — owner: [FRONTEND]
- [x] Audit LandingScreen.tsx sign-in card vs new vertical style — owner: [FRONTEND]
- [x] Run `npm run lint` + `npm run build` — owner: [QA]
- [x] QA review changes — owner: [QA]
- [x] Commit a — `754a330` feat: vertical compact ProfileCard + matching sign-in card
- [x] Commit b — `47ffb8c` fix: eliminate stale-username races in profile system
- [x] Cleanup worktree `profile-ui-fixes` (auto-pruned, branch already gone)
- [x] Push to origin/main — `3bbd4be..47ffb8c` (4 commits)
- [x] Gitignore TASK_TRACKER.md + IDEA_BACKLOG.md, commit + push — `0d07a12`
- [x] Update memory: mark session_2026-05-15_profile-ui as resolved — owner: [PM]
- [x] Add Notification hook (global ~/.claude/settings.json) — osascript banner + Ping sound on input/approval — owner: [BACKEND]
- [x] Update memory: session log resolved, Bug 3 flipped to fixed, added notification-hook-setup feedback memory, MEMORY.md index updated — owner: [PM]
- [x] Bug 4 — ResultScreen + StreakResultScreen submit session.user.name when signed in — commit `35306d4` — owner: [FRONTEND]
- [x] /api/profile/me endpoint + ProfileCard switch (replaces 404-and-refresh band-aid for Bug 3) — commit `eb1e6f7` — owner: [BACKEND]+[FRONTEND]
- [x] Bug 5 — HistoryTab timeAgo 'just now' for <60s — commit `8e288c2` — owner: [FRONTEND]
- [x] Push round 2 to origin/main — `3738d0c..8e288c2`
- [x] Update memory: Bugs 3/4/5 all marked fixed, MEMORY.md index updated — owner: [PM]
- [x] Browser test localhost — ProfileCard, /api/profile/me 401, result screen pill `Signed in as FAKEit3`, payload `{username:FAKEit3, time_ms:840}`, HistoryTab `just now` — owner: [QA]
- [x] Deploy to production via `vercel --prod` (GitHub auto-deploy hook ไม่ trigger; CLI deploy works) — owner: [BACKEND]
- [x] Prod regression caught: result screen pill showed stale `FAKEit` (session JWT lagging). Root: client uses session.user.name; ProfileCard `update()` is async, race with navigation. — owner: [QA]
- [x] Server-side fix `/api/score` — resolve canonical username from session.user.id, ignore client name when authenticated — commit `2c6c15b` — owner: [BACKEND]
- [x] Country chip on result screens + canonical name display via `/api/profile/me` fetch; `useCountry` now returns `[country, setCountry]` tuple — commit `c4378ed` — owner: [FRONTEND]
- [x] Deploy round 3 — `vercel --prod` ✓
- [x] Verify chip + pill on prod — pill `FAKEit3` (canonical), chip default `🇹🇭`, change→JP→submit body `country:"JP"`, history shows 1312ms JP, server override of `STALE_NAME_X`→`FAKEit3` confirmed — owner: [QA]
- [x] Cleanup prod test pollution via `scripts/cleanup-test-pollution.ts` — ZREM 3 members across `lb:single:{all,week,today}`, ZINCRBY -1 country counters (XX -2, JP -1), DECRBY `lb:stats:plays` -3, DELETE 3 DB rows. Verified history=1 (200ms TH). Commit `5d70032`. — owner: [BACKEND]
- [x] Bug 6 — `/profile/me` server redirect resolves canonical username via session.user.id → DB (was using stale JWT `session.user.name` → 404 after rename) — commit `2acc77c` — owner: [BACKEND]
- [x] JWT throttled DB sync — auth.ts background re-pull username from DB every 5s, cookie rotates on every auth() call; eliminates stale `session.user.name` after rename without manual `update()` — commit `95fa9b8` — owner: [BACKEND]
- [x] Push round 4 — `c4378ed..95fa9b8` (3 commits) + `vercel --prod` deploys
- [x] Prod re-verify after each round — /profile/me redirect, JWT auto-refresh post-reload, cookie persists across multi-nav, post-STALE_MS gap stays canonical, console clean — owner: [QA]
- [x] Memory updates: bugs_auth_profile (Bug 6 fixed), cleanup_script_pattern, jwt_throttled_db_sync; MEMORY.md index — owner: [PM]
- [x] Snapshot DevSquad workspace files — commit `8708967` + push (FF after clearing skip-worktree, re-flagged after) — owner: [PM]
- [x] End-to-end rename test on prod — PATCH FAKEit3→FAKEit4 via /api/profile/settings, session auto-refreshes within 12s of the new auth() call (5s STALE_MS + nav latency), /profile/me + ProfileCard + landing all reflect FAKEit4; rollback FAKEit4→FAKEit3 syncs back equally fast. No client `update()` required. — owner: [QA]
- [x] Settings Change Country — replace 2-char text input with shared `COUNTRIES` dropdown via `src/lib/countries.ts`; CountryChip migrated to same source; Save disabled when unchanged — commit `fb7b5af` — owner: [FRONTEND]
- [x] Verify Change Country on prod — initial XX/Save disabled → select TH → PATCH `{field:"country",value:"TH"}` → DB TH → Save disables on refresh → rollback XX — owner: [QA]
- [x] Username rename rate limit + leaderboard sync — added `users.usernameChangedAt timestamp` column (drizzle-kit push), 24h cooldown returns 429 + nextChangeAt + retryAfterSec, /api/score now writes `userId` in member JSON, `rewriteLeaderboardUsername()` scans `lb:{single,streak}:{all,week,today}` on rename and ZREM old + ZADD new for matching members, scores.username denorm bulk-updated — commit `5c65ed6` — owner: [BACKEND]
- [x] SettingsTab username form — accepts `usernameChangedAt`, shows "Available in Xh Ym" + disables input/Save while cooldown active, 30s tick — commit `5c65ed6` — owner: [FRONTEND]
- [x] Verify rate limit on prod — first rename FAKEit3→FAKEit5 (scanned 28, rewritten 0 — legacy members lack userId, snapshot used older username); immediate retry returns 429 + Retry-After 86382s + nextChangeAt 2026-05-16; UI cooldown "Available in 23h 59m" with disabled input — owner: [QA]
- [x] Auto-save result screens + top-right header — ResultScreen/StreakResultScreen submit on mount (signed-in or cached anon username); Save button removed; anonymous w/o cached name still types + submits via Enter/blur. LandingScreen identity card moved to top-right; "New here? Create a free account" link removed — commit `03c1737` — owner: [FRONTEND]
- [x] Verify auto-save on prod — gameplay → POST `/api/score` fires automatically `{username:"FAKEit5", time_ms:895, country:"XX"}` → 201 with percentile 10 → DOM shows "Score saved to leaderboard ✓", no Save button present — owner: [QA]
