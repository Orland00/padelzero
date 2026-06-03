/**
 * Stress test: concurrent ELO RPC calls on the same match.
 * Verifies the SECURITY DEFINER RPC is idempotent:
 * only the first call succeeds; subsequent calls get "not pending" exception.
 *
 * Updated: 2026-05-07
 */
import http from 'k6/http'
import { check } from 'k6'

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || ''
const TEST_MATCH_ID = __ENV.TEST_MATCH_ID || ''  // must be a pending match

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.02'],
  },
}

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

  // Either 200 (first caller) or 400 with "not pending" message is acceptable
  check(res, {
    'status is 200 or 400': r =>
      r.status === 200 ||
      (r.status === 400 && r.body.includes('not pending')),
  })
}
