/**
 * Stress test: simulate burst of rating history inserts to verify
 * the achievements trigger does not deadlock under load.
 *
 * NOTE: Requires SUPABASE_SERVICE_KEY env var.
 * Only run against a staging environment, NEVER production.
 *
 * Updated: 2026-05-07
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co'
const SERVICE_KEY = __ENV.SUPABASE_SERVICE_KEY || ''  // NEVER use in production tests
const TEST_PLAYER_ID = __ENV.TEST_PLAYER_ID || ''
const TEST_MATCH_ID = __ENV.TEST_MATCH_ID || ''

export const options = {
  vus: 50,
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
}

export default function () {
  const res = http.post(
    `${SUPABASE_URL}/rest/v1/player_rating_history`,
    JSON.stringify({
      player_id: TEST_PLAYER_ID,
      match_id: TEST_MATCH_ID,
      elo_before: 1200,
      elo_after: 1216,
      level_before: 1.75,
      level_after: 1.82,
      delta_elo: 16,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    }
  )

  check(res, {
    'insert succeeds': r => r.status === 201,
    'no deadlock': r => !r.body.includes('deadlock'),
  })

  sleep(0.02)
}
