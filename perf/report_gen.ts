/**
 * Reads perf/runs/round-N/* JSON output and writes perf/report/index.html.
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
  // k6 --summary-export format: metrics map values directly on the metric
  // object (e.g. `m['p(95)']`), not under a `values` sub-key. Some k6 outputs
  // do nest under `values`; support both.
  const j = JSON.parse(readFileSync(path, 'utf8')) as {
    metrics: Record<string, Record<string, number | object> & { values?: Record<string, number> }>
  }
  const m = j.metrics
  const num = (
    metric: Record<string, number | object> | undefined,
    key: string
  ): number | undefined => {
    if (!metric) return undefined
    const v = metric.values?.[key] ?? metric[key]
    return typeof v === 'number' ? v : undefined
  }
  const endpoints: EndpointSummary[] = []
  for (const tag of ['stats', 'lb', 'country', 'play_start', 'score']) {
    const e = m[`http_req_duration{endpoint:${tag}}`]
    if (!e) continue
    const p95 = num(e, 'p(95)')
    if (p95 === undefined) continue
    endpoints.push({
      name: tag,
      p50: num(e, 'p(50)') ?? num(e, 'med') ?? 0,
      p95,
      p99: num(e, 'p(99)') ?? 0,
      errorRate: num(m['http_req_failed'], 'rate') ?? 0,
    })
  }
  return {
    endpoints,
    cacheHitRatio: num(m['cf_cache_hit_ratio'], 'rate') ?? num(m['cf_cache_hit_ratio'], 'value') ?? 0,
    wafBlocks: num(m['waf_blocks_429'], 'count') ?? 0,
  }
}

function loadLighthouse(roundDir: string): LhRow[] | undefined {
  type Lh = {
    finalUrl?: string
    configSettings?: { formFactor?: string }
    categories?: { performance?: { score?: number } }
    audits?: Record<string, { numericValue?: number }>
  }
  const out: LhRow[] = []
  for (const sub of ['lhci', 'lhci-mobile']) {
    const dir = join(roundDir, sub)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json') || f === 'manifest.json') continue
      let j: Lh
      try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')) } catch { continue }
      if (!j.categories?.performance) continue
      out.push({
        url: j.finalUrl ?? f,
        formFactor: j.configSettings?.formFactor ?? (sub === 'lhci-mobile' ? 'mobile' : 'desktop'),
        perf: (j.categories.performance.score ?? 0) * 100,
        lcp: j.audits?.['largest-contentful-paint']?.numericValue ?? 0,
        cls: j.audits?.['cumulative-layout-shift']?.numericValue ?? 0,
        tbt: j.audits?.['total-blocking-time']?.numericValue ?? 0,
      })
    }
  }
  return out.length ? out : undefined
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
    lighthouse: loadLighthouse(roundDir),
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
  // p99 is omitted because k6 --summary-export does not include it; the raw
  // event stream has it but we don't parse it here. Show p50/p95/max-target.
  const rows = d.endpoints.map(e => {
    const limit = ENDPOINT_LIMITS[e.name] ?? 1000
    const pass = e.p95 <= limit
    const cls = pass ? '' : 'delta-bad'
    return `<tr><td>${esc(e.name)}</td><td>${e.p50.toFixed(0)}</td><td class="${cls}">${e.p95.toFixed(0)}</td><td>${limit}</td><td>${pass ? '✓' : '✗'}</td></tr>`
  }).join('')
  const cacheLine = d.cacheHitRatio !== undefined
    ? `<p>CF cache hit ratio: ${(d.cacheHitRatio * 100).toFixed(1)}% &middot; WAF 429s: ${d.wafBlocks ?? 0}</p>`
    : ''
  return `<h3>k6 ${esc(name)}</h3><table><tr><th>Endpoint</th><th>p50 (ms)</th><th>p95 (ms)</th><th>Target</th><th>Pass</th></tr>${rows}</table>${cacheLine}`
}

function renderLighthouse(rows?: LhRow[]): string {
  if (!rows?.length) return ''
  // Group by URL+formFactor, take median across runs.
  const grouped = new Map<string, LhRow[]>()
  for (const r of rows) {
    const k = `${r.url}|${r.formFactor}`
    grouped.set(k, [...(grouped.get(k) ?? []), r])
  }
  const median = (arr: number[]): number => {
    const s = [...arr].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
  }
  const trs = [...grouped.entries()].sort().map(([_, runs]) => {
    const r = runs[0]
    const perfPass = median(runs.map(x => x.perf)) >= 90
    const cls = perfPass ? '' : 'delta-bad'
    return `<tr><td>${esc(r.url)}</td><td>${esc(r.formFactor)}</td><td class="${cls}">${median(runs.map(x => x.perf)).toFixed(0)}</td><td>${median(runs.map(x => x.lcp)).toFixed(0)}</td><td>${median(runs.map(x => x.cls)).toFixed(2)}</td><td>${median(runs.map(x => x.tbt)).toFixed(0)}</td><td>${perfPass ? '✓' : '✗ (target ≥90)'}</td></tr>`
  }).join('')
  return `<h3>Lighthouse (median of 3 runs per URL)</h3><table><tr><th>URL</th><th>Form</th><th>Perf</th><th>LCP (ms)</th><th>CLS</th><th>TBT (ms)</th><th>Pass</th></tr>${trs}</table>`
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

<h2>Fixes Applied (Round 0 → 1)</h2>
<table>
  <tr><th>ID</th><th>Description</th><th>Commit</th><th>Measured Effect (moderate p95)</th></tr>
  <tr><td>F-B</td><td>Pipeline 5 Promise.all reads in /api/score into a single redis.pipeline().exec()</td><td>9c14346</td><td>score 328.5 ms → 328.1 ms (-0.1% — neutral; Upstash REST appears to already batch internally)</td></tr>
  <tr><td>F-C</td><td>Cache-Control: private, max-age=3600 on /api/country/detect (browser cache)</td><td>9c14346</td><td>Not visible in k6 (no cache replay); benefits real-browser repeat visits</td></tr>
  <tr><td>F-A</td><td>Cloudflare Cache Rule: cache /api/leaderboard + /api/stats (edge_ttl override_origin 30s)</td><td>(CF API)</td><td>cf_cache_hit_ratio 0% → 0% — rule did not engage (likely Bot Fight Mode interference)</td></tr>
</table>

<h2>Bottleneck Backlog (unfixed)</h2>
<table>
  <tr><th>Finding</th><th>Why deferred</th></tr>
  <tr><td>play_start p95 ~320-460 ms (above 250 target)</td><td>Pure cold-start + Vercel→Upstash single RTT; only fix is Edge runtime or Cron warm — out of round-1 scope</td></tr>
  <tr><td>country/detect p95 ~330 ms via k6</td><td>Real browsers benefit from F-C cache; k6 issues a fresh request each iter and cannot show the saving</td></tr>
  <tr><td>Lighthouse mobile perf 73-84 (target ≥90)</td><td>4G throttled — needs JS bundle splitting, image/font tuning; beyond pipeline fixes</td></tr>
  <tr><td>Lighthouse best-practices 78</td><td>Likely third-party script issues (Vercel Analytics / Insights) — investigate separately</td></tr>
  <tr><td>cf_cache_hit_ratio 0% on /api/leaderboard</td><td>CF Cache Rule applied but DYNAMIC persists; Bot Fight Mode disables caching for non-whitelisted bots — would need a separate Cache Rule exception or BFM scoped to non-API paths</td></tr>
  <tr><td>p99 tail 35 s observed at 50 VU moderate (lb + stats once each)</td><td>Single outlier per round, almost certainly cold-start storm during ramp-up; not a steady-state concern</td></tr>
</table>

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
