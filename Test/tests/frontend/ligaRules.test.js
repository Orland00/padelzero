import { describe, expect, it } from 'vitest'
import { getLigaRules, getLigaRulesLabel, validateLigaScore } from '@/lib/ligaRules'

describe('ligaRules', () => {
  it('uses ATP defaults with quick liga rules', () => {
    const liga = { schedule: { rules: { preset: 'express', maxScore: 4, deadPoint: true } } }

    expect(getLigaRules(liga)).toMatchObject({
      preset: 'express',
      maxScore: 4,
      deadPoint: true,
      ratingName: 'ATP',
    })
    expect(getLigaRulesLabel(liga)).toBe('Máx. 4 puntos · punto muerto')
  })

  it('dead point allows a one-point finish at max score', () => {
    const liga = { schedule: { rules: { maxScore: 4, deadPoint: true, winByTwo: false } } }

    expect(validateLigaScore(4, 3, liga).valid).toBe(true)
    expect(validateLigaScore(3, 4, liga).valid).toBe(true)
  })

  it('win-by-two blocks a one-point finish', () => {
    const liga = { schedule: { rules: { maxScore: 4, deadPoint: false, winByTwo: true } } }

    expect(validateLigaScore(4, 3, liga)).toMatchObject({
      valid: false,
      message: 'Esta liga requiere ganar por 2 puntos',
    })
    expect(validateLigaScore(4, 2, liga).valid).toBe(true)
  })

  it('blocks ties, overflow and unfinished winners', () => {
    const liga = { max_score: 6, schedule: { rules: { deadPoint: true } } }

    expect(validateLigaScore(6, 6, liga).message).toBe('No se permiten empates')
    expect(validateLigaScore(7, 5, liga).message).toBe('El marcador máximo es 6')
    expect(validateLigaScore(5, 3, liga).message).toBe('El ganador debe llegar a 6')
  })
})
