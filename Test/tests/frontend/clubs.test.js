import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  fetchClubs, 
  fetchClubBySlug, 
  fetchAvailableSlots, 
  createBooking, 
  cancelBooking, 
  fetchMyBookings 
} from '@/lib/clubs'
import { useClubStore } from '@/stores/clubStore'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: { access_token: 't1' } }, error: null })),
    }
  },
}))

// Mock UI store for toasts
vi.mock('@/stores/uiStore', () => ({
  useUiStore: {
    getState: () => ({
      showToast: vi.fn(),
    }),
  },
}))

describe('clubs lib', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchClubs applies city and search filters', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
    }
    vi.mocked(supabase.from).mockReturnValue(mockQuery)
    mockQuery.ilike.mockResolvedValue({ data: [], error: null })

    await fetchClubs({ city: 'CDMX', search: 'Padel' })

    expect(supabase.from).toHaveBeenCalledWith('clubs')
    expect(mockQuery.eq).toHaveBeenCalledWith('city', 'CDMX')
    expect(mockQuery.ilike).toHaveBeenCalledWith('name', '%Padel%')
  })

  it('fetchClubBySlug fetches single club with courts', async () => {
    const mockClub = { id: 'c1', name: 'Club 1', courts: [{ id: 'ct1' }] }
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockClub, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(mockQuery)

    const result = await fetchClubBySlug('club-1')
    expect(result).toEqual(mockClub)
    expect(mockQuery.eq).toHaveBeenCalledWith('slug', 'club-1')
  })

  it('fetchClubAvailabilitySummary calls RPC', async () => {
    const mockSummary = [{ date: '2026-01-01', available: true }]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: mockSummary, error: null })
    const { fetchClubAvailabilitySummary } = await import('@/lib/clubs')
    const result = await fetchClubAvailabilitySummary('c1')
    expect(result).toEqual(mockSummary)
    expect(supabase.rpc).toHaveBeenCalledWith('get_club_availability_summary', { p_club_id: 'c1' })
  })

  it('createBooking calls RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'booking_id', error: null })

    const result = await createBooking({
      courtId: 'ct1',
      date: '2026-01-01',
      startTime: '10:00',
      endTime: '11:00',
      priceCents: 1000
    })

    expect(result).toBe('booking_id')
    expect(supabase.rpc).toHaveBeenCalledWith('create_booking', expect.any(Object))
  })

  it('fetchAvailableSlots calls RPC', async () => {
    const mockSlots = [{ start_time: '10:00' }]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: mockSlots, error: null })
    const result = await fetchAvailableSlots('ct1', '2026-01-01')
    expect(result).toEqual(mockSlots)
    expect(supabase.rpc).toHaveBeenCalledWith('get_available_slots', { p_court_id: 'ct1', p_date: '2026-01-01' })
  })

  it('cancelBooking updates booking status', async () => {
    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(mockQuery)
    await cancelBooking('b1')
    expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }))
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'b1')
  })

  it('fetchMyBookings fetches upcoming bookings', async () => {
    const mockBookings = [{ id: 'b1' }]
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn((cb) => cb({ data: mockBookings, error: null })),
    }
    vi.mocked(supabase.from).mockReturnValue(mockQuery)
    const result = await fetchMyBookings()
    expect(result).toEqual(mockBookings)
  })
})

describe('clubStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useClubStore.setState({
      clubs: [],
      clubsLoading: false,
      club: null,
      myBookings: [],
    })
  })

  it('loadClubs updates state', async () => {
    const mockClubs = [{ id: 'c1', name: 'Club 1' }]
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn((cb) => cb({ data: mockClubs, error: null })),
    }
    
    vi.mocked(supabase.from).mockReturnValue(mockQuery)

    await useClubStore.getState().loadClubs()
    expect(useClubStore.getState().clubs).toEqual(mockClubs)
  })

  it('bookSlot handles success', async () => {
    useClubStore.setState({
      selectedSlot: { courtId: 'ct1', start_time: '10:00', end_time: '11:00', price_cents: 1000 },
      club: { id: 'c1', courts: [{ id: 'ct1', active: true }] },
      selectedDate: '2026-01-01'
    })

    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'b1', error: null })
    // Mock for loadSlots that's called after booking
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null })

    await useClubStore.getState().bookSlot()

    expect(useClubStore.getState().selectedSlot).toBeNull()
    expect(useClubStore.getState().bookingInProgress).toBe(false)
  })
})
