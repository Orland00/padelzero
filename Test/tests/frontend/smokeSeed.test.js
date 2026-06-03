import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readRepoFile = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('seeded smoke harness', () => {
  it('contains the real role matrix for smoke QA', () => {
    const seed = readRepoFile('Test/scripts/smoke-seed.js')

    expect(seed).toContain('smoke-player@example.com')
    expect(seed).toContain('smoke-liga-admin@example.com')
    expect(seed).toContain('smoke-tournament@example.com')
    expect(seed).toContain('smoke-coach@example.com')
    expect(seed).toContain('smoke-club-owner@example.com')
    expect(seed).toContain("role: 'coach'")
    expect(seed).toContain("role: 'club_admin'")
    expect(seed).toContain('ADMIN_USER_ID')
  })

  it('keeps the smoke runner gated behind an explicit env flag', () => {
    const smoke = readRepoFile('Test/scripts/smoke-test.js')

    expect(smoke).toContain("SMOKE_USE_SEEDED_USERS === 'true'")
    expect(smoke).toContain('testSeededAuthMatrix')
  })
})
