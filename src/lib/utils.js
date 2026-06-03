import { ELO_TIERS } from './constants'

/**
 * Merge classnames conditionally
 */
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ')
}

/**
 * Format ELO rating with commas
 */
export const formatElo = (elo) => {
  return Math.round(elo).toLocaleString()
}

/**
 * Get card tier based on ELO rating
 */
export const getCardTier = (elo) => {
  for (const [key, tier] of Object.entries(ELO_TIERS)) {
    if (elo >= tier.min && elo <= tier.max) {
      return key
    }
  }
  return 'bronze'
}

/**
 * Get tier label in Spanish
 */
export const getTierLabel = (elo) => {
  const tier = getCardTier(elo)
  return ELO_TIERS[tier].label
}

/**
 * Format date as "12 Mar"
 */
export const formatDate = (date) => {
  const d = new Date(date)
  const lang = localStorage.getItem('padelzero_lang') || 'es'
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' })
}

/**
 * Format time as "14:30"
 */
export const formatTime = (date) => {
  const d = new Date(date)
  const lang = localStorage.getItem('padelzero_lang') || 'es'
  return d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Format datetime as "12 Mar 14:30"
 */
export const formatDateTime = (date) => {
  return `${formatDate(date)} ${formatTime(date)}`
}

/**
 * Calculate win rate percentage
 */
export const calculateWinRate = (wins, matches) => {
  if (matches === 0) return 0
  return Math.round((wins / matches) * 100)
}

/**
 * Truncate text with ellipsis
 */
export const truncate = (text, max = 20) => {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

/**
 * Generate random ID
 */
export const generateId = () => {
  return Math.random().toString(36).slice(2, 9)
}

/**
 * Sleep utility for delays
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get tier color classes for Tailwind
 */
export const getTierColorClasses = (elo) => {
  const tier = getCardTier(elo)
  const colors = {
    bronze: {
      bg: 'from-zinc-800 to-zinc-700',
      border: 'border-zinc-600',
      text: 'text-zinc-200',
    },
    silver: {
      bg: 'from-slate-600 to-slate-500',
      border: 'border-slate-400',
      text: 'text-slate-100',
    },
    gold: {
      bg: 'from-amber-700 to-yellow-600',
      border: 'border-amber-500',
      text: 'text-yellow-50',
    },
    diamond: {
      bg: 'from-cyan-600 to-blue-500',
      border: 'border-cyan-400',
      text: 'text-cyan-50',
    },
  }
  return colors[tier] || colors.bronze
}

/**
 * Normalize city name: Title Case, trim, collapse spaces
 * "mexico_city" → "Mexico City", "MEXICO CITY" → "Mexico City", "  mexico_city  " → "Mexico City"
 */
export const normalizeCity = (city) => {
  if (!city) return ''
  return city.trim().replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Normalize country name: match against known list, fallback to title case
 */
const KNOWN_COUNTRIES = {
  'mexico': 'México', 'méxico': 'México', 'mx': 'México',
  'españa': 'España', 'spain': 'España', 'es': 'España',
  'argentina': 'Argentina', 'ar': 'Argentina',
  'colombia': 'Colombia', 'co': 'Colombia',
  'chile': 'Chile', 'cl': 'Chile',
  'peru': 'Perú', 'perú': 'Perú', 'pe': 'Perú',
  'estados unidos': 'Estados Unidos', 'united states': 'Estados Unidos', 'usa': 'Estados Unidos', 'us': 'Estados Unidos',
  'venezuela': 'Venezuela', 've': 'Venezuela',
  'ecuador': 'Ecuador', 'ec': 'Ecuador',
  'bolivia': 'Bolivia', 'bo': 'Bolivia',
  'uruguay': 'Uruguay', 'uy': 'Uruguay',
  'paraguay': 'Paraguay', 'py': 'Paraguay',
  'costa rica': 'Costa Rica', 'cr': 'Costa Rica',
  'guatemala': 'Guatemala', 'gt': 'Guatemala',
  'honduras': 'Honduras', 'hn': 'Honduras',
  'el salvador': 'El Salvador', 'sv': 'El Salvador',
  'nicaragua': 'Nicaragua', 'ni': 'Nicaragua',
  'panamá': 'Panamá', 'panama': 'Panamá', 'pa': 'Panamá',
  'cuba': 'Cuba', 'cu': 'Cuba',
  'república dominicana': 'República Dominicana', 'dominican republic': 'República Dominicana', 'do': 'República Dominicana',
  'puerto rico': 'Puerto Rico', 'pr': 'Puerto Rico',
}

export const normalizeCountry = (country) => {
  if (!country) return 'México'
  const key = country.trim().toLowerCase()
  return KNOWN_COUNTRIES[key] || country.trim()
}
