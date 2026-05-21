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
