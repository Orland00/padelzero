import { getLang } from '@/lib/i18n'

function getLocale() {
  return getLang() === 'en' ? 'en-US' : 'es-ES'
}

export function isValidDateInput(date) {
  if (!date) return false
  const parsed = new Date(date)
  return !Number.isNaN(parsed.getTime())
}

export function formatDisplayName(name, fallback = 'Jugador sin nombre') {
  if (typeof name !== 'string') return fallback
  const trimmed = name.trim()
  return trimmed || fallback
}

export function formatDateSafe(date, options = {}, fallback = 'Fecha pendiente') {
  if (!isValidDateInput(date)) return fallback
  return new Date(date).toLocaleDateString(getLocale(), options)
}

export function formatTimeSafe(date, options = {}, fallback = 'Hora pendiente') {
  if (!isValidDateInput(date)) return fallback
  return new Date(date).toLocaleTimeString(getLocale(), options)
}

/**
 * Format a date as a relative time string
 * Language-aware: respects current i18n setting
 */
export function formatRelativeTime(date) {
  if (!isValidDateInput(date)) return ''

  const lang = getLang()
  const now = new Date()
  const then = new Date(date)
  const diffMs = now - then
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (lang === 'en') {
    if (diffSecs < 60) return 'just now'
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
    if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`
    if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
    return 'a year ago'
  }

  if (diffSecs < 60) return 'ahora mismo'
  if (diffMins < 60) return `hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`
  if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`
  if (diffDays < 7) return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`
  if (diffWeeks < 4) return `hace ${diffWeeks} ${diffWeeks === 1 ? 'semana' : 'semanas'}`
  if (diffMonths < 12) return `hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`
  return 'hace un año'
}

/**
 * Format date as short date string
 * e.g., "21 mar" / "Mar 21"
 */
export function formatShortDate(date) {
  return formatDateSafe(date, {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Format date with time
 * e.g., "21 mar, 14:30"
 */
export function formatDateWithTime(date) {
  return formatDateSafe(date, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
