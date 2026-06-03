import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminBookings({ club }) {
  const { lang } = useI18n()
  const es = lang === 'es'
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('club_bookings')
        .select('*, courts(name, court_number), profiles!booked_by(display_name, avatar_url, phone)')
        .eq('club_id', club.id)
        .gte('booking_date', localToday())
        .neq('status', 'cancelled')
        .order('booking_date')
        .order('start_time')
        .limit(50)
      // error silently handled — UI shows empty state
      setBookings(data || [])
      setLoading(false)
    }
    load()
  }, [club.id])

  const formatTime = (t) => t?.substring(0, 5) || ''
  const formatDate = (d) => {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString(es ? 'es-MX' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const statusColors = {
    confirmed: 'text-emerald-400',
    completed: 'text-blue-400',
    no_show: 'text-red-400',
    pending_payment: 'text-yellow-400',
  }

  const statusLabels = {
    confirmed: es ? 'Confirmada' : 'Confirmed',
    completed: es ? 'Completada' : 'Completed',
    no_show: es ? 'No asistió' : 'No show',
  }

  const updateStatus = async (bookingId, newStatus) => {
    setUpdating(bookingId)
    const { error } = await supabase
      .from('club_bookings')
      .update({ status: newStatus })
      .eq('id', bookingId)
      .eq('club_id', club.id)
    if (!error) {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b))
    }
    setUpdating(null)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">
        {es ? 'Próximas reservas' : 'Upcoming bookings'}
      </h3>

      {loading ? (
        <div className="text-center py-8"><div className="glass-spinner mx-auto" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-zinc-500 text-sm">{es ? 'No hay reservas próximas' : 'No upcoming bookings'}</p>
        </div>
      ) : (
        bookings.map(b => (
          <div key={b.id} className="glass-card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-white font-bold">
                  {b.courts?.name || `Cancha ${b.courts?.court_number}`}
                </span>
                <span className={`text-[9px] font-black uppercase ${statusColors[b.status] || 'text-zinc-500'}`}>
                  {statusLabels[b.status] || b.status}
                </span>
                {b.price_cents > 0 && (
                  <span className="text-[9px] font-black uppercase text-zinc-400 bg-zinc-500/10 px-1.5 py-0.5 rounded">
                    {es ? 'Pago en sitio' : 'Pay on site'}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {formatDate(b.booking_date)} · {formatTime(b.start_time)} - {formatTime(b.end_time)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {b.profiles?.display_name || (es ? 'Jugador' : 'Player')}
                {b.profiles?.phone && ` · ${b.profiles.phone}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-sm font-bold text-emerald-400">
                ${(b.price_cents / 100).toFixed(0)}
              </span>
              {b.status === 'confirmed' && (
                <div className="flex gap-1">
                  <button
                    disabled={updating === b.id}
                    onClick={() => updateStatus(b.id, 'completed')}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold hover:bg-blue-500/30 transition disabled:opacity-50"
                  >
                    {es ? 'Asistió' : 'Showed'}
                  </button>
                  <button
                    disabled={updating === b.id}
                    onClick={() => updateStatus(b.id, 'no_show')}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30 transition disabled:opacity-50"
                  >
                    {es ? 'No vino' : 'No show'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
