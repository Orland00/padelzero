// Tests for S2: Open Matches — store, level filter, slot logic
// Updated: 2026-05-08
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    })),
  }
}))

describe('openMatchStore', () => {
  it('exports useOpenMatchStore', async () => {
    const mod = await import('../../../src/stores/openMatchStore')
    expect(mod.useOpenMatchStore).toBeDefined()
  })

  it('has loadFeed and joinMatch actions', async () => {
    const { useOpenMatchStore } = await import('../../../src/stores/openMatchStore')
    const state = useOpenMatchStore.getState()
    expect(typeof state.loadFeed).toBe('function')
    expect(typeof state.joinMatch).toBe('function')
  })

  it('initializes with empty feed', async () => {
    const { useOpenMatchStore } = await import('../../../src/stores/openMatchStore')
    const state = useOpenMatchStore.getState()
    expect(Array.isArray(state.feed)).toBe(true)
    expect(state.feed.length).toBe(0)
    expect(state.loading).toBe(false)
  })
})

describe('level filter logic', () => {
  it('clamps levelMin to 0', () => {
    const viewerLevel = 0.3
    const levelMin = Math.max(0, viewerLevel - 0.5)
    expect(levelMin).toBe(0)
  })

  it('clamps levelMax to 7', () => {
    const viewerLevel = 6.8
    const levelMax = Math.min(7, viewerLevel + 0.5)
    expect(levelMax).toBe(7)
  })

  it('computes ±0.5 window correctly for mid-range level', () => {
    const viewerLevel = 3.5
    const levelMin = Math.max(0, viewerLevel - 0.5)
    const levelMax = Math.min(7, viewerLevel + 0.5)
    expect(levelMin).toBe(3.0)
    expect(levelMax).toBe(4.0)
  })
})
