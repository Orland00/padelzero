// tests/frontend/crm.test.js
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: [{ id: 'n1' }], error: null }),
      update: vi.fn().mockReturnThis(),
      match: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  }
}))

describe('crmStore', () => {
  it('loadNotes calls log_crm_access RPC', async () => {
    const { useCrmStore } = await import('../../../src/stores/crmStore')
    const { supabase } = await import('../../../src/lib/supabase')
    
    await useCrmStore.getState().loadNotes('target-123')
    
    expect(supabase.rpc).toHaveBeenCalledWith('log_crm_access', {
      p_target_id: 'target-123',
      p_action: 'view_notes'
    })
  })

  it('exports useCrmStore', async () => {
    const mod = await import('../../../src/stores/crmStore')
    expect(mod.useCrmStore).toBeDefined()
  })

  it('has loadNotes, saveNote, toggleShare, loadClubStats actions', async () => {
    const { useCrmStore } = await import('../../../src/stores/crmStore')
    const s = useCrmStore.getState()
    expect(typeof s.loadNotes).toBe('function')
    expect(typeof s.saveNote).toBe('function')
    expect(typeof s.toggleShare).toBe('function')
    expect(typeof s.loadClubStats).toBe('function')
  })

  it('PREDEFINED_TAGS has 10 entries', async () => {
    const mod = await import('../../../src/stores/crmStore')
    expect(mod.PREDEFINED_TAGS.length).toBe(10)
  })
})
