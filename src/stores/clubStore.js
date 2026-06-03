import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import {
  fetchClubs,
  fetchClubBySlug,
  fetchAvailableSlots,
  createBooking,
  cancelBooking,
  fetchMyBookings,
} from '@/lib/clubs'
import { useUiStore } from '@/stores/uiStore'
import { getSpanishError } from '@/utils/errorMessages'

const showToast = (opts) => useUiStore.getState().showToast(opts)

export const useClubStore = create((set, get) => ({
  // Listing
  clubs: [],
  clubsLoading: false,

  // Single club view
  club: null,
  clubLoading: false,

  // Availability grid
  selectedDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })(),
  courtSlots: {},
  slotsLoading: false,

  // Booking
  selectedSlot: null,
  bookingInProgress: false,

  // My bookings
  myBookings: [],
  myBookingsLoading: false,

  // User location
  userLocation: null,
  setUserLocation: (loc) => set({ userLocation: loc }),

  loadClubs: async (filters = {}) => {
    set({ clubsLoading: true })
    try {
      const clubs = await fetchClubs(filters)
      set({ clubs })
    } catch (err) {
      showToast({ type: 'error', message: getSpanishError(err) || 'Error al cargar clubes' })
    } finally {
      set({ clubsLoading: false })
    }
  },

  loadClub: async (slug) => {
    set({ clubLoading: true, club: null, courtSlots: {} })
    try {
      const club = await fetchClubBySlug(slug)
      set({ club })
      if (club?.courts?.length) {
        get().loadSlots(club, get().selectedDate)
      }
    } catch (err) {
      showToast({ type: 'error', message: getSpanishError(err) || 'Error al cargar club' })
    } finally {
      set({ clubLoading: false })
    }
  },

  loadSlots: async (club, date) => {
    set({ slotsLoading: true, selectedDate: date })
    try {
      const activeCourts = (club || get().club)?.courts?.filter(c => c.active) || []
      const results = await Promise.all(
        activeCourts.map(async (court) => {
          const slots = await fetchAvailableSlots(court.id, date)
          return {
            courtId: court.id,
            courtName: court.name || `Cancha ${court.court_number}`,
            slots,
          }
        })
      )
      const map = {}
      for (const r of results) {
        map[r.courtId] = { courtName: r.courtName, slots: r.slots }
      }
      set({ courtSlots: map })
    } catch (err) {
      showToast({ type: 'error', message: 'Error al cargar disponibilidad' })
    } finally {
      set({ slotsLoading: false })
    }
  },

  selectSlot: (slot) => set({ selectedSlot: slot }),
  clearSlot: () => set({ selectedSlot: null }),

  bookSlot: async () => {
    const { selectedSlot, club, selectedDate } = get()
    if (!selectedSlot) return

    set({ bookingInProgress: true })
    try {
      const bookingId = await createBooking({
        courtId: selectedSlot.courtId,
        date: selectedDate,
        startTime: selectedSlot.start_time,
        endTime: selectedSlot.end_time,
        priceCents: selectedSlot.price_cents,
      })
      showToast({ type: 'success', message: 'Reserva confirmada' })
      set({ selectedSlot: null })
      // Fire-and-forget email notification
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-confirmation-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ bookingId }),
          }).catch(() => {})
        }
      })
      get().loadSlots(club, selectedDate)
    } catch (err) {
      const msg = err.message?.includes('exclusion')
        ? 'Ese horario ya fue reservado'
        : err.message?.includes('Rate limit')
        ? 'Demasiadas reservas. Intenta luego.'
        : err.message?.includes('past')
        ? 'No puedes reservar en el pasado'
        : err.message?.includes('14 days')
        ? 'Solo puedes reservar hasta 14 días adelante'
        : getSpanishError(err) || 'Error al reservar'
      showToast({ type: 'error', message: msg })
    } finally {
      set({ bookingInProgress: false })
    }
  },

  cancelMyBooking: async (bookingId) => {
    try {
      await cancelBooking(bookingId)
      showToast({ type: 'success', message: 'Reserva cancelada' })
      get().loadMyBookings()
    } catch (err) {
      showToast({ type: 'error', message: getSpanishError(err) || 'Error al cancelar' })
    }
  },

  loadMyBookings: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { set({ myBookings: [], myBookingsLoading: false }); return }
    set({ myBookingsLoading: true })
    try {
      const bookings = await fetchMyBookings()
      set({ myBookings: bookings })
    } catch (err) {
      showToast({ type: 'error', message: 'Error al cargar reservas' })
    } finally {
      set({ myBookingsLoading: false })
    }
  },
}))
