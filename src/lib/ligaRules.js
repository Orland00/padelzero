const DEFAULT_MAX_SCORE = 4

export function getLigaRules(liga = {}) {
  const scheduleRules = liga?.schedule?.rules || {}
  const maxScore = Number(scheduleRules.maxScore || liga?.max_score || DEFAULT_MAX_SCORE)

  return {
    preset: scheduleRules.preset || 'custom',
    maxScore: Number.isFinite(maxScore) && maxScore > 0 ? maxScore : DEFAULT_MAX_SCORE,
    deadPoint: Boolean(scheduleRules.deadPoint),
    winByTwo: Boolean(scheduleRules.winByTwo),
    tieBreak: Boolean(scheduleRules.tieBreak),
    ratingName: scheduleRules.ratingName || 'ATP',
  }
}

export function getLigaRulesLabel(liga = {}) {
  const rules = getLigaRules(liga)
  const finishRule = rules.deadPoint
    ? 'punto muerto'
    : rules.winByTwo
      ? 'ganar por 2'
      : 'sin ventaja'

  return `Máx. ${rules.maxScore} puntos · ${finishRule}`
}

export function validateLigaScore(scoreTeamA, scoreTeamB, liga = {}) {
  const rules = getLigaRules(liga)
  const scoreA = Number(scoreTeamA)
  const scoreB = Number(scoreTeamB)

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return { valid: false, message: 'Marcador no válido', rules }
  }

  if (scoreA === scoreB) {
    return { valid: false, message: 'No se permiten empates', rules }
  }

  if (scoreA > rules.maxScore || scoreB > rules.maxScore) {
    return { valid: false, message: `El marcador máximo es ${rules.maxScore}`, rules }
  }

  const winnerScore = Math.max(scoreA, scoreB)
  const loserScore = Math.min(scoreA, scoreB)
  const difference = winnerScore - loserScore

  if (winnerScore !== rules.maxScore) {
    return { valid: false, message: `El ganador debe llegar a ${rules.maxScore}`, rules }
  }

  if (rules.deadPoint) {
    if (difference < 1) {
      return { valid: false, message: 'Con punto muerto debe haber ganador', rules }
    }
    return { valid: true, rules }
  }

  if (rules.winByTwo && difference < 2) {
    return { valid: false, message: 'Esta liga requiere ganar por 2 puntos', rules }
  }

  if (!rules.winByTwo && loserScore >= rules.maxScore) {
    return { valid: false, message: `El perdedor no puede llegar a ${rules.maxScore}`, rules }
  }

  return { valid: true, rules }
}
