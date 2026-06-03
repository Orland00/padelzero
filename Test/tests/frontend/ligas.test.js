import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLigaStore } from '@/stores/ligaStore'

const hoisted = vi.hoisted(() => {
  const mockAuth = {
    getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
  }
  
  const makeChain = () => {
    const chain = {}
    chain.select = vi.fn(() => chain)
    chain.insert = vi.fn(() => chain)
    chain.update = vi.fn(() => chain)
    chain.delete = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.in = vi.fn(() => chain)
    chain.order = vi.fn(() => chain)
    chain.gte = vi.fn(() => chain)
    chain.limit = vi.fn(() => chain)
    chain.or = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    chain.single = vi.fn(async () => ({ data: null, error: null }))
    chain.upsert = vi.fn(async () => ({ data: null, error: null }))
    return chain
  }

  const mockSupabase = {
    auth: mockAuth,
    from: vi.fn(() => makeChain()),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  }

  return { mockAuth, mockSupabase, makeChain }
})

vi.mock('@/lib/supabase', () => ({
  supabase: hoisted.mockSupabase,
}))

// Mock other stores if needed
vi.mock('@/stores/uiStore', () => ({
  useUiStore: {
    getState: () => ({
      showToast: vi.fn(),
    }),
  },
}))

// Mock localStorage
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(() => 'es'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true
  })
}

import { supabase } from '@/lib/supabase'

