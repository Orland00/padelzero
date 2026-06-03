import { describe, it, expect } from 'vitest'
import { isValidPadelSet, getSetWinner, validateMatchScore, getScoreError } from '../../../src/utils/scoreValidation'

describe('Score Validation', () => {
  describe('isValidPadelSet', () => {
    // Valid scores
    it.each([
      [6, 0], [6, 1], [6, 2], [6, 3], [6, 4],
      [0, 6], [1, 6], [2, 6], [3, 6], [4, 6],
      [7, 5], [5, 7],
      [7, 6], [6, 7],
    ])('accepts valid score %i-%i', (a, b) => {
      expect(isValidPadelSet(a, b)).toBe(true)
    })

    // Invalid scores
    it.each([
      [5, 5], [6, 6], [7, 7],    // ties at high scores
      [6, 5], [5, 6],             // 6-5 is not valid (need tiebreak)
      [7, 4], [4, 7],             // 7-4 not valid
      [8, 6], [6, 8],             // > 7 not valid
      [3, 3], [5, 4], [4, 5],     // neither player reached 6
      [-1, 6], [6, -1],           // negative
    ])('rejects invalid score %i-%i', (a, b) => {
      expect(isValidPadelSet(a, b)).toBe(false)
    })

    it('handles string inputs', () => {
      expect(isValidPadelSet('6', '4')).toBe(true)
      expect(isValidPadelSet('abc', '4')).toBe(false)
    })
  })

  describe('getSetWinner', () => {
    it('returns "a" when player A wins', () => {
      expect(getSetWinner(6, 3)).toBe('a')
      expect(getSetWinner(7, 5)).toBe('a')
      expect(getSetWinner(7, 6)).toBe('a')
    })

    it('returns "b" when player B wins', () => {
      expect(getSetWinner(3, 6)).toBe('b')
      expect(getSetWinner(5, 7)).toBe('b')
    })

    it('returns null for invalid scores', () => {
      expect(getSetWinner(5, 5)).toBeNull()
      expect(getSetWinner(8, 6)).toBeNull()
    })
  })

  describe('validateMatchScore', () => {
    it('accepts valid single set', () => {
      const result = validateMatchScore([{ a: 6, b: 4 }])
      expect(result.valid).toBe(true)
      expect(result.error).toBeNull()
    })

    it('accepts valid multi-set match', () => {
      const result = validateMatchScore([{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 5 }])
      expect(result.valid).toBe(true)
    })

    it('rejects empty sets', () => {
      expect(validateMatchScore([]).valid).toBe(false)
      expect(validateMatchScore(null).valid).toBe(false)
    })

    it('rejects invalid set scores', () => {
      const result = validateMatchScore([{ a: 5, b: 5 }])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Set 1')
    })

    it('rejects negative scores', () => {
      const result = validateMatchScore([{ a: -1, b: 6 }])
      expect(result.valid).toBe(false)
    })

    it('rejects scores > 7', () => {
      const result = validateMatchScore([{ a: 8, b: 6 }])
      expect(result.valid).toBe(false)
    })
  })

  describe('getScoreError', () => {
    it('returns null while typing (empty inputs)', () => {
      expect(getScoreError('', '')).toBeNull()
      expect(getScoreError('6', '')).toBeNull()
    })

    it('returns null for valid scores', () => {
      expect(getScoreError('6', '4')).toBeNull()
      expect(getScoreError('7', '5')).toBeNull()
    })

    it('returns error for non-numeric input', () => {
      expect(getScoreError('abc', '4')).toBe('Solo números')
    })

    it('returns error for negative scores', () => {
      expect(getScoreError('-1', '6')).toBe('No puede ser negativo')
    })

    it('returns error for > 7', () => {
      expect(getScoreError('8', '6')).toBe('Máximo 7')
    })
  })
})
