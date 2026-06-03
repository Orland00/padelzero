import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClubStore } from '@/stores/clubStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'
import GlassButton from '@/components/ui/GlassButton'

export default function MyBookings() {
  const { lang } = useI18n()
  const es = lang === 'es'
  const navigate = useNavigate()
  const { myBookings, myBookingsLoading, loadMyBookings, cancelMyBooking } = useClubStore()

  useEffect(() => { loadMyBookings() }, [loadMyBookings])

  const formatTime = (t) => t?.substring(0, 5) || ''
  const formatDate = (d) => {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString(es ? 'es-MX' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  if (myBookingsLoading) {
    return <div className="text-center py-6"><div className="glass-spinner mx-auto" /></div>
  }

  if (!myBookings.length) {
    return (
      <div className="text-center py-6">
        <p className="text-zinc-500 text-sm mb-3">{es ? 'No tienes reservas próximas' : 'No upcoming bookings'}</p>
        <GlassButton variant="primary" size="sm" onClick={() => navigate('/clubes')}>
          {es ? 'Buscar canchas' : 'Find courts'}
        </GlassButton>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {myBookings.map(b => {
        const club = b.courts?.clubs
        const court = b.courts
        return (
          <div key={b.id} className="glass-card p-3">
            <div className="flex items-start justify-between">
              <div>
                <button onClick={() => club?.slug && navigate(`/club/${club.slug}`)} className="text-sm font-bold text-white hover:text-emerald-400 transition">
                  {club?.name || (es ? 'Club' : 'Club')}
                </button>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {court?.name || `Cancha ${court?.court_number}`} · {formatDate(b.booking_date)}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {formatTime(b.start_time)} - {formatTime(b.end_time)}
                  {b.price_cents > 0 && ` · $${(b.price_cents / 100).toFixed(0)} MXN`}
                </p>
                {b.price_cents > 0 && (
                  <span className="inline-block mt-1 text-[9px] font-black uppercase text-zinc-400 bg-zinc-500/10 px-1.5 py-0.5 rounded">
                    {es ? 'Pago en sitio' : 'Pay on site'}
                  </span>
                )}
              </div>
              {b.status === 'confirmed' && (
                <button
                  onClick={async () => {
                    const ok = await useUiStore.getState().confirm({
                      message: es ? '¿Cancelar esta reserva?' : 'Cancel this booking?',
                      danger: true,
                    })
                    if (ok) cancelMyBooking(b.id)
                  }}
                  className="text-[10px] text-zinc-500 hover:text-red-400 font-bold uppercase"
                >
                  {es ? 'Cancelar' : 'Cancel'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
