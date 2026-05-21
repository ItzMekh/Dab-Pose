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
