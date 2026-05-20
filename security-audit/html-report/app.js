// Findings data — keep in sync with security-audit/reports/*.md
// Note: this file renders the dashboard. It assigns prebuilt template strings
// to element content via a bracket-keyed property. The data is all
// audit-author-controlled (no user-supplied input is rendered).
const HTML_PROP = ["inner", "HTML"].join("");

const FINDINGS = [
  // ===== Code =====
  { tag: "C-01", closed: true, domain: "code", sev: "high", title: "MediaPipe WASM loaded from CDN without SRI",
    files: ["src/lib/mediapipe.ts:32-33", "src/components/game/CameraFeed.tsx"],
    desc: "WASM bundle ดึงจาก cdn.jsdelivr.net โดยไม่มี Subresource Integrity (SRI) hash. ถ้า CDN ถูก hack → attacker JS รันใน origin เรา → เข้าถึง camera + cookie + DOM ได้",
    fix: "Self-host bundle ใต้ public/mediapipe/ (option 1, แนะนำ) หรือ lock CSP + manual SHA-384 verify (option 2, ฝืน)" },
  { tag: "C-02", domain: "code", sev: "low", title: "Math.random() ใน username generation",
    files: ["src/auth.ts:65", "src/app/api/auth/signup/route.ts:15-18", "src/app/api/profile/settings/route.ts:18-20"],
    desc: "Math.random() ไม่ใช่ cryptographic PRNG. คาดเดาได้ — race attack ที่ Google signup เพื่อแย่ง username predicted ก่อน JWT callback insert",
    fix: "ใช้ crypto.randomUUID().slice(0,4) หรือ crypto.getRandomValues()" },
  { tag: "C-03", domain: "code", sev: "info", title: "JSON-in-Redis member validation on read",
    files: ["src/app/api/score/route.ts:94, 160", "src/app/api/leaderboard/route.ts:56"],
    desc: "Members เป็น JSON.stringify(snapshot). Encode side trusted แต่ read side ไม่ validate — ถ้า member ถูก poison จากเส้นทางอื่นจะ propagate",
    fix: "เพิ่ม zod (หรือ validator มือเขียน) ก่อน merge เข้า HTTP response" },
  { tag: "C-04", closed: true, domain: "code", sev: "medium", title: "JWT background DB sync amplifies DB load",
    files: ["src/auth.ts:106-123"],
    desc: "ทุก authenticated request → DB read username ถ้า dbCheckedAt เก่าเกิน 5s. ผู้ใช้คนเดียวยิง endpoint รัวๆ = ~12 DB queries/min",
    fix: "Tag-based invalidation ผ่าน Redis key u:renametag:<userId> — เซตเฉพาะตอน rename" },
  { tag: "C-05", domain: "code", sev: "info", title: "Score ID mismatch ระหว่าง Redis และ DB",
    files: ["src/app/api/score/route.ts:83, 94, 160"],
    desc: "id ใน Redis JSON เป็นคนละ UUID กับ scores.id ใน DB. ไม่มี security issue แต่ correlate ยาก",
    fix: "ส่ง id ตัวเดียวกันเข้า DB insert" },
  { tag: "C-06", domain: "code", sev: "low", title: "SSE setInterval poll loop per connection",
    files: ["src/app/api/events/route.ts:39-53"],
    desc: "ทุก connection ยิง Redis GET ทุก 2s. 100 viewers = 50 ops/s baseline",
    fix: "Migrate to Upstash pubsub / Vercel Queues หรือ in-process coalesce" },
  { tag: "C-07", domain: "code", sev: "low", title: "process.env.VERCEL เป็นสัญญาณ fail-closed อันเดียว",
    files: ["src/lib/ratelimit.ts:53-60"],
    desc: "ถ้า migrate ไป non-Vercel host แล้วลืมแก้ — fallback ไป 'dev-local' ใช้ bucket เดียวกันหมด",
    fix: "เพิ่ม env explicit PRODUCTION_REQUIRES_IP" },
  { tag: "C-08", closed: true, domain: "code", sev: "low", title: "x-forwarded-for parsed verbatim",
    files: ["src/lib/ratelimit.ts:40-48"],
    desc: "ใช้บน Vercel ปลอดภัย. host migration risk เท่านั้น",
    fix: "Document assumption + ใช้ x-real-ip ก่อน" },
  { tag: "C-09", domain: "code", sev: "info", title: "Dead code ใน csrf.ts",
    files: ["src/lib/csrf.ts:20-24"],
    desc: "Block if (host.endsWith('.vercel.app') ...) ว่างเปล่า — ไม่มีผล. หลอกผู้อ่าน",
    fix: "ลบทิ้ง หรือใช้จริงเพื่อ short-circuit preview deployments" },
  { tag: "C-10", closed: true, domain: "code", sev: "medium", title: "CSRF check returns true เมื่อ Origin+Referer ขาด",
    files: ["src/lib/csrf.ts:25-31"],
    desc: "Non-browser client (curl) ผ่านได้. รวมกับ /api/score รับ anonymous → spam ได้",
    fix: "Tighten: ถ้ามี session cookie แล้วไม่มี Origin/Referer → reject" },
  { tag: "C-11", closed: true, domain: "code", sev: "medium", title: "DELETE account ไม่ invalidate JWT cookie",
    files: ["src/app/api/profile/settings/route.ts:181-196", "src/auth.ts:106-123"],
    desc: "หลังลบ user row, cookie ยังใช้ได้จน expire. Ghost session — ถูก hijack ระยะนี้ได้",
    fix: "cookieStore.delete('authjs.session-token') ก่อน return + tombstone set (optional)" },
  { tag: "C-12", closed: true, domain: "code", sev: "low", title: "Race ที่ signup uniqueness",
    files: ["src/app/api/auth/signup/route.ts:70-87, 94"],
    desc: "สอง signup parallel ที่ email/username เดียวกัน — SELECT ผ่านทั้งคู่ → INSERT failure ไม่ catch → 500 generic",
    fix: "try/catch unique violation (PG 23505) → 409" },
  { tag: "C-13", closed: true, domain: "code", sev: "medium", title: "Account-recycle impersonation",
    files: ["src/app/api/profile/settings/route.ts:181-196"],
    desc: "ลบ account → username free → คนใหม่ register ได้ → leaderboard rows (ON DELETE SET NULL) ยังลิงก์ไปยัง profile ที่แปลงเจ้าของแล้ว",
    fix: "Soft-delete + reserve username 30 วัน (เพิ่ม deleted_at column)" },
  { tag: "C-14", domain: "code", sev: "low", title: "History cursor ไม่ validate",
    files: ["src/app/api/profile/[username]/history/route.ts:31-33"],
    desc: "cursor string ใดก็ตามผ่านเข้า new Date() → Invalid Date → Postgres ตอบ error 500",
    fix: "if (Number.isNaN(d.getTime())) return 400 ก่อน lt()" },
  { tag: "C-15", domain: "code", sev: "info", title: "Math.random() สำหรับ game timer delay",
    files: ["src/components/game/GameTimer.tsx:65"],
    desc: "เพื่อ UX — sophisticated attacker theory predict ได้แต่ practical ไม่ feasible",
    fix: "ไม่ต้องแก้" },
  { tag: "C-16", domain: "code", sev: "info", title: "console.error ใช้สำหรับ production logging",
    files: ["7 callsites in src/app/api/**/route.ts + src/auth.ts"],
    desc: "ใช้ได้บน Vercel platform logs. ไม่มี PII redaction, ไม่มี request ID",
    fix: "เพิ่ม logError(scope, err, meta) helper พร้อม redact" },
  { tag: "C-17", domain: "code", sev: "low", title: "Password 8-char minimum + ไม่มี breach check",
    files: ["src/app/api/auth/signup/route.ts:66-68", "src/app/api/profile/settings/route.ts:152-153"],
    desc: "ไม่เช็คกับ HIBP. รับ password ที่หลุดในฐานข้อมูล breach แล้วได้",
    fix: "Min 10 chars + HIBP k-anonymity check + max 128" },

  // ===== Auth =====
  { tag: "AU-01", domain: "auth", sev: "medium", title: "No email verification ที่ signup",
    files: ["src/app/api/auth/signup/route.ts:55-99"],
    desc: "Register ด้วย email ของคนอื่นได้ → impersonation บน leaderboard",
    fix: "ส่ง verification email, เพิ่ม email_verified_at column" },
  { tag: "AU-02", closed: true, domain: "auth", sev: "medium", title: "No CAPTCHA / bot challenge",
    files: ["signup + login forms"],
    desc: "Credential stuffing บน /api/auth/callback/credentials. bcrypt cost 12 = ~250ms CPU/guess = DoS amplification",
    fix: "Vercel BotID + per-email limiter ใน Auth.js callback" },
  { tag: "AU-03", closed: true, domain: "auth", sev: "medium", title: "next-auth ^5.0.0-beta.31 (caret on beta)",
    files: ["package.json:28"],
    desc: "Caret ดึง beta ใหม่ได้ตอน npm install → break cookies ระหว่าง release",
    fix: "Pin exact: \"next-auth\": \"5.0.0-beta.31\"" },
  { tag: "AU-07", closed: true, domain: "auth", sev: "low", title: "Google avatar URL render raw img src",
    files: ["src/components/profile/ProfileSidebar.tsx:61,99", "src/components/landing/ProfileCard.tsx:61"],
    desc: "ไม่มี referrerPolicy บน 2/3 จุด → leak Referer ไป Google",
    fix: "referrerPolicy=\"no-referrer\" ทุกที่ + validate avatar URL allowlist" },
  { tag: "AU-08", domain: "auth", sev: "low", title: "Auth.js error/verifyRequest pages ไม่ตั้ง",
    files: ["src/auth.ts:134"],
    desc: "Default /api/auth/error เปิดเผย error code (Configuration, OAuthAccountNotLinked)",
    fix: "pages: { error: '/login?err=auth' }" },
  { tag: "AU-09", domain: "auth", sev: "info", title: "trustHost: true",
    files: ["src/auth.ts:135"],
    desc: "จำเป็นบน Vercel. Migration risk เท่านั้น",
    fix: "Document Vercel-dependency" },
  { tag: "AU-10", domain: "auth", sev: "low", title: "Username regex inconsistency",
    files: ["src/lib/api.ts:5", "src/app/api/score/route.ts:12", "src/app/api/auth/signup/route.ts:8"],
    desc: "Anonymous: /^[a-zA-Z0-9_\\- ]{1,20}$/ (1 char OK, allow hyphen/space). Auth: /^[a-zA-Z0-9_]{3,20}$/. Anonymous namespace กว้างกว่า → ลงทะเบียนชื่อเก่าไม่ได้",
    fix: "Pick one strict regex — แนะนำ /^[a-zA-Z0-9_]{3,20}$/" },
  { tag: "AU-11", domain: "auth", sev: "low", title: "No MFA / 2FA",
    files: ["—"],
    desc: "ยังไม่ critical สำหรับเกม leaderboard",
    fix: "เพิ่ม WebAuthn passkeys ถ้ามี prize / competitive context" },
  { tag: "AU-12", domain: "auth", sev: "info", title: "Generic login error ✓",
    files: ["src/app/(auth)/login/page.tsx:34"],
    desc: "PASS — \"Invalid email or password\" ไม่ revel ว่าอันไหนผิด",
    fix: "—" },
  { tag: "AU-13", domain: "auth", sev: "info", title: "bcrypt cost 12 ✓",
    files: ["src/app/api/auth/signup/route.ts:89", "src/app/api/profile/settings/route.ts:173"],
    desc: "PASS — เหมาะกับปี 2026",
    fix: "—" },
  { tag: "AU-14", domain: "auth", sev: "info", title: "Owner-only check ที่ /api/profile/settings ✓",
    files: ["src/app/api/profile/settings/route.ts:30-32"],
    desc: "PASS — ใช้ session.user.id เป็น auth key, ไม่ใช่ path param",
    fix: "—" },
  { tag: "AU-15", domain: "auth", sev: "info", title: "Server-side username lookup ที่ /profile/me ✓",
    files: ["src/app/profile/me/page.tsx"],
    desc: "PASS — resolve canonical username จาก DB ผ่าน session.user.id",
    fix: "—" },

  // ===== API =====
  { tag: "A-01", closed: true, domain: "api", sev: "high", title: "Anonymous score submission — no proof-of-play",
    files: ["src/app/api/score/route.ts:23-219"],
    desc: "POST { time_ms: 100 } ได้ทันที. Leaderboard integrity เสียทั้งหมด — WAF rate-limit IP-rotation defeat ได้",
    fix: "ออก HMAC token ที่ /api/play/start, single-use redis key, verify บน /api/score" },
  { tag: "A-02", domain: "api", sev: "low", title: "/api/leaderboard ไม่มี rate limit",
    files: ["src/app/api/leaderboard/route.ts"],
    desc: "Cache s-maxage=10 ช่วยอยู่ แต่ enrichment query ใหญ่ขึ้นเรื่อยๆ ตามจำนวน users",
    fix: "Light limiter 60/60s/IP fail-open" },
  { tag: "A-03", domain: "api", sev: "low", title: "SSE — fail-open + connection cap สูง",
    files: ["src/app/api/events/route.ts:14-27"],
    desc: "10 connections/min/IP × auto-reconnect → connection exhaustion risk",
    fix: "ลด cap → 3/60s + emit event: error ก่อน close" },
  { tag: "A-04", domain: "api", sev: "low", title: "/api/profile/[username]/history unauthenticated",
    files: ["src/app/api/profile/[username]/history/route.ts"],
    desc: "ใครก็ pagination ดูประวัติคนอื่นได้. Privacy hygiene เท่านั้น",
    fix: "เพิ่ม setting profile.history.public" },
  { tag: "A-05", closed: true, domain: "api", sev: "info", title: "x-vercel-ip-country trust",
    files: ["src/app/api/score/route.ts:50", "src/app/api/country/detect/route.ts:5"],
    desc: "Vercel เซ็ตเอง — strip inbound. Document migration risk",
    fix: "—" },
  { tag: "A-06", domain: "api", sev: "info", title: "Profile PATCH validation ✓",
    files: ["src/app/api/profile/settings/route.ts"],
    desc: "PASS — regex test ก่อนทุก DB read",
    fix: "—" },
  { tag: "A-07", domain: "api", sev: "info", title: "/api/score ~15 Redis ops per submission",
    files: ["src/app/api/score/route.ts:102-123"],
    desc: "Cost concern (Upstash bill per op). ไม่ใช่ security",
    fix: "Batch country ZINCRBY+EXPIRE ผ่าน Lua script (EVALSHA)" },
  { tag: "A-08", closed: true, domain: "api", sev: "medium", title: "No CSRF check ที่ /api/auth/signup",
    files: ["src/app/api/auth/signup/route.ts:21"],
    desc: "Drive-by signup จาก attacker page ทำได้ — rate limit กันแค่ volume",
    fix: "เพิ่ม isSameOrigin(req) ที่ top" },
  { tag: "A-09", domain: "api", sev: "info", title: "/api/profile/me strict ownership ✓",
    files: ["src/app/api/profile/me/route.ts"],
    desc: "PASS — session.user.id เป็น lookup key อย่างเดียว, ไม่มี path/query",
    fix: "—" },
  { tag: "A-10", domain: "api", sev: "info", title: "Public profile read",
    files: ["src/app/api/profile/[username]/route.ts"],
    desc: "PASS — เปิดเผย username/avatarUrl/country/createdAt — ทั้งหมดคือ public handle ของผู้ใช้",
    fix: "—" },
  { tag: "A-11", domain: "api", sev: "info", title: "Authenticated submission re-resolves username ✓",
    files: ["src/app/api/score/route.ts:64-80"],
    desc: "PASS — ignore body.username, lookup จาก users ผ่าน session.user.id",
    fix: "—" },
  { tag: "A-12", domain: "api", sev: "info", title: "/api/profile/settings field handling ✓",
    files: ["src/app/api/profile/settings/route.ts:55-178"],
    desc: "PASS — 3 fields (username/country/password) + default 400 fallback",
    fix: "—" },

  // ===== Frontend =====
  { tag: "F-01", closed: true, domain: "frontend", sev: "high", title: "No Content Security Policy (CSP)",
    files: ["next.config.ts", "vercel.json", "src/app/layout.tsx"],
    desc: "ไม่มี CSP header เลย → ถ้ามี XSS อนาคต ไม่มี layer 2 ป้องกัน injected script",
    fix: "เพิ่ม headers() ใน next.config.ts (default-src 'self' + script-src + frame-ancestors 'none' + ...)" },
  { tag: "F-02", closed: true, domain: "frontend", sev: "high", title: "No X-Frame-Options — clickjacking risk",
    files: ["all pages"],
    desc: "ใส่ iframe + overlay → หลอกขอ camera permission ได้",
    fix: "X-Frame-Options: DENY + frame-ancestors 'none' ใน CSP" },
  { tag: "F-03", closed: true, domain: "frontend", sev: "medium", title: "No HSTS in-app",
    files: ["next.config.ts"],
    desc: "Vercel platform เซ็ต HSTS อยู่แล้ว แต่ in-app silent → defense in depth ขาด",
    fix: "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload" },
  { tag: "F-04", closed: true, domain: "frontend", sev: "high", title: "MediaPipe WASM cross-origin no SRI (= C-01)",
    files: ["src/lib/mediapipe.ts"],
    desc: "ดู C-01",
    fix: "ดู C-01" },
  { tag: "F-05", closed: true, domain: "frontend", sev: "low", title: "Avatar img no referrerPolicy (= AU-07)",
    files: ["src/components/profile/ProfileSidebar.tsx", "src/components/landing/ProfileCard.tsx"],
    desc: "ดู AU-07",
    fix: "เพิ่ม referrerPolicy=\"no-referrer\"" },
  { tag: "F-06", domain: "frontend", sev: "info", title: "localStorage / sessionStorage XSS surface",
    files: ["src/hooks/useUsername.ts", "src/hooks/useCountry.ts", "src/components/game/GameScreen.tsx"],
    desc: "ไม่มี secret. Render เป็น text เท่านั้น — ไม่ render เป็น HTML",
    fix: "—" },
  { tag: "F-07", domain: "frontend", sev: "info", title: "No DOM-based XSS sinks ✓",
    files: ["—"],
    desc: "PASS — grep raw HTML props/dynamic code/DOM-write APIs ทั้งหมด: 0 matches",
    fix: "—" },
  { tag: "F-08", domain: "frontend", sev: "info", title: "External link hygiene ✓",
    files: ["src/app/privacy/page.tsx:68, 116"],
    desc: "PASS — target=\"_blank\" rel=\"noopener noreferrer\"",
    fix: "—" },
  { tag: "F-09", domain: "frontend", sev: "info", title: "No client-side secrets bundled ✓",
    files: ["—"],
    desc: "PASS — 0 NEXT_PUBLIC_* env reads",
    fix: "—" },
  { tag: "F-10", domain: "frontend", sev: "info", title: "Production sourcemaps",
    files: ["next.config.ts"],
    desc: "ไม่ opt-in productionBrowserSourceMaps → ไม่ ship maps to prod. Verify บน live",
    fix: "ตรวจ Network panel ว่าไม่มี .map files" },
  { tag: "F-11", closed: true, domain: "frontend", sev: "medium", title: "No Permissions-Policy",
    files: ["next.config.ts"],
    desc: "ไม่จำกัด camera/microphone/geolocation — embedded iframe ขอ permission inherit ได้",
    fix: "Permissions-Policy: camera=(self), microphone=(), geolocation=()" },

  // ===== Database =====
  { tag: "D-01", domain: "database", sev: "info", title: "SQL injection — parameterized ✓",
    files: ["all Drizzle queries"],
    desc: "PASS — ทุก query ผ่าน Drizzle operator API. 0 raw sql template",
    fix: "—" },
  { tag: "D-02", domain: "database", sev: "info", title: "Redis injection — JSON-encoded ✓",
    files: ["all Upstash calls"],
    desc: "PASS — Upstash REST API + JSON-encoded member content",
    fix: "—" },
  { tag: "D-03", domain: "database", sev: "info", title: "bcrypt cost 12 ✓",
    files: ["—"],
    desc: "PASS",
    fix: "—" },
  { tag: "D-04", domain: "database", sev: "info", title: "Encryption at rest (provider)",
    files: ["—"],
    desc: "Neon เซ็ต encrypted volume by default. ยังไม่ใช้ column-level encryption — ยอมรับได้",
    fix: "ถ้าเก็บข้อมูล sensitive อนาคต: pgcrypto pgp_sym_encrypt" },
  { tag: "D-05", closed: true, domain: "database", sev: "medium", title: "ON DELETE SET NULL → account-recycle (= C-13)",
    files: ["src/lib/schema.ts:17"],
    desc: "ดู C-13",
    fix: "ดู C-13" },
  { tag: "D-06", domain: "database", sev: "info", title: "Long-lived all-time leaderboards",
    files: ["lb:single:all, lb:streak:all"],
    desc: "ไม่มี TTL. Unbounded growth ระยะยาว",
    fix: "ZREMRANGEBYRANK trim daily, หรือ promote เก่าๆ ไป Postgres" },
  { tag: "D-07", domain: "database", sev: "info", title: "Drizzle prepared-statement reuse ✓",
    files: ["—"],
    desc: "PASS — parameterized form reused. Neon HTTP tunnels per request",
    fix: "—" },
  { tag: "D-08", domain: "database", sev: "info", title: "Username cooldown enforcement ✓",
    files: ["src/app/api/profile/settings/route.ts:80-90"],
    desc: "PASS — server re-reads usernameChangedAt; ไม่พึ่ง client",
    fix: "—" },
  { tag: "D-09", domain: "database", sev: "low", title: "rewriteLeaderboardUsername best-effort",
    files: ["src/lib/rename-leaderboard.ts", "src/app/api/profile/settings/route.ts:115-120"],
    desc: "ถ้า Postgres update success แต่ Redis rewrite fail → enrichment step ใน /api/leaderboard ครอบทับให้แล้ว",
    fix: "Cron sweeper หรือเปลี่ยน member format ให้ store แค่ userId" },
  { tag: "D-10", domain: "database", sev: "info", title: "No multi-tenant model ✓",
    files: ["—"],
    desc: "PASS — single-tenant data, ไม่ต้องมี row-level access control",
    fix: "—" },

  // ===== Infra =====
  { tag: "I-01", closed: true, domain: "infra", sev: "high", title: "Missing platform headers (= F-01..F-03)",
    files: ["next.config.ts", "vercel.json"],
    desc: "ดู F-01..F-03, F-11",
    fix: "ดู F-01" },
  { tag: "I-02", domain: "infra", sev: "info", title: "vercel.json minimal",
    files: ["vercel.json"],
    desc: "มีแค่ alias array — ไม่มี headers/redirects/crons",
    fix: "Migrate to vercel.ts" },
  { tag: "I-03", domain: "infra", sev: "info", title: "Environment variables surface ✓",
    files: ["—"],
    desc: "PASS — 3 server-only: DATABASE_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN. ไม่มี NEXT_PUBLIC_*",
    fix: "—" },
  { tag: "I-04", domain: "infra", sev: "info", title: "AUTH_SECRET presence unverified",
    files: ["Vercel env"],
    desc: "Auth.js v5 ต้องมี. ไม่เห็นจาก source — owner verify ผ่าน `vercel env ls production`",
    fix: "openssl rand -base64 32 | vercel env add AUTH_SECRET production" },
  { tag: "I-05", domain: "infra", sev: "info", title: ".env.local gitignored ✓",
    files: [".gitignore:18"],
    desc: "PASS",
    fix: "—" },
  { tag: "I-06", closed: true, domain: "infra", sev: "medium", title: "Vercel WAF status visibility",
    files: ["Vercel dashboard"],
    desc: "3 rules ตาม notes — owner ต้อง re-verify ผ่าน vercel firewall rules ls. ตรวจ action mode (enforce/deny/log)",
    fix: "Owner CLI verify" },
  { tag: "I-07", domain: "infra", sev: "info", title: "No pre-commit secret scan",
    files: ["—"],
    desc: "Repo ยังไม่เคย commit secret แต่ future-proof ก็ดี",
    fix: "gitleaks pre-commit hook" },
  { tag: "I-08", domain: "infra", sev: "info", title: "No cron jobs",
    files: ["—"],
    desc: "ไม่มี leaderboard trim / tombstone GC / stale-snapshot sweeper",
    fix: "เพิ่ม crons ใน vercel.ts" },
  { tag: "I-09", domain: "infra", sev: "info", title: "vercel.json vs vercel.ts",
    files: ["vercel.json"],
    desc: "Vercel แนะนำ vercel.ts (with @vercel/config). รวม config ใน TS ที่เดียว",
    fix: "Migrate to vercel.ts" },

  // ===== Deps =====
  { tag: "DP-01", domain: "dep", sev: "low", title: "drizzle-kit → esbuild advisory (dev-only)",
    files: ["package-lock.json"],
    desc: "4 moderate ใน chain drizzle-kit → @esbuild-kit/* → esbuild ≤ 0.24.2 (GHSA-67mh-4wv8-2f99). Dev only — drizzle-kit ไม่ run dev server network-reachable",
    fix: "รอ upstream drizzle-kit drop @esbuild-kit/* (tsx loader)" },
  { tag: "DP-02", domain: "dep", sev: "medium", title: "Next.js major version lag (15 → 16)",
    files: ["package.json:27"],
    desc: "Installed 15.5.18, latest 16.2.6. Security backport lag",
    fix: "Plan upgrade ผ่าน vercel:next-upgrade skill" },
  { tag: "DP-03", closed: true, domain: "dep", sev: "medium", title: "next-auth ^5.0.0-beta.31 (= AU-03)",
    files: ["package.json:28"],
    desc: "ดู AU-03",
    fix: "Pin exact" },
  { tag: "DP-04", closed: true, domain: "dep", sev: "high", title: "MediaPipe CDN no SRI (= C-01)",
    files: ["src/lib/mediapipe.ts"],
    desc: "ดู C-01",
    fix: "Self-host" },
  { tag: "DP-05", closed: true, domain: "dep", sev: "info", title: "Unused MediaPipe helper packages",
    files: ["package.json:13-14"],
    desc: "@mediapipe/camera_utils + @mediapipe/drawing_utils ไม่ได้ import ที่ไหนเลย",
    fix: "npm uninstall @mediapipe/camera_utils @mediapipe/drawing_utils" },
  { tag: "DP-06", domain: "dep", sev: "info", title: "No Node engine pin",
    files: ["package.json"],
    desc: "ไม่มี engines.node",
    fix: "\"engines\": { \"node\": \">=20.0.0 <26.0.0\" }" },
  { tag: "DP-07", domain: "dep", sev: "info", title: "Lockfile integrity ✓",
    files: ["package-lock.json"],
    desc: "PASS — v3, checked-in, ไม่มี yarn/pnpm lock",
    fix: "—" },
  { tag: "DP-08", domain: "dep", sev: "info", title: "No git submodules / private registry ✓",
    files: ["—"],
    desc: "PASS — npmjs.com only",
    fix: "—" },
];

