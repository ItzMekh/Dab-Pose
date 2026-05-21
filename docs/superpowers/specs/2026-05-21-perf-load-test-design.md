# Performance & Load Test Plan — Dab Pose

**Date**: 2026-05-21
**Owner**: เมฆ
**Status**: Approved (brainstorm) → ready for implementation plan
**Target**: `https://dabpose.fun` (prod reads) + local prod-build (writes/profile)

---

## 1. Goal

Establish a repeatable performance & load test harness that:

1. Measures backend latency (p50/p95/p99), throughput, and breaking point.
2. Measures frontend Core Web Vitals (LCP, INP, CLS, TBT) and Lighthouse perf score.
3. Measures client runtime (MediaPipe FPS, WASM load, memory leak).
4. Drives a realistic end-to-end browser flow under concurrent load.
5. Iteratively fixes the top 2-3 bottlenecks per round until p95 + Lighthouse targets are met (max 3 rounds, hard stop).
6. Produces a single self-contained HTML report comparing before/after.

Constraints:

- **Production target** must not trip Cloudflare WAF, pollute analytics, or burn Upstash free-tier quota.
- Test data is fully namespaced (`loadtest_*` prefix) and auto-cleaned after every round.
- Total cost per full run ≤ 10% of any free-tier daily quota.

## 2. Non-Goals

- Will not load-test `/api/auth/[...nextauth]` (managed by Auth.js — opaque).
- Will not exercise real MediaPipe WASM on every Playwright VU (CPU-bound, would skew results).
- Will not auto-apply more than 3 fix rounds.
- Will not modify Vercel runtime config or upgrade plans for the test.

## 3. Architecture

```
perf/
├── run_all.sh              # orchestrator: bypass → layers → cleanup → reset
├── cleanup.sh              # invokes scripts/cleanup-test-pollution.ts
├── waf_bypass.sh           # enables/disables CF Custom Rule via API
├── k6/
│   ├── smoke.js            # Layer 1: 5 VU × 60 s — baseline
│   ├── moderate.js         # Layer 2: ramp 10→50 VU × 5 m — reads + 1 write/VU
│   └── stress.js           # Layer 3: ramp 50→100 VU × 10 m — reads only (prod)
├── lhci/
│   └── lhci.config.js      # Layer 4: 3 URLs × mobile+desktop × 3 runs
├── playwright/
│   └── realistic.spec.ts   # Layer 5: 5 parallel browsers, full journey, mocked camera
├── clinic/
│   └── run.sh              # Layer 6: local clinic doctor + flame via autocannon
├── runs/
│   └── round-{0,1,2}/      # raw JSON per round
├── baseline/               # round-0 frozen for comparison
└── report/
    ├── report_gen.ts       # round-* JSON → index.html
    └── index.html          # final report (vanilla HTML + Chart.js CDN)
```

**Tooling**: `k6`, `@lhci/cli`, `@playwright/test` (already in repo), `clinic`, `autocannon`. Install via `npm i -D k6 @lhci/cli clinic autocannon` (k6 via Homebrew preferred on macOS).

## 4. Test Scenarios

### Layer 1 — k6 SMOKE (`perf/k6/smoke.js`)
- 5 VU × 60 s. One hit per endpoint per iteration.
- Reads: `/api/stats`, `/api/leaderboard?mode=single`, `?mode=country`, `/api/country/detect`.
- Writes: 1× `/api/play/start` → wait 500 ms → 1× `/api/score` per VU.
- Username pattern: `loadtest_smoke_${__VU}_${__ITER}`.
- Country: `'XX'` (server fallback path — `bodyCountry !== 'XX' ? bodyCountry : headerCountry` at `src/app/api/score/route.ts:76`). Stored country will be whatever Vercel/CF detects from the test client IP, so cleanup must also `ZINCRBY -1` against the resolved country counter (handled in cleanup script).

### Layer 2 — k6 MODERATE (`perf/k6/moderate.js`)
- Stages: 1 m ramp 0→10, 2 m ramp 10→50, 2 m steady 50, 1 m down 50→0.
- Read-only on prod (lb + stats + country detect).
- 1 write per VU at iteration end (tagged `loadtest_moderate_*`).
- Custom metric: `cf_cache_hit_ratio` from response `cf-cache-status` header.