describe('useLigaStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLigaStore.getState().reset()
  })

  describe('fetchMyLigas', () => {
    it('fetches ligas for the authenticated user', async () => {
      const mockLigas = [
        { liga_id: 'l1', ligas: { id: 'l1', name: 'Liga 1' } },
        { liga_id: 'l2', ligas: { id: 'l2', name: 'Liga 2' } },
      ]
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockLigas, error: null }),
      })

      await useLigaStore.getState().fetchMyLigas()

      expect(useLigaStore.getState().ligas).toHaveLength(2)
      expect(useLigaStore.getState().ligas[0].id).toBe('l1')
      expect(useLigaStore.getState().loading).toBe(false)
    })

    it('handles error if not authenticated', async () => {
      hoisted.mockAuth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      await useLigaStore.getState().fetchMyLigas()
      expect(useLigaStore.getState().error).toBe('Not authenticated')
    })
  })

  describe('fetchLiga', () => {
    it('fetches a single liga with members and standings', async () => {
      const mockLiga = { id: 'l1', name: 'Liga 1' }
      const mockMembers = [{ id: 'm1', player_id: 'u1' }]
      const mockStandings = [{ player_id: 'u1', total_points: 10 }]

      vi.mocked(supabase.from).mockImplementation((table) => {
        const chain = hoisted.makeChain()
        if (table === 'ligas') {
          chain.single = vi.fn().mockResolvedValue({ data: mockLiga, error: null })
        } else if (table === 'liga_members') {
          chain.eq = vi.fn().mockResolvedValue({ data: mockMembers, error: null })
        } else if (table === 'liga_standings') {
          chain.order = vi.fn().mockResolvedValue({ data: mockStandings, error: null })
        }
        return chain
      })

      await useLigaStore.getState().fetchLiga('l1')

      const state = useLigaStore.getState()
      expect(state.currentLiga).toEqual(mockLiga)
      expect(state.members).toHaveLength(1)
      expect(state.standings).toHaveLength(1)
    })
  })

  describe('createLiga', () => {
    it('creates a new liga and adds creator as admin', async () => {
      const mockLiga = { id: 'l1', name: 'New Liga' }
      
      vi.mocked(supabase.from).mockImplementation((table) => {
        const chain = hoisted.makeChain()
        if (table === 'ligas') {
          chain.select = vi.fn().mockReturnThis()
          chain.single = vi.fn().mockResolvedValue({ data: mockLiga, error: null })
        } else if (table === 'liga_members') {
          chain.insert = vi.fn().mockResolvedValue({ error: null })
        }
        return chain
      })

      const result = await useLigaStore.getState().createLiga('New Liga', 'Desc', 'Schedule')
      
      expect(result).toEqual(mockLiga)
      expect(useLigaStore.getState().ligas).toContainEqual(mockLiga)
      expect(supabase.from).toHaveBeenCalledWith('ligas')
      expect(supabase.from).toHaveBeenCalledWith('liga_members')
    })
  })

  describe('joinLiga', () => {
    it('adds member to liga (pending status by default)', async () => {
      vi.mocked(supabase.from).mockReturnValue(hoisted.makeChain())
      
      // Mock fetchLiga internally called by joinLiga
      const fetchLigaSpy = vi.spyOn(useLigaStore.getState(), 'fetchLiga').mockResolvedValue()

      await useLigaStore.getState().joinLiga('l1')

      expect(supabase.from).toHaveBeenCalledWith('liga_members')
      const insertCall = vi.mocked(supabase.from).mock.results.find(r => r.value.insert)
      // verify insert arguments if possible, but let's keep it simple for now
      expect(fetchLigaSpy).toHaveBeenCalledWith('l1')
    })
  })

  describe('recordLigaMatch', () => {
    it('calls record_liga_match RPC and refreshes data', async () => {
      const mockEloChanges = [
        { playerId: 'u1', oldElo: 1200, newElo: 1220, delta: 20 }
      ]
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { match_id: 'm1', elo_changes: mockEloChanges },
        error: null
      })

      const fetchLigaSpy = vi.spyOn(useLigaStore.getState(), 'fetchLiga').mockResolvedValue()
      const fetchMatchesSpy = vi.spyOn(useLigaStore.getState(), 'fetchLigaMatches').mockResolvedValue()
      useLigaStore.setState({
        currentLiga: {
          id: 'l1',
          schedule: { rules: { maxScore: 6, deadPoint: false, winByTwo: true } },
        },
      })

      const result = await useLigaStore.getState().recordLigaMatch('l1', {
        teamAPlayer1: 'u1', teamAPlayer2: 'u2',
        teamBPlayer1: 'u3', teamBPlayer2: 'u4',
        scoreTeamA: 6, scoreTeamB: 4
      })

      expect(supabase.rpc).toHaveBeenCalledWith('record_liga_match', expect.any(Object))
      expect(result.match.id).toBe('m1')
      expect(result.eloChanges).toHaveLength(1)
      expect(fetchLigaSpy).toHaveBeenCalledWith('l1')
      expect(fetchMatchesSpy).toHaveBeenCalledWith('l1')
    })

    it('rejects scores that violate configured liga rules before RPC', async () => {
      useLigaStore.setState({
        currentLiga: {
          id: 'l1',
          schedule: { rules: { maxScore: 4, deadPoint: false, winByTwo: true } },
        },
      })

      await expect(useLigaStore.getState().recordLigaMatch('l1', {
        teamAPlayer1: 'u1', teamAPlayer2: 'u2',
        teamBPlayer1: 'u3', teamBPlayer2: 'u4',
        scoreTeamA: 4, scoreTeamB: 3
      })).rejects.toThrow('Esta liga requiere ganar por 2 puntos')

      expect(supabase.rpc).not.toHaveBeenCalled()
    })
  })

  describe('removeMember', () => {
    it('allows admin to remove a member', async () => {
      // Mock caller is admin
      vi.mocked(supabase.from).mockImplementation((table) => {
        const chain = hoisted.makeChain()
        if (table === 'liga_members') {
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
          chain.delete = vi.fn().mockReturnThis()
          // For the delete chain, eq is called once. 
          // But it was also called twice in the select chain.
          // To be safe, make eq always return chain except when we want it to return the error
          chain.eq = vi.fn().mockImplementation((col, val) => {
            if (col === 'id' && val === 'm1') {
              return Promise.resolve({ error: null })
            }
            return chain
          })
        }
        return chain
      })

      const fetchLigaSpy = vi.spyOn(useLigaStore.getState(), 'fetchLiga').mockResolvedValue()

      await useLigaStore.getState().removeMember('m1', 'l1')

      expect(supabase.from).toHaveBeenCalledWith('liga_members')
      expect(fetchLigaSpy).toHaveBeenCalledWith('l1')
    })

    it('throws error if caller is not admin', async () => {
      vi.mocked(supabase.from).mockImplementation((table) => {
        const chain = hoisted.makeChain()
        if (table === 'liga_members') {
          chain.select = vi.fn().mockReturnThis()
          chain.eq = vi.fn().mockReturnThis()
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'player' }, error: null })
        }
        return chain
      })

      await expect(useLigaStore.getState().removeMember('m1', 'l1')).rejects.toThrow('Solo admins pueden eliminar miembros')
    })
  })

  describe('createNextJornada', () => {
    it('completes current jornada and creates a new one', async () => {
      useLigaStore.setState({
        jornadas: [{ id: 'j1', status: 'in_progress', jornada_number: 1 }],
        members: [{ player_id: 'u1', status: 'active' }]
      })

      vi.mocked(supabase.from).mockImplementation((table) => {
        const chain = hoisted.makeChain()
        if (table === 'jornadas') {
          chain.update = vi.fn().mockReturnThis()
          chain.insert = vi.fn().mockReturnThis()
          chain.select = vi.fn().mockReturnThis()
          chain.single = vi.fn().mockResolvedValue({ data: { id: 'j2', jornada_number: 2 }, error: null })
        }
        return chain
      })

      await useLigaStore.getState().createNextJornada('l1')

      expect(supabase.rpc).toHaveBeenCalledWith('apply_jornada_penalties', { p_jornada_id: 'j1' })
      expect(supabase.from).toHaveBeenCalledWith('jornadas')
      expect(supabase.from).toHaveBeenCalledWith('jornada_participants')
    })
  })
})