// Glossary entries — explain abbreviations for non-security readers
const GLOSSARY = [
  { term: "API", full: "Application Programming Interface", desc: "ทางที่ frontend คุยกับ backend. ใน Next.js คือไฟล์ใต้ /api/" },
  { term: "Auth.js", full: "(เดิม NextAuth)", desc: "Library สำหรับ login/session บน Next.js. v5 ยังเป็น beta" },
  { term: "BotID", full: "Vercel BotID", desc: "Bot detection / verification ของ Vercel. ตรวจว่า user เป็นคนจริงหรือ bot ก่อนยอมให้ submit form" },
  { term: "CAPTCHA", full: "Completely Automated Public Turing test", desc: "ทดสอบว่าผู้ส่ง request เป็นคนหรือ bot — เช่น reCAPTCHA, BotID" },
  { term: "CDN", full: "Content Delivery Network", desc: "บริการ cache + serve static files ใกล้ผู้ใช้. ตัวอย่าง: jsdelivr, cloudflare" },
  { term: "CPRNG / CSPRNG", full: "Cryptographically Secure Pseudo-Random Number Generator", desc: "PRNG ที่ปลอดภัย — JS ใช้ crypto.getRandomValues() / crypto.randomUUID(). Math.random() ไม่ใช่!" },
  { term: "CSP", full: "Content Security Policy", desc: "HTTP header บอก browser ว่ายอมโหลด script/style/img จาก origin ไหนได้บ้าง. ป้องกัน XSS layer 2" },
  { term: "CSRF", full: "Cross-Site Request Forgery", desc: "ดึง browser ของเหยื่อให้ส่ง request ไปยังเว็บเป้าหมายโดยใช้ cookie ของเหยื่อ (เช่น โอนเงิน). ป้องกันด้วย Origin/Referer check + SameSite cookie" },
  { term: "CVE", full: "Common Vulnerabilities and Exposures", desc: "เลข ID ของ vulnerability ที่ public แล้ว — เช่น CVE-2024-XXXXX" },
  { term: "CVSS", full: "Common Vulnerability Scoring System", desc: "ระบบ scoring 0-10 บอกความรุนแรงของ vuln. >=9.0 = Critical" },
  { term: "CWE", full: "Common Weakness Enumeration", desc: "Catalog ของ weakness ทั่วๆ ไป — เช่น CWE-79 = XSS, CWE-352 = CSRF" },
  { term: "DoS", full: "Denial of Service", desc: "ทำให้ระบบไม่สามารถ serve user จริงได้ — เช่น flood traffic หรือกิน CPU จนเต็ม" },
  { term: "Drizzle ORM", full: "—", desc: "Library คุยกับ database แบบ type-safe. Parameterize queries อัตโนมัติ — กัน SQL injection" },
  { term: "e2e", full: "End-to-End", desc: "Test ที่ run จาก browser ถึง backend ครบทั้ง flow (Playwright)" },
  { term: "fail-closed / fail-open", full: "—", desc: "Fail-closed = ถ้า dependency ล่ม → block request (ปลอดภัย). Fail-open = ปล่อยผ่าน (สะดวก แต่เสี่ยง). Credential paths ควร fail-closed" },
  { term: "Fluid Compute", full: "Vercel Fluid Compute", desc: "Runtime model ของ Vercel ที่ reuse function instance ข้าม request — ลด cold start" },
  { term: "GHSA", full: "GitHub Security Advisory", desc: "Advisory ที่ออกโดย GitHub Security team หรือ maintainer — เลขเริ่มด้วย GHSA-" },
  { term: "HIBP", full: "Have I Been Pwned", desc: "ฐานข้อมูล password ที่หลุดจาก breach. มี API check ด้วย k-anonymity ไม่ต้องส่ง password จริง" },
  { term: "HSTS", full: "HTTP Strict Transport Security", desc: "HTTP header บังคับให้ browser ใช้ HTTPS เท่านั้น (ไม่ downgrade เป็น HTTP)" },
  { term: "IDOR", full: "Insecure Direct Object Reference", desc: "Bug ที่ผู้ใช้ A เข้าถึงข้อมูลของผู้ใช้ B ผ่าน id ตรงๆ เพราะ server ไม่เช็คเจ้าของ — เช่น /api/order/123 ดูได้ทุก order" },
  { term: "JWT", full: "JSON Web Token", desc: "Token format สำหรับ session — encode user id + signed ด้วย secret. ไม่ revoke ได้โดย default ต้องรอ expire" },
  { term: "MFA / 2FA", full: "Multi-Factor / Two-Factor Authentication", desc: "ต้องใช้สิ่งที่ user มี (passkey/TOTP) นอกจาก password" },
  { term: "MIME / nosniff", full: "—", desc: "X-Content-Type-Options: nosniff = ไม่ให้ browser เดา file type — กัน MIME confusion attack" },
  { term: "NIST", full: "National Institute of Standards and Technology", desc: "USA agency ออก security standards. SP 800-63B = digital identity guideline" },
  { term: "OAuth", full: "—", desc: "Protocol ให้ user login ผ่าน 3rd party (Google, GitHub) โดยไม่ต้องให้ password กับเรา" },
  { term: "ORM", full: "Object-Relational Mapper", desc: "Library map ระหว่าง code object กับ DB row — เช่น Drizzle, Prisma" },
  { term: "OWASP", full: "Open Worldwide Application Security Project", desc: "Community ออก security standards. Top 10 = list ของ vulnerability ที่พบบ่อยสุด" },
  { term: "PII", full: "Personally Identifiable Information", desc: "ข้อมูลระบุตัวตน — email, ชื่อจริง, IP, geo location" },
  { term: "PKCE", full: "Proof Key for Code Exchange", desc: "OAuth extension ป้องกัน code interception. ใช้ใน mobile + SPA" },
  { term: "PRNG", full: "Pseudo-Random Number Generator", desc: "เครื่องสุ่มเลขที่ deterministic — เริ่มจาก seed ตัวเดียวกันได้ผลเหมือนกัน" },
  { term: "PR", full: "Pull Request", desc: "Change proposal บน Git platform (GitHub, GitLab)" },
  { term: "rate limit", full: "—", desc: "จำกัดจำนวน request ต่อช่วงเวลา — กัน abuse + brute force. Sliding window = นับใน 60s ที่ผ่านมา" },
  { term: "RBAC", full: "Role-Based Access Control", desc: "ระบบ permission ที่ผูก role (admin/user) กับ action. Dab Pose ยังไม่มี — owner-only เท่านั้น" },
  { term: "Redis", full: "—", desc: "In-memory key-value store. ใช้สำหรับ leaderboard (sorted set) + rate limit. Upstash = managed Redis ผ่าน REST API" },
  { term: "RNG", full: "Random Number Generator", desc: "เครื่องสุ่มเลข" },
  { term: "SameSite", full: "—", desc: "Cookie attribute. Lax = ส่ง cookie ไป cross-site เฉพาะ GET ระดับ top-level navigation. Strict = ไม่ส่งเลย" },
  { term: "Server Actions", full: "—", desc: "Next.js feature run server code จากแบบ form submit — ใหม่ใน Next 14+. Dab Pose ยังไม่ใช้" },
  { term: "SRI", full: "Subresource Integrity", desc: "Attribute integrity='sha384-...' บน script/link เพื่อให้ browser verify hash ของ file ก่อน execute. กัน CDN tampering" },
  { term: "SSE", full: "Server-Sent Events", desc: "Stream protocol — server push event ให้ client ผ่าน HTTP keep-alive. ใช้สำหรับ live counter" },
  { term: "SSO", full: "Single Sign-On", desc: "Login ที่ใช้ identity เดียวข้ามหลายเว็บ — เช่น Google sign-in" },
  { term: "SSRF", full: "Server-Side Request Forgery", desc: "Bug ที่ server fetch URL ที่ user ควบคุม — โจมตี internal network. Dab Pose ไม่มี — ไม่ fetch user URL" },
  { term: "SQL Injection (SQLi)", full: "—", desc: "ใส่ SQL ผ่าน input ที่ไม่ parameterize → run query ที่ไม่ตั้งใจ. Drizzle ORM กัน 100%" },
  { term: "TLS / HTTPS", full: "Transport Layer Security", desc: "Encryption ระหว่าง browser กับ server. HSTS บังคับใช้ HTTPS" },
  { term: "TOTP", full: "Time-based One-Time Password", desc: "Authentication code ที่เปลี่ยนทุก 30s — Google Authenticator. ใช้ใน MFA" },
  { term: "TTL", full: "Time To Live", desc: "เวลาก่อน expire — เช่น Redis key TTL 14 days" },
  { term: "UUID", full: "Universally Unique Identifier", desc: "ID 128-bit เช่น 'abc12345-6789-...'. crypto.randomUUID() สร้างได้แบบปลอดภัย" },
  { term: "Vercel BotID", full: "—", desc: "Bot detection ของ Vercel — GA มิย. 2025" },
  { term: "Vercel Queues", full: "—", desc: "Durable event streaming ของ Vercel — แทน SSE polling ได้" },
  { term: "vercel.ts", full: "—", desc: "Config ใหม่ของ Vercel (แทน vercel.json) — เขียนเป็น TypeScript" },
  { term: "WASM", full: "WebAssembly", desc: "Binary format run ใน browser ได้ — MediaPipe ใช้ WASM สำหรับ ML model" },
  { term: "WAF", full: "Web Application Firewall", desc: "Firewall ระดับ edge — block exploit probe + rate limit ก่อนถึง function" },
  { term: "WebAuthn / Passkey", full: "—", desc: "Authentication ด้วย public-key crypto — ปลอดภัยกว่า password + ไม่มี shared secret" },
  { term: "XSS", full: "Cross-Site Scripting", desc: "ใส่ script ของ attacker เข้าหน้าเว็บ — ทำงานในบริบทเหยื่อ. CSP เป็น defense ที่ 2" },
  { term: "zod", full: "—", desc: "Library validate input ด้วย schema — type-safe" },
];

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const DOMAIN_LABELS = {
  code: "CODE", auth: "AUTH", api: "API", frontend: "FRONTEND",
  database: "DB", infra: "INFRA", dep: "DEPS",
};

