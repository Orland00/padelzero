// Tests for bracketEngine — snake-draft level-balanced bracket generation
// Updated: 2026-05-08
import { describe, it, expect } from 'vitest'
import { generateBalancedBracket, assignByes } from '../../../src/utils/bracketEngine'

describe('generateBalancedBracket', () => {
  const make = (id, level) => ({ id, level })

  it('distributes 4 players into 2 balanced pairs', () => {
    // Level desc: [4.0, 3.0, 2.0, 1.0]
    // Snake: pair 0→[4.0, 1.0] avg 2.5, pair 1→[3.0, 2.0] avg 2.5
    const players = [
      make('a', 4.0), make('b', 3.0), make('c', 2.0), make('d', 1.0)
    ]
    const { pairs } = generateBalancedBracket(players)
    expect(pairs).toHaveLength(2)
    const avgA = (pairs[0][0].level + pairs[0][1].level) / 2
    const avgB = (pairs[1][0].level + pairs[1][1].level) / 2
    expect(Math.abs(avgA - avgB)).toBeLessThanOrEqual(0.1)
  })

  it('returns byes for odd player count', () => {
    const players = [make('a', 3.0), make('b', 2.0), make('c', 1.0)]
    const { pairs, byes } = generateBalancedBracket(players)
    expect(byes).toHaveLength(1)
    expect(pairs).toHaveLength(1)
  })

  it('handles 8 players — 4 balanced pairs', () => {
    const players = Array.from({ length: 8 }, (_, i) =>
      make(`p${i}`, 4.0 - i * 0.5)
    )
    const { pairs } = generateBalancedBracket(players)
    expect(pairs).toHaveLength(4)
    const avgs = pairs.map(p => (p[0].level + p[1].level) / 2)
    const maxDiff = Math.max(...avgs) - Math.min(...avgs)
    expect(maxDiff).toBeLessThanOrEqual(0.5)
  })

  it('handles 2 players — 1 pair, 0 byes', () => {
    const players = [make('a', 3.5), make('b', 2.5)]
    const { pairs, byes } = generateBalancedBracket(players)
    expect(pairs).toHaveLength(1)
    expect(byes).toHaveLength(0)
  })

  it('throws for empty or 1 player', () => {
    expect(() => generateBalancedBracket([])).toThrow()
    expect(() => generateBalancedBracket([make('a', 2.0)])).toThrow()
  })
})

describe('assignByes', () => {
  it('assigns round 2 to bye players', () => {
    const byes = [{ id: 'a', level: 1.0 }]
    const result = assignByes(byes)
    expect(result[0].round).toBe(2)
    expect(result[0].player.id).toBe('a')
  })
})
