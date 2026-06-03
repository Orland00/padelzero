/**
 * Unit tests for the HaveIBeenPwned k-anonymity helper.
 *
 * Network side-effects are mocked; these tests lock the response-parsing +
 * fail-open behaviour the signup flow relies on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findBreachCount, checkPasswordPwned } from '@/lib/pwnedPasswordCheck'

describe('findBreachCount (HIBP response parser)', () => {
  it('returns the breach count for a matching suffix', () => {
    const body = [
      '1E4C9B93F3F0682250B6CF8331B7EE68FD8:4',   // not ours
      '2AC9CB7DC02B3C0083EB70898E549B63:123',    // ours (example)
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:7',
    ].join('\n')
    expect(findBreachCount(body, '2AC9CB7DC02B3C0083EB70898E549B63')).toBe(123)
  })

  it('returns 0 when no line matches the suffix', () => {
    const body = 'ABCDEF1234567890ABCDEF1234567890ABC:42\n'
    expect(findBreachCount(body, '0000000000000000000000000000000')).toBe(0)
  })

  it('ignores padding rows (count=0)', () => {
    // API with Add-Padding: true returns filler rows; they must not produce matches
    const suffix = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
    const body = `${suffix}:0`
    expect(findBreachCount(body, suffix)).toBe(0)
  })

  it('is case-insensitive on suffix comparison', () => {
    const body = 'abc0000000000000000000000000000000f:9'
    expect(findBreachCount(body, 'ABC0000000000000000000000000000000F')).toBe(9)
  })

  it('handles CRLF line endings', () => {
    const body = 'AAA0000000000000000000000000000000F:5\r\nBBB000000000000000000000000000000AA:2\r\n'
    expect(findBreachCount(body, 'BBB000000000000000000000000000000AA')).toBe(2)
  })

  it('returns 0 on empty input', () => {
    expect(findBreachCount('', 'ABCDE')).toBe(0)
    expect(findBreachCount(null, 'ABCDE')).toBe(0)
  })
})

describe('checkPasswordPwned (live-ish behaviour with stubbed fetch)', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns pwned=true and the count when the suffix is present', async () => {
    // SHA-1 of 'password' is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // Prefix: 5BAA6  Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    globalThis.fetch = vi.fn(async (url) => {
      expect(String(url)).toBe('https://api.pwnedpasswords.com/range/5BAA6')
      return {
        ok: true,
        text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365\nOTHER:3\n',
      }
    })
    const result = await checkPasswordPwned('password')
    expect(result.pwned).toBe(true)
    expect(result.count).toBeGreaterThan(0)
    expect(result.checked).toBe(true)
  })

  it('returns pwned=false when the suffix is absent', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => 'ABCDEF1234567890ABCDEF1234567890ABC:42\n',
    }))
    const result = await checkPasswordPwned('almost-certainly-not-in-breach-corpora-a8sb39d')
    expect(result.pwned).toBe(false)
    expect(result.count).toBe(0)
    expect(result.checked).toBe(true)
  })

  it('fails open (checked=false) if fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('net down') })
    const result = await checkPasswordPwned('whatever')
    expect(result.pwned).toBe(false)
    expect(result.checked).toBe(false)
  })

  it('fails open on non-2xx response', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, text: async () => '' }))
    const result = await checkPasswordPwned('whatever')
    expect(result.pwned).toBe(false)
    expect(result.checked).toBe(false)
  })

  it('does nothing for empty or non-string input', async () => {
    const a = await checkPasswordPwned('')
    const b = await checkPasswordPwned(undefined)
    const c = await checkPasswordPwned(null)
    for (const r of [a, b, c]) {
      expect(r.pwned).toBe(false)
      expect(r.count).toBe(0)
      expect(r.checked).toBe(true)
    }
  })
})