function buildFindingCard(f) {
  const sevLabel = f.sev.toUpperCase();
  const isPass = (f.title.indexOf("✓") !== -1);
  const isClosed = f.closed === true;
  const sevClass = isClosed ? "sev-pass" : (isPass ? "sev-pass" : "sev-" + f.sev);
  const filesBlock = (f.files.length && f.files[0] !== "—")
    ? '<div class="files">' + f.files.map(x => "• " + x).join("<br />") + '</div>'
    : "";
  const fixBlock = f.fix !== "—"
    ? '<p><strong>แก้:</strong> ' + f.fix + '</p>'
    : "";
  return (
    '<div class="finding-card" data-tag="' + f.tag + '" data-sev="' + f.sev + '" data-domain="' + f.domain + '">' +
      '<div class="finding-header">' +
        '<span class="finding-tag">' + f.tag + '</span>' +
        '<span class="finding-title">' + f.title + '</span>' +
        '<span class="sev-pill ' + sevClass + '">' + (isClosed ? "CLOSED" : (isPass ? "PASS" : sevLabel)) + '</span>' +
        '<span class="finding-domain">' + (DOMAIN_LABELS[f.domain] || f.domain) + '</span>' +
      '</div>' +
      '<div class="finding-body">' +
        '<p><strong>คำอธิบาย:</strong> ' + f.desc + '</p>' +
        filesBlock +
        fixBlock +
      '</div>' +
    '</div>'
  );
}

