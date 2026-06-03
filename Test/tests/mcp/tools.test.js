import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a robust mock for the Supabase client
const createMockSb = () => {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockReturnThis(),
    // We'll use a custom property to set the resolved value
    _resolvedValue: { data: null, error: null },
    then: function(onFulfilled) {
      return Promise.resolve(this._resolvedValue).then(onFulfilled);
    }
  }
  return mock
}

const mockSb = createMockSb()

vi.mock('../../../mcp/lib/supabase.js', () => {
  return {
    getClient: () => mockSb,
    requireAuth: () => ({ id: 'user-123', email: 'test@example.com' }),
    getUser: () => ({ id: 'user-123', email: 'test@example.com' }),
    login: vi.fn(),
  }
})

import { getClient, requireAuth } from '../../../mcp/lib/supabase.js'
import { getMyLigas, getLiga } from '../../../mcp/tools/liga.js'
import { getStandings, getTeamStats } from '../../../mcp/tools/standings.js'
import { searchPlayers, addMember, removeMember } from '../../../mcp/tools/members.js'
import { getMatches, recordMatch, deleteMatch } from '../../../mcp/tools/matches.js'

describe('MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSb._resolvedValue = { data: null, error: null }
    // Reset individual mocks to return this
    Object.keys(mockSb).forEach(key => {
      if (typeof mockSb[key] === 'function' && mockSb[key].mockReturnThis) {
        mockSb[key].mockReturnThis()
      }
    })
  })

  describe('liga.js', () => {
    it('getMyLigas filters and maps results', async () => {
      mockSb._resolvedValue = {
        data: [
          {
            liga_id: 'l1',
            role: 'admin',
            status: 'active',
            ligas: { id: 'l1', name: 'Liga 1', format: 'doubles', description: 'Desc 1', is_active: true }
          },
          {
            liga_id: 'l2',
            role: 'player',
            status: 'active',
            ligas: null
          }
        ]
      }

      const result = await getMyLigas()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Liga 1')
    })

    it('getLiga returns single liga', async () => {
      mockSb._resolvedValue = { data: { id: 'l1', name: 'Liga 1' } }
      const result = await getLiga('l1')
      expect(result.name).toBe('Liga 1')
    })
  })

  describe('standings.js', () => {
    it('getStandings maps results correctly', async () => {
      mockSb._resolvedValue = {
        data: [
          {
            player_id: 'p1',
            elo_rating: 1500,
            profile: { id: 'p1', display_name: 'Player 1' }
          }
        ]
      }
      const result = await getStandings('l1')
      expect(result[0].player).toBe('Player 1')
    })
  })

  describe('members.js', () => {
    it('searchPlayers searches by query', async () => {
      mockSb._resolvedValue = {
        data: [{ id: 'p1', display_name: 'John Doe' }]
      }
      const result = await searchPlayers('john')
      expect(result[0].name).toBe('John Doe')
    })

    it('addMember upserts and creates standings if missing', async () => {
      // This test is tricky because it makes multiple independent calls
      // We'll use mockImplementationOnce for them
      mockSb.upsert.mockResolvedValueOnce({ error: null })
      mockSb.maybeSingle.mockResolvedValueOnce({ data: null })
      mockSb.insert.mockResolvedValueOnce({ error: null })

      const result = await addMember('l1', 'p1')
      expect(result.added).toBe('p1')
    })

    it('removeMember deletes member', async () => {
      mockSb._resolvedValue = { error: null }
      const result = await removeMember('l1', 'p1')
      expect(result.removed).toBe('p1')
      expect(mockSb.delete).toHaveBeenCalled()
    })
  })

  describe('matches.js', () => {
    it('getMatches enriches with player names', async () => {
      // First call for matches, second for profiles
      mockSb.limit.mockResolvedValueOnce({
        data: [{ id: 'm1', team_a_player1_id: 'p1', team_a_player2_id: 'p2', score_team_a: 6, score_team_b: 4 }]
      })
      mockSb.in.mockResolvedValueOnce({
        data: [{ id: 'p1', display_name: 'P1' }, { id: 'p2', display_name: 'P2' }]
      })

      const result = await getMatches('l1')
      expect(result[0].team_a).toContain('P1')
    })

    it('recordMatch validates input and updates ELO', async () => {
      // profiles call
      mockSb.in.mockResolvedValueOnce({
        data: [
          { id: 'p1', elo_rating: 1200, matches_played: 10, matches_won: 5 },
          { id: 'p2', elo_rating: 1200, matches_played: 10, matches_won: 5 },
          { id: 'p3', elo_rating: 1200, matches_played: 10, matches_won: 5 },
          { id: 'p4', elo_rating: 1200, matches_played: 10, matches_won: 5 },
        ]
      })
      // jornadas call
      mockSb.limit.mockResolvedValueOnce({ data: [{ id: 'j1' }] })
      // match insert
      mockSb.single.mockResolvedValueOnce({ data: { id: 'm1' } })
      // update_match_elo RPC (called 4 times)
      mockSb.rpc.mockResolvedValue({ error: null })
      // standings calls (4 times, each with maybeSingle then update/insert)
      mockSb.maybeSingle.mockResolvedValue({ data: { id: 's1', total_points: 0, matches_played: 0, matches_won: 0, matches_lost: 0 } })
      
      // Ensure update and insert return the mock object for chaining
      mockSb.update.mockReturnThis()
      mockSb.insert.mockReturnThis()
      mockSb._resolvedValue = { error: null }

      const result = await recordMatch('l1', 'p1', 'p2', 'p3', 'p4', 6, 4)
      expect(result.match_id).toBe('m1')
    })
  })
})
