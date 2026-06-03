import { supabase } from '@/lib/supabase'
import { distanceKm } from './distance'
export { distanceKm }

/**
 * Fetch active clubs with optional city filter and search
 * Returns only public-safe columns (no stripe_account_id, no email)
 */
export async function fetchClubs({ city, search } = {}) {
  let query = supabase
    .from('clubs')
    .select('id, name, slug, address, city, courts_count, verified, logo_url, cover_url, is_sponsor, sponsor_tier, lat, lng, court_type')
    .eq('active', true)
    .order('is_sponsor', { ascending: false })
    .order('name')

  if (city) query = query.eq('city', city)
  if (search) {
    const safe = search.replace(/[%_\\,.()"']/g, '')
    query = query.ilike('name', `%${safe}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Fetch single club by slug with its active courts
 */
export async function fetchClubBySlug(slug) {
  const { data, error } = await supabase
    .from('clubs')
    .select(`
      id, name, slug, address, phone, website, instagram,
      courts_count, verified, logo_url, cover_url,
      is_sponsor, sponsor_tier, lat, lng, owner_user_id, stripe_account_id,
      court_type, added_by, claimed_by, hours, notes,
      courts(id, court_number, name, surface_type, active)
    `)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Get available slots for a court on a date — single RPC round-trip
 */
export async function fetchAvailableSlots(courtId, date) {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_court_id: courtId,
    p_date: date,
  })
  if (error) throw error
  return data || []
}

/**
 * Get 7-day availability summary for a club (for listing cards)
 */
export async function fetchClubAvailabilitySummary(clubId) {
  const { data, error } = await supabase.rpc('get_club_availability_summary', {
    p_club_id: clubId,
  })
  if (error) throw error
  return data || []
}

/**
 * Create a booking via server-side RPC (rate limited, atomic)
 */
export async function createBooking({ courtId, date, startTime, endTime, priceCents }) {
  const { data, error } = await supabase.rpc('create_booking', {
    p_court_id: courtId,
    p_date: date,
    p_start_time: startTime,
    p_end_time: endTime,
    p_price_cents: priceCents,
  })
  if (error) throw error
  return data
}

/**
 * Cancel a booking (self-service)
 */
export async function cancelBooking(bookingId) {
  const { error } = await supabase
    .from('club_bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) throw error
}

/**
 * Fetch user's upcoming bookings
 */
export async function fetchMyBookings() {
  const { data, error } = await supabase
    .from('club_bookings')
    .select(`
      id, booking_date, start_time, end_time, price_cents, status, created_at,
      stripe_payment_intent_id, stripe_checkout_session_id,
      courts(id, name, court_number, club_id, clubs(id, name, slug, logo_url))
    `)
    .gte('booking_date', (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })())
    .neq('status', 'cancelled')
    .order('booking_date')
    .order('start_time')

  if (error) throw error
  return data || []
}
