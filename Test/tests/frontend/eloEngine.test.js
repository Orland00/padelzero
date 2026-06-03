import { describe, it, expect } from 'vitest'
import { calculateDoublesElo, calculateMatchEloChanges } from '@/utils/eloEngine'

const player = (elo, matches_played) => ({ elo, matches_played })

// ─── calculateDoublesElo ───────────────────────────────────────────

describe('calculateDoublesElo', () => {
  it('equal teams (1200 vs 1200) — winner +16, loser -16', () => {
    const result = calculateDoublesElo({
      winner1: player(1200, 20),
      winner2: player(1200, 20),
      loser1:  player(1200, 20),
      loser2:  player(1200, 20),
    })
    expect(result.winner1Delta).toBe(16)
    expect(result.winner2Delta).toBe(16)
    expect(result.loser1Delta).toBe(-16)
    expect(result.loser2Delta).toBe(-16)
    expect(result.winnerGain).toBe(16)
    expect(result.loserLoss).toBe(-16)
    expect(result.expectedWin).toBe(50)
  })

  it('upset win — 1000 beats 1400 — larger delta than equal match', () => {
    const result = calculateDoublesElo({
      winner1: player(1000, 20),
      winner2: player(1000, 20),
      loser1:  player(1400, 20),
      loser2:  player(1400, 20),
    })
    expect(result.winner1Delta).toBe(29)
    expect(result.loser1Delta).toBe(-29)
    expect(result.winner1Delta).toBeGreaterThan(16)
    expect(result.expectedWin).toBeLessThan(50)
  })

  it('K-factor — new player (<20 matches) K=40, veteran (>=20) K=32', () => {
    const newPlayer = calculateDoublesElo({
      winner1: player(1200, 10),
      winner2: player(1200, 10),
      loser1:  player(1200, 10),
      loser2:  player(1200, 10),
    })
    expect(newPlayer.winner1Delta).toBe(20)

    const veteran = calculateDoublesElo({
      winner1: player(1200, 20),
      winner2: player(1200, 20),
      loser1:  player(1200, 20),
      loser2:  player(1200, 20),
    })
    expect(veteran.winner1Delta).toBe(16)

    // Mixed team: one new, one veteran
    const mixed = calculateDoublesElo({
      winner1: player(1200, 5),
      winner2: player(1200, 25),
      loser1:  player(1200, 20),
      loser2:  player(1200, 20),
    })
    expect(mixed.winner1Delta).toBe(20)
    expect(mixed.winner2Delta).toBe(16)
  })

  it('winnerGain and loserLoss are team averages', () => {
    const result = calculateDoublesElo({
      winner1: player(1200, 25),
      winner2: player(1200, 25),
      loser1:  player(1200, 25),
      loser2:  player(1200, 25),
    })
    expect(result.winnerGain).toBe(Math.round((result.winner1Delta + result.winner2Delta) / 2))
    expect(result.loserLoss).toBe(Math.round((result.loser1Delta + result.loser2Delta) / 2))
  })

  it('symmetry — net delta across all 4 players is within rounding (±4)', () => {
    const result = calculateDoublesElo({
      winner1: player(1300, 30),
      winner2: player(1100, 30),
      loser1:  player(1250, 30),
      loser2:  player(950,  30),
    })
    const total = result.winner1Delta + result.winner2Delta + result.loser1Delta + result.loser2Delta
    expect(Math.abs(total)).toBeLessThanOrEqual(4)
    expect(result.winner1Delta).toBeGreaterThan(0)
    expect(result.loser1Delta).toBeLessThan(0)
  })

  it('high ELO (1800) vs low (800) — delta rounds to 0 for already-dominant team', () => {
    const result = calculateDoublesElo({
      winner1: player(1800, 30),
      winner2: player(1800, 30),
      loser1:  player(800, 30),
      loser2:  player(800, 30),
    })
    expect(Math.abs(result.winner1Delta)).toBe(0)
    expect(Math.abs(result.loser1Delta)).toBe(0)
    expect(result.expectedWin).toBe(100)
  })
})

// ─── calculateMatchEloChanges ──────────────────────────────────────

