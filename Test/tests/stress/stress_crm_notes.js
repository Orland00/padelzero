/**
 * Stress test: 100 coaches writing notes simultaneously.
 * Verifies RLS isolation holds under concurrent writes —
 * each coach's INSERT must only write to their own rows.
 *
 * Run with a test user token that has coach access.
 *
 * Updated: 2026-05-07
 */
import http from 'k6/http'
import { check } from 'k6'

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || ''
const TEST_USER_TOKEN = __ENV.TEST_USER_TOKEN || ''  // JWT for a test coach user
const TEST_TARGET_ID = __ENV.TEST_TARGET_ID || ''    // target student profile ID

export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
}

export default function () {
  const res = http.post(
    `${SUPABASE_URL}/rest/v1/crm_notes`,
    JSON.stringify({
      target_id: TEST_TARGET_ID,
      content: `Stress test note ${Date.now()}`,
      tags: ['bandeja'],
      is_shared: false,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${TEST_USER_TOKEN}`,
        Prefer: 'return=minimal',
      },
    }
  )

  check(res, {
    'insert succeeds (201)': r => r.status === 201,
    'no RLS violation': r => !r.body.includes('row-level security'),
  })
}
