// Tests for S4: Social Layer — store, follow logic, achievement metadata
// Updated: 2026-05-08
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
      match: vi.fn().mockResolvedValue({ error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  }
}))

describe('socialStore', () => {
  it('exports useSocialStore', async () => {
    const mod = await import('../../../src/stores/socialStore')
    expect(mod.useSocialStore).toBeDefined()
  })

  it('has follow, unfollow, loadFeed, loadAchievements actions', async () => {
    const { useSocialStore } = await import('../../../src/stores/socialStore')
    const s = useSocialStore.getState()
    expect(typeof s.follow).toBe('function')
    expect(typeof s.unfollow).toBe('function')
    expect(typeof s.loadFeed).toBe('function')
    expect(typeof s.loadAchievements).toBe('function')
  })

  it('initializes with empty following array', async () => {
    const { useSocialStore } = await import('../../../src/stores/socialStore')
    expect(Array.isArray(useSocialStore.getState().following)).toBe(true)
  })
})

describe('ACHIEVEMENT_META', () => {
  it('exports 10 achievement types', async () => {
    const { ACHIEVEMENT_META } = await import('../../../src/stores/socialStore')
    expect(Object.keys(ACHIEVEMENT_META)).toHaveLength(10)
  })

  it('each achievement has icon and label', async () => {
    const { ACHIEVEMENT_META } = await import('../../../src/stores/socialStore')
    for (const [key, meta] of Object.entries(ACHIEVEMENT_META)) {
      expect(meta.icon, `${key} missing icon`).toBeTruthy()
      expect(meta.label, `${key} missing label`).toBeTruthy()
    }
  })
})
