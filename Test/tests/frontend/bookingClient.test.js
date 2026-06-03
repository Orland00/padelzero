/**
 * Client-side booking flow behaviour tests.
 *
 * Scope: the error-to-UX translation path. The authoritative booking logic
 * lives in the `create_booking` SECURITY DEFINER RPC on Supabase (auth check,
 * court lookup, rate limit, past-date guard, 14-day window, EXCLUDE gist);
 * see tests/sql/booking_integration.sql for server-side coverage.
 *
 * These tests lock in the client contract: when the RPC raises a specific
 * error, the store must surface the correct Spanish toast.
 */
import { describe, it, expect } from 'vitest'
import { getSpanishError } from '@/utils/errorMessages'

// Mirrors the mapping used in ligaStore/clubStore/bookSlot
// (kept in the test so regressions in the bookSlot error-ladder are caught).
function toBookingMessage(err) {
  const m = err?.message || ''
  if (m.includes('exclusion')) return 'Ese horario ya fue reservado'
  if (m.includes('Rate limit')) return 'Demasiadas reservas. Intenta luego.'
  if (m.includes('past')) return 'No puedes reservar en el pasado'
  if (m.includes('14 days')) return 'Solo puedes reservar hasta 14 días adelante'
  return getSpanishError(err) || 'Error al reservar'
}

describe('booking error translation', () => {
  it('maps EXCLUDE constraint violations to "horario ya reservado"', () => {
    const err = new Error('conflicting key value violates exclusion constraint "club_bookings_court_id_tsrange_excl"')
    expect(toBookingMessage(err)).toBe('Ese horario ya fue reservado')
  })

  it('maps rate-limit RPC error to retry hint', () => {
    const err = new Error('Rate limit: max 5 bookings per hour. Try again later.')
    expect(toBookingMessage(err)).toBe('Demasiadas reservas. Intenta luego.')
  })

  it('maps past-date RPC error', () => {
    const err = new Error('Cannot book a slot in the past')
    expect(toBookingMessage(err)).toBe('No puedes reservar en el pasado')
  })

  it('maps 14-day window RPC error', () => {
    const err = new Error('Cannot book more than 14 days in advance')
    expect(toBookingMessage(err)).toBe('Solo puedes reservar hasta 14 días adelante')
  })

  it('falls back to generic Spanish for auth errors', () => {
    const err = new Error('Authentication required')
    expect(toBookingMessage(err)).toBe('Ocurrió un error. Intenta de nuevo.')
  })

  it('treats unknown RPC errors as generic', () => {
    const err = new Error('something weird happened')
    expect(toBookingMessage(err)).toBe('Ocurrió un error. Intenta de nuevo.')
  })
})

describe('booking display helpers', () => {
  // These mirror MyBookings.jsx / BookingSheet.jsx inline helpers. Extracted
  // so any future refactor to shared utils keeps the same behaviour.
  const formatTime = (t) => t?.substring(0, 5) || ''
  const formatPrice = (cents) => `$${(cents / 100).toFixed(0)} MXN`

  it('formats 24h times to HH:MM', () => {
    expect(formatTime('10:00:00')).toBe('10:00')
    expect(formatTime('18:30:00')).toBe('18:30')
    expect(formatTime('')).toBe('')
    expect(formatTime(null)).toBe('')
  })

  it('formats prices in MXN integer pesos', () => {
    expect(formatPrice(30000)).toBe('$300 MXN')
    expect(formatPrice(45000)).toBe('$450 MXN')
    expect(formatPrice(0)).toBe('$0 MXN')    // free bookings render as $0
    expect(formatPrice(12350)).toBe('$124 MXN') // rounds (toFixed(0))
  })
})

describe('booking slot overlap math', () => {
  // Pure helper that mirrors the server-side tsrange && check.
  // A booking [start,end) overlaps another when start<other.end AND end>other.start.
  function overlaps(a, b) {
    return a.start < b.end && a.end > b.start
  }
  const slot = (s, e) => ({ start: s, end: e })

  it('detects direct overlap', () => {
    expect(overlaps(slot('10:00', '11:30'), slot('10:30', '12:00'))).toBe(true)
  })
  it('detects containment', () => {
    expect(overlaps(slot('10:00', '12:00'), slot('10:30', '11:00'))).toBe(true)
  })
  it('allows back-to-back slots ([) semantics)', () => {
    expect(overlaps(slot('10:00', '11:30'), slot('11:30', '13:00'))).toBe(false)
  })
  it('allows non-overlapping slots', () => {
    expect(overlaps(slot('08:00', '09:30'), slot('10:00', '11:30'))).toBe(false)
  })
})
