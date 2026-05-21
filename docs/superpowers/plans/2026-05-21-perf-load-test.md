# Performance & Load Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 6-layer perf & load test harness that runs against `https://dabpose.fun` (reads) + local prod-build (writes/profile), auto-cleans test data, iterates ≤3 fix rounds, and emits a self-contained HTML before/after report.

**Architecture:** Six independent test layers (k6 smoke/moderate/stress, Lighthouse CI, Playwright E2E, clinic.js) orchestrated by `perf/run_all.sh`. Each layer writes raw JSON to `perf/runs/round-N/<layer>/`. A TypeScript report generator (`perf/report_gen.ts`) reads all round JSONs and produces a fully-static `perf/report/index.html` (no client-side JS — server-rendered tables). WAF bypass is toggled by `perf/waf_bypass.sh` via Cloudflare API and protected by a `trap EXIT`. Test data uses the `loadtest_*` username prefix and is purged by a wrapper around the existing `scripts/cleanup-test-pollution.ts`.

**Tech Stack:** k6 (Homebrew), `@lhci/cli`, `@playwright/test` (already installed), `clinic`, `autocannon`, `tsx`, static HTML.

**Spec:** `docs/superpowers/specs/2026-05-21-perf-load-test-design.md`

---

## File Structure

| Path | Purpose | Committed? |
|---|---|---|
| `perf/run_all.sh` | Orchestrator | yes |
| `perf/waf_bypass.sh` | CF Custom Rule enable/disable | yes |
| `perf/preflight.sh` | Upstash quota guard | yes |
| `perf/cleanup.sh` | Wrapper → purge script + ZCARD delta verify | yes |
| `perf/k6/smoke.js` | Layer 1: 5 VU × 60 s | yes |
| `perf/k6/moderate.js` | Layer 2: ramp 10→50 × 5 m | yes |
| `perf/k6/stress.js` | Layer 3: ramp 50→100 × 10 m (reads only) | yes |
| `perf/k6/_lib.js` | Shared helpers | yes |
| `perf/lhci/lhci.config.js` | Layer 4: Lighthouse CI config | yes |
| `perf/playwright/realistic.spec.ts` | Layer 5: 5 parallel browsers | yes |
| `perf/clinic/run.sh` | Layer 6: local prod-build + autocannon | yes |
| `perf/report_gen.ts` | round-N/*.json → HTML | yes |
| `perf/runs/` | Raw JSON per round | **gitignored via `perf/.gitignore`** |
| `perf/report/` | Generated HTML | **gitignored via `perf/.gitignore`** |
| `scripts/cleanup-perf-pollution.ts` | Cleans username pattern `loadtest_*` | local-only (`/scripts/` gitignored) |

---

### Task 1: Bootstrap perf/ scaffolding + tooling

**Files:**
- Create: `perf/.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Install runtime tools**

```bash
brew install k6
npm i -D @lhci/cli@^0.14.0 clinic@^13.0.0 autocannon@^7.15.0
```

Verify:
```bash
k6 version
npx lhci --version
npx clinic --version
npx autocannon --version
```
Expected: each prints a version (k6 ≥ 0.50, lhci ≥ 0.14, clinic ≥ 13, autocannon ≥ 7).

- [ ] **Step 2: Create perf/ directory tree**

```bash
mkdir -p perf/k6 perf/lhci perf/playwright perf/clinic perf/runs perf/report
```

- [ ] **Step 3: Create `perf/.gitignore`**

```gitignore
runs/
report/
*.log
```

- [ ] **Step 4: Add npm scripts to `package.json`**

Insert under `"scripts"`:
```json
    "perf:smoke": "k6 run --out json=perf/runs/round-0/k6-smoke.json perf/k6/smoke.js",
    "perf:moderate": "k6 run --out json=perf/runs/round-0/k6-moderate.json perf/k6/moderate.js",
    "perf:stress": "k6 run --out json=perf/runs/round-0/k6-stress.json perf/k6/stress.js",
    "perf:lhci": "lhci collect --config=perf/lhci/lhci.config.js",
    "perf:e2e": "playwright test perf/playwright/realistic.spec.ts --reporter=json",
    "perf:clinic": "bash perf/clinic/run.sh",
    "perf:report": "tsx perf/report_gen.ts",
    "perf:all": "bash perf/run_all.sh"
```

- [ ] **Step 5: Verify wiring**

```bash
npm run perf:report 2>&1 | head -3
```
Expected: error mentioning `perf/report_gen.ts` cannot be found (script not yet written — proves npm wiring).

- [ ] **Step 6: Commit**

```bash
git add perf/.gitignore package.json package-lock.json
git commit -m "perf: bootstrap perf/ scaffolding + tooling deps (k6, lhci, clinic, autocannon)"
```

---

### Task 2: WAF bypass + secret token

**Files:**
- Create: `perf/waf_bypass.sh`
- Create: `perf/WAF_SETUP.md`
- Modify: `.env.local`

- [ ] **Step 1: Generate secret token**

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```
Copy the output.

- [ ] **Step 2: Add env entries to `.env.local`**

Append via editor (avoid echoing secrets to shell history):
```
# Perf testing — DO NOT COMMIT
PERF_BYPASS_TOKEN=<paste-token-from-step-1>
CF_API_TOKEN=<get-from-CF-dash-tokens-with-Zone-WAF-edit>
CF_ZONE_ID=<from-CF-dash-overview-right-sidebar>
CF_RULE_ID=
```
Leave `CF_RULE_ID` empty for now — populated after step 4.

- [ ] **Step 3: Write `perf/WAF_SETUP.md`**

```markdown
# WAF Bypass — One-Time Setup

1. CF dashboard → Security → WAF → Custom Rules → Create rule
2. Name: `perf-test-bypass`
3. Expression (edit as expression):
   `(http.request.headers["x-perf-test"][0] eq "<PASTE_PERF_BYPASS_TOKEN>")`
4. Action: **Skip** → check "All custom rules" + "All rate limiting rules"
5. Save as **Paused / Disabled**
6. Copy rule ID from URL (`.../rules/<RULE_ID>`)
7. Paste into `.env.local` as `CF_RULE_ID`
8. Test: `bash perf/waf_bypass.sh enable && bash perf/waf_bypass.sh disable`
```

- [ ] **Step 4: Write `perf/waf_bypass.sh`**

```bash
#!/usr/bin/env bash
# Toggle Cloudflare WAF perf-test-bypass rule.
# Usage: bash perf/waf_bypass.sh enable|disable|status
set -eu
ACTION="${1:-status}"

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

: "${CF_API_TOKEN:?CF_API_TOKEN missing in .env.local}"
: "${CF_ZONE_ID:?CF_ZONE_ID missing in .env.local}"
: "${CF_RULE_ID:?CF_RULE_ID missing in .env.local}"

API="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/firewall/rules/${CF_RULE_ID}"
AUTH="Authorization: Bearer ${CF_API_TOKEN}"

case "$ACTION" in
  enable)
    curl -fsS -X PATCH "$API" -H "$AUTH" -H "Content-Type: application/json" \
      --data '{"paused":false}' | grep -oE '"paused":(true|false)' || true
    echo "[waf] bypass ENABLED"
    ;;
  disable)
    curl -fsS -X PATCH "$API" -H "$AUTH" -H "Content-Type: application/json" \
      --data '{"paused":true}' | grep -oE '"paused":(true|false)' || true
    echo "[waf] bypass DISABLED"
    ;;
  status)
    curl -fsS "$API" -H "$AUTH" | grep -oE '"paused":(true|false)'
    ;;
  *)
    echo "Usage: $0 enable|disable|status" >&2; exit 2;;
esac
```

- [ ] **Step 5: chmod + manual status check**

```bash
chmod +x perf/waf_bypass.sh
bash perf/waf_bypass.sh status
```
Expected: `"paused":true` (rule is paused/disabled).

- [ ] **Step 6: Commit**

```bash
git add perf/waf_bypass.sh perf/WAF_SETUP.md
git commit -m "perf: WAF bypass toggle via CF API + one-time setup doc"
```

---

### Task 3: Upstash preflight quota guard

**Files:**
- Create: `perf/preflight.sh`

- [ ] **Step 1: Write `perf/preflight.sh`**

```bash
#!/usr/bin/env bash
# Abort if Upstash daily command count > 80% of free-tier quota (500k).
set -eu

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

: "${UPSTASH_REDIS_REST_URL:?UPSTASH_REDIS_REST_URL missing}"
: "${UPSTASH_REDIS_REST_TOKEN:?UPSTASH_REDIS_REST_TOKEN missing}"

DAILY_LIMIT=500000
THRESHOLD=$(( DAILY_LIMIT * 80 / 100 ))

RAW=$(curl -fsS "${UPSTASH_REDIS_REST_URL}/info" \
  -H "Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}")

COUNT=$(echo "$RAW" | grep -oE '"total_commands_processed:[0-9]+' | head -1 | grep -oE '[0-9]+$')
COUNT="${COUNT:-0}"

echo "[preflight] Upstash commands today=$COUNT  threshold=$THRESHOLD"

if [ "$COUNT" -gt "$THRESHOLD" ]; then
  echo "[preflight] ABORT — quota usage above 80%"
  exit 1
fi
echo "[preflight] OK"
```

- [ ] **Step 2: chmod + run**

```bash
chmod +x perf/preflight.sh
bash perf/preflight.sh
```
Expected: `[preflight] OK`.

- [ ] **Step 3: Commit**

```bash
git add perf/preflight.sh
git commit -m "perf: Upstash quota preflight guard (abort >80% of free-tier daily limit)"
```

---

### Task 4: k6 shared helpers

**Files:**
- Create: `perf/k6/_lib.js`

- [ ] **Step 1: Write `perf/k6/_lib.js`**

```js
import { Counter, Rate, Trend } from 'k6/metrics'

export const cacheHits = new Counter('cf_cache_hits')
export const cacheMisses = new Counter('cf_cache_misses')
export const cacheHitRatio = new Rate('cf_cache_hit_ratio')
export const wafBlocks = new Counter('waf_blocks_429')
export const apiLatency = new Trend('api_latency_ms', true)

const BASE = __ENV.PERF_BASE || 'https://dabpose.fun'
const TOKEN = __ENV.PERF_BYPASS_TOKEN || ''

export function baseUrl() { return BASE }

export function headers(extra = {}) {
  const h = {
    'User-Agent': 'k6-perf/1.0 (+dabpose-loadtest)',
    'Accept': 'application/json',
  }
  if (TOKEN) h['x-perf-test'] = TOKEN
  return Object.assign(h, extra)
}

export function jsonHeaders(extra = {}) {
  return headers(Object.assign({ 'Content-Type': 'application/json' }, extra))
}

export function trackCache(res) {
  const st = (res.headers['Cf-Cache-Status'] || res.headers['cf-cache-status'] || '').toUpperCase()
  if (st === 'HIT' || st === 'STALE' || st === 'REVALIDATED') {
    cacheHits.add(1)
    cacheHitRatio.add(true)
  } else if (st) {
    cacheMisses.add(1)
    cacheHitRatio.add(false)
  }
  if (res.status === 429) wafBlocks.add(1)
  apiLatency.add(res.timings.duration)
}

export function loadtestName(layer, vu, iter) {
  return `loadtest_${layer}_${vu}_${iter}`.slice(0, 20)
}
```

- [ ] **Step 2: Verify file size**

```bash
wc -c perf/k6/_lib.js
```
Expected: > 1000 bytes.

- [ ] **Step 3: Commit**

```bash
git add perf/k6/_lib.js
git commit -m "perf: k6 shared helpers (cache tracking, bypass headers, loadtest names)"
```

---

### Task 5: k6 SMOKE layer

**Files:**
- Create: `perf/k6/smoke.js`

- [ ] **Step 1: Write `perf/k6/smoke.js`**

```js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { baseUrl, headers, jsonHeaders, trackCache, loadtestName } from './_lib.js'

export const options = {
  vus: 5,
  duration: '60s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:stats}': ['p(95)<150'],
    'http_req_duration{endpoint:lb}': ['p(95)<200'],
    'http_req_duration{endpoint:country}': ['p(95)<120'],
    'http_req_duration{endpoint:play_start}': ['p(95)<250'],
    'http_req_duration{endpoint:score}': ['p(95)<400'],
  },
}

const BASE = baseUrl()

export default function () {
  for (const [path, tag] of [
    ['/api/stats', 'stats'],
    ['/api/leaderboard?mode=single', 'lb'],
    ['/api/leaderboard?mode=country', 'lb'],
    ['/api/country/detect', 'country'],
  ]) {
    const res = http.get(`${BASE}${path}`, { headers: headers(), tags: { endpoint: tag } })
    trackCache(res)
    check(res, { [`${tag} 200`]: r => r.status === 200 })
  }

  const startRes = http.post(`${BASE}/api/play/start`, null, {
    headers: jsonHeaders({ Origin: BASE, Referer: BASE + '/' }),
    tags: { endpoint: 'play_start' },
  })
  trackCache(startRes)
  check(startRes, { 'play/start 200': r => r.status === 200 })
  const token = startRes.json('token')

  sleep(0.5 + Math.random())

  const scorePayload = JSON.stringify({
    token,
    username: loadtestName('smoke', __VU, __ITER),
    time_ms: 250 + Math.floor(Math.random() * 800),
    mode: 'single',
    country: 'XX',
  })
  const scoreRes = http.post(`${BASE}/api/score`, scorePayload, {
    headers: jsonHeaders({ Origin: BASE, Referer: BASE + '/' }),
    tags: { endpoint: 'score' },
  })
  trackCache(scoreRes)
  check(scoreRes, { 'score 201': r => r.status === 201 })

  sleep(1)
}
```

- [ ] **Step 2: Dry-run against localhost**

In another terminal: `npm run dev`. Wait for `Ready in ...`.
```bash
PERF_BASE=http://localhost:3000 k6 run --vus 1 --duration 10s perf/k6/smoke.js
```
Expected: all checks ≥ 99% pass, no threshold violations.

- [ ] **Step 3: Stop the local dev server**

Kill the `npm run dev` process.

- [ ] **Step 4: Commit**

```bash
git add perf/k6/smoke.js
git commit -m "perf: k6 smoke layer (5 VU × 60s, all endpoints, thresholds)"
```

---

### Task 6: k6 MODERATE layer

**Files:**
- Create: `perf/k6/moderate.js`

- [ ] **Step 1: Write `perf/k6/moderate.js`**

```js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { baseUrl, headers, jsonHeaders, trackCache, loadtestName } from './_lib.js'

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    'http_req_duration{endpoint:lb}': ['p(95)<200'],
    'http_req_duration{endpoint:stats}': ['p(95)<150'],
    cf_cache_hit_ratio: ['rate>0.70'],
    waf_blocks_429: ['count<50'],
  },
}

const BASE = baseUrl()

export default function () {
  for (const [path, tag] of [
    ['/api/leaderboard?mode=single&period=all', 'lb'],
    ['/api/leaderboard?mode=single&period=week', 'lb'],
    ['/api/leaderboard?mode=streak&period=today', 'lb'],
    ['/api/leaderboard?mode=country&period=all', 'lb'],
    ['/api/stats', 'stats'],
  ]) {
    const res = http.get(`${BASE}${path}`, { headers: headers(), tags: { endpoint: tag } })
    trackCache(res)
    check(res, { [`${tag} 200`]: r => r.status === 200 })
    sleep(0.2)
  }

  const startRes = http.post(`${BASE}/api/play/start`, null, {
    headers: jsonHeaders({ Origin: BASE, Referer: BASE + '/' }),
    tags: { endpoint: 'play_start' },
  })
  trackCache(startRes)
  if (startRes.status === 200) {
    sleep(0.5)
    const token = startRes.json('token')
    const body = JSON.stringify({
      token,
      username: loadtestName('mod', __VU, __ITER),
      time_ms: 300 + Math.floor(Math.random() * 700),
      mode: 'single',
      country: 'XX',
    })
    const res = http.post(`${BASE}/api/score`, body, {
      headers: jsonHeaders({ Origin: BASE, Referer: BASE + '/' }),
      tags: { endpoint: 'score' },
    })
    trackCache(res)
  }
  sleep(1)
}
```

- [ ] **Step 2: Commit**

```bash
git add perf/k6/moderate.js
git commit -m "perf: k6 moderate layer (ramp 10→50 × 5m, cache ratio + WAF threshold)"
```

---

### Task 7: k6 STRESS layer (reads only)

**Files:**
- Create: `perf/k6/stress.js`

- [ ] **Step 1: Write `perf/k6/stress.js`**

```js
import http from 'k6/http'
import { check } from 'k6'
import { baseUrl, headers, trackCache } from './_lib.js'

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '4m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{endpoint:lb}': ['p(99)<800'],
    cf_cache_hit_ratio: ['rate>0.80'],
  },
}

const BASE = baseUrl()
const PATHS = [
  '/api/leaderboard?mode=single&period=all',
  '/api/leaderboard?mode=streak&period=all',
  '/api/leaderboard?mode=country&period=all',
  '/api/stats',
]

export default function () {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)]
  const res = http.get(`${BASE}${path}`, { headers: headers(), tags: { endpoint: 'lb' } })
  trackCache(res)
  check(res, { '2xx': r => r.status >= 200 && r.status < 300 })
}
```

- [ ] **Step 2: Commit**

```bash
git add perf/k6/stress.js
git commit -m "perf: k6 stress layer (50→100 VU × 10m, reads only, prod-safe)"
```

---

### Task 8: Lighthouse CI config

**Files:**
- Create: `perf/lhci/lhci.config.js`

- [ ] **Step 1: Write `perf/lhci/lhci.config.js`**

```js
module.exports = {
  ci: {
    collect: {
      url: [
        'https://dabpose.fun/',
        'https://dabpose.fun/leaderboard',
        'https://dabpose.fun/signup',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        extraHeaders: process.env.PERF_BYPASS_TOKEN
          ? { 'x-perf-test': process.env.PERF_BYPASS_TOKEN }
          : {},
        skipAudits: ['uses-http2'],
      },
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.90 }],
        'categories:accessibility': ['error', { minScore: 0.90 }],
        'categories:best-practices': ['warn', { minScore: 0.90 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './perf/runs/round-0/lhci' },
  },
}
```

- [ ] **Step 2: Dry-run desktop preset**

```bash
mkdir -p perf/runs/round-0/lhci
npx lhci collect --config=perf/lhci/lhci.config.js
```
Expected: 9 runs (3 URLs × 3 runs), JSON files in `perf/runs/round-0/lhci/`.

- [ ] **Step 3: Commit**

```bash
git add perf/lhci/lhci.config.js
git commit -m "perf: Lighthouse CI config (3 URLs × 3 runs, perf ≥ 0.90 warn)"
```

---

### Task 9: Playwright realistic E2E load

**Files:**
- Create: `perf/playwright/realistic.spec.ts`

- [ ] **Step 1: Write `perf/playwright/realistic.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.PERF_BASE || 'https://dabpose.fun'
const TOKEN = process.env.PERF_BYPASS_TOKEN || ''
const OUT_DIR = resolve(process.cwd(), 'perf/runs/round-0/e2e')
mkdirSync(OUT_DIR, { recursive: true })

type Timing = {
  worker: number
  navStartMs: number
  navEndMs: number
  playStartMs: number
  scoreSubmitMs: number
  total: number
  status: 'ok' | 'failed'
  reason?: string
}

for (let worker = 0; worker < 5; worker++) {
  test(`worker ${worker} realistic flow`, async ({ page, context }) => {
    test.setTimeout(60_000)
    const t: Partial<Timing> = { worker }

    if (TOKEN) {
      await context.setExtraHTTPHeaders({ 'x-perf-test': TOKEN })
    }

    const t0 = performance.now()
    await page.goto(BASE)
    t.navStartMs = performance.now() - t0
    await expect(page.getByText('Reflex Dab')).toBeVisible({ timeout: 10_000 })
    t.navEndMs = performance.now() - t0

    const startRes = await page.request.post(`${BASE}/api/play/start`, {
      headers: TOKEN
        ? { 'x-perf-test': TOKEN, Origin: BASE, Referer: BASE + '/' }
        : { Origin: BASE, Referer: BASE + '/' },
    })
    expect(startRes.ok()).toBeTruthy()
    const { token } = await startRes.json()
    t.playStartMs = performance.now() - t0

    await page.waitForTimeout(500 + Math.floor(Math.random() * 1500))

    const submitRes = await page.request.post(`${BASE}/api/score`, {
      headers: TOKEN
        ? { 'x-perf-test': TOKEN, Origin: BASE, Referer: BASE + '/', 'Content-Type': 'application/json' }
        : { Origin: BASE, Referer: BASE + '/', 'Content-Type': 'application/json' },
      data: {
        token,
        username: `loadtest_e2e_${worker}`,
        time_ms: 300 + Math.floor(Math.random() * 700),
        mode: 'single',
        country: 'XX',
      },
    })
    t.scoreSubmitMs = performance.now() - t0
    t.total = t.scoreSubmitMs
    t.status = submitRes.ok() ? 'ok' : 'failed'
    if (!submitRes.ok()) t.reason = `submit status ${submitRes.status()}`

    writeFileSync(
      resolve(OUT_DIR, `worker-${worker}.json`),
      JSON.stringify(t, null, 2)
    )
    expect(t.status).toBe('ok')
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add perf/playwright/realistic.spec.ts
git commit -m "perf: Playwright realistic E2E (5 parallel workers, full flow timing JSON)"
```

---

### Task 10: clinic.js local profiling

**Files:**
- Create: `perf/clinic/run.sh`

- [ ] **Step 1: Write `perf/clinic/run.sh`**

```bash
#!/usr/bin/env bash
# Profile local prod-build with clinic doctor + flame.
# Runs against http://localhost:3000 — never prod.
set -eu

OUT="perf/runs/round-0/clinic"
mkdir -p "$OUT"

echo "[clinic] building prod bundle"
npm run build

echo "[clinic] running clinic doctor"
npx clinic doctor --on-port "npx autocannon -c 50 -d 30 http://localhost:\$PORT/api/leaderboard" \
  --dest "$OUT" \
  -- node node_modules/.bin/next start

echo "[clinic] running clinic flame"
npx clinic flame --on-port "npx autocannon -c 50 -d 30 http://localhost:\$PORT/api/leaderboard" \
  --dest "$OUT" \
  -- node node_modules/.bin/next start

echo "[clinic] HTML reports in $OUT/"
ls "$OUT"/*.html 2>/dev/null || echo "[clinic] no HTML produced — check stderr"
```

- [ ] **Step 2: chmod**

```bash
chmod +x perf/clinic/run.sh
```

- [ ] **Step 3: Commit**

```bash
git add perf/clinic/run.sh
git commit -m "perf: clinic.js doctor + flame profiling against local prod-build"
```

---

### Task 11: Cleanup wrapper + perf-aware purge script

**Files:**
- Create: `scripts/cleanup-perf-pollution.ts` (local-only — `/scripts/` gitignored)
- Create: `perf/cleanup.sh`

- [ ] **Step 1: Write `scripts/cleanup-perf-pollution.ts`**

```ts
/**
 * Purge all leaderboard + DB rows where username starts with 'loadtest_'.
 * Run from project root:
 *   npx tsx scripts/cleanup-perf-pollution.ts
 * Env DRY_RUN=1 to preview without writing.
 */
