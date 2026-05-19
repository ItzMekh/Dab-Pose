# Cloudflare Proxy Migration Runbook — Dab Pose

Status: draft, ready to execute
Target domain: `dabpose.fun` (alias of `dab-pose.vercel.app`)
Stack: Next.js 15 on Vercel Fluid Compute + Upstash Redis + Auth.js v5
Goal: front the production domain with Cloudflare as a reverse proxy to get a real WAF, bot challenges, DDoS protection, edge caching, and proper visitor IP / country headers — without leaving Vercel.

This runbook assumes the application code is already Cloudflare-aware (commits landed):

- `src/lib/client-meta.ts` — `clientCountry(req)` / `clientCountryFromHeaders(h)` prefer `CF-IPCountry`, fall back to `x-vercel-ip-country`. `XX` and `T1` (Tor exit) are normalized to `unknown`.
- `src/lib/ratelimit.ts` — `clientIp(req)` reads `CF-Connecting-IP` first, then `x-forwarded-for`, then `x-real-ip`.
- `src/auth.ts` — `detectCountry()` uses `clientCountryFromHeaders(h)`.
- `src/app/api/score/route.ts`, `src/app/api/country/detect/route.ts` — use `clientCountry(req)`.

Existing protection layers that stay in place:

- Vercel WAF on Hobby (3 rules) — rate-limit on `/api/score` 30/60s/IP, exploit-probe deny, signup logger.
- Upstash @upstash/ratelimit — 5 limiters (signup 5/60s fail-closed, settings 10/60s fail-open, password-change 3/300s fail-closed, events 10/60s fail-open).
- Auth.js v5 with `trustHost: true`.

Other findings touched on (not fully resolved here): no CSP / X-Frame-Options / HSTS in-app, MediaPipe WASM loaded from `cdn.jsdelivr.net` with no SRI. These should be addressed separately; Cloudflare can help with HSTS via a managed transform but the CSP belongs in `next.config.ts` / middleware.

---

## 1. Pre-migration prerequisites

### Required

- A Cloudflare account. **Free plan is enough for everything in this runbook.** No credit card needed.
- Access to the registrar where `dabpose.fun` is registered (to change nameservers).
- Vercel project access to confirm the current alias and to manage the Vercel WAF.
- About 30 minutes of active work and up to 24 h of passive DNS-propagation wait time (in practice usually < 30 min).

### Optional (Pro plan, $20/mo)

The Free plan covers:

- Unlimited DDoS mitigation
- Universal SSL with Full (strict)
- 5 custom WAF rules
- Bot Fight Mode (the basic version)
- Cloudflare Cache Rules (5 rules)
- 3 Page Rules
- Cloudflare Web Analytics
- Cloudflare Turnstile (CAPTCHA replacement — free, unrelated to plan)

Pro adds:

