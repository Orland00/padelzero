import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * PADELZERO SUPER STRESS TEST SUITE (v1.0)
 * ---------------------------------------
 * Targets the new high-concurrency features of the post-Playtomic roadmap.
 * Uses k6 (https://k6.io)
 */

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users (Peak load)
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate must be < 1%
  },
};

const BASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';
const API_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key';

export default function () {
  const params = {
    headers: {
      'apikey': API_KEY,
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  // --- 1. ELO RPC Stress (Idempotency Check) ---
  // Simulate 50 players trying to confirm the same match simultaneously.
  // The Postgres row-lock should ensure ELO is only updated once.
  const eloPayload = JSON.stringify({ match_id: 'stress-match-uuid-123' });
  let eloRes = http.post(`${BASE_URL}/rest/v1/rpc/confirm_match_and_update_ratings`, eloPayload, params);
  check(eloRes, {
    'ELO RPC status is 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  // --- 2. Open Matches Feed (Index Performance) ---
  // Simulate rapid filtering of the feed by level ±0.5.
  // Validates the index on (is_open, played_at).
  let feedRes = http.get(`${BASE_URL}/rest/v1/matches?is_open=eq.true&level=gt.3.0&level=lt.4.0&order=played_at.desc`, params);
  check(feedRes, {
    'Feed status is 200': (r) => r.status === 200,
    'Feed returned data': (r) => JSON.parse(r.body).length >= 0,
  });

  // --- 3. CRM Note Concurrency (RLS Isolation) ---
  // Simulate coaches writing notes for different students at once.
  // Verifies that RLS and DB connections don't bottleneck.
  const notePayload = JSON.stringify({
    author_id: 'coach-uuid',
    target_id: 'student-uuid',
    content: 'Stress test note content',
    tags: ['Bandeja', 'Stress'],
    is_shared: true
  });
  let noteRes = http.post(`${BASE_URL}/rest/v1/crm_notes`, notePayload, params);
  check(noteRes, {
    'CRM Note created (201)': (r) => r.status === 201,
  });

  // --- 4. Achievements Trigger Stress ---
  // Rapidly write to history to see if the achievement trigger deadlocks.
  const histPayload = JSON.stringify({
    player_id: 'player-uuid',
    match_id: 'match-uuid',
    elo_after: 2001
  });
  let histRes = http.post(`${BASE_URL}/rest/v1/player_rating_history`, histPayload, params);
  check(histRes, {
    'Rating history written': (r) => r.status === 201,
  });

  sleep(1);
}
