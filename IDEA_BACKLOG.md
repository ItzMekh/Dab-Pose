# IDEA_BACKLOG.md

DevSquad idea log. Append-only. Any agent can add. Format: `- [YYYY-MM-DD] [AGENT] idea — context`.

## Ideas
- [2026-05-15] [PM] Backlog initialized — awaiting first project brief from user.
- [2026-05-15] [PM] Bug 4 (open): ResultScreen/StreakResultScreen use localStorage username, not session username. Fix: prefer session.user.name when signed in, lock input.
- [2026-05-15] [PM] Bug 5 (open): HistoryTab timeAgo shows "0m ago" for <60s entries. Fix: add `if (m < 1) return 'just now'` before `m < 60` branch.
- [2026-05-15] [PM] Proper fix for ProfileCard stale username: build `/api/profile/me` endpoint (resolves via session.user.id → DB lookup). ProfileCard switches to fetching from this endpoint instead of using session.user.name. Eliminates 404-and-refresh flow entirely.
- [2026-05-15] [BACKEND] Stale worktree leftover `/Users/m3kh/projects/Dab Pose/.claude/worktrees/zen-cohen-c626b9` (lowercase 'p' path) — orphan from earlier session. Cleanup candidate, unrelated to current task.
