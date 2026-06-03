import { describe, it, expect } from 'vitest'
import { calculateMatchEloChanges } from '../../../mcp/lib/elo.js'

describe('ELO Calculation', () => {
  const playerData = {
    'p1': { elo: 1200, matches_played: 10 },
    'p2': { elo: 1200, matches_played: 10 },
    'p3': { elo: 1200, matches_played: 10 },
    'p4': { elo: 1200, matches_played: 10 },
  }

  it('calculates equal changes for equal ratings', () => {
    const changes = calculateMatchEloChanges({
      teamAPlayer1: 'p1', teamAPlayer2: 'p2',
      teamBPlayer1: 'p3', teamBPlayer2: 'p4',
      scoreTeamA: 6, scoreTeamB: 4,
      playerData
    })

    expect(changes).toHaveLength(4)
    const p1Change = changes.find(c => c.playerId === 'p1')
    const p3Change = changes.find(c => c.playerId === 'p3')

    expect(p1Change.delta).toBeGreaterThan(0)
    expect(p3Change.delta).toBeLessThan(0)
    expect(p1Change.delta).toBe(Math.abs(p3Change.delta))
  })

  it('handles draws by returning zero deltas', () => {
    const changes = calculateMatchEloChanges({
      teamAPlayer1: 'p1', teamAPlayer2: 'p2',
      teamBPlayer1: 'p3', teamBPlayer2: 'p4',
      scoreTeamA: 6, scoreTeamB: 6,
      playerData
    })

    changes.forEach(c => {
      expect(c.delta).toBe(0)
      expect(c.newElo).toBe(c.oldElo)
    })
  })

  it('applies higher K-factor for new players', () => {
    const mixedPlayerData = {
      'new': { elo: 1200, matches_played: 5 }, // K = 40
      'old': { elo: 1200, matches_played: 25 }, // K = 32
      'p3': { elo: 1200, matches_played: 10 },
      'p4': { elo: 1200, matches_played: 10 },
    }

    const changes = calculateMatchEloChanges({
      teamAPlayer1: 'new', teamAPlayer2: 'old',
      teamBPlayer1: 'p3', teamBPlayer2: 'p4',
      scoreTeamA: 6, scoreTeamB: 4,
      playerData: mixedPlayerData
    })

    const newChange = changes.find(c => c.playerId === 'new')
    const oldChange = changes.find(c => c.playerId === 'old')

    expect(newChange.delta).toBeGreaterThan(oldChange.delta)
  })

  it('awards fewer points when beating much weaker opponents', () => {
    const unevenPlayerData = {
      'strong1': { elo: 2000, matches_played: 50 },
      'strong2': { elo: 2000, matches_played: 50 },
      'weak1': { elo: 1000, matches_played: 50 },
      'weak2': { elo: 1000, matches_played: 50 },
    }

    const changes = calculateMatchEloChanges({
      teamAPlayer1: 'strong1', teamAPlayer2: 'strong2',
      teamBPlayer1: 'weak1', teamBPlayer2: 'weak2',
      scoreTeamA: 6, scoreTeamB: 0,
      playerData: unevenPlayerData
    })

    const strongChange = changes.find(c => c.playerId === 'strong1')
    expect(strongChange.delta).toBeLessThan(5) // Should be very small
  })

  it('awards many points when weak team beats strong team', () => {
    const unevenPlayerData = {
      'strong1': { elo: 2000, matches_played: 50 },
      'strong2': { elo: 2000, matches_played: 50 },
      'weak1': { elo: 1000, matches_played: 50 },
      'weak2': { elo: 1000, matches_played: 50 },
    }

    const changes = calculateMatchEloChanges({
      teamAPlayer1: 'weak1', teamAPlayer2: 'weak2',
      teamBPlayer1: 'strong1', teamBPlayer2: 'strong2',
      scoreTeamA: 6, scoreTeamB: 4,
      playerData: unevenPlayerData
    })

    const weakChange = changes.find(c => c.playerId === 'weak1')
    expect(weakChange.delta).toBeGreaterThan(25) // Should be large
  })

  it('enforces floor of 800 for ELO', () => {
    const lowEloData = {
      'p1': { elo: 810, matches_played: 50 },
      'p2': { elo: 810, matches_played: 50 },
      'p3': { elo: 810, matches_played: 50 },
      'p4': { elo: 810, matches_played: 50 },
    }

    const changes = calculateMatchEloChanges({
      teamAPlayer1: 'p1', teamAPlayer2: 'p2',
      teamBPlayer1: 'p3', teamBPlayer2: 'p4',
      scoreTeamA: 0, scoreTeamB: 6,
      playerData: lowEloData
    })

    const p1Change = changes.find(c => c.playerId === 'p1')
    expect(p1Change.newElo).toBe(800)
    expect(p1Change.delta).toBeLessThan(0)
  })
})
