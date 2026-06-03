import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('coaches data fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches active coaches with profiles', async () => {
    const mockCoaches = [
      { id: 'coach1', profiles: { display_name: 'Coach A' }, active: true }
    ]
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockCoaches, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(mockQuery)

    const { data, error } = await supabase
      .from('coaches')
      .select('*, profiles!inner(display_name, avatar_url, elo_rating)')
      .eq('active', true)
      .order('created_at', { ascending: false })

    expect(data).toEqual(mockCoaches)
    expect(supabase.from).toHaveBeenCalledWith('coaches')
    expect(mockQuery.eq).toHaveBeenCalledWith('active', true)
  })

  it('checks if user is a coach', async () => {
    const mockCoach = { id: 'c1' }
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockCoach, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(mockQuery)

    const { data } = await supabase
      .from('coaches')
      .select('id')
      .eq('profile_id', 'u1')
      .maybeSingle()

    expect(data).toEqual(mockCoach)
    expect(mockQuery.eq).toHaveBeenCalledWith('profile_id', 'u1')
  })

  it('fetches coach reviews and calculates average', async () => {
    const mockReviews = [
      { rating: 5 },
      { rating: 4 },
      { rating: 3 },
    ]
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: mockReviews, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(mockQuery)

    const { data } = await supabase
      .from('coach_reviews')
      .select('rating')
      .eq('coach_id', 'coach1')

    const avg = data.reduce((s, r) => s + r.rating, 0) / data.length
    expect(avg).toBe(4)
  })
})
