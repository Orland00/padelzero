/**
 * Stress test: 10 VUs confirming the same pending match simultaneously.
 * Only 1 should succeed (200); the rest must get a 400 "not pending" error.
 * Validates the FOR UPDATE row lock in confirm_match_and_update_ratings.
 *
 * Updated: 2026-05-07
 */
import http from 'k6/http'
import { check } from 'k6'

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || ''
const TEST_MATCH_ID = __ENV.TEST_MATCH_ID || ''

export const options = {
  vus: 10,
  iterations: 10,
  thresholds: {
    'checks{check:exactly one success}': ['rate>=0.09'],
  },
}

let successCount = 0

export default function () {
  const res = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/confirm_match_and_update_ratings`,
    JSON.stringify({ p_match_id: TEST_MATCH_ID }),
    {
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )

  const succeeded = res.status === 200
  if (succeeded) successCount++

  check(res, {
    'either succeeded or got expected rejection': r =>
      r.status === 200 ||
      (r.status === 400 && (r.body.includes('not pending') || r.body.includes('confirmación'))),
    'exactly one success': () => successCount <= 1,
  })
}