import { like, and, isNotNull } from 'drizzle-orm'
import {
  redis,
  weekKey,
  todayKey,
  countryAllKey,
  countryWeekKey,
  countryTodayKey,
} from '../src/lib/redis'
import { db } from '../src/lib/db'
import { scores } from '../src/lib/schema'

const PREFIX = 'loadtest_'
const DRY = process.env.DRY_RUN === '1'

async function purgeKey(key: string, isStreak: boolean) {
  const all = (await redis.zrange(key, 0, -1, isStreak ? { rev: true } : {})) as string[]
  let removed = 0
  const countryDelta: Record<string, number> = {}
  for (const m of all) {
    if (typeof m !== 'string') continue
    let parsed: { username?: string; country?: string } | null = null
    try { parsed = JSON.parse(m) } catch { continue }
    if (!parsed?.username || !parsed.username.startsWith(PREFIX)) continue
    if (!DRY) await redis.zrem(key, m)
    removed++
    const c = (parsed.country ?? 'XX').toUpperCase()
    countryDelta[c] = (countryDelta[c] ?? 0) + 1
  }
  return { removed, countryDelta }
}

async function main() {
  console.log(`[perf-cleanup] prefix=${PREFIX} dry=${DRY}`)
  const keys = [
    ['lb:single:all', false],
    [`lb:single:week:${weekKey()}`, false],
    [`lb:single:today:${todayKey()}`, false],
    ['lb:streak:all', true],
    [`lb:streak:week:${weekKey()}`, true],
    [`lb:streak:today:${todayKey()}`, true],
  ] as const

  const totals: Record<string, number> = {}
  const totalCountry: Record<string, number> = {}

  for (const [k, isStreak] of keys) {
    const { removed, countryDelta } = await purgeKey(k, isStreak)
    totals[k] = removed
    for (const [c, n] of Object.entries(countryDelta)) {
      totalCountry[c] = (totalCountry[c] ?? 0) + n
    }
    console.log(`[redis] ${k} → removed ${removed}`)
  }

  if (!DRY) {
    for (const [c, n] of Object.entries(totalCountry)) {
      await redis.zincrby(countryAllKey(), -n, c)
      await redis.zincrby(countryWeekKey(), -n, c)
      await redis.zincrby(countryTodayKey(), -n, c)
    }
    const removedFromAll = totals['lb:single:all'] + totals['lb:streak:all']
    if (removedFromAll > 0) {
      await redis.decrby('lb:stats:plays', removedFromAll)
    }
  }

  const dbRes = DRY
    ? { rowCount: -1 }
    : await db.delete(scores).where(and(like(scores.username, `${PREFIX}%`), isNotNull(scores.id)))
  console.log(`[db] scores rows deleted=${(dbRes as { rowCount: number }).rowCount}`)
  console.log('[perf-cleanup] done')
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Write `perf/cleanup.sh`**

```bash
#!/usr/bin/env bash
# Purge loadtest_* test data + verify ZCARD delta vs snapshot.
set -eu

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

: "${UPSTASH_REDIS_REST_URL:?}"
: "${UPSTASH_REDIS_REST_TOKEN:?}"

snap() {
  curl -fsS "${UPSTASH_REDIS_REST_URL}/zcard/lb:single:all" \
    -H "Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}" \
    | grep -oE '[0-9]+'
}

BEFORE=$(snap)
echo "[cleanup] ZCARD lb:single:all before=$BEFORE"

npx tsx scripts/cleanup-perf-pollution.ts

AFTER=$(snap)
echo "[cleanup] ZCARD lb:single:all after=$AFTER"
echo "[cleanup] delta=$((BEFORE - AFTER))"
```

- [ ] **Step 3: chmod**

```bash
chmod +x perf/cleanup.sh
```

- [ ] **Step 4: Dry-run**

```bash
DRY_RUN=1 npx tsx scripts/cleanup-perf-pollution.ts
```
Expected: `removed 0` for each key, then `done`.

- [ ] **Step 5: Commit (only `perf/cleanup.sh` — scripts/ is gitignored)**

```bash
git add perf/cleanup.sh
git commit -m "perf: cleanup wrapper + ZCARD delta verify"
```

---

### Task 12: Orchestrator `run_all.sh`

**Files:**
- Create: `perf/run_all.sh`

- [ ] **Step 1: Write `perf/run_all.sh`**

```bash
#!/usr/bin/env bash
# Orchestrate all 6 layers for one round.
# Usage: bash perf/run_all.sh <round-num>
set -eu

ROUND="${1:-0}"
RUN_DIR="perf/runs/round-${ROUND}"
mkdir -p "$RUN_DIR"
LOG="$RUN_DIR/run.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== Perf round ${ROUND} starting $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

cleanup_exit() {
  echo "[exit] disabling WAF bypass"
  bash perf/waf_bypass.sh disable || echo "[exit] WAF disable failed — check manually!"
}
trap cleanup_exit EXIT

bash perf/preflight.sh

bash perf/waf_bypass.sh enable
echo "[orch] waiting 5s for CF propagation"
sleep 5

echo "[orch] Layer 1: k6 SMOKE"
k6 run --out json="$RUN_DIR/k6-smoke.json" perf/k6/smoke.js \
  --summary-export "$RUN_DIR/k6-smoke-summary.json" \
  || echo "[orch] smoke thresholds violated — continuing"

echo "[orch] Layer 2: k6 MODERATE"
k6 run --out json="$RUN_DIR/k6-moderate.json" perf/k6/moderate.js \
  --summary-export "$RUN_DIR/k6-moderate-summary.json" \
  || echo "[orch] moderate thresholds violated — continuing"

echo "[orch] Layer 3: k6 STRESS"
k6 run --out json="$RUN_DIR/k6-stress.json" perf/k6/stress.js \
  --summary-export "$RUN_DIR/k6-stress-summary.json" \
  || echo "[orch] stress thresholds violated — continuing"

echo "[orch] Layer 4: Lighthouse desktop"
mkdir -p "$RUN_DIR/lhci"
npx lhci collect --config=perf/lhci/lhci.config.js \
  || echo "[orch] LHCI desktop failed — continuing"

echo "[orch] Layer 4: Lighthouse mobile (extra preset)"
mkdir -p "$RUN_DIR/lhci-mobile"
npx lhci collect --config=perf/lhci/lhci.config.js --settings.preset=mobile \
  || echo "[orch] LHCI mobile failed — continuing"

echo "[orch] Layer 5: Playwright E2E load"
PERF_BASE="${PERF_BASE:-https://dabpose.fun}" \
  npx playwright test perf/playwright/realistic.spec.ts \
  --reporter=json \
  > "$RUN_DIR/playwright.json" \
  || echo "[orch] Playwright failed — continuing"

if [ "${SKIP_CLINIC:-0}" != "1" ]; then
  echo "[orch] Layer 6: clinic (local prod-build)"
  bash perf/clinic/run.sh || echo "[orch] clinic failed — continuing"
fi

echo "[orch] cleanup"
bash perf/cleanup.sh || echo "[orch] cleanup failed — manual purge needed!"

echo "=== Round ${ROUND} complete $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "[orch] artifacts in $RUN_DIR/"
```

- [ ] **Step 2: chmod**

```bash
chmod +x perf/run_all.sh
```

- [ ] **Step 3: Commit**

```bash
git add perf/run_all.sh
git commit -m "perf: orchestrator — runs 6 layers, WAF bypass with trap-exit safety"
```

---

### Task 13: HTML report generator (server-rendered, no client JS)

**Files:**
- Create: `perf/report_gen.ts`

- [ ] **Step 1: Write `perf/report_gen.ts`**

```ts
/**
 * Reads perf/runs/round-*/* JSON output and writes perf/report/index.html.
 * Fully static HTML — all data rendered server-side; no client-side script.
 *
 * Usage: npx tsx perf/report_gen.ts
 * Manually open the report with:  open perf/report/index.html
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

type EndpointSummary = { name: string; p50: number; p95: number; p99: number; errorRate: number }
type LayerData = { endpoints: EndpointSummary[]; cacheHitRatio?: number; wafBlocks?: number }
type LhRow = { url: string; formFactor: string; perf: number; lcp: number; cls: number; tbt: number }
type E2eRow = { worker: number; total: number; status: string }
type RoundData = {
  round: number
  smoke?: LayerData
  moderate?: LayerData
  stress?: LayerData
  lighthouse?: LhRow[]
  e2e?: E2eRow[]
}

const RUNS_DIR = resolve(process.cwd(), 'perf/runs')
const OUT_DIR = resolve(process.cwd(), 'perf/report')

const ENDPOINT_LIMITS: Record<string, number> = {
  stats: 150, lb: 200, country: 120, play_start: 250, score: 400,
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function loadK6Summary(path: string): LayerData | undefined {
  if (!existsSync(path)) return undefined
  const j = JSON.parse(readFileSync(path, 'utf8')) as {
    metrics: Record<string, { values?: Record<string, number> }>
  }
  const m = j.metrics
  const endpoints: EndpointSummary[] = []
  for (const tag of ['stats', 'lb', 'country', 'play_start', 'score']) {
    const e = m[`http_req_duration{endpoint:${tag}}`]
    if (!e?.values) continue
    endpoints.push({
      name: tag,
      p50: e.values['p(50)'] ?? e.values['med'] ?? 0,
      p95: e.values['p(95)'] ?? 0,
      p99: e.values['p(99)'] ?? 0,
      errorRate: m['http_req_failed']?.values?.['rate'] ?? 0,
    })
  }
  return {
    endpoints,
    cacheHitRatio: m['cf_cache_hit_ratio']?.values?.['rate'] ?? 0,
    wafBlocks: m['waf_blocks_429']?.values?.['count'] ?? 0,
  }
}

function loadLighthouse(dir: string): LhRow[] | undefined {
  if (!existsSync(dir)) return undefined
  const out: LhRow[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    type Lh = {
      finalUrl?: string
      configSettings?: { formFactor?: string }
      categories?: { performance?: { score?: number } }
      audits?: Record<string, { numericValue?: number }>
    }
    let j: Lh
    try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')) } catch { continue }
    if (!j.categories?.performance) continue
    out.push({
      url: j.finalUrl ?? f,
      formFactor: j.configSettings?.formFactor ?? 'desktop',
      perf: (j.categories.performance.score ?? 0) * 100,
      lcp: j.audits?.['largest-contentful-paint']?.numericValue ?? 0,
      cls: j.audits?.['cumulative-layout-shift']?.numericValue ?? 0,
      tbt: j.audits?.['total-blocking-time']?.numericValue ?? 0,
    })
  }
  return out
}

function loadE2e(dir: string): E2eRow[] | undefined {
  if (!existsSync(dir)) return undefined
  const out: E2eRow[] = []
  for (const f of readdirSync(dir)) {
    if (!f.startsWith('worker-')) continue
    try {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8')) as E2eRow
      out.push({ worker: j.worker, total: j.total, status: j.status })
    } catch {}
  }
  return out
}

function loadRound(roundDir: string, n: number): RoundData {
  return {
    round: n,
    smoke: loadK6Summary(join(roundDir, 'k6-smoke-summary.json')),
    moderate: loadK6Summary(join(roundDir, 'k6-moderate-summary.json')),
    stress: loadK6Summary(join(roundDir, 'k6-stress-summary.json')),
    lighthouse: loadLighthouse(join(roundDir, 'lhci')),
    e2e: loadE2e(join(roundDir, 'e2e')),
  }
}

function renderExecSummary(baseline: RoundData, final: RoundData): string {
  const eps = baseline.smoke?.endpoints ?? []
  if (!eps.length) return '<p>No smoke data.</p>'
  const rows = eps.map(e => {
    const f = final.smoke?.endpoints.find(x => x.name === e.name) ?? e
    const delta = ((f.p95 - e.p95) / Math.max(1, e.p95)) * 100
    const cls = delta < 0 ? 'delta-good' : delta > 5 ? 'delta-bad' : ''
    const limit = ENDPOINT_LIMITS[e.name] ?? 1000
    const pass = f.p95 <= limit
    return `<tr><td>${esc(e.name)}</td><td>${e.p95.toFixed(0)} ms</td><td>${f.p95.toFixed(0)} ms</td><td class="${cls}">${delta.toFixed(1)}%</td><td>${limit} ms</td><td>${pass ? 'PASS' : 'FAIL'}</td></tr>`
  }).join('')
  return `<table><tr><th>Endpoint</th><th>Baseline p95</th><th>Final p95</th><th>&Delta;%</th><th>Target</th><th>Pass</th></tr>${rows}</table>`
}

function renderLayer(name: string, d?: LayerData): string {
  if (!d?.endpoints?.length) return ''
  const rows = d.endpoints.map(e =>
    `<tr><td>${esc(e.name)}</td><td>${e.p50.toFixed(0)}</td><td>${e.p95.toFixed(0)}</td><td>${e.p99.toFixed(0)}</td></tr>`
  ).join('')
  const cacheLine = d.cacheHitRatio !== undefined
    ? `<p>CF cache hit ratio: ${(d.cacheHitRatio * 100).toFixed(1)}% &middot; WAF 429s: ${d.wafBlocks ?? 0}</p>`
    : ''
  return `<h3>k6 ${esc(name)}</h3><table><tr><th>Endpoint</th><th>p50</th><th>p95</th><th>p99</th></tr>${rows}</table>${cacheLine}`
}

function renderLighthouse(rows?: LhRow[]): string {
  if (!rows?.length) return ''
  const trs = rows.map(l =>
    `<tr><td>${esc(l.url)}</td><td>${esc(l.formFactor)}</td><td>${l.perf.toFixed(0)}</td><td>${l.lcp.toFixed(0)}</td><td>${l.cls.toFixed(2)}</td><td>${l.tbt.toFixed(0)}</td></tr>`
  ).join('')
  return `<h3>Lighthouse</h3><table><tr><th>URL</th><th>Form</th><th>Perf</th><th>LCP</th><th>CLS</th><th>TBT</th></tr>${trs}</table>`
}

function renderE2e(rows?: E2eRow[]): string {
  if (!rows?.length) return ''
  const trs = rows.map(e =>
    `<tr><td>${e.worker}</td><td>${e.total.toFixed(0)}</td><td>${esc(e.status)}</td></tr>`
  ).join('')
  return `<h3>Playwright E2E</h3><table><tr><th>Worker</th><th>Total ms</th><th>Status</th></tr>${trs}</table>`
}

function renderRound(r: RoundData, isFinal: boolean): string {
  return `<details${isFinal ? ' open' : ''}>
<summary>Round ${r.round}</summary>
${renderLayer('smoke', r.smoke)}
${renderLayer('moderate', r.moderate)}
${renderLayer('stress', r.stress)}
${renderLighthouse(r.lighthouse)}
${renderE2e(r.e2e)}
</details>`
}

function render(rounds: RoundData[]): string {
  const baseline = rounds[0]
  const final = rounds[rounds.length - 1]
  const verdict = (() => {
    if (!final?.smoke?.endpoints?.length) return { color: '#888', text: 'INCOMPLETE — no smoke data' }
    const allPass = final.smoke.endpoints.every(e => e.p95 <= (ENDPOINT_LIMITS[e.name] ?? 1000))
    return allPass
      ? { color: '#2dd4bf', text: 'GREEN — all p95 targets met' }
      : { color: '#f59e0b', text: 'YELLOW — some p95 thresholds exceeded' }
  })()

  const roundHtml = rounds.map(r => renderRound(r, r.round === final.round)).join('\n')

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Dab Pose &mdash; Perf Report</title>
<style>
  body{font:14px/1.5 system-ui;margin:0;padding:24px;background:#0a0a0a;color:#eaeaea}
  h1,h2,h3{margin:.5em 0}
  .verdict{padding:16px;border-radius:8px;background:${verdict.color};color:#000;font-weight:700;margin-bottom:24px}
  table{border-collapse:collapse;width:100%;margin:12px 0}
  th,td{padding:6px 10px;border-bottom:1px solid #333;text-align:left}
  th{background:#1a1a1a}
  .delta-good{color:#34d399}
  .delta-bad{color:#f87171}
  details{margin:12px 0;padding:8px;background:#111;border-radius:6px}
  summary{cursor:pointer;font-weight:600}
</style></head><body>

<h1>Dab Pose &mdash; Perf &amp; Load Report</h1>
<p>Generated ${esc(new Date().toISOString())} &middot; Rounds: ${rounds.length}</p>

<div class="verdict">${esc(verdict.text)}</div>

<h2>Executive Summary</h2>
${renderExecSummary(baseline, final)}

<h2>Per-Round Detail</h2>
${roundHtml}

</body></html>`
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  const rounds: RoundData[] = []
  if (existsSync(RUNS_DIR)) {
    const dirs = readdirSync(RUNS_DIR).filter(d => d.startsWith('round-')).sort()
    for (const d of dirs) {
      const n = Number(d.replace('round-', ''))
      if (Number.isNaN(n)) continue
      rounds.push(loadRound(join(RUNS_DIR, d), n))
    }
  }
  if (rounds.length === 0) {
    console.error('No round-* directories found in perf/runs/.')
    process.exit(1)
  }
  const html = render(rounds)
  const outPath = join(OUT_DIR, 'index.html')
  writeFileSync(outPath, html)
  console.log(`[report] wrote ${outPath} (${rounds.length} round(s))`)
  console.log(`[report] open with:  open ${outPath}`)
}