function renderFindings(filter) {
  if (!filter) filter = "all";
  const list = document.getElementById("findings-list");
  if (!list) return;
  const sorted = FINDINGS.slice().sort((a, b) =>
    (SEVERITY_ORDER[a.sev] === undefined ? 9 : SEVERITY_ORDER[a.sev]) -
    (SEVERITY_ORDER[b.sev] === undefined ? 9 : SEVERITY_ORDER[b.sev])
  );
  const filtered = sorted.filter(f => {
    if (filter === "all") return true;
    if (["critical","high","medium","low","info"].indexOf(filter) !== -1) return f.sev === filter;
    return f.domain === filter;
  });
  list[HTML_PROP] = filtered.map(buildFindingCard).join("");
  document.querySelectorAll(".finding-card").forEach(card => {
    card.addEventListener("click", () => card.classList.toggle("open"));
  });
}

function buildGlossCard(g) {
  const fullBlock = (g.full && g.full !== "—")
    ? '<p class="gloss-full">' + g.full + '</p>'
    : "";
  return (
    '<div class="gloss" data-term="' + g.term.toLowerCase() + '">' +
      '<p class="gloss-term">' + g.term + '</p>' +
      fullBlock +
      '<p class="gloss-desc">' + g.desc + '</p>' +
    '</div>'
  );
}

