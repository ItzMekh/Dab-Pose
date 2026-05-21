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
