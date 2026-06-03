import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClubStore } from '@/stores/clubStore'
import { useI18n } from '@/lib/i18n'
import { distanceKm } from '@/lib/clubs'
import { usePageTitle } from '@/hooks/usePageTitle'
import ClubCard from '@/components/clubs/ClubCard'
import CourtMap from '@/components/clubs/CourtMap'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import GlassButton from '@/components/ui/GlassButton'
import MyBookings from '@/components/clubs/MyBookings'
import UpcomingFeatures from '@/components/common/UpcomingFeatures'

export default function Clubes() {
  const { t, lang } = useI18n()
  const es = lang === 'es'
  const navigate = useNavigate()
  usePageTitle(es ? 'Clubes' : 'Clubs')

  const { clubs, clubsLoading, loadClubs, userLocation, setUserLocation } = useClubStore()
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [locationDenied, setLocationDenied] = useState(false)

  useEffect(() => {
    loadClubs()
  }, [loadClubs])

  useEffect(() => {
    if (!userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocationDenied(true),
        { timeout: 5000, maximumAge: 300000 }
      )
    }
  }, [])

  // Extract city options from addresses for filter
  const cityOptions = [...new Set(
    clubs.map(c => {
      if (!c.address) return null
      const parts = c.address.split(',').map(s => s.trim())
      return parts.length >= 2 ? parts[parts.length - 1] : null
    }).filter(Boolean)
  )].sort()

  const filtered = (() => {
    let list = clubs
    if (search) {
      list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    }
    if (cityFilter) {
      list = list.filter(c => c.address?.includes(cityFilter))
    }
    if (typeFilter) {
      list = list.filter(c => c.court_type === typeFilter)
    }
    if (userLocation) {
      list = list.map(c => ({
        ...c,
        _distance: (c.lat && c.lng) ? distanceKm(userLocation.lat, userLocation.lng, c.lat, c.lng) : null,
      })).sort((a, b) => {
        if (a._distance == null && b._distance == null) return 0
        if (a._distance == null) return 1
        if (b._distance == null) return -1
        return a._distance - b._distance
      })
    }
    return list
  })()

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="px-4 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">
              {t('courts.title')}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              {t('courts.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              className="text-xs px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition"
            >
              {viewMode === 'list' ? `📍 ${t('courts.map_view')}` : `📋 ${t('courts.list_view')}`}
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('courts.search')}
            className="glass-input w-full pl-9 pr-4 py-2.5 text-sm"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
            🔍
          </span>
        </div>
        {userLocation && (
          <p className="text-[10px] text-emerald-400 mt-1">
            📍 {t('courts.sorted_distance')}
          </p>
        )}
        {locationDenied && (
          <p className="text-[10px] text-zinc-500 mt-1">
            📍 {t('courts.enable_location')}
          </p>
        )}

        {cityOptions.length > 1 && (
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="glass-input w-full py-2 px-3 text-sm"
          >
            <option value="">{es ? 'Todas las ciudades' : 'All cities'}</option>
            {cityOptions.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        )}

        {/* Type filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {['', 'publica', 'comunitaria', 'club', 'country_club'].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                typeFilter === type ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {type ? t(`courts.type_${type}`) : t('courts.type_all')}
            </button>
          ))}
        </div>

        {/* Add Court CTA */}
        <div className="glass-card p-3 flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-bold">{t('courts.add_cta')}</p>
            <p className="text-[10px] text-zinc-500">{t('courts.add_cta_desc')}</p>
          </div>
          <GlassButton variant="primary" size="sm" onClick={() => navigate('/clubes/agregar')}>
            {t('courts.add_btn')}
          </GlassButton>
        </div>

        {/* My Bookings */}
        <div>
          <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-2">
            {es ? 'Mis reservas' : 'My bookings'}
          </h2>
          <MyBookings />
        </div>

        {clubsLoading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🏟️"
            title={t('courts.no_courts')}
            message={
              search
                ? (es ? `No hay resultados para "${search}"` : `No results for "${search}"`)
                : t('courts.no_courts_desc')
            }
          />
        ) : viewMode === 'map' ? (
          <CourtMap courts={filtered} userLocation={userLocation} />
        ) : (
          <div className="space-y-3">
            {filtered.map(club => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}
        <UpcomingFeatures features={[
          { key: 'clubs_whatsapp_bot', icon: '🤖', label: es ? 'Agente AI WhatsApp' : 'WhatsApp AI Agent', description: es ? 'Reserva canchas desde tu grupo de WhatsApp' : 'Book courts from your WhatsApp group' },
          { key: 'clubs_tournament_hosting', icon: '🏆', label: es ? 'Torneos en club' : 'Club tournaments', description: es ? 'Organiza torneos desde tu club' : 'Host tournaments from your club' },
          { key: 'clubs_coaches', icon: '🎓', label: es ? 'Coaches en tu club' : 'Coaches at your club', description: es ? 'Vincula entrenadores a tu club' : 'Link coaches to your club' },
          { key: 'clubs_loyalty_program', icon: '⭐', label: es ? 'Programa de lealtad' : 'Loyalty program', description: es ? 'Puntos y recompensas por reservas' : 'Points and rewards for bookings' },
          { key: 'clubs_analytics', icon: '📊', label: es ? 'Analytics avanzados' : 'Advanced analytics', description: es ? 'Métricas de ocupación, ingresos y tendencias' : 'Occupancy, revenue, and trend metrics' },
          { key: 'clubs_live_streaming', icon: '📺', label: es ? 'Streaming en vivo' : 'Live streaming', description: es ? 'Transmite partidos desde tus canchas' : 'Stream matches from your courts' },
          { key: 'clubs_online_payments', icon: '💳', label: es ? 'Pagos en línea' : 'Online payments', description: es ? 'Acepta pagos con tarjeta y OXXO' : 'Accept card and OXXO payments' },
          { key: 'clubs_memberships', icon: '🎫', label: es ? 'Membresías' : 'Memberships', description: es ? 'Planes mensuales y paquetes de horas' : 'Monthly plans and hour packages' },
          { key: 'clubs_notifications', icon: '🔔', label: es ? 'Notificaciones push' : 'Push notifications', description: es ? 'Recordatorios de reserva y promociones' : 'Booking reminders and promotions' },
        ]} />
      </div>
    </div>
  )
}