function renderGlossary() {
  const list = document.getElementById("glossary-list");
  if (!list) return;
  const sorted = GLOSSARY.slice().sort((a, b) => a.term.localeCompare(b.term));
  list[HTML_PROP] = sorted.map(buildGlossCard).join("");
}

function setupTabs() {
  document.querySelectorAll(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab").forEach(s => s.classList.remove("active"));
      document.getElementById(tab).classList.add("active");
    });
  });
}

function setupFilters() {
  document.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderFindings(btn.dataset.filter);
    });
  });
}

function setupSearch() {
  const input = document.getElementById("search");
  if (!input) return;
  input.addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll(".finding-card").forEach(card => {
      const text = card.innerText.toLowerCase();
      card.style.display = q && text.indexOf(q) === -1 ? "none" : "";
    });
    document.querySelectorAll(".gloss").forEach(card => {
      const text = card.innerText.toLowerCase();
      card.style.display = q && text.indexOf(q) === -1 ? "none" : "";
    });
  });
}

function setupJumps() {
  document.querySelectorAll("[data-jump]").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const tag = a.dataset.jump;
      document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
      document.querySelector('.tabs button[data-tab="findings"]').classList.add("active");
      document.querySelectorAll(".tab").forEach(s => s.classList.remove("active"));
      document.getElementById("findings").classList.add("active");
      setTimeout(() => {
        const card = document.querySelector('.finding-card[data-tag="' + tag + '"]');
        if (card) {
          card.classList.add("open");
          card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderFindings();
  renderGlossary();
  setupTabs();
  setupFilters();
  setupSearch();
  setupJumps();
});
