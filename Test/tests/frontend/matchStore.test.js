import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMatchStore } from '@/stores/matchStore'

// Mock dependencies
const hoisted = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getUser: vi.fn(),
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
  mockOfflineQueue: {
    queueMatch: vi.fn(),
  },
  mockUiStore: {
    getState: vi.fn(() => ({
      showToast: vi.fn(),
    })),
  }
}))

vi.mock('@/lib/supabase', () => ({
  supabase: hoisted.mockSupabase,
}))

vi.mock('@/lib/offlineQueue', () => ({
  queueMatch: hoisted.mockOfflineQueue.queueMatch,
}))

vi.mock('@/stores/uiStore', () => ({
  useUiStore: hoisted.mockUiStore,
}))

import { supabase } from '@/lib/supabase'

describe('matchStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMatchStore.setState({
      currentMatch: null,
      matches: [],
      matchSubscription: null,
      loading: false,
      creating: false,
      error: null,
    })
    
    // Default online
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
      writable: true,
    })
  })

  describe('createMatch', () => {
    it('creates a match successfully when online', async () => {
      const mockMatch = { id: 'm1', formato: '1v1' }
      const chain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockMatch, error: null }),
      }
      vi.mocked(supabase.from).mockReturnValue(chain)

      const result = await useMatchStore.getState().createMatch('p1', null, 'p2', null, 2, 'amistoso', 'c1', 1)

      expect(result.data).toEqual(mockMatch)
      expect(useMatchStore.getState().currentMatch).toEqual(mockMatch)
      expect(supabase.from).toHaveBeenCalledWith('matches')
    })

    it('queues a match when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false })
      hoisted.mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
      
      const result = await useMatchStore.getState().createMatch('p1', null, 'p2', null, 2, 'amistoso', 'c1', 1)

      expect(result.queued).toBe(true)
      expect(hoisted.mockOfflineQueue.queueMatch).toHaveBeenCalled()
      expect(useMatchStore.getState().currentMatch).toBeNull()
    })
  })

  describe('fetchMatch', () => {
    it('fetches a match by id', async () => {
      const mockMatch = { id: 'm1', p1: { display_name: 'P1' } }
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockMatch, error: null }),
      }
      vi.mocked(supabase.from).mockReturnValue(chain)

      const result = await useMatchStore.getState().fetchMatch('m1')

      expect(result.data).toEqual(mockMatch)
      expect(useMatchStore.getState().currentMatch).toEqual(mockMatch)
    })
  })

  describe('updateScore', () => {
    it('updates the score of the current match', async () => {
      const initialMatch = { id: 'm1', live_state: { p1_points: 0, p2_points: 0 } }
      useMatchStore.setState({ currentMatch: initialMatch })
      
      const updatedMatch = { ...initialMatch, live_state: { ...initialMatch.live_state, p1_points: 15 } }
      const chain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedMatch, error: null }),
      }
      vi.mocked(supabase.from).mockReturnValue(chain)

      const result = await useMatchStore.getState().updateScore('m1', 0, 15, 0)

      expect(result.data.live_state.p1_points).toBe(15)
      expect(useMatchStore.getState().currentMatch.live_state.p1_points).toBe(15)
    })
  })

  describe('finishMatch', () => {
    it('calls the finish_match edge function', async () => {
      const mockUpdatedMatch = { id: 'm1', finished: true }
      hoisted.mockSupabase.functions.invoke.mockResolvedValue({ data: { success: true }, error: null })
      
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedMatch, error: null }),
      }
      vi.mocked(supabase.from).mockReturnValue(chain)

      const result = await useMatchStore.getState().finishMatch('m1', 'p1', 6, 4, [])

      expect(hoisted.mockSupabase.functions.invoke).toHaveBeenCalledWith('finish_match', expect.anything())
      expect(result.data).toEqual(mockUpdatedMatch)
    })
  })
})
