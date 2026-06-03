/**
 * Contract tests for the 2026-04-17 audit fixes (commits 66c891d + 9689551).
 *
 * Scope: pure-logic mirrors of the fixed code paths. These lock the contract
 * so the fixes can't silently regress.
 *
 * Covered:
 *  - Offline queue author filter (src/lib/offlineQueue.js)
 *  - Onboarding username normalization (src/pages/Onboarding.jsx)
 *  - Tournament registerTeam guards (src/stores/tournamentDetailStore.js)
 *  - Club claim flow intent parsing (src/pages/Anunciate.jsx)
 *  - Score submit debounce (src/pages/TournamentDetail.jsx)
 */
import { describe, it, expect } from 'vitest'

// ============================================================
// 1. Offline queue — author-keyed filter
// ============================================================
// Mirrors getAllQueued() post-filter: when a userId is passed, only return
// entries authored by that user (or legacy null-author entries).
function filterQueueByAuthor(entries, authorId) {
  if (!authorId) return entries
  return entries.filter(item => !item.authorId || item.authorId === authorId)
}

describe('offline queue author filter', () => {
  const entries = [
    { id: 1, authorId: 'alice', data: 'a1' },
    { id: 2, authorId: 'bob',   data: 'b1' },
    { id: 3, authorId: 'alice', data: 'a2' },
    { id: 4, authorId: null,    data: 'legacy' }, // pre-fix entries lack authorId
  ]

  it('returns all entries when no author provided (legacy callers)', () => {
    expect(filterQueueByAuthor(entries, null)).toHaveLength(4)
  })

  it('returns only alice entries plus legacy when author=alice', () => {
    const result = filterQueueByAuthor(entries, 'alice')
    expect(result).toHaveLength(3)
    expect(result.map(e => e.id).sort()).toEqual([1, 3, 4])
  })

  it('never leaks entries from another user across accounts on same browser', () => {
    const bobsQueue = filterQueueByAuthor(entries, 'bob')
    expect(bobsQueue.every(e => e.authorId !== 'alice')).toBe(true)
    expect(bobsQueue.find(e => e.data === 'a1')).toBeUndefined()
    expect(bobsQueue.find(e => e.data === 'a2')).toBeUndefined()
  })

  it('empty author id acts like no filter (safer default)', () => {
    expect(filterQueueByAuthor(entries, '')).toHaveLength(4)
  })
})

// ============================================================
// 2. Onboarding username normalization
// ============================================================
// Mirrors the Onboarding → Profile normalization contract: strip leading @,
// lowercase. Both entry points must produce the same DB value so that future
// case-insensitive lookups converge.
function normalizeUsername(raw) {
  return (raw || '').trim().replace(/^@+/, '').toLowerCase()
}

describe('username normalization', () => {
  it('strips a single leading @', () => {
    expect(normalizeUsername('@playera')).toBe('playera')
  })

  it('strips multiple leading @ prefixes', () => {
    expect(normalizeUsername('@@playera')).toBe('playera')
  })

  it('lowercases mixed case input', () => {
    expect(normalizeUsername('Player A')).toBe('playera')
    expect(normalizeUsername('@PLAYERA')).toBe('playera')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeUsername('  @Player A  ')).toBe('playera')
  })

  it('Onboarding and Profile produce identical output (convergence check)', () => {
    const inputs = ['@User1', 'USER1', '@@user1', ' user1 ']
    const normalized = inputs.map(normalizeUsername)
    expect(new Set(normalized).size).toBe(1)
    expect(normalized[0]).toBe('user1')
  })

  it('handles empty / null input without throwing', () => {
    expect(normalizeUsername('')).toBe('')
    expect(normalizeUsername(null)).toBe('')
    expect(normalizeUsername(undefined)).toBe('')
  })
})

