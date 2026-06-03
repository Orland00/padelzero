import { describe, it, expect } from 'vitest'
import {
  generateAmericanoRounds,
  generateAmericanoSchedule,
  calculateRounds,
  calculateJornadaPoints,
  calculateJornadaPointsAlternative,
  calculateByePoints,
  validateRounds,
} from '@/utils/americanoEngine'

const makeIds = n => Array.from({ length: n }, (_, i) => `p${i + 1}`)

// ─── generateAmericanoRounds ───────────────────────────────────────

describe('generateAmericanoRounds – 8 players', () => {
  const rounds = generateAmericanoRounds(makeIds(8))

  it('produces 7 rounds', () => { expect(rounds).toHaveLength(7) })
  it('produces 2 matches per round', () => { rounds.forEach(r => expect(r.matches).toHaveLength(2)) })
  it('no byes', () => { rounds.forEach(r => expect(r.bye).toBeNull()) })

  it('round objects have correct shape', () => {
    const r = rounds[0]
    expect(r).toHaveProperty('round', 1)
    expect(r).toHaveProperty('matches')
    expect(r).toHaveProperty('bye')
    expect(r.matches[0]).toHaveProperty('court')
    expect(r.matches[0]).toHaveProperty('teamA')
    expect(r.matches[0]).toHaveProperty('teamB')
  })

  it('assigns court numbers starting from 1', () => {
    rounds.forEach(round => {
      round.matches.forEach((m, i) => expect(m.court).toBe(i + 1))
    })
  })

  it('each match has exactly 4 players (2v2)', () => {
    rounds.forEach(round => {
      round.matches.forEach(m => {
        expect(m.teamA).toHaveLength(2)
        expect(m.teamB).toHaveLength(2)
      })
    })
  })
})

describe('generateAmericanoRounds – 5 players (odd)', () => {
  const rounds = generateAmericanoRounds(makeIds(5))

  it('produces 5 rounds', () => { expect(rounds).toHaveLength(5) })
  it('produces 1 match per round', () => { rounds.forEach(r => expect(r.matches).toHaveLength(1)) })
  it('has one bye per round', () => { rounds.forEach(r => { expect(r.bye).not.toBeNull(); expect(typeof r.bye).toBe('string') }) })

  it('H2: every player gets at least one bye across the schedule', () => {
    const ids = makeIds(5)
    const byes = new Set(generateAmericanoRounds(ids).map(r => r.bye))
    ids.forEach(p => expect(byes.has(p)).toBe(true))
  })
})

describe('generateAmericanoRounds – 4 players', () => {
  const rounds = generateAmericanoRounds(makeIds(4))
  it('produces 3 rounds', () => { expect(rounds).toHaveLength(3) })
  it('no byes', () => { rounds.forEach(r => expect(r.bye).toBeNull()) })
})

describe('generateAmericanoRounds – maxRounds cap', () => {
  it('caps at 3 for 8 players with maxRounds=3', () => {
    expect(generateAmericanoRounds(makeIds(8), 3)).toHaveLength(3)
  })
  it('does not exceed natural round count when cap is higher', () => {
    expect(generateAmericanoRounds(makeIds(4), 100)).toHaveLength(3)
  })
  it('H3: maxRounds=0 returns empty schedule', () => {
    expect(generateAmericanoRounds(makeIds(6), 0)).toHaveLength(0)
  })
})

// ─── validateRounds ────────────────────────────────────────────────

