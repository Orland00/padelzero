/**
 * Padel Score Validation
 * Valid padel sets: 6-0 through 6-4, 7-5, 7-6 (tiebreak)
 */

export function isValidPadelSet(scoreA, scoreB) {
  const a = parseInt(scoreA, 10)
  const b = parseInt(scoreB, 10)
  if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return false
  if (a > 7 || b > 7) return false
  // 7-5 or 7-6 (tiebreak scenarios)
  if (a === 7 && (b === 5 || b === 6)) return true
  if (b === 7 && (a === 5 || a === 6)) return true
  // 6-X where X <= 4
  if (a === 6 && b <= 4) return true
  if (b === 6 && a <= 4) return true
  return false
}

export function getSetWinner(scoreA, scoreB) {
  const a = parseInt(scoreA, 10)
  const b = parseInt(scoreB, 10)
  if (!isValidPadelSet(a, b)) return null
  return a > b ? 'a' : 'b'
}

export function validateMatchScore(sets) {
  if (!sets || sets.length === 0) {
    return { valid: false, error: 'Ingresa al menos un set' }
  }
  for (let i = 0; i < sets.length; i++) {
    const a = parseInt(sets[i].a, 10)
    const b = parseInt(sets[i].b, 10)
    if (isNaN(a) || isNaN(b)) {
      return { valid: false, error: `Set ${i + 1}: ingresa ambos marcadores` }
    }
    if (a < 0 || b < 0) {
      return { valid: false, error: `Set ${i + 1}: no puede ser negativo` }
    }
    if (a > 7 || b > 7) {
      return { valid: false, error: `Set ${i + 1}: máximo 7 juegos por set` }
    }
    if (!isValidPadelSet(a, b)) {
      return { valid: false, error: `Set ${i + 1}: marcador inválido (ej: 6-4, 7-5, 7-6)` }
    }
  }
  return { valid: true, error: null }
}

export function getScoreError(a, b) {
  if (a === '' || b === '') return null // Don't show error while typing
  const numA = parseInt(a, 10)
  const numB = parseInt(b, 10)
  if (isNaN(numA) || isNaN(numB)) return 'Solo números'
  if (numA < 0 || numB < 0) return 'No puede ser negativo'
  if (numA > 7 || numB > 7) return 'Máximo 7'
  if (numA === numB && numA >= 5) return 'Empate no válido en pádel'
  if ((numA < 6 && numB < 6) || (numA === 5 && numB === 6) || (numA === 6 && numB === 5)) return null // Still typing
  if (!isValidPadelSet(numA, numB)) return 'Marcador inválido'
  return null
}
