// ELO Tier Thresholds
export const ELO_TIERS = {
  bronze: { min: 0, max: 1399, label: 'Bronce', color: 'zinc' },
  silver: { min: 1400, max: 1599, label: 'Plata', color: 'slate' },
  gold: { min: 1600, max: 1799, label: 'Oro', color: 'amber' },
  diamond: { min: 1800, max: 3000, label: 'Diamante', color: 'cyan' },
}

// K-factor based on matches played
export const getKFactor = (matchesPlayed) => {
  if (matchesPlayed < 50) return 32
  if (matchesPlayed < 100) return 24
  return 16
}

// Optional public Liga IDs for demo routes.
export const LIGA_FOREVER_ID = import.meta.env?.VITE_LIGA_FOREVER_ID || ''
export const LIGA_PROLEAGUE_ID = import.meta.env?.VITE_LIGA_PROLEAGUE_ID || ''

// Optional public admin user ID for demo/admin UI gates.
export const ADMIN_USER_ID = import.meta.env?.VITE_ADMIN_USER_ID || ''

// Common cities (Latin America + Spain + USA padel hotspots)
export const CITIES = [
  'Mexico City', 'Cancún', 'Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Querétaro',
  'León', 'Tijuana', 'Playa del Carmen', 'San Miguel de Allende', 'Oaxaca', 'Aguascalientes',
  'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga', 'Bilbao',
  'Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza',
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
  'Santiago', 'Viña del Mar', 'Lima', 'Quito', 'Guayaquil',
  'Panamá', 'San José', 'Guatemala City',
  'Miami', 'Houston', 'Los Angeles', 'New York', 'Dallas', 'Austin', 'San Diego', 'Chicago',
  'Otra',
]

// Countries
export const COUNTRIES = [
  'México', 'España', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Venezuela',
  'Ecuador', 'Bolivia', 'Uruguay', 'Paraguay', 'Costa Rica', 'Guatemala',
  'Honduras', 'El Salvador', 'Nicaragua', 'Panamá', 'Cuba', 'República Dominicana',
  'Puerto Rico', 'Estados Unidos', 'Otro',
]

// Gender options
export const GENDERS = [
  { value: 'masculino', label: 'Masc.' },
  { value: 'femenino', label: 'Fem.' },
  { value: 'otro', label: 'Otro' },
]

// Starting ELO for new players
export const DEFAULT_ELO = 1200

// Initial ELO by self-declared level (1-5)
export const LEVEL_ELO = {
  1: 1000, // Principiante
  2: 1100, // Básico
  3: 1200, // Intermedio
  4: 1400, // Avanzado
  5: 1600, // Pro
}

// Minimum ELO floor
export const MIN_ELO = 100

// Match formats
export const MATCH_FORMATS = {
  reta: 'Reta',
  session: 'Sesión',
  tournament: 'Torneo',
}

// Session formats
export const SESSION_FORMATS = {
  round_robin: 'Round Robin',
  liguilla: 'Liguilla',
  single_elimination: 'Eliminación Simple',
  mexicano: 'Mexicano',
}

// Tournament formats
export const TOURNAMENT_FORMATS = {
  single_elimination: 'Eliminación Simple',
  liguilla: 'Liguilla',
  mexicano: 'Mexicano',
}

// Player levels
export const PLAYER_LEVELS = {
  1: 'Principiante',
  2: 'Básico',
  3: 'Intermedio',
  4: 'Avanzado',
  5: 'Pro',
}

// Badge types
export const BADGE_TYPES = {
  veteran_10: 'Veterano (10)',
  veteran_50: 'Veterano (50)',
  first_blood: 'Primera Sangre',
  streak_3: 'Racha de 3',
  streak_5: 'Racha de 5',
  streak_10: 'Racha de 10',
  elo_1400: 'ELO 1400',
  elo_1600: 'ELO 1600',
  elo_1800: 'ELO 1800',
  early_bird: 'Madrugador',
  night_owl: 'Búho Nocturno',
  champion: 'Campeón',
  founder: 'Fundador',
}

// Toast types
export const TOAST_TYPES = {
  success: 'success',
  error: 'error',
  info: 'info',
  warning: 'warning',
  achievement: 'achievement',
}