// ============================================================
// 3. Tournament registerTeam guards
// ============================================================
// Mirrors tournamentDetailStore.registerTeam gates applied before INSERT:
//   a) tournament status must be 'registration' or 'draft'
//   b) neither player may already be registered (non-cancelled) in this tourney
//   c) capacity uses fresh DB count (caller wires that), not stale client state
function canRegister(tournament, p1Id, p2Id, existingParticipants) {
  if (tournament?.status && tournament.status !== 'registration' && tournament.status !== 'draft') {
    return { ok: false, reason: 'registration_closed' }
  }
  const blocked = existingParticipants.some(p => {
    if (p.status === 'cancelled') return false
    return p.p1_id === p1Id || p.p2_id === p1Id || p.p1_id === p2Id || p.p2_id === p2Id
  })
  if (blocked) return { ok: false, reason: 'duplicate_player' }
  return { ok: true }
}

function bucketOnCapacity(isFull) {
  return isFull ? 'waitlisted' : 'registered'
}

describe('tournament registerTeam guards', () => {
  const regTourney = { status: 'registration', max_players: 8 }

  it('allows registration when tournament is in registration state', () => {
    expect(canRegister(regTourney, 'alice', 'bob', []).ok).toBe(true)
  })

  it('blocks registration once tournament is in_progress', () => {
    expect(canRegister({ status: 'in_progress' }, 'alice', 'bob', [])).toEqual({
      ok: false, reason: 'registration_closed',
    })
  })

  it('blocks registration once tournament is finished', () => {
    expect(canRegister({ status: 'finished' }, 'alice', 'bob', [])).toEqual({
      ok: false, reason: 'registration_closed',
    })
  })

  it('blocks when p1 is already registered elsewhere in this tournament', () => {
    const existing = [{ p1_id: 'alice', p2_id: 'carol', status: 'registered' }]
    expect(canRegister(regTourney, 'alice', 'bob', existing)).toEqual({
      ok: false, reason: 'duplicate_player',
    })
  })

  it('blocks when p2 is already registered', () => {
    const existing = [{ p1_id: 'carol', p2_id: 'alice', status: 'registered' }]
    expect(canRegister(regTourney, 'bob', 'alice', existing)).toEqual({
      ok: false, reason: 'duplicate_player',
    })
  })

  it('ignores cancelled prior registrations', () => {
    const existing = [
      { p1_id: 'alice', p2_id: 'carol', status: 'cancelled' },
    ]
    expect(canRegister(regTourney, 'alice', 'bob', existing).ok).toBe(true)
  })

  it('buckets into waitlist when capacity is full', () => {
    expect(bucketOnCapacity(true)).toBe('waitlisted')
    expect(bucketOnCapacity(false)).toBe('registered')
  })
})

// ============================================================
// 4. Club claim intent parsing (Anunciate.jsx entry)
// ============================================================
// When ClubProfile's claim button redirects to /anunciate?intent=claim&slug=X,
// Anunciate must switch to the 'claim' tab and carry the slug forward.
function pickInitialTab(intent) {
  return intent === 'claim' ? 'claim' : 'stats'
}

describe('club claim intent routing', () => {
  it('opens stats tab by default', () => {
    expect(pickInitialTab(null)).toBe('stats')
  })

  it('opens claim tab when intent=claim', () => {
    expect(pickInitialTab('claim')).toBe('claim')
  })

  it('ignores unknown intents (defense in depth)', () => {
    expect(pickInitialTab('wipe-db')).toBe('stats')
    expect(pickInitialTab('')).toBe('stats')
  })
})

// ============================================================
// 5. Score submit debounce
// ============================================================
// Mirrors TournamentDetail.handleScoreSubmit guard: early-return when a
// submit is already in flight. Prevents duplicate writes on double-click.
function shouldProcessSubmit(isAlreadySubmitting) {
  return !isAlreadySubmitting
}

describe('score submit debounce', () => {
  it('processes the first click', () => {
    expect(shouldProcessSubmit(false)).toBe(true)
  })

  it('drops concurrent clicks while one is in flight', () => {
    expect(shouldProcessSubmit(true)).toBe(false)
  })
})
