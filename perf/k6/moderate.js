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
