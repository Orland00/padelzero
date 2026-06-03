/**
 * Stress test: 200 VUs reading the open matches feed simultaneously.
 * Verifies partial index on (is_open, played_at) keeps p95 < 200ms.
 *
 * Updated: 2026-05-07
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || ''

export const options = {
  vus: 200,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/matches?is_open=eq.true&slots_needed=gt.0&order=played_at.desc&limit=30`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )

  check(res, {
    'status 200': r => r.status === 200,
    'returns array': r => r.json() !== null,
  })

  sleep(0.1)
}