### Layer 3 — k6 STRESS (`perf/k6/stress.js`)
- Stages: 2 m ramp 0→50, 3 m ramp 50→100, 4 m steady 100, 1 m down.
- **Reads only** — `/api/leaderboard` variants. CF cache absorbs.
- Tracks: WAF 429 rate, p99 tail, Vercel function cold-start spikes (look for outliers > 1500 ms).
- Write stress runs against **local prod-build** (`npm run build && npm run start`) — never prod.

### Layer 4 — Lighthouse CI (`perf/lhci/lhci.config.js`)
- URLs: `/`, `/leaderboard`, `/signup`.
- 2 form factors: mobile (Moto G4 emulation) + desktop.
- 3 runs per URL → take median.
- Categories: performance, accessibility, best-practices, seo.
- Output: `perf/runs/round-N/lhci/*.json`.

### Layer 5 — Playwright E2E load (`perf/playwright/realistic.spec.ts`)
- `test.describe.parallel` with 5 workers.
- Each worker: open `/` → click mode card → stub `navigator.mediaDevices.getUserMedia` (returns black canvas stream) → POST `/api/play/start` via `page.evaluate` → wait 300-2000 ms randomized → POST `/api/score` → assert ResultScreen renders.
- Capture per-step timing into `perf/runs/round-N/e2e.json`.

### Layer 6 — clinic.js profiling (`perf/clinic/run.sh`)
- `npm run build` → `clinic doctor -- node node_modules/.bin/next start`.
- Drive load: `autocannon -c 50 -d 30 http://localhost:3000/api/leaderboard`.
- Repeat with `clinic flame` for CPU sampling.
- Output: HTML flame graphs in `perf/runs/round-N/clinic/`.

## 5. Metrics & Thresholds

### API (k6 `http_req_duration` ms)

| Endpoint | p50 | **p95** | p99 | Error |
|---|---:|---:|---:|---:|
| `GET /api/stats` | 50 | **150** | 300 | 0.5% |
| `GET /api/leaderboard` | 80 | **200** | 400 | 0.5% |
| `GET /api/country/detect` | 40 | **120** | 250 | 0.5% |
| `POST /api/play/start` | 100 | **250** | 500 | 1% |
| `POST /api/score` | 150 | **400** | 800 | 1% |
| `POST /api/auth/signup` | 600 | **1200** | 2000 | 2% |

### Frontend (Lighthouse, mobile)

| Metric | Target |
|---|---|
| Performance score | ≥ 90 |
| LCP | < 2.5 s |
| INP | < 200 ms |
| CLS | < 0.1 |
| TBT | < 200 ms |
| Total transfer | < 500 KB (pre-MediaPipe) |

### Client runtime

| Metric | Target |
|---|---|
| MediaPipe WASM cold load | < 3 s on Fast 3G throttle |
| Detection loop FPS | ≥ 25 fps sustained |
| Heap growth per minute | < 5 MB |
| Full flow (open → submit) | < 8 s p95 |

### System

| Signal | Threshold |
|---|---|
| WAF 429 during smoke | 0% |
| WAF 429 during moderate | < 5% |
| Upstash bandwidth per run | < 50 MB |
| Neon connections peak | < 10 |
| CF cache hit on `/api/leaderboard` | ≥ 70% |

### Exit condition

Stop the iteration loop when **all** endpoint p95 targets meet **and** Lighthouse mobile perf ≥ 90. Otherwise iterate up to round 3, then list remaining bottlenecks in the report without further fixes.

## 6. WAF Bypass & Cost Control

### CF Custom Rule (manual one-time setup)
```
Name: perf-test-bypass
Expression: (http.request.headers["x-perf-test"][0] eq "<secret>")
Action: Skip → All custom rules + Rate limiting rules
Status: Disabled by default
```
Secret stored as `PERF_BYPASS_TOKEN` in `.env.local` (gitignored). All test clients send header `x-perf-test: $PERF_BYPASS_TOKEN`.

`perf/waf_bypass.sh enable|disable` toggles the rule via CF API (`PATCH /zones/<zone-id>/firewall/rules/<rule-id>`). Orchestrator enables before tests, disables in a `trap EXIT` so a crashed run still cleans up.

If CF API access is unavailable: fallback to ≤ 5 VU smoke only.

### Pre-flight checks (in `run_all.sh`)

