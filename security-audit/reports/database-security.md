# Database & Backend Security

Tag prefix `D-NN`.

## Summary

| Finding | Severity |
|---|---|
| D-01 No SQL injection vectors — Drizzle parameterizes all queries | Pass |
| D-02 No NoSQL/Redis injection vectors — all member content is JSON-encoded server-side | Pass |
| D-03 Passwords hashed with bcrypt cost 12 | Pass |
| D-04 No encryption at rest for non-bcrypt PII (email, avatarUrl) — relies on Neon | Info |
| D-05 `ON DELETE SET NULL` on `scores.user_id` enables impersonation via account-recycle | Medium (= C-13) |
| D-06 Redis keys hold long-lived all-time leaderboards with no archival/rotation | Info |
| D-07 No prepared-statement caching review; Drizzle handles | Pass |
| D-08 Username `usernameChangedAt` cooldown is checked client-side first; the server is authoritative | Pass |
| D-09 `rewriteLeaderboardUsername` is best-effort (no transaction across Redis + DB) | Low |
| D-10 No row-level access control needed — single-tenant data model | Pass |

---

## D-01 — SQL Injection — PASS

All Postgres queries go through Drizzle ORM with the operator API (`eq`, `and`, `inArray`, `lt`, `desc`, etc.). No raw SQL strings are built by user input. A grep for `sql\`...\`` (Drizzle's raw template) inside `src/` returns **zero matches**. **Pass.**

---

## D-02 — Redis / NoSQL Injection — PASS

The Upstash Redis client uses a typed REST API. All commands (`ZADD`, `ZRANGE`, `EXPIRE`, `INCR`, `ZINCRBY`, etc.) receive primitive arguments. Member content is built via `JSON.stringify` on server-controlled objects, then parsed with `JSON.parse` on read. Username is regex-validated before being placed inside the JSON.

A user cannot inject Redis command tokens (e.g., a CRLF) because:
- The Upstash REST API is not the RESP wire protocol — it serializes commands as JSON over HTTPS.
- The client library does the encoding.

**Pass.**

---

## D-03 — Password storage — PASS

`bcrypt.hash(password, 12)` is used on signup and password change. Stored in `users.password_hash`. **Pass.**

---

## D-04 — Encryption at rest

### Severity
**Info**

### Description
The Neon Postgres service stores data on encrypted volumes by default (per Neon docs). The application does not apply any additional column-level encryption to email or `avatarUrl`. Acceptable for the threat model.

### Recommended fix
If the project ever stores anything more sensitive (DOB, phone, real name, payment), add column-level encryption (`pgcrypto`'s `pgp_sym_encrypt` with a key in Vercel env) for those columns.

---

## D-05 — Account recycle on deletion

See **C-13**. The `scores.user_id` ON DELETE SET NULL combined with **no username reservation** allows another user to register a deleted user's name and inherit the leaderboard rows in the public UI. Fix: soft-delete or reserve usernames for 30 days.

---

## D-06 — Long-lived all-time leaderboards

### Severity
**Info**

### Description
The keys `lb:single:all` and `lb:streak:all` have no TTL. As the project grows, the sorted sets are unbounded. Today's deployment is fine (small data); long-term think about:
- Trimming to top-N (`ZREMRANGEBYRANK` to keep only the top 1000) on a daily cron.
- Promoting historical entries to Postgres for analytics and dropping them from Redis.

### Risk scenario
- Cost growth.
- Read latency on full-table scans (currently `ZRANGE 0 99` only — bounded).

---

## D-07 — Drizzle prepared-statement reuse — PASS

Drizzle compiles a Drizzle `Query` once and reuses the parameterized form. Neon HTTP driver tunnels each query over HTTPS — there is no traditional prepared-statement cache, but injection-safety holds. **Pass.**

---

## D-08 — Cooldown enforcement — PASS

`SettingsTab.tsx` shows a UI hint "Available in Xh Ym" but does **not** rely on client-side enforcement. The server-side check at `src/app/api/profile/settings/route.ts:80-90` re-reads `usernameChangedAt` and refuses with 429 if within 24 h. **Pass.**

---

## D-09 — `rewriteLeaderboardUsername` is best-effort across two stores

### Severity
**Low**

### Affected files
- `src/lib/rename-leaderboard.ts`
- caller: `src/app/api/profile/settings/route.ts:115-120`

### Description
The username PATCH:
1. Updates `users.username` and `scores.username` in Postgres.
2. Then rewrites Redis sorted-set member snapshots.

If the Postgres update succeeds but the Redis rewrite fails (the wrapping try/catch logs only), the leaderboard temporarily shows the old name. Next time the leaderboard reads, the enrichment step (`/api/leaderboard/route.ts:71-79`) overrides the stale snapshot with the current DB username — so the user-visible result is correct.

### Risk scenario
No correctness issue thanks to enrichment. Stale snapshots accumulate over many renames. If the enrichment step is ever removed, the stale name resurfaces.

### Recommended fix
- Add a "stale member sweeper" cron that walks every leaderboard key and re-stringifies members whose `username` differs from `users.username`.
- Or, store only `userId` in the Redis member (no username), and always join on read. Trade-off: cannot show anonymous players this way.

---

## Backend hardening checklist

- [ ] Reserve usernames on account deletion (D-05 / C-13)
- [ ] Add username `deletedAt` column and soft-delete pattern
- [ ] Schedule a leaderboard trim cron (D-06)
- [ ] Add a stale-snapshot sweeper or move to userId-only members (D-09)
