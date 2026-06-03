import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/v15_10_liga_score_rules_authority.sql'),
  'utf8'
)

describe('liga score rules migration', () => {
  it('makes schedule.rules scoring authoritative in the database trigger path', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.validate_liga_score_rules')
    expect(migration).toContain("v_rules->>'maxScore'")
    expect(migration).toContain("v_rules->>'deadPoint'")
    expect(migration).toContain("v_rules->>'winByTwo'")
    expect(migration).toContain('PERFORM public.validate_liga_score_rules')
    expect(migration).toContain('CREATE TRIGGER trg_validate_liga_match_score')
  })

  it('rejects the same invalid score shapes as the frontend guard', () => {
    expect(migration).toContain('No se permiten empates')
    expect(migration).toContain('El marcador máximo es %')
    expect(migration).toContain('El ganador debe llegar a %')
    expect(migration).toContain('Esta liga requiere ganar por 2 puntos')
  })
})
