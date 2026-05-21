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