- **Super Bot Fight Mode** (definitive/likely-bot categorization, finer controls)
- WAF Managed Rules (Cloudflare's curated OWASP/Cloudflare ruleset)
- Up to 20 custom WAF rules
- Image optimization (Polish, Mirage)
- Page rule quota raised to 20

For Dab Pose's traffic profile (a small game with periodic spikes) the Free plan is sufficient. Revisit Pro only if Bot Fight Mode's basic categorization starts letting too much credential-stuffing through to `/api/auth/*`.

### Backup / pre-flight

Take a screenshot or export of:

- Current DNS records at the registrar (apex `A`/`ALIAS`, `www` `CNAME`, any `MX`, `TXT`, `_acme-challenge`, etc.).
- Current Vercel domain settings for `dabpose.fun` (Project → Settings → Domains).
- Current Vercel WAF rules (`vercel firewall rules ls --scope <team>`).

You'll thank yourself if anything needs reverting.

---

## 2. DNS migration

### 2.1 Add the site to Cloudflare

1. Log in to https://dash.cloudflare.com.
2. Click **Add a Site** → enter `dabpose.fun` → choose **Free** plan.
3. Cloudflare runs a DNS scan against the current authoritative nameservers and imports records.
4. Review the imported list. Pay attention to:
   - Apex record (`@`) currently pointing to Vercel.
   - `www` `CNAME` (if present).
   - Any `TXT` records used for domain verification (Vercel `_vercel`, email SPF/DMARC, Google, etc.). These must be kept.
   - `MX` records if you ever set up email — these must be kept and stay **DNS-only** (grey cloud). Never proxy MX.

### 2.2 Verify records point at Vercel

Vercel's documented targets:

- Apex (`@`): `ALIAS`/`ANAME` to `cname.vercel-dns.com`, or `A` records to Vercel's anycast IPs if your registrar doesn't support ALIAS at apex.
- `www`: `CNAME` to `cname.vercel-dns.com`.

In Cloudflare's DNS panel, the apex will likely show as `CNAME @ cname.vercel-dns.com` — Cloudflare supports CNAME flattening at apex, which is correct.

Expected end state in Cloudflare DNS:

```
Type   Name   Content                    Proxy
CNAME  @      cname.vercel-dns.com       Proxied  (orange cloud)
CNAME  www    cname.vercel-dns.com       Proxied  (orange cloud)
TXT    _vercel ...verification token...  DNS only (grey cloud)
TXT    @      v=spf1 ...                  DNS only (grey cloud)
... any MX / DKIM / DMARC ...             DNS only (grey cloud)
```

The orange cloud is what activates the proxy — everything else here depends on it.

### 2.3 Switch nameservers at the registrar

Cloudflare assigns two nameservers per zone (e.g. `nina.ns.cloudflare.com`, `paul.ns.cloudflare.com`). The exact names are shown in the Cloudflare onboarding wizard.

At the registrar (Namecheap, Cloudflare Registrar, Porkbun, GoDaddy, etc.):

1. Open the domain's DNS / nameserver settings.
2. Switch from "registrar default" / current nameservers to **custom nameservers**.
3. Paste the two Cloudflare nameservers.
4. Save.

Most registrars apply this in 5–30 minutes. The maximum is 24 h. Cloudflare sends an email once it detects the change.

### 2.4 Verify

While waiting, check propagation:

```bash
dig +short NS dabpose.fun
# expected output once propagated:
# nina.ns.cloudflare.com.
# paul.ns.cloudflare.com.
```

```bash
dig +short dabpose.fun
# expected: a Cloudflare anycast IP (104.x / 172.x / 162.x range), not a Vercel IP
```

```bash
curl -sI https://dabpose.fun/ | grep -i 'server\|cf-ray'
# expected: 'server: cloudflare' and a 'cf-ray: <hex>-<airport>' header
```

If `cf-ray` shows up, the proxy is live.

### 2.5 Confirm Vercel still terminates correctly

`dabpose.fun` must still be listed under the Vercel project's Domains and show "Valid Configuration". Vercel doesn't care that DNS is now at Cloudflare — it cares that the CNAME resolves to it. Cloudflare resolves `cname.vercel-dns.com` server-side when proxying, so this still works.

---

## 3. SSL / TLS settings

Cloudflare → SSL/TLS:

### 3.1 Encryption mode: Full (strict)

Set it to **Full (strict)**. This is non-negotiable.

- **Off** — plain HTTP. Never.
- **Flexible** — HTTPS to browser, HTTP to origin. Cleartext between Cloudflare and Vercel. Insecure and also breaks Vercel's HTTPS redirect logic.
- **Full** — HTTPS to origin but accepts self-signed. Unnecessary because Vercel always serves valid certs.
- **Full (strict)** — HTTPS to origin and validates the cert. Correct choice.

Vercel automatically provisions and renews Let's Encrypt / Google Trust Services certs, so the strict validation always succeeds.

### 3.2 Edge certificates

Cloudflare → SSL/TLS → Edge Certificates:

- **Always Use HTTPS**: On — issues a 308 from `http://` to `https://`.
- **HTTP Strict Transport Security (HSTS)**: Enable with:
  - Max-Age: `15552000` (6 months) to start; raise to `31536000` (1 year) after a week of clean traffic.
  - Include subdomains: only if you have no HTTP-only subdomain. Leave off initially.
  - Preload: leave off until you're certain you'll never serve HTTP again on this apex.
- **Minimum TLS Version**: `TLS 1.2`. TLS 1.0/1.1 are deprecated and there's no reason to support them.
- **TLS 1.3**: On (default).
- **Automatic HTTPS Rewrites**: On — rewrites hardcoded `http://` references in HTML to `https://` where safe.
- **Opportunistic Encryption**: On (default, harmless).

This delivers HSTS at the edge without touching app code — relevant since the app currently has no in-app HSTS header.

### 3.3 Origin certificate (optional, recommended later)

You can issue a long-lived Cloudflare Origin Certificate and upload it to Vercel as a custom cert. Not necessary while Vercel manages the cert automatically and Full (strict) is happy with the Let's Encrypt cert. Skip for now.

---

## 4. Cloudflare WAF + Bot Fight Mode

### 4.1 Bot Fight Mode (Free)

Security → Bots → **Bot Fight Mode**: On.

What it does:

- Challenges requests whose fingerprint matches Cloudflare's "definitely automated" model with a lightweight JS challenge.
- Adds an empty-or-failed challenge response → request is dropped.
- Logs bot scores per request (visible in Security Events).
- Free tier categorizes into "likely automated" only. Super Bot Fight Mode (Pro) splits into "definitely automated" vs "likely automated" with separate actions per category.

This is the actual remediation for finding **AU-02** (no credential-stuffing protection at the edge). Combined with the Upstash signup limiter (5/60s fail-closed) and the upcoming Turnstile widget (see §9), it materially raises the cost of automated abuse against `/api/auth/signup` and `/api/auth/callback/credentials`.

If on Pro: enable **Super Bot Fight Mode**, set "Definitely automated" → Block, "Likely automated" → Managed Challenge. Static resource protection: On.

### 4.2 Custom WAF rules to enable on Free

Security → WAF → **Custom rules** → Create rule. Free plan allows 5 custom rules.

#### Rule 1 — Rate limit `/api/score`

This duplicates the Vercel WAF rule (which we'll disable in §5).

Expression (Cloudflare Rule Builder, "edit expression"):

```
(http.request.uri.path eq "/api/score")
```

Action: **Rate limiting** (separate "Rate limiting rules" tab — does not consume custom rule quota).

Settings:
- Characteristics: IP source address
- Period: 60 seconds
- Requests: 30
- Action: Block
- Duration: 60 seconds

#### Rule 2 — Rate limit `/api/auth/*` (signup, login)

Rate limiting rules → New rule:

```
(starts_with(http.request.uri.path, "/api/auth/"))
```

- Characteristics: IP source address
- Period: 60 seconds
- Requests: 20
- Action: Managed Challenge
- Duration: 60 seconds

Managed Challenge over Block — accidentally-aggressive humans (corporate NAT) still get through.

#### Rule 3 — Block known exploit-probe paths

Custom rule. Expression:

```
(http.request.uri.path contains "/wp-")
or (http.request.uri.path contains "/.env")
or (http.request.uri.path contains "/.git/")
or (http.request.uri.path contains "/phpmyadmin")
or (http.request.uri.path contains "/xmlrpc.php")
or (http.request.uri.path contains "/.aws/")
or (http.request.uri.path contains "/server-status")
or (http.request.uri.path eq "/.well-known/security.txt") and false
```

Action: **Block**.

This mirrors the Vercel WAF exploit-probe rule. Worth keeping on both layers — Cloudflare blocks before traffic reaches Vercel and costs nothing.

#### Rule 4 — Block requests with no User-Agent on `/api/*`

```
(starts_with(http.request.uri.path, "/api/")
 and (http.user_agent eq "" or not exists http.user_agent))
```

Action: **Block**. Legitimate browsers always send a UA. Scrapers and probes often don't.

#### Rule 5 — Challenge non-standard methods to `/api/*`

```
(starts_with(http.request.uri.path, "/api/")
 and not (http.request.method in {"GET" "POST" "OPTIONS" "HEAD"}))
```

Action: **Block**.

### 4.3 Managed rules (Pro only)

If on Pro, also enable:

- WAF → Managed rules → Cloudflare Managed Ruleset → Deploy. Action: Block. Sensitivity: Medium.
- OWASP Core Ruleset → Paranoia level 1 to start. Watch false positives for a week before raising.

### 4.4 Security Level

Security → Settings → **Security Level**: **Medium** is the default and right starting point. Move to **High** only if you see real attack traffic in Security Events.

---

## 5. Vercel WAF deduplication

The Vercel WAF currently has 3 rules on Hobby:

| Rule | Action | Status after Cloudflare |
|---|---|---|
| `/api/score` rate-limit 30/60s/IP | Block | **Disable** — duplicated by Cloudflare Rate Limit rule (§4.2 Rule 1). |
| Exploit-probe paths | Deny | **Keep** — defense in depth. Cloudflare is the front door; Vercel WAF catches anything that bypasses Cloudflare via direct hits to `dab-pose.vercel.app`. |
| Signup logger | Log | **Keep** — observability into requests that reach Vercel. |

Rationale for keeping the exploit-probe rule on both layers: Cloudflare protects `dabpose.fun` only. The Vercel-assigned domain `dab-pose.vercel.app` is publicly resolvable and unproxied. Anyone scanning the IP range can hit Vercel directly. Vercel WAF stays as a second line.

### 5.1 CLI flow

List current rules:

```bash
vercel firewall rules ls
```

Find the `/api/score` rate-limit rule ID and disable it:

```bash
vercel firewall rules edit <RULE_ID>
# in the interactive editor, set "active": false
# or use --json to pipe a patched config
```

If your version of the CLI doesn't support `edit`, the alternative is to remove and recreate:

```bash
vercel firewall rules rm <RULE_ID>
```

Confirm it's gone:

```bash
vercel firewall rules ls
```

After disabling, run a smoke test against `/api/score` from a single IP at 35 req / 60 s — Cloudflare should be the one blocking now. Check Cloudflare → Security → Events for matches against the rate-limit rule.

### 5.2 Block direct Vercel-domain access (optional hardening)

To force all traffic through Cloudflare, add a Vercel WAF rule that denies requests where the `Host` is `dab-pose.vercel.app` for paths other than Vercel's internal `_vercel/insights/*` and `_next/static/*`. This breaks preview deployments, so only do it for production. Better alternative: leave it open and accept that the Vercel-direct domain is a known exposure documented in the threat model.

---

## 6. Header forwarding

After enabling the proxy, the following headers change:

### 6.1 Headers Cloudflare adds (now relied on by app code)

| Header | Meaning | Notes |
|---|---|---|
| `CF-Connecting-IP` | Real client IP. | Used by `clientIp(req)` in `src/lib/ratelimit.ts`. Always present on proxied requests. |
| `CF-IPCountry` | ISO 3166-1 alpha-2 country code from MaxMind GeoIP. | Used by `clientCountry()` in `src/lib/client-meta.ts`. `XX` = unknown, `T1` = Tor exit. Both normalized to `unknown` in our code. |
| `CF-Ray` | Cloudflare request ID. | Useful for support / debugging. |
| `CF-Visitor` | JSON like `{"scheme":"https"}`. | Indicates the scheme the browser used. |
| `True-Client-IP` | Same as `CF-Connecting-IP` but enterprise / Pro+ contract. | **Not used.** Not available on Free. Don't read this header. |

### 6.2 Headers Cloudflare overwrites (don't trust client-supplied values)

When Cloudflare proxies, it rewrites:

- `X-Forwarded-For` — appended-to. The leftmost entry is the original client, the rightmost is Cloudflare's egress to Vercel. Vercel will see Cloudflare's IP as the immediate peer.
- `X-Real-IP` — set by Vercel based on the immediate peer (Cloudflare).
- `X-Vercel-IP-Country` — Vercel's GeoIP. After proxying, this reflects **Cloudflare's egress region**, not the user. Do not rely on it as primary signal.
- `X-Vercel-Forwarded-For` — same chain story.

This is why the app now reads `CF-Connecting-IP` and `CF-IPCountry` first, with the Vercel headers only as fallback (relevant when proxy is disabled — see §11 rollback).

### 6.3 Trust boundary

The fallback path in `clientIp(req)` accepts `x-forwarded-for` from any source. With Cloudflare in front, this is fine because the request *must* arrive via Cloudflare egress to reach Vercel. **However**, if you later block direct Vercel-domain access (§5.2), tighten this further by parsing `x-forwarded-for` only if the immediate peer IP is in Cloudflare's published IP ranges (https://www.cloudflare.com/ips/). Out of scope for this runbook.

---

## 7. Cache rules — what to bypass, what to cache

### 7.1 Bypass cache (dynamic / auth / per-user)

These paths must never be cached by Cloudflare:

- `/api/*` — all API routes. They're either rate-limited, write Redis, or include user-specific data.
- `/login`, `/signup` — Auth.js form pages.
- `/profile/*` — per-user profile pages including `/profile/me` (server-redirect based on session).
- `/api/auth/*` — Auth.js routes (`/api/auth/callback/credentials`, `/api/auth/csrf`, etc.).

### 7.2 Cache aggressively (static)

- `/_next/static/*` — Next.js fingerprinted assets. Immutable. Cache for 1 year.
- `/favicon.ico`, `/og.png`, `/*.svg`, `/*.png` in `/public` — cache for 1 day to 1 week depending on stability.

Vercel already serves `_next/static/*` with `Cache-Control: public, max-age=31536000, immutable`, so Cloudflare will honor the origin cache headers automatically. Adding a Cache Rule is belt-and-braces and lets Cloudflare cache regardless of query string normalization.

### 7.3 Don't proxy `/api/country/detect` heavily

This route returns the visitor's country. Even though caching it at the edge could be tempting, it's already cheap and must vary per-IP. Leave it in the §7.1 bypass list.

---

## 8. Cache Rules (concrete dashboard config)

Cloudflare → Caching → **Cache Rules**. Free plan allows 5 cache rules. Order matters — the first match wins, so put bypass rules above cache rules.

### Rule 1 — Bypass cache on dynamic paths

Name: `Bypass dynamic`

Expression (use the rule builder or paste this into "Edit expression"):

```
(starts_with(http.request.uri.path, "/api/"))
or (http.request.uri.path eq "/login")
or (http.request.uri.path eq "/signup")
or (starts_with(http.request.uri.path, "/profile/"))
```

Then: **Bypass cache**.

### Rule 2 — Long cache for static assets

Name: `Static assets`

Expression:

```
(starts_with(http.request.uri.path, "/_next/static/"))
```

Then: **Eligible for cache**.
Edge TTL: Override origin → `1 year`.
Browser TTL: Respect origin (Next.js sends `max-age=31536000, immutable`).

### Rule 3 — Cache `/public` images

Name: `Public images`

Expression:

```
(http.request.uri.path matches "^/(favicon\\.ico|og\\.png|.*\\.(png|jpg|jpeg|svg|webp|woff2?))$")
```

Then: **Eligible for cache**.
Edge TTL: Override origin → `1 day`.

### Rule 4 (optional) — Cache `/api/leaderboard` for 30 s

The app already sets `Cache-Control: s-maxage=30` on `/api/leaderboard` and `/api/stats`. Cloudflare will normally not cache `/api/*` by default. If you want to opt these specific endpoints into edge caching, add:

```
(http.request.uri.path eq "/api/leaderboard")
or (http.request.uri.path eq "/api/stats")
```

Then: **Eligible for cache**.
Edge TTL: Respect origin (will pick up 30 s from `s-maxage`).

Important: if you add this rule, make sure it comes **after** Rule 1 (bypass) — otherwise Rule 1's broader `/api/*` match will short-circuit. Or remove these two endpoints from Rule 1's expression with an explicit negation.

### Rule 5 (optional) — Disable caching for HTML to be safe

If Cloudflare ever starts edge-caching server-rendered HTML and it bleeds session info, you'd have a bad time. Force-bypass HTML:

```
(http.response.content_type.media_type eq "text/html")
```

Then: **Bypass cache**.

This is paranoid but cheap.

---

## 9. Bot challenge UX + Turnstile

### 9.1 What Bot Fight Mode looks like to users

For 99% of users: invisible. Cloudflare's edge runs a JS challenge in the background — the browser executes a small WASM/JS payload, returns a token, and continues. No CAPTCHA, no interaction.

For users with bad reputation (Tor, known abusive ASNs, residential proxies flagged in Cloudflare's intel) or slow networks where the challenge times out: they see Cloudflare's "Checking your browser" interstitial. If they fail, they get a Managed Challenge (a non-interactive CAPTCHA, then a Turnstile widget if that fails).

Mitigation tips:

- Don't enable Bot Fight Mode on `/api/country/detect` if you ever call it from a service worker or background fetch with no UI to render a challenge. (For Dab Pose it's only called interactively, so this is fine.)
- Don't proxy webhook endpoints if you ever add any — they'll fail the JS challenge.

### 9.2 Turnstile on signup and credentials login

Cloudflare Turnstile is a free, privacy-preserving CAPTCHA alternative. For F-01 (signup abuse) and AU-02 (credential stuffing), add a Turnstile widget to:

- `/signup` form before submit → `/api/auth/signup`.
- `/login` form before submit → `/api/auth/callback/credentials`.

High-level steps (not part of this migration's core scope — see findings `security-audit/F-01.md`, `security-audit/AU-02.md`):

1. Cloudflare dashboard → Turnstile → Add Site → enter `dabpose.fun` and any preview domains you want to test against. Get the site key + secret key.
2. Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` env vars to Vercel (Production + Preview, NOT Development unless you want to test it locally with the test keys `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`).
3. Render `<Turnstile siteKey={...} onSuccess={setToken} />` (use `@marsidev/react-turnstile` or the official `<script>` tag) on `/signup` and `/login`.
4. Send the token as `cf-turnstile-response` in the form body.
5. Server-side: in the route handler, `POST` to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret`, `response`, and `remoteip` (`CF-Connecting-IP`). Reject if `success !== true`.

Keep the Upstash rate limiter as the second gate — Turnstile blocks human-attended stuffing, the limiter catches automation that solves Turnstile via paid services.

---

## 10. Verification checklist

Run these after the proxy is live. Expected results are inline.

### 10.1 DNS

```bash
dig +short NS dabpose.fun
# → *.ns.cloudflare.com (two entries)

dig +short dabpose.fun
# → Cloudflare anycast IP (104.x / 172.x / 162.x)

dig +short www.dabpose.fun
# → Cloudflare anycast IP
```

### 10.2 TLS + proxy

```bash
curl -sI https://dabpose.fun/ | grep -i -E '^(server|cf-ray|strict-transport-security|alt-svc):'
# expected:
#   server: cloudflare
#   cf-ray: <hex>-<airport>
#   strict-transport-security: max-age=15552000
```

```bash
curl -sv https://dabpose.fun/ 2>&1 | grep -E 'subject|issuer|TLSv'
# expected:
#   * TLSv1.3 (or TLSv1.2)
#   * issuer: ... (E5 / E6 / Google Trust Services / Cloudflare Inc ECC CA-3)
#   * subject: CN=dabpose.fun (sni.cloudflaressl.com is also valid for the universal cert)
```

### 10.3 Country detection still works

```bash
curl -s https://dabpose.fun/api/country/detect
# expected (from non-Tor IP):
# {"country":"TH"}   (or whatever your real country is)
```

Repeat from a VPN/different egress and confirm the country changes accordingly.

### 10.4 Rate limit firing

```bash
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://dabpose.fun/api/score \
    -H 'content-type: application/json' \
    -d '{"username":"test","mode":"single","time_ms":999}'
done | sort | uniq -c
# expected: a mix of 4xx (rejected as invalid signed payload), then 429 / 403 once Cloudflare's rate-limit rule trips around request 31-ish
```

The 429s should be Cloudflare-shaped responses (HTML error page with `cf-ray` header), not the JSON 429 our handler emits — that confirms Cloudflare is the blocker, not Vercel.

### 10.5 Static asset caching

```bash
curl -sI https://dabpose.fun/_next/static/<known-hash>/_buildManifest.js | grep -i -E '^(cf-cache-status|age|cache-control):'
# expected on 2nd hit:
#   cf-cache-status: HIT
#   age: <seconds since cached>
```

### 10.6 Auth.js callback unaffected

Open `/login` in a browser, sign in. Confirm:

- The redirect lands on `/profile/me`.
- The session cookie (`__Secure-authjs.session-token` in production) is set.
- `document.cookie` shows the cookie's `Domain` attribute is `dabpose.fun` (or unset, which is fine).

If Auth.js complains about CSRF / host mismatch, see §11 trade-offs.

---

## 11. Rollback plan

If Cloudflare misbehaves (false positives blocking real users, regional issues, ratecard surprise), rollback is one click.

### 11.1 Soft rollback — disable proxy only

Cloudflare → DNS → click the orange cloud next to each proxied record (`@` and `www`) to flip it to **DNS only** (grey cloud).

Effects:

- Cloudflare still serves DNS but does not proxy requests.
- TLS, WAF, Bot Fight Mode, cache rules — all bypassed.
- Traffic goes directly to Vercel.
- `CF-Connecting-IP` and `CF-IPCountry` headers disappear.
- App code falls back to `x-forwarded-for` (set by Vercel) and `x-vercel-ip-country` automatically — no redeploy needed.

This is the recommended rollback. Propagation: under a minute (Cloudflare's own DNS TTL is typically 5 min).

### 11.2 Hard rollback — switch nameservers back

If for some reason Cloudflare DNS itself is broken (rare), at the registrar:

1. Switch nameservers back to the registrar default OR Vercel's nameservers (if you ever used those).
2. Recreate the same DNS records there.
3. Wait for propagation (minutes to 24 h).

Keep the records' content (CNAME to `cname.vercel-dns.com`) identical; only the authority changes.

### 11.3 Verify rollback

```bash
curl -sI https://dabpose.fun/ | grep -i -E '^(server|cf-ray):'
# expected after soft rollback:
#   server: Vercel
# and NO cf-ray header
```

```bash
curl -s https://dabpose.fun/api/country/detect
# expected: still returns a country (now from x-vercel-ip-country)
```

---

## 12. Monitoring

### 12.1 Cloudflare-native

- **Cloudflare Analytics** (Analytics → Traffic): requests, bandwidth, status codes, cached vs uncached. Good for traffic shape.
- **Security Events** (Security → Events): every WAF action, rate-limit hit, bot challenge. Filter by rule ID. Export as CSV. This is where you'll catch false positives.
- **Cloudflare Web Analytics** (Analytics → Web Analytics): privacy-friendly pageview tracker. Doesn't use cookies. Free.
- **Email alerts** (Notifications → Add): set alerts for HTTP DDoS attack, Layer 7 DDoS, origin error rate spike.

### 12.2 Vercel-side caveat

After enabling the proxy:

- **Vercel Analytics** records the visitor's IP / country as Cloudflare's egress (e.g. a Cloudflare PoP in the US for a user in Thailand). Country-level stats become meaningless from Vercel Analytics alone.
- **Vercel Speed Insights** still works (it's client-side performance metrics, not IP-based).
- **Vercel Logs** show Cloudflare's IP as the immediate peer. To recover the real IP in logs, log `request.headers.get('cf-connecting-ip')` explicitly in the API route handlers when needed.

Recommendation: keep Vercel Analytics + Speed Insights for raw performance numbers (Web Vitals, function durations) and use **Cloudflare Web Analytics** as the source of truth for geographic / traffic-shape stats post-migration.

### 12.3 Logpush (Enterprise) / Logflare / S3

Cloudflare → Analytics → Logs → Logpush is Enterprise-only. On Free you have the dashboard and a 24 h event retention. If you need long-term retention, ship your Vercel runtime logs to a log aggregator (Logflare, Axiom, Datadog) and log `cf-connecting-ip` / `cf-ray` from every request.

---

## 13. Cost

| Plan | Price | Relevant features for Dab Pose |
|---|---|---|
| **Free** | $0/mo | Universal SSL, DDoS, 5 custom WAF rules, 5 rate-limit rules, Bot Fight Mode (basic), Cache Rules (5), Cloudflare Web Analytics, Turnstile (separate free product). |
| **Pro** | $20/mo | Super Bot Fight Mode, WAF Managed Rules + OWASP, 20 custom rules, image optimization (Polish, Mirage), 20 page rules. |
| Business | $200/mo | 100% uptime SLA, custom cert upload, prioritized routing. Overkill. |
| Enterprise | Quote | Logpush, advanced bot management, 100 Gbps+ DDoS shielding. |

For Dab Pose's launch profile, **Free is sufficient**. Revisit Pro if you see one of:

- Sustained credential-stuffing on `/api/auth/*` that Bot Fight Mode basic isn't catching.
- Need for >5 custom WAF rules.
- Volumetric attack patterns where you'd want the Managed Ruleset.

---

## 14. Trade-offs and gotchas

### 14.1 Tor exits → `CF-IPCountry: T1`

Cloudflare flags Tor exit nodes with the special country code `T1`. The app's `clientCountry()` normalizes both `XX` and `T1` to `unknown`. Effect: Tor users will appear as `Unknown` on the leaderboard country chip. This is intentional — Tor exits should not be treated as residing in any particular country and we'd rather not record a misleading flag.

If you want to outright block Tor (not recommended — there are legitimate users), add a Cloudflare WAF rule:

```
(ip.geoip.country eq "T1")
```

Action: **Managed Challenge** (or Block, but challenge is friendlier).

### 14.2 Legitimate users on slow networks get challenged

Bot Fight Mode's JS challenge has a network/CPU budget. Old phones on 3G in regions Cloudflare considers risky may see the "Checking your browser" interstitial for 3–5 seconds. There is no way to fully avoid this on Free. Mitigations:

- Use Managed Challenge instead of JS Challenge in custom rules (smarter, less likely to flag legitimate browsers).
- Whitelist specific IPs / ASNs you know are clean (Security → WAF → Tools → IP Access Rules).

### 14.3 Preview deployments are unproxied

`dab-pose.vercel.app` and per-deployment URLs like `dab-pose-git-feature-foo.vercel.app` go directly to Vercel. They have:

- No Cloudflare WAF.
- No `CF-Connecting-IP` / `CF-IPCountry` headers — `clientCountry()` falls back to `x-vercel-ip-country` (which still works correctly here).
- No edge caching from Cloudflare.

If you need a proxied preview, add the preview domain as a CNAME in Cloudflare DNS pointing to `cname.vercel-dns.com`, set proxy On, and configure Vercel to accept it as an alias of the preview branch. Generally not worth the effort.

### 14.4 Vercel `_vercel/insights/*` may be cached unexpectedly

Vercel Analytics POSTs to `/_vercel/insights/event` from the client. These should be POSTs and Cloudflare doesn't cache POST by default, but if you ever see analytics events going missing, add an explicit Cache Rule:

```
(starts_with(http.request.uri.path, "/_vercel/"))
```

Action: **Bypass cache**.

### 14.5 Auth.js cookie domain

Auth.js v5 with `trustHost: true` sets the session cookie for the request's host. Through Cloudflare, the host header is preserved (`Host: dabpose.fun`), so cookies are scoped correctly. **However**, if anyone accesses `dab-pose.vercel.app` directly and signs in there, that session is for a different cookie domain and won't carry over. Document this; consider redirecting `dab-pose.vercel.app` → `dabpose.fun` at the Next.js layer (`headers()` / `redirects()` in `next.config.ts`).

### 14.6 `automaticDeserialization: false` on Redis is unrelated

Just a reminder: nothing in this migration touches Redis. The Upstash client config stays as-is.

### 14.7 MediaPipe WASM from `cdn.jsdelivr.net`

Cloudflare doesn't proxy or cache requests to `cdn.jsdelivr.net` for you — those are loaded directly from the browser to the CDN. This migration does not fix the missing SRI on those `<script>` tags. Track separately and add `integrity="sha384-..."` attributes once you can pin a specific MediaPipe build.

### 14.8 Cloudflare Workers / Cloudflare Pages temptation

You may be tempted to move the whole app to Cloudflare Pages + Workers later. Don't bundle that with this migration. The current goal is just to put a proxy in front of Vercel. Cloudflare-in-front-of-Vercel is a well-trodden pattern and rolls back trivially. Moving the runtime is a separate, much larger project.

### 14.9 Webhook endpoints / server-to-server callers

If you ever add a webhook receiver (Stripe, Discord, etc.), exclude it from Bot Fight Mode and rate limit rules:

- Add a custom WAF rule above the rate-limit rules: `(http.request.uri.path eq "/api/webhooks/stripe") and (ip.src in {<stripe-ip-ranges>})` → Skip (action: Skip all remaining custom rules and managed rules).
- Better: authenticate webhooks via signature verification regardless of source IP, and exempt the path from Bot Fight Mode via the dashboard.

Not applicable today; flag it for future.

---

## Appendix A — Final state summary

After this runbook:

- DNS authoritative at Cloudflare, apex + `www` proxied (orange cloud).
- TLS: Full (strict), Always Use HTTPS, HSTS 6mo, Min TLS 1.2.
- Cloudflare WAF: 5 custom rules, 2 rate-limit rules, Bot Fight Mode on.
- Vercel WAF: exploit-probe deny + signup logger kept, rate-limit disabled.
- Headers: app reads `CF-Connecting-IP` and `CF-IPCountry` primarily; falls back to Vercel headers if proxy disabled.
- Cache: dynamic paths bypassed, `/_next/static/*` cached 1y, public images cached 1d.
- Monitoring: Cloudflare Analytics + Web Analytics + Security Events; Vercel Speed Insights kept; Vercel Analytics country data deprecated.
- Cost: $0/mo.

## Appendix B — Quick command cheatsheet

```bash
# DNS sanity
dig +short NS dabpose.fun
dig +short dabpose.fun
dig +short www.dabpose.fun

# Proxy active?
curl -sI https://dabpose.fun/ | grep -i 'cf-ray\|server'

# Country header reaching app?
curl -s https://dabpose.fun/api/country/detect

# Trigger rate limit (Cloudflare side)
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://dabpose.fun/api/score \
    -H 'content-type: application/json' -d '{}'
done

# Vercel WAF inventory
vercel firewall rules ls

# Disable Vercel /api/score rate-limit rule
vercel firewall rules edit <RULE_ID>   # set active=false
# or
vercel firewall rules rm <RULE_ID>
```

## Appendix C — Related findings

- `security-audit/F-01.md` — signup abuse. Mitigated by Cloudflare rate-limit on `/api/auth/*` + Turnstile (recommended in §9.2).
- `security-audit/AU-02.md` — credential stuffing on `/api/auth/callback/credentials`. Mitigated by Bot Fight Mode + Turnstile.
- `security-audit/fixes/security-fixes.md` — broader fix list; reference for CSP / X-Frame-Options / HSTS gaps not addressed by this runbook.

— End of runbook —
