import { useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useClubStore } from '@/stores/clubStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'
import { usePageTitle } from '@/hooks/usePageTitle'
import DatePicker from '@/components/clubs/DatePicker'
import CourtGrid from '@/components/clubs/CourtGrid'
import BookingSheet from '@/components/clubs/BookingSheet'
import MyBookings from '@/components/clubs/MyBookings'
import { SkeletonCard } from '@/components/common/LoadingSkeleton'

const TYPE_STYLES = {
  publica: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  comunitaria: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  club: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  country_club: { bg: 'bg-yellow-500/15', text: 'text-yellow-300' },
}

export default function ClubProfile() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t, lang } = useI18n()
  const es = lang === 'es'

  const { user } = useAuthStore()
  const { showToast } = useUiStore()
  const {
    club, clubLoading,
    selectedDate, courtSlots, slotsLoading,
    loadClub, loadSlots, selectSlot,
  } = useClubStore()

  usePageTitle(club?.name || (es ? 'Club' : 'Club'))

  useEffect(() => {
    loadClub(slug)
  }, [slug, loadClub])

  // Toast booking confirmation when BookingSheet redirects here with ?booking=success
  useEffect(() => {
    const bookingStatus = searchParams.get('booking')
    if (bookingStatus === 'success') {
      showToast({ type: 'success', message: es ? '¡Reserva confirmada!' : 'Booking confirmed!', duration: 4000 })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  if (clubLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
        <div className="px-4 pt-6 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">{es ? 'Club no encontrado' : 'Club not found'}</p>
          <button onClick={() => navigate('/clubes')} className="text-emerald-400 text-sm font-bold">
            {es ? 'Ver todos los clubes' : 'See all clubs'}
          </button>
        </div>
      </div>
    )
  }

  const typeStyle = club.court_type ? TYPE_STYLES[club.court_type] : null

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="relative h-36 bg-zinc-900">
        {club.cover_url && (
          <img src={club.cover_url} alt="" className="w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute -bottom-8 left-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 border-2 border-zinc-950 overflow-hidden flex items-center justify-center">
            {club.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">🏟️</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-12 space-y-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black text-white">{club.name}</h1>
            {club.verified && <span className="text-emerald-400">✓</span>}
            {typeStyle && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>
                {t(`courts.type_${club.court_type}`)}
              </span>
            )}
          </div>
          {club.address && (
            <p className="text-xs text-zinc-500 mt-0.5">{club.address}</p>
          )}
          {(club.lat && club.lng) ? (
            <a
              href={`https://www.google.com/maps/?q=${club.lat},${club.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-1"
            >
              📍 {t('courts.view_on_maps')}
            </a>
          ) : club.address ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(club.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-1"
            >
              📍 {t('courts.view_on_maps')}
            </a>
          ) : null}
          <div className="flex items-center gap-3 mt-2">
            {club.courts?.length > 0 && (
              <span className="text-xs text-zinc-400">
                {club.courts.filter(c => c.active).length} {es ? 'canchas' : 'courts'}
              </span>
            )}
            {club.phone && (
              <a href={`tel:${club.phone}`} className="text-xs text-emerald-400 font-bold">
                {es ? 'Llamar' : 'Call'}
              </a>
            )}
            {club.instagram && (
              <a
                href={`https://instagram.com/${club.instagram.replace('@','')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-400"
              >
                @{club.instagram.replace('@','')}
              </a>
            )}
          </div>

          {club.hours && (
            <div className="mt-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{t('courts.hours')}</p>
              <p className="text-sm text-white mt-0.5">{club.hours}</p>
            </div>
          )}
          {club.notes && (
            <div className="mt-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{t('courts.notes')}</p>
              <p className="text-sm text-zinc-300 mt-0.5">{club.notes}</p>
            </div>
          )}

          {!club.owner_user_id && !club.claimed_by && (
            <div className="glass-card p-3 mt-3">
              <p className="text-xs text-zinc-400">{t('courts.no_admin')}</p>
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    navigate(`/login?next=${encodeURIComponent(`/anunciate?intent=claim&slug=${slug}`)}`)
                    return
                  }
                  navigate(`/anunciate?intent=claim&slug=${slug}`)
                }}
                className="text-[11px] text-emerald-400 mt-1 font-bold uppercase tracking-widest hover:text-emerald-300 transition-colors"
              >
                {t('courts.claim')} →
              </button>
            </div>
          )}
        </div>

        {user?.id && club.owner_user_id === user.id && (
          <button
            onClick={() => navigate(`/club/${slug}/admin`)}
            className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
          >
            {es ? 'Panel de administración' : 'Admin Panel'}
          </button>
        )}

        <div>
          <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-2">
            {es ? 'Disponibilidad' : 'Availability'}
          </h2>
          <DatePicker
            selectedDate={selectedDate}
            onSelect={(date) => loadSlots(club, date)}
          />
        </div>

        <CourtGrid
          courtSlots={courtSlots}
          loading={slotsLoading}
          onSelectSlot={selectSlot}
        />

        {user && (
          <div>
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-2">
              {es ? 'Mis reservas' : 'My bookings'}
            </h2>
            <MyBookings />
          </div>
        )}

        {/* WhatsApp AI Agent Teaser */}
        <div className="glass-card p-4" style={{ border: '1px solid rgba(37, 211, 102, 0.2)', background: 'linear-gradient(135deg, rgba(37,211,102,0.05) 0%, rgba(18,18,26,0.8) 100%)' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
              <span className="text-lg">🤖</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">
                  {es ? 'Agente AI de WhatsApp' : 'WhatsApp AI Agent'}
                </h4>
                <span className="text-[9px] font-black uppercase text-[#25D366] bg-[#25D366]/10 px-1.5 py-0.5 rounded">
                  {es ? 'Próximamente' : 'Coming soon'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {es
                  ? 'Agrega un agente AI a tu grupo de WhatsApp para consultar disponibilidad, agendar canchas y recibir recordatorios automáticos.'
                  : 'Add an AI agent to your WhatsApp group to check availability, book courts, and get automatic reminders.'}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[9px] text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">
                  {es ? '📅 "¿Hay cancha mañana a las 7?"' : '📅 "Any court tomorrow at 7?"'}
                </span>
                <span className="text-[9px] text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">
                  {es ? '🏟️ "Reserva la cancha 2"' : '🏟️ "Book court 2"'}
                </span>
                <span className="text-[9px] text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">
                  {es ? '🔔 Recordatorios' : '🔔 Reminders'}
                </span>
              </div>
              <div
                className="mt-3 w-full py-2 rounded-lg text-xs font-bold text-zinc-500 text-center cursor-not-allowed opacity-50"
                style={{ background: 'rgba(113, 113, 122, 0.1)', border: '1px solid rgba(113, 113, 122, 0.2)' }}
              >
                {es ? 'Próximamente' : 'Coming soon'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BookingSheet />
    </div>
  )
}