main()
```

- [ ] **Step 2: Smoke-test with synthetic data**

```bash
mkdir -p perf/runs/round-0
cat > perf/runs/round-0/k6-smoke-summary.json <<'JSON'
{"metrics":{"http_req_duration{endpoint:lb}":{"values":{"p(95)":180,"p(50)":80,"p(99)":350}}}}
JSON
npx tsx perf/report_gen.ts
```
Expected: `[report] wrote .../perf/report/index.html (1 round(s))`.

- [ ] **Step 3: Open + visually verify**

```bash
open perf/report/index.html
```
Expected: HTML loads with GREEN verdict, exec summary table with one row.

- [ ] **Step 4: Cleanup smoke artifact**

```bash
rm -rf perf/runs/round-0
```

- [ ] **Step 5: Commit**

```bash
git add perf/report_gen.ts
git commit -m "perf: HTML report generator (server-rendered, no client-side script)"
```

---

### Task 14: Round 0 baseline run + analysis

**Files:** (read-only this task)

- [ ] **Step 1: Confirm `.env.local` has all 4 perf vars**

```bash
grep -E "PERF_BYPASS_TOKEN|CF_API_TOKEN|CF_ZONE_ID|CF_RULE_ID" .env.local | sed 's/=.*/=<set>/'
```
Expected: all 4 lines show `<set>`.

- [ ] **Step 2: Verify CF rule reachable + currently disabled**

```bash
bash perf/waf_bypass.sh status
```
Expected: `"paused":true`.

- [ ] **Step 3: Run baseline (long — ~30 min)**

```bash
bash perf/run_all.sh 0
```
Tail log in another terminal:
```bash
tail -f perf/runs/round-0/run.log
```
Expected end lines: `=== Round 0 complete ===` then `[exit] disabling WAF bypass`.

- [ ] **Step 4: Manually re-verify bypass is OFF**

```bash
bash perf/waf_bypass.sh status
```
Expected: `"paused":true`. If `false`, immediately:
```bash
bash perf/waf_bypass.sh disable
```

- [ ] **Step 5: Build the round-0 report**

```bash
npx tsx perf/report_gen.ts
open perf/report/index.html
```

- [ ] **Step 6: Analyze + record top 2-3 bottlenecks**

Create `perf/runs/round-0/ANALYSIS.md` (lives in gitignored dir):
```markdown
# Round 0 Analysis

