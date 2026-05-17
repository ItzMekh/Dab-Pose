# Security Hardening — Session 2026-05-16/17

ขอบเขต: API surface ทั้งหมด + Vercel WAF + รองรับ subagent review.
ผู้ทำ: เมฆ + Claude.

---

## สรุปสั้น

| Layer | จำนวน |
|---|---|
| Vercel WAF rules (staged, รอ publish) | 3 |
| Endpoint hardening (Upstash sliding window) | 5 |
| CSRF Origin check | 2 endpoints (3 method handlers) |
| ไฟล์ใหม่ | 3 |
| Playwright e2e tests | 2 |
| Tests passing | 18/18 |

---

## 1. Vercel WAF (staged, ยังไม่ publish)

Hobby plan limit = 3 rules.

```
+ Rate limit /api/score POST    [rate_limit 30/60s/IP, action=log]
+ Block exploit probes          [path inc /wp-admin /.env /.git/config /phpmyadmin /wp-login.php /.aws/credentials /.ssh/id_rsa, action=log]
+ Log signup POSTs              [action=log]
```

ตรวจ: `vercel firewall diff`
Publish: `vercel firewall publish --yes`

ทุก rule action=log ครั้งแรก. ดู `https://vercel.com/<team>/<project>/firewall/traffic?filter=<ruleId>` 24h ก่อนเปลี่ยนเป็น deny.

---

## 2. ไฟล์ใหม่

### `src/lib/ratelimit.ts`
- 4 sliding-window limiters: signup (5/60s), settings (10/60s), passwordChange (3/300s), events (10/60s)
- `clientIp(req)` → string | null (return null ถ้าไม่มี header แทน 'unknown')
- `clientIpOrFail(req)` → throw ถ้าอยู่บน Vercel แต่ IP missing, ไม่งั้นใช้ 'dev-local'

### `src/lib/csrf.ts`
- `isSameOrigin(req)` — ตรวจ Origin/Referer ตรงกับ Host. รับ vercel.app, vercel.dev, localhost:3000, 127.0.0.1:3000. Non-browser (no Origin/Referer) ผ่าน (server-to-server)

### `tests/rate-limit.spec.ts`
- e2e ทดสอบ signup 429 + events 429 + ตรวจ Retry-After header
- `beforeEach` flush keys ผ่าน Upstash direct เพื่อกัน race กับ smoke parallel
- Sliding window math ทำให้ exact boundary ไม่ deterministic → test fire เกิน limit แล้วเช็คว่าอย่างน้อย 1 ตัวเป็น 429

---

## 3. ไฟล์แก้

### `src/app/api/score/route.ts`
- ลบ broken in-memory `Map` rate limiter (ไม่ทำงานบน Fluid Compute)
- เพิ่ม `isSameOrigin(req)` ตรวจ CSRF → 403
- ใส่ comment ว่า WAF handle rate limit

### `src/app/api/auth/signup/route.ts`
- `clientIpOrFail` แทน raw header parsing
- `signupLimiter.limit(ip)` wrap try/catch → **fail closed** (503) ถ้า Redis ล่ม
- Retry-After cap ที่ 3600s

### `src/app/api/profile/settings/route.ts`
- CSRF Origin check บน PATCH + DELETE
- `settingsLimiter` keyed by `session.user.id`, fail-open (anti-spam ไม่ใช่ security)
- `passwordChangeLimiter` แยกต่างหาก, **fail closed** (กัน bcrypt CPU DoS)
- Error message แยก "Too many profile edits" vs "Too many password change attempts"

### `src/app/api/events/route.ts`
- `clientIpOrFail` + `eventsLimiter.limit(ip)` fail-open + log
- `controller.close()` wrap try/catch → กัน `ERR_INVALID_STATE` race ตอน client abort

### `package.json`
- เพิ่ม `@upstash/ratelimit ^2.0.8`
- devDep: `dotenv` (เพื่อ test cleanup)

### `playwright.config.ts`
- ไม่แก้

---

## 4. ปัญหาที่พบและแก้ระหว่างเขียน test

### 4.1 SSE timeout ใน Playwright `request.get`
- อาการ: `request.get('/api/events')` รอ body จบแต่ SSE ไม่จบ → 30s timeout
- แก้: ใช้ native `fetch` + `AbortController` — อ่าน status header แล้ว abort