describe('validateRounds – no duplicate players per round', () => {
  it.each([8, 5, 4])('%i players produce valid rounds', (n) => {
    const result = validateRounds(generateAmericanoRounds(makeIds(n)), n)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe('bye player not in matches', () => {
  it('5-player bye player never appears in match of same round', () => {
    generateAmericanoRounds(makeIds(5)).forEach(round => {
      if (!round.bye) return
      const matchPlayers = round.matches.flatMap(m => [...m.teamA, ...m.teamB])
      expect(matchPlayers).not.toContain(round.bye)
    })
  })
})

// ─── calculateRounds ───────────────────────────────────────────────

describe('calculateRounds', () => {
  it('8 players → 7 rounds, 105 min, no note', () => {
    const r = calculateRounds(8)
    expect(r.recommendedRounds).toBe(7)
    expect(r.estimatedMinutes).toBe(105)
    expect(r.note).toBeNull()
  })

  it('8 players with maxRounds=4 → 4 rounds, 60 min, includes note', () => {
    const r = calculateRounds(8, 4)
    expect(r.recommendedRounds).toBe(4)
    expect(r.estimatedMinutes).toBe(60)
    expect(r.note).not.toBeNull()
    expect(typeof r.note).toBe('string')
  })

  it('large player count (12) produces a warning note', () => {
    const r = calculateRounds(12)
    expect(r.recommendedRounds).toBe(11)
    expect(r.note).not.toBeNull()
  })
})

// ─── calculateJornadaPoints ────────────────────────────────────────

describe('calculateJornadaPoints', () => {
  const match = {
    team_a_player1: 'p1', team_a_player2: 'p2',
    team_b_player1: 'p3', team_b_player2: 'p4',
    score_team_a: 21, score_team_b: 15,
  }

  it('winners get their team score, losers get 0', () => {
    const pts = calculateJornadaPoints([match])
    expect(pts['p1']).toBe(21)
    expect(pts['p2']).toBe(21)
    expect(pts['p3']).toBe(0)
    expect(pts['p4']).toBe(0)
  })

  it('draw — both teams get their score', () => {
    const drawMatch = { ...match, score_team_a: 15, score_team_b: 15 }
    const pts = calculateJornadaPoints([drawMatch])
    expect(pts['p1']).toBe(15)
    expect(pts['p3']).toBe(15)
  })

  it('accumulates points across multiple matches', () => {
    const matches = [
      { team_a_player1: 'p1', team_a_player2: 'p2', team_b_player1: 'p3', team_b_player2: 'p4', score_team_a: 21, score_team_b: 15 },
      { team_a_player1: 'p1', team_a_player2: 'p3', team_b_player1: 'p2', team_b_player2: 'p4', score_team_a: 18, score_team_b: 21 },
    ]
    const pts = calculateJornadaPoints(matches)
    expect(pts['p1']).toBe(21) // won first (21), lost second (0)
    expect(pts['p2']).toBe(42) // won first (21) + won second (21)
  })
})

// ─── calculateJornadaPointsAlternative ───────────────────────────

describe('calculateJornadaPointsAlternative', () => {
  const match = {
    team_a_player1: 'p1', team_a_player2: 'p2',
    team_b_player1: 'p3', team_b_player2: 'p4',
    score_team_a: 21, score_team_b: 15,
  }

  it('winners get 3, losers get 0 (default config)', () => {
    const pts = calculateJornadaPointsAlternative([match])
    expect(pts['p1']).toBe(3)
    expect(pts['p3']).toBe(0)
  })

  it('draw gives 1 point each', () => {
    const drawMatch = { ...match, score_team_a: 15, score_team_b: 15 }
    const pts = calculateJornadaPointsAlternative([drawMatch])
    expect(pts['p1']).toBe(1)
    expect(pts['p3']).toBe(1)
  })

  it('respects custom pointConfig (win:2, draw:0, loss:0)', () => {
    const pts = calculateJornadaPointsAlternative([match], { win: 2, draw: 0, loss: 0 })
    expect(pts['p1']).toBe(2)
    expect(pts['p3']).toBe(0)
  })

  it('respects custom pointConfig with non-zero loss', () => {
    const pts = calculateJornadaPointsAlternative([match], { win: 5, draw: 2, loss: 1 })
    expect(pts['p1']).toBe(5)
    expect(pts['p3']).toBe(1)
  })
})

// ─── calculateByePoints ───────────────────────────────────────────

describe('calculateByePoints', () => {
  it('returns rounded average of all scores in round', () => {
    // (21+15+18+12)/4 = 16.5 → 17
    expect(calculateByePoints([
      { score_team_a: 21, score_team_b: 15 },
      { score_team_a: 18, score_team_b: 12 },
    ])).toBe(17)
  })

  it('returns 0 for empty round', () => { expect(calculateByePoints([])).toBe(0) })

  it('handles a single match', () => {
    expect(calculateByePoints([{ score_team_a: 20, score_team_b: 10 }])).toBe(15)
  })

  it('handles missing score_team_b as 0', () => {
    expect(calculateByePoints([{ score_team_a: 20 }])).toBe(10)
  })
})

// ─── generateAmericanoSchedule ────────────────────────────────────

describe('generateAmericanoSchedule', () => {
  const players = [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
    { id: 'p3', name: 'Carlos' },
    { id: 'p4', name: 'Diana' },
  ]

  it('returns correct metadata shape', () => {
    const s = generateAmericanoSchedule(players)
    expect(s).toHaveProperty('rounds')
    expect(s).toHaveProperty('rawRounds')
    expect(s).toHaveProperty('totalRounds')
    expect(s).toHaveProperty('playerCount', 4)
    expect(s).toHaveProperty('hasOdd', false)
  })

  it('populates teamANames and teamBNames with player names', () => {
    const names = ['Alice', 'Bob', 'Carlos', 'Diana']
    generateAmericanoSchedule(players).rounds.forEach(round => {
      round.matches.forEach(m => {
        m.teamANames.forEach(n => expect(names).toContain(n))
        m.teamBNames.forEach(n => expect(names).toContain(n))
      })
    })
  })

  it('adds byeName for odd player count', () => {
    const odd = [...players, { id: 'p5', name: 'Ernesto' }]
    const s = generateAmericanoSchedule(odd)
    expect(s.hasOdd).toBe(true)
    s.rounds.forEach(r => expect(['Alice', 'Bob', 'Carlos', 'Diana', 'Ernesto']).toContain(r.byeName))
  })

  it('respects maxRounds param', () => {
    const s = generateAmericanoSchedule(players, 2)
    expect(s.totalRounds).toBe(2)
    expect(s.rounds).toHaveLength(2)
  })
})
