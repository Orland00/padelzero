import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useJornadaStore } from '@/stores/jornadaStore'

const hoisted = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getUser: vi.fn(() => ({ data: { user: { id: 'admin1' } } })),
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
  mockAmericanoEngine: {
    generateAmericanoRounds: vi.fn(() => [
      { round: 1, matches: [{ court: 1, teamA: ['p1', 'p2'], teamB: ['p3', 'p4'] }], bye: null }
    ]),
    calculateJornadaPoints: vi.fn(),
  }
}))

vi.mock('@/lib/supabase', () => ({
  supabase: hoisted.mockSupabase,
}))

vi.mock('@/utils/americanoEngine', () => ({
  generateAmericanoRounds: hoisted.mockAmericanoEngine.generateAmericanoRounds,
  calculateJornadaPoints: hoisted.mockAmericanoEngine.calculateJornadaPoints,
}))

import { supabase } from '@/lib/supabase'

describe('jornadaStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useJornadaStore.setState({
      jornada: null,
      checkIns: [],
      rounds: [],
      matches: [],
      currentRound: 0,
      loading: false,
      error: null,
    })
  })

  describe('createJornada', () => {
    it('creates a new jornada', async () => {
      const mockJornada = { id: 'j1', jornada_number: 1 }
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: null, error: null }) // lastJornada
          .mockResolvedValueOnce({ data: mockJornada, error: null }), // insertedJornada
        insert: vi.fn().mockReturnThis(),
      }
      vi.mocked(supabase.from).mockReturnValue(chain)

      const result = await useJornadaStore.getState().createJornada('l1', '2026-05-06')

      expect(result).toEqual(mockJornada)
      expect(useJornadaStore.getState().jornada).toEqual(mockJornada)
      expect(supabase.from).toHaveBeenCalledWith('jornadas')
    })
  })

  describe('generateRounds', () => {
    it('generates rounds and matches from check-ins', async () => {
      const players = [{ player_id: 'p1' }, { player_id: 'p2' }, { player_id: 'p3' }, { player_id: 'p4' }]
      const mockRounds = [{ id: 'r1', round_number: 1 }]
      
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: players, error: null }),
      }
      
      // Mock different responses for different calls
      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === 'jornada_checkins') return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: players, error: null })
        }
        if (table === 'americano_rounds') return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({ data: mockRounds, error: null }),
          order: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        }
        if (table === 'americano_matches') return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null })
        }
        if (table === 'jornadas') return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null })
        }
        return chain
      })

      await useJornadaStore.getState().generateRounds('j1', 'l1')

      expect(hoisted.mockAmericanoEngine.generateAmericanoRounds).toHaveBeenCalled()
      expect(useJornadaStore.getState().rounds).toEqual(mockRounds)
    })
  })

  describe('finalizeJornada', () => {
    it('calls the finalize_jornada edge function', async () => {
      hoisted.mockSupabase.functions.invoke.mockResolvedValue({ data: { success: true, newCrownHolder: 'p1' }, error: null })
      
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { display_name: 'Winner' }, error: null }),
      }
      vi.mocked(supabase.from).mockReturnValue(chain)

      const result = await useJornadaStore.getState().finalizeJornada('j1', 'l1')

      expect(hoisted.mockSupabase.functions.invoke).toHaveBeenCalledWith('finalize_jornada', expect.anything())
      expect(result.crownWinnerName).toBe('Winner')
    })
  })
})
