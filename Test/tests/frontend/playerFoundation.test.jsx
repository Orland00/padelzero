// Player Foundation Tests — ELO level, store, badge
// Tests for the Playtomic-style 0.0–7.0 level system.
// Updated: 2026-05-07
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── eloToLevel tests ────────────────────────────────────────────────────────

describe('eloToLevel', () => {
  it('maps ELO 800 to level 0.00', async () => {
    const { eloToLevel } = await import('../../../src/utils/eloEngine')
    expect(eloToLevel(800)).toBe(0.00)
  })

  it('maps ELO 1200 (default) to level 1.75', async () => {
    // (1200 - 800) / 1600 * 7 = 400/1600*7 = 1.75
    const { eloToLevel } = await import('../../../src/utils/eloEngine')
    expect(eloToLevel(1200)).toBe(1.75)
  })

  it('maps ELO 2400 to level 7.00', async () => {
    const { eloToLevel } = await import('../../../src/utils/eloEngine')
    expect(eloToLevel(2400)).toBe(7.00)
  })

  it('clamps below 800 to 0.00', async () => {
    const { eloToLevel } = await import('../../../src/utils/eloEngine')
    expect(eloToLevel(400)).toBe(0.00)
  })

  it('clamps above 2400 to 7.00', async () => {
    const { eloToLevel } = await import('../../../src/utils/eloEngine')
    expect(eloToLevel(3000)).toBe(7.00)
  })

  it('returns 2 decimal places', async () => {
    const { eloToLevel } = await import('../../../src/utils/eloEngine')
    const level = eloToLevel(1000)
    expect(String(level).split('.')[1]?.length).toBeLessThanOrEqual(2)
  })
})

// ─── playerStore tests ───────────────────────────────────────────────────────

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}))

describe('playerStore', () => {
  it('exports usePlayerStore', async () => {
    const mod = await import('../../../src/stores/playerStore')
    expect(mod.usePlayerStore).toBeDefined()
  })
})

// ─── PlayerLevelBadge tests ──────────────────────────────────────────────────

import { render, screen } from '@testing-library/react'

describe('PlayerLevelBadge', () => {
  it('renders level number', async () => {
    const { default: PlayerLevelBadge } = await import('../../../src/components/PlayerLevelBadge')
    render(<PlayerLevelBadge level={3.5} />)
    expect(screen.getByText('3.50')).toBeTruthy()
  })

  it('shows provisional asterisk when matches < 15', async () => {
    const { default: PlayerLevelBadge } = await import('../../../src/components/PlayerLevelBadge')
    render(<PlayerLevelBadge level={1.75} matchesPlayed={5} />)
    expect(screen.getByTitle(/provisional/i)).toBeTruthy()
  })
})
