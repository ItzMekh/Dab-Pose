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