## Top bottlenecks (rank by impact)
1. <endpoint or metric> — baseline X ms, target Y ms, fix candidate: F<id>
2. ...
3. ...

## Exit condition
- All p95 met? yes / no
- LH mobile perf ≥ 90? yes / no
- Decision: STOP / proceed to Round 1
```

- [ ] **Step 7: Decision gate**

If both exit conditions met → skip to Task 16.
Otherwise → proceed to Task 15.

---

### Task 15: Fix round (apply 2-3 fixes, re-run, compare)

**Fix-candidate list** (apply only what Round 0 analysis flagged):

| ID | Fix | Files | Expected impact |
|---|---|---|---|
| F1 | Verify `Cache-Control` on `/api/stats` hits CF | `src/app/api/stats/route.ts` | No code change — verify CF cache hit |
| F2 | Shorter play token (UUID → 16-char hex) | `src/app/api/play/start/route.ts:26` | Smaller Redis member, fewer bytes per req |
| F3 | `Cache-Control: public, max-age=86400, immutable` for `/mediapipe/*` | `next.config.ts` `headers()` block | Repeat WASM loads from disk cache |
| F4 | `<link rel="preconnect">` to Upstash REST host | `src/app/layout.tsx` head | Reduce TTFB on first /api/play/start |
| F5 | Lazy-import bcryptjs in signup route | `src/app/api/auth/signup/route.ts:2` → dynamic import | Smaller cold start for shared bundle |
| F6 | `revalidate` on `/leaderboard` page | `src/app/leaderboard/page.tsx` add `export const revalidate = 30` | Cached SSR, fewer Redis hits |

- [ ] **Step 1: Pick the top 2-3 from Round 0 analysis**

Create `docs/superpowers/plans/2026-05-21-perf-load-test-round-N.md` (gitignored under `/docs/`):
```markdown
# Round N picks
1. F<id> — <why, based on baseline data>
2. F<id> — <why>
3. F<id> — <why>
```

- [ ] **Step 2: Apply each fix in a separate commit**

For each pick, follow its mini-recipe. Example for F2:

In `src/app/api/play/start/route.ts:26`, replace:
```ts
  const token = crypto.randomUUID()
```
with:
```ts
  const token = randomBytes(8).toString('hex') // 16 chars
```

Add at the top of the file:
```ts
import { randomBytes } from 'crypto'
```

Run lint + build:
```bash
npm run lint && npm run build
```
Expected: no new errors.

Commit:
```bash
git add src/app/api/play/start/route.ts
git commit -m "perf(F2): shorter play token (UUID → 16-char hex) for smaller Redis payload"
```

Repeat for the other picked fixes (separate commit each).

- [ ] **Step 3: Run the next round**

```bash
bash perf/run_all.sh 1   # 1 / 2 / 3 depending on round number
```

- [ ] **Step 4: Generate the comparison report**

```bash
npx tsx perf/report_gen.ts
open perf/report/index.html
```
Expected: executive summary shows baseline → final delta % per endpoint.

- [ ] **Step 5: Decision gate**

- All p95 met AND LH ≥ 90? → STOP, go to Task 16.
- Round number == 3? → STOP, go to Task 16 (hard limit).
- Δ improvement < 5% vs previous round? → STOP, go to Task 16 (diminishing returns).
- Otherwise → repeat Task 15 for next round.

---

### Task 16: Finalize report + memory entry

**Files:**
- Regenerate: `perf/report/index.html`
- Create: `/Users/m3kh/.claude/projects/-Users-m3kh-Projects-Dab-Pose/memory/perf_baseline_2026-05-21.md`
- Modify: `/Users/m3kh/.claude/projects/-Users-m3kh-Projects-Dab-Pose/memory/MEMORY.md`

- [ ] **Step 1: Regenerate the final report**

```bash
npx tsx perf/report_gen.ts
open perf/report/index.html
```

- [ ] **Step 2: Write memory entry**

Create `/Users/m3kh/.claude/projects/-Users-m3kh-Projects-Dab-Pose/memory/perf_baseline_2026-05-21.md`:

```markdown
---
name: perf-baseline-2026-05-21
description: Performance baseline + fix-round results from 6-layer perf harness; pointers to report and commits
metadata:
  type: project
---

# Perf baseline 2026-05-21

Ran 6-layer harness (`perf/run_all.sh`) across N rounds. Baseline + final p95 per endpoint, fixes applied, and exit condition recorded in `perf/report/index.html`.

**Why:** Pre-launch perf verification + identify cost/latency bottlenecks while on free tiers (Upstash, Neon, Vercel Hobby).

**How to apply:** When the user asks "is the site fast enough" or "what's the perf budget", reference this report. When considering a new endpoint, copy the thresholds from `perf/k6/smoke.js` as the contract.

Related: [[security_layers_runtime]] (perf interacts with WAF/CF cache).
```

- [ ] **Step 3: Append to MEMORY.md**

Add this line under existing entries:
```
- [Perf baseline 2026-05-21](perf_baseline_2026-05-21.md) — 6-layer perf harness baseline + fix rounds; report at `perf/report/index.html`
```

- [ ] **Step 4: Verify bypass disabled one last time**

```bash
bash perf/waf_bypass.sh status
```
Expected: `"paused":true`.

- [ ] **Step 5: Final git status check**

```bash
git status
git log --oneline | head -20
```
Confirm the chain of `perf:` commits is present and the working tree is clean.

---

## Self-Review (post-write)

**Spec coverage check** — every spec section maps to a task:
- Section 2 (scenarios) → Tasks 5, 6, 7, 8, 9, 10
- Section 3 (metrics + thresholds) → embedded in k6 thresholds (Tasks 5-7) + LHCI config (Task 8) + report exec summary (Task 13)
- Section 4 (WAF + cost control) → Tasks 2, 3
- Section 5 (iteration loop) → Tasks 14, 15
- Section 6 (test data isolation + cleanup) → Task 11
- Section 7 (HTML report) → Task 13
- Architecture file map (section 4) → Task 1

**Placeholder scan** — no TBD/TODO/"similar to" patterns. Each code block is complete.

**Type consistency** — `loadtest_<layer>_<vu>_<iter>` is consistent between `_lib.js` (`loadtestName`) and `scripts/cleanup-perf-pollution.ts` (prefix `loadtest_`). Round directory naming `round-N` is consistent across orchestrator (Task 12) and report generator (Task 13).

**Known sharp edges left for the executor**:
- LHCI mobile re-run uses `--settings.preset=mobile` CLI override. Confirmed supported in `@lhci/cli` 0.14.x. If a future version drops it, split into two config files.
- `clinic` on Apple Silicon may need Rosetta or `0x` fallback — surface the error at run time, do not pre-fix.
- `crypto.randomBytes` in Next.js route handlers — supported since Next 13.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-21-perf-load-test.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