### 4.2 Sliding window ไม่ได้ตัด exact ที่ N+1
- อาการ: limit=5 แต่ request 6 บางครั้งผ่าน เพราะ window boundary คั่นกลาง → count แยกใน 2 windows, weighted sum < limit
- แก้: test ยิงเกิน limit เยอะๆ (12 หรือ 20) แล้วเช็คว่าอย่างน้อย 1 ตัวเป็น 429

### 4.3 Test pollute Redis ระหว่างรอบ
- อาการ: รัน test ติดกัน → window ยังไม่หมด → request #1 รอบใหม่โดน 429
- แก้: `beforeEach` ใน rate-limit.spec.ts ลบ keys ผ่าน Upstash direct (`redis.keys` + `redis.del`)

### 4.4 Smoke test parallel ใช้ SSE token
- อาการ: smoke โหลด home page → home มี SSE → กิน events token → rate-limit test ล้ม
- แก้: `beforeEach` flush แทน `beforeAll` (re-flush ก่อนทุก test)

### 4.5 Controller already closed
- อาการ: SSE cleanup เรียก `controller.close()` หลัง client abort → throw `ERR_INVALID_STATE`
- แก้: wrap try/catch swallow

---

## 5. Subagent findings ที่ apply แล้ว

### Silent-failure-hunter (5 critical)
- ✓ try/catch รอบ `limiter.limit()` ทุกที่
- ✓ `clientIp` return null + `clientIpOrFail` decide
- ✓ SSE controller close race
- ✓ Retry-After cap 3600s
- ✓ Settings vs password error message แยก (เริ่มแยก แต่ logic ไม่ยังไม่ reorder — password ยัง consume settings token ถ้า edits ก่อน. ดู section 6 — backlog)

### XSS/CSRF/IDOR audit (5 findings)
- ✓ CSRF: Origin check บน `/api/score` POST + `/api/profile/settings` PATCH+DELETE (HIGH)
- ✗ Avatar URL validation (MEDIUM) — ยังไม่ทำ. ดู backlog
- ✗ Profile history per-username rate limit (MEDIUM) — ยังไม่ทำ
- ✗ Auth callback whitelist (LOW) — ปัจจุบัน hardcode `/` ปลอดภัย
- ✓ XSS/SQL/Redis injection — ไม่พบ (regex validation + Drizzle parameterization)

---

## 6. Backlog (ยังไม่ทำในรอบนี้)

1. **Avatar URL whitelist** (`ProfileSidebar.tsx:99`, `UserCell.tsx:16`) — validate `https://` + known image domain
2. **Profile history rate limit** (`/api/profile/[username]/history`) — per-username token
3. **Settings limit reordering** — password change ปัจจุบัน consume `settingsLimiter` token ก่อนเข้า password branch. แก้: check `passwordChangeLimiter` ก่อนถ้า `field === 'password'`, skip settings limit
4. **SSE error event** — เพิ่ม `event: error` ก่อน close ตอน Redis poll fail (ตอนนี้ client คิดว่า stream จบปกติแล้ว reconnect storm)
5. **App-level limiter on `/api/score`** — defense-in-depth ถ้า WAF rule ถูกลบ
6. **`logError` helper** — แทน `console.error` ทั่วไป (ตามมาตรฐานโปรเจกต์)

---

## 7. Performance impact (ตามที่ user ถาม)

### `/api/score` write path
ไม่เปลี่ยน. WAF อยู่ edge (~1-3ms) ก่อน function. Critical path เดิม 45-100ms.

### Endpoints ที่เพิ่ม Upstash ratelimit
+5-15ms ต่อ request (1 Redis call). Legitimate traffic ไม่รู้สึก.

### Attacker path
**เร็วขึ้น** เพราะ WAF drop ที่ edge — ไม่ burn function quota / Redis ops / DB connections.

---

## 8. Test commands

```bash
# รัน test ทั้งหมด
npx playwright test

# เฉพาะ rate-limit
npx playwright test tests/rate-limit.spec.ts

# Cleanup DB หลัง signup test pollute rltest* rows
npx tsx scripts/cleanup-test-pollution.ts
```

---

## 9. ขั้นต่อ

1. `vercel firewall diff` — review staged
2. `vercel firewall publish --yes` — push 3 WAF rules ขึ้น production (log mode, ไม่บล็อค)
3. ปล่อย 24h ดู dashboard → ถ้าไม่มี false positive switch action=deny / rate_limit สำหรับ exploit probes
4. `git add` + commit ทุกการแก้
5. Tackle backlog #1-6 รอบหน้า
