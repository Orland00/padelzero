import { describe, expect, it } from 'vitest'
import {
  formatDateSafe,
  formatDisplayName,
  formatRelativeTime,
  formatShortDate,
  formatTimeSafe,
  isValidDateInput,
} from '@/utils/dateFormatters'

describe('date fallback helpers', () => {
  it('formats display names with a safe fallback', () => {
    expect(formatDisplayName('  Ana  ')).toBe('Ana')
    expect(formatDisplayName('', 'Sin nombre')).toBe('Sin nombre')
    expect(formatDisplayName(null, 'Sin nombre')).toBe('Sin nombre')
  })

  it('guards invalid dates instead of leaking Invalid Date', () => {
    expect(isValidDateInput('not-a-date')).toBe(false)
    expect(formatDateSafe('not-a-date')).toBe('Fecha pendiente')
    expect(formatTimeSafe('not-a-date')).toBe('Hora pendiente')
    expect(formatShortDate('not-a-date')).toBe('Fecha pendiente')
    expect(formatRelativeTime('not-a-date')).toBe('')
  })

  it('formats valid dates', () => {
    const date = '2026-05-28T12:30:00Z'
    expect(formatDateSafe(date, { year: 'numeric' }, 'Fecha pendiente')).not.toBe('Fecha pendiente')
    expect(formatTimeSafe(date, { hour: '2-digit', minute: '2-digit' }, 'Hora pendiente')).not.toBe('Hora pendiente')
  })
})
