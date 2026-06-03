/**
 * Stress test: 200 VUs querying ranking with level filter.
 * Verifies idx_profiles_level index keeps p95 < 150ms.
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
    http_req_duration: ['p(95)<150'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const minLevel = [0, 2, 4, 5.5][Math.floor(Math.random() * 4)]
  const maxLevel = minLevel + 2

  const res = http.get(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,display_name,level,elo_rating,matches_played` +
    `&level=gte.${minLevel}&level=lt.${maxLevel}` +
    `&order=elo_rating.desc&limit=100`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )

  check(res, {
    'status 200': r => r.status === 200,
  })

  sleep(0.1)
}
