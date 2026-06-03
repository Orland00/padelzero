/**
 * Maps Supabase/network error codes to Spanish user-facing messages.
 * Import and use: getSpanishError(err) → string
 */

const ERROR_MAP = {
  'PGRST301': 'No tienes permiso para esta acción.',
  'PGRST116': 'No se encontró el recurso.',
  'PGRST204': 'Sin resultados.',
  '23505': 'Este registro ya existe.',
  '23503': 'Referencia inválida — verifica los datos.',
  '42501': 'No tienes permiso para esta acción.',
  '42P01': 'Error interno del sistema.',
  'DUPLICATE_MATCH': 'Este partido ya fue registrado.',
  'Failed to fetch': 'Sin conexión. Intenta de nuevo.',
  'NetworkError': 'Sin conexión. Intenta de nuevo.',
  'TypeError: Failed to fetch': 'Sin conexión. Intenta de nuevo.',
  'FetchError': 'Sin conexión. Intenta de nuevo.',
  'JWT expired': 'Tu sesión expiró. Inicia sesión de nuevo.',
  'invalid_grant': 'Credenciales inválidas.',
  'User not found': 'Usuario no encontrado.',
  'Email not confirmed': 'Confirma tu email antes de iniciar sesión.',
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'rate_limit': 'Demasiados intentos. Espera un momento.',
}

export function getSpanishError(error) {
  if (!error) return 'Ocurrió un error. Intenta de nuevo.'

  // Handle different error shapes
  const messages = [
    error.code,
    error.message,
    error?.error?.message,
    typeof error === 'string' ? error : null,
    String(error),
  ].filter(Boolean)

  for (const msg of messages) {
    for (const [key, spanish] of Object.entries(ERROR_MAP)) {
      if (msg.includes(key)) return spanish
    }
  }

  return 'Ocurrió un error. Intenta de nuevo.'
}
