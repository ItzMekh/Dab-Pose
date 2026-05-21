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