- Query Upstash REST `INFO` — abort if command count > 80% of daily free-tier quota.
- Each k6 stage has `summaryThresholds` — fail-fast if error rate > 50%.
- k6 `--max-duration=15m` hard ceiling.

### Test data isolation

- Username: `loadtest_<layer>_<vu>_<iter>`
- Country: `ZZ` (server falls back, never adds to country leaderboard)
- Cleanup: `perf/cleanup.sh` calls `scripts/cleanup-test-pollution.ts --prefix loadtest_`
- Verify: snapshot `ZCARD lb:single:all` before/after, expect delta = 0

## 7. Iteration Loop

```
Round 0 (Baseline — no fixes applied)
  enable bypass → run 6 layers → save JSON → cleanup → disable bypass
  → analyze: top 2-3 bottlenecks
  → all targets met? STOP : continue to Round 1

Round 1..3 (up to 3 fix rounds — 4 rounds total worst case)
  apply 2-3 fixes (separate commits)
  re-run 6 layers
  compare vs Round 0 baseline, compute Δ%
  exit condition met? STOP : continue

Hard stop:
  - completed Round 3 (3 fix attempts after baseline), OR
  - Δ improvement < 5% vs previous round (diminishing returns)
```

### Bottleneck auto-flag heuristics
- Endpoint p95 > 2× target → "primary"
- p99/p50 ratio > 5× → "tail latency / cold start"
- LH perf < 80 AND LCP > 4 s → "render path"
- Cache hit < 30% → "caching misconfigured"
- Heap growth > 20 MB/min → "memory leak"

### Pre-identified fix candidates (apply only if flagged)
1. Verify `stale-while-revalidate` on `/api/stats` (already configured — confirm in test)
2. Shorter play token (`crypto.randomUUID` → 16-char nanoid) — reduce Redis bandwidth
3. `Cache-Control: public, max-age=86400, immutable` on self-hosted MediaPipe assets
4. `<link rel="preconnect">` to Upstash REST host on game screen
5. Lazy import `bcryptjs` in signup route — reduce cold-start
6. ISR revalidation on `/leaderboard` page — reduce SSR cost

## 8. HTML Report (`perf/report/index.html`)

Single-file output. Vanilla HTML + Chart.js via CDN. No build step.

Sections:
1. Header — project name, timestamp, round count
2. Verdict card — GREEN/YELLOW/RED with reason
3. Executive summary table — metric | baseline | final | Δ% | target | pass?
4. Round-by-round timeline chart
5. Per-layer collapsible sections:
   - k6 smoke — p50/p95/p99 per endpoint
   - k6 moderate — VU vs latency line chart
   - k6 stress — failure rate timeline
   - Lighthouse — radar per URL × form factor
   - Playwright E2E — waterfall per step
   - clinic — link to embedded flame HTML
6. Fixes applied table — commit SHA, file path, description, measured delta
7. Bottleneck backlog (unfixed)
8. Raw JSON downloads (relative links to `perf/runs/`)

Generator: `perf/report_gen.ts` (run via `npx tsx`). Reads `perf/runs/round-*/`, renders template literal, writes `perf/report/index.html`, optionally opens via `open` (macOS).

## 9. Risks

| Risk | Mitigation |
|---|---|
| CF WAF blocks test IP | Bypass rule + fallback to ≤ 5 VU |
| Upstash quota exhaustion | Pre-flight check + abort at 80% |
| Leaderboard pollution | `loadtest_*` prefix + auto cleanup + ZCARD delta verify |
| Playwright + real MediaPipe = CPU-bound | Stub `getUserMedia`, never load real WASM in E2E load |
| clinic.js on Apple Silicon native binding issues | Use Node 20 LTS; document fallback to `0x` (alternative flame) |
| Bypass rule left enabled | `trap EXIT` in orchestrator + manual checklist at end |
| Fix regressions break gameplay | Each fix is a separate commit; revert path documented |

## 10. Deliverables

- `perf/` directory with all scripts.
- `perf/runs/round-*/` raw JSON.
- `perf/report/index.html` final report.
- Up to 3 fix commits (if needed) tagged `perf:` prefix.
- Updated `MEMORY.md` entry pointing to the report.

## 11. Out of Scope (for this spec)

- CI/CD integration (run on every PR) — separate follow-up.
- Synthetic monitoring (continuous prod probes) — separate follow-up.
- Real-user monitoring beyond what Vercel Speed Insights already provides.
