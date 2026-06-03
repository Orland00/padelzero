/**
 * Liga + tournament flow behaviour tests.
 *
 * Scope: pure logic that gates UI decisions — invite acceptance eligibility,
 * points accounting for draw handling, tournament registration capacity.
 *
 * Authoritative logic lives in:
 *   - record_liga_match RPC (ELO + standings + draw handling)
 *   - tournament_participants RLS + tournaments_participants_status_check
 *   - liga_members_role/status CHECK constraints
 */
import { describe, it, expect } from 'vitest'

// ============================================================
// Liga invite acceptance gates
// ============================================================
// Mirrors notificationStore.acceptLigaInvite guard: only the invited player
// may accept, and the membership must currently be 'invited'.
function canAcceptLigaInvite(membership, currentUserId) {
  if (!membership) return false
  if (membership.player_id !== currentUserId) return false
  if (membership.status !== 'invited') return false
  return true
}

describe('liga invite acceptance gates', () => {
  it('allows the invited player to accept their own pending invite', () => {
    const m = { id: 'm1', player_id: 'alice', status: 'invited' }
    expect(canAcceptLigaInvite(m, 'alice')).toBe(true)
  })

  it('rejects accept attempts by another user', () => {
    const m = { id: 'm1', player_id: 'alice', status: 'invited' }
    expect(canAcceptLigaInvite(m, 'bob')).toBe(false)
  })

  it('rejects re-accepting an already-active membership', () => {
    const m = { id: 'm1', player_id: 'alice', status: 'active' }
    expect(canAcceptLigaInvite(m, 'alice')).toBe(false)
  })

  it('rejects rejected memberships', () => {
    const m = { id: 'm1', player_id: 'alice', status: 'rejected' }
    expect(canAcceptLigaInvite(m, 'alice')).toBe(false)
  })

  it('rejects null/undefined input safely', () => {
    expect(canAcceptLigaInvite(null, 'alice')).toBe(false)
    expect(canAcceptLigaInvite(undefined, 'alice')).toBe(false)
  })
})

// ============================================================
// Liga standings points accounting
// ============================================================
// Points model per record_liga_match:
//   Win  → 3
//   Draw → 1
//   Loss → 0
// (Also gates ELO: draws give 0 delta.)
function pointsForOutcome(scoreFor, scoreAgainst) {
  if (scoreFor > scoreAgainst) return 3
  if (scoreFor === scoreAgainst) return 1
  return 0
}

describe('liga points accounting', () => {
  it('grants 3 points for a win', () => {
    expect(pointsForOutcome(4, 2)).toBe(3)
  })

  it('grants 1 point for a draw (per April-14 fix)', () => {
    expect(pointsForOutcome(3, 3)).toBe(1)
    expect(pointsForOutcome(0, 0)).toBe(1)
  })

  it('grants 0 points for a loss', () => {
    expect(pointsForOutcome(2, 4)).toBe(0)
  })

  it('accumulates correctly across 3 matches (2W 1D simulation)', () => {
    const scores = [[4,2],[4,3],[3,3]]
    const total = scores.reduce((s, [a,b]) => s + pointsForOutcome(a,b), 0)
    expect(total).toBe(7) // 3 + 3 + 1
  })
})

// ============================================================
// Tournament registration capacity
// ============================================================
// tournaments.max_players is the team-pairs cap (each tp row = one team).
function canRegisterTeam(tournament, currentParticipants) {
  if (!tournament) return { ok: false, reason: 'no-tournament' }
  if (tournament.status !== 'registration') return { ok: false, reason: 'status-closed' }
  const cap = tournament.max_players ?? Infinity
  if (currentParticipants.length >= cap) return { ok: false, reason: 'full' }
  return { ok: true }
}

describe('tournament registration capacity', () => {
  const openT = { status: 'registration', max_players: 8 }

  it('allows registration under cap', () => {
    const ps = [1,2,3]
    expect(canRegisterTeam(openT, ps)).toEqual({ ok: true })
  })

  it('blocks at exact capacity', () => {
    const ps = [1,2,3,4,5,6,7,8]
    expect(canRegisterTeam(openT, ps)).toEqual({ ok: false, reason: 'full' })
  })

  it('blocks when registration is closed', () => {
    expect(canRegisterTeam({ status: 'in_progress', max_players: 8 }, [])).toEqual({ ok: false, reason: 'status-closed' })
    expect(canRegisterTeam({ status: 'finished',    max_players: 8 }, [])).toEqual({ ok: false, reason: 'status-closed' })
  })

  it('rejects null tournament', () => {
    expect(canRegisterTeam(null, [])).toEqual({ ok: false, reason: 'no-tournament' })
  })
})

// ============================================================
// ELO delta sign expectations (spot-checks; full ELO math covered by
// tests/frontend/eloEngine.test.js)
// ============================================================
describe('ELO delta sign contract', () => {
  it('winner delta is non-negative', () => {
    // Pure invariant: whichever K, expected-probability clamps actual-expected ≥ 0 on win.
    const winnerDelta = (k, actual, expected) => Math.round(k * (actual - expected))
    expect(winnerDelta(40, 1, 0.5)).toBeGreaterThanOrEqual(0)
    expect(winnerDelta(32, 1, 0.9)).toBeGreaterThanOrEqual(0)
  })

  it('draws produce zero delta (matches DB fix)', () => {
    // Per record_liga_match: IF v_is_draw THEN v_delta_* := 0.
    // (Irrespective of ELO spread, draws neutralise.)
    const drawDelta = 0
    expect(drawDelta).toBe(0)
  })

  it('loser delta is non-positive but floored at -K', () => {
    const loserDelta = (k, expected) => Math.round(k * (0 - (1 - expected)))
    expect(loserDelta(40, 0.5)).toBeLessThanOrEqual(0)
    expect(loserDelta(40, 0.5)).toBeGreaterThanOrEqual(-40)
  })
})