describe('calculateMatchEloChanges', () => {
  const basePlayerData = {
    p1: { elo: 1200, matches_played: 20 },
    p2: { elo: 1200, matches_played: 20 },
    p3: { elo: 1200, matches_played: 20 },
    p4: { elo: 1200, matches_played: 20 },
  }

  it('returns correct shape for all 4 players', () => {
    const result = calculateMatchEloChanges({
      teamAPlayer1: 'p1', teamAPlayer2: 'p2',
      teamBPlayer1: 'p3', teamBPlayer2: 'p4',
      scoreTeamA: 6, scoreTeamB: 3,
      playerData: basePlayerData,
    })
    expect(result).toHaveLength(4)
    for (const r of result) {
      expect(r).toHaveProperty('playerId')
      expect(r).toHaveProperty('oldElo')
      expect(r).toHaveProperty('newElo')
      expect(r).toHaveProperty('delta')
      expect(r.newElo).toBe(Math.max(800, r.oldElo + r.delta))
    }
  })

  it('draw — all deltas = 0', () => {
    const result = calculateMatchEloChanges({
      teamAPlayer1: 'p1', teamAPlayer2: 'p2',
      teamBPlayer1: 'p3', teamBPlayer2: 'p4',
      scoreTeamA: 3, scoreTeamB: 3,
      playerData: basePlayerData,
    })
    result.forEach(r => { expect(r.delta).toBe(0); expect(r.newElo).toBe(r.oldElo) })
  })

  it('team A wins — A players gain, B players lose', () => {
    const result = calculateMatchEloChanges({
      teamAPlayer1: 'p1', teamAPlayer2: 'p2',
      teamBPlayer1: 'p3', teamBPlayer2: 'p4',
      scoreTeamA: 6, scoreTeamB: 3,
      playerData: basePlayerData,
    })
    const p1 = result.find(r => r.playerId === 'p1')
    const p3 = result.find(r => r.playerId === 'p3')
    expect(p1.delta).toBeGreaterThan(0)
    expect(p3.delta).toBeLessThan(0)
    const winners = result.filter(r => r.delta > 0)
    const losers  = result.filter(r => r.delta < 0)
    expect(winners).toHaveLength(2)
    expect(losers).toHaveLength(2)
  })

  it('team B wins — B players gain, A players lose', () => {
    const result = calculateMatchEloChanges({
      teamAPlayer1: 'p1', teamAPlayer2: 'p2',
      teamBPlayer1: 'p3', teamBPlayer2: 'p4',
      scoreTeamA: 2, scoreTeamB: 6,
      playerData: basePlayerData,
    })
    const p1 = result.find(r => r.playerId === 'p1')
    const p3 = result.find(r => r.playerId === 'p3')
    expect(p3.delta).toBeGreaterThan(0)
    expect(p1.delta).toBeLessThan(0)
  })

  it('floor 800 — loser near 800 cannot drop below 800', () => {
    const playerData = {
      p1: { elo: 805,  matches_played: 20 },
      p2: { elo: 1200, matches_played: 20 },
      p3: { elo: 1200, matches_played: 20 },
      p4: { elo: 1200, matches_played: 20 },
    }
    const result = calculateMatchEloChanges({
      teamAPlayer1: 'p3', teamAPlayer2: 'p4',
      teamBPlayer1: 'p1', teamBPlayer2: 'p2',
      scoreTeamA: 6, scoreTeamB: 0,
      playerData,
    })
    const p1result = result.find(r => r.playerId === 'p1')
    expect(p1result.newElo).toBeGreaterThanOrEqual(800)
    expect(p1result.newElo).toBe(800)
  })

  it('floor 800 — new player (K=40) at 808 cannot drop below 800', () => {
    const playerData = {
      p1: { elo: 808, matches_played: 5 },
      p2: { elo: 1200, matches_played: 20 },
      p3: { elo: 1200, matches_played: 20 },
      p4: { elo: 1200, matches_played: 20 },
    }
    const result = calculateMatchEloChanges({
      teamAPlayer1: 'p3', teamAPlayer2: 'p4',
      teamBPlayer1: 'p1', teamBPlayer2: 'p2',
      scoreTeamA: 6, scoreTeamB: 0,
      playerData,
    })
    expect(result.find(r => r.playerId === 'p1').newElo).toBeGreaterThanOrEqual(800)
  })
})
