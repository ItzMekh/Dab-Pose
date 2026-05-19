# Refactor Summary

Architectural changes proposed alongside the security fixes. These are **not strictly security fixes** but reduce future audit burden.

## R-01 — Move all platform headers and rate limits to Routing Middleware

**Status**: proposed

**Motivation**: every API route in this project independently calls `isSameOrigin`, runs a rate-limit check, and re-decides headers. Centralizing into Vercel Routing Middleware:
- One place to enforce CSRF + rate-limit + security headers.
- A future migration to non-Vercel infra has a single rewire point.

**Sketch**:
```ts
// middleware.ts
import { NextResponse } from 'next/server'
import { isSameOrigin } from '@/lib/csrf'

export function middleware(req) {
  // CSRF gate on state-mutating endpoints
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
    if (req.nextUrl.pathname.startsWith('/api/') &&
        !req.nextUrl.pathname.startsWith('/api/auth/[...nextauth]')) {
      if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }
  const res = NextResponse.next()
  // headers can also be set here; per-path overrides via next.config.ts
  return res
}

export const config = { matcher: ['/api/:path*'] }
```

Caveats: Auth.js v5 has its own middleware adapter; integration requires care.

---

## R-02 — Extract a `validateBody<T>(schema)` helper

**Status**: proposed

Currently every API handler builds its own `try { body = await req.json() }` and a series of `typeof x === 'string' && regex.test(x)` checks. A `zod` schema per endpoint shrinks code and unifies error messages.

```ts
// lib/validate.ts
import { z } from 'zod'

export async function validateBody<T>(req: Request, schema: z.ZodSchema<T>): Promise<T | NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  return parsed.data
}
```

Adds one dep (`zod`); replaces 60+ lines of ad-hoc validation across the API.

---

## R-03 — Single `logError(scope, err, meta?)` helper

**Status**: proposed (C-16)

Replaces 7 ad-hoc `console.error` callsites. Mandatory PII redaction and request-ID stamping.

---

## R-04 — Lift Redis snapshot rewriter to a Postgres-source-of-truth model

**Status**: proposed (D-09)

Two paths:
- Store **only** `userId` in the Redis member; join on `users` table on read. Pros: no rewrite-on-rename. Cons: anonymous players (no userId) cannot use this model, so a dual-format member would be required.
- Or, accept the current "snapshot + enrichment on read" model and add a periodic stale-snapshot sweeper cron.

Trade-off documented; no immediate action recommended.

---

## R-05 — Consolidate avatar render into a single `<UserAvatar>` component

**Status**: recommended (F-05 hygiene)

Three sites render avatar `<img>` today. Move into `src/components/ui/UserAvatar.tsx`:

```tsx
interface Props {
  username: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}
export function UserAvatar({ username, avatarUrl, size = 'md' }: Props) {
  // unified sizing, referrerPolicy="no-referrer", fallback letter avatar
}
```

Then `UserCell`, `ProfileSidebar`, `ProfileCard` import the same component. Future avatar-related security hardening (URL allowlist, image optimizer, CSP narrowing) happens in one place.

---

## R-06 — Move the WAF rule list into version control

**Status**: recommended (I-06)

Today the WAF rules live only in Vercel's dashboard. The owner's local notes mirror them but drift over time.

Use the `vercel firewall` CLI to export the rules into `vercel.ts` config (via `routes` / `redirect` / `rewrite` directives where applicable, or via the project's `vercel.ts` `firewall` block when the project moves to Pro plan).

For Hobby plan today, the rules are not config-defined; document them in `CLAUDE.md` so future contributors don't accidentally redo work the WAF already covers.

---

## R-07 — Add a `/health` route for uptime monitoring

**Status**: recommended (operational)

```ts
// src/app/api/health/route.ts
export async function GET() {
  return new Response('ok', { headers: { 'Cache-Control': 'no-store' } })
}
```

Lets Vercel monitoring / external uptime services check the function path. The current site relies on the landing page render.
