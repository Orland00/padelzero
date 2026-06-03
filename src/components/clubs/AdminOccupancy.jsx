import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AdminOccupancy({ club }) {
  const { lang } = useI18n()
  const es = lang === 'es'
  const dayNames = es ? DAY_NAMES_ES : DAY_NAMES_EN

  const [weekOffset, setWeekOffset] = useState(0)
  const [data, setData] = useState({}) // { date: { totalSlots, bookedSlots, revenue, slots: [{time, booked, courtName}] } }
  const [loading, setLoading] = useState(true)

  const today = localToday()
  // Start from Monday of current week + offset
  const todayDate = new Date(today + 'T12:00:00')
  const dayOfWeek = todayDate.getDay() // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = addDays(today, mondayOffset + (weekOffset * 7))

  const weekDates = []
  for (let i = 0; i < 7; i++) {
    weekDates.push(addDays(weekStart, i))
  }

  useEffect(() => {
    const loadWeek = async () => {
      setLoading(true)
      const activeCourts = club.courts?.filter(c => c.active) || []
      if (!activeCourts.length) { setLoading(false); return }

      const weekData = {}

      for (const dateStr of weekDates) {
        let totalSlots = 0
        let bookedSlots = 0
        let revenue = 0
        const slotDetails = []

        for (const court of activeCourts) {
          const { data: slots } = await supabase.rpc('get_available_slots', {
            p_court_id: court.id,
            p_date: dateStr,
          })
          if (slots) {
            for (const s of slots) {
              totalSlots++
              const isBooked = !s.is_available
              if (isBooked) {
                bookedSlots++
                revenue += s.price_cents
              }
              slotDetails.push({
                time: s.start_time?.substring(0, 5),
                booked: isBooked,
                courtName: court.name || `C${court.court_number}`,
                price: s.price_cents,
                isPeak: s.is_peak,
              })
            }
          }
        }

        weekData[dateStr] = { totalSlots, bookedSlots, revenue, slots: slotDetails }
      }

      setData(weekData)
      setLoading(false)
    }
    loadWeek()
  }, [weekOffset, club.id])

  // Collect all unique time slots across the week for the grid rows
  const allTimes = new Set()
  Object.values(data).forEach(d => d.slots?.forEach(s => allTimes.add(s.time)))
  const sortedTimes = [...allTimes].sort()

  // Week totals
  const weekTotalSlots = Object.values(data).reduce((s, d) => s + d.totalSlots, 0)
  const weekBookedSlots = Object.values(data).reduce((s, d) => s + d.bookedSlots, 0)
  const weekRevenue = Object.values(data).reduce((s, d) => s + d.revenue, 0)
  const weekOccupancy = weekTotalSlots > 0 ? Math.round((weekBookedSlots / weekTotalSlots) * 100) : 0

  const formatWeekLabel = () => {
    const start = new Date(weekStart + 'T12:00:00')
    const end = new Date(addDays(weekStart, 6) + 'T12:00:00')
    const opts = { day: 'numeric', month: 'short' }
    return `${start.toLocaleDateString(es ? 'es-MX' : 'en-US', opts)} — ${end.toLocaleDateString(es ? 'es-MX' : 'en-US', opts)}`
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekOffset(w => w - 1)} className="text-zinc-400 hover:text-white px-2 py-1 text-sm font-bold">
          ‹ {es ? 'Anterior' : 'Previous'}
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{formatWeekLabel()}</p>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-[10px] text-emerald-400">
              {es ? 'Ir a esta semana' : 'Go to this week'}
            </button>
          )}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} className="text-zinc-400 hover:text-white px-2 py-1 text-sm font-bold">
          {es ? 'Siguiente' : 'Next'} ›
        </button>
      </div>

      {/* Week summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card p-3 text-center">
          <p className={`text-lg font-black ${weekOccupancy > 70 ? 'text-emerald-400' : weekOccupancy > 40 ? 'text-amber-400' : 'text-red-400'}`}>
            {loading ? '—' : `${weekOccupancy}%`}
          </p>
          <p className="text-[9px] text-zinc-500 uppercase">{es ? 'Ocupación' : 'Occupancy'}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-lg font-black text-white">
            {loading ? '—' : `${weekBookedSlots}/${weekTotalSlots}`}
          </p>
          <p className="text-[9px] text-zinc-500 uppercase">{es ? 'Reservas' : 'Bookings'}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-lg font-black text-emerald-400">
            {loading ? '—' : `$${(weekRevenue / 100).toFixed(0)}`}
          </p>
          <p className="text-[9px] text-zinc-500 uppercase">{es ? 'Ingresos' : 'Revenue'}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8"><div className="glass-spinner mx-auto" /></div>
      ) : (
        <>
          {/* Day-by-day breakdown */}
          <div className="space-y-2">
            {weekDates.map(dateStr => {
              const d = data[dateStr] || { totalSlots: 0, bookedSlots: 0, revenue: 0 }
              const occ = d.totalSlots > 0 ? Math.round((d.bookedSlots / d.totalSlots) * 100) : 0
              const dateObj = new Date(dateStr + 'T12:00:00')
              const isToday = dateStr === today

              return (
                <div key={dateStr} className={`glass-card p-3 ${isToday ? 'border-emerald-500/30' : ''}`}
                  style={isToday ? { borderColor: 'rgba(16,185,129,0.3)' } : undefined}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {dayNames[dateObj.getDay()]} {dateObj.getDate()}
                      </span>
                      {isToday && <span className="text-[8px] text-emerald-400 font-black uppercase">HOY</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-zinc-500">{d.bookedSlots}/{d.totalSlots}</span>
                      <span className={`text-xs font-black ${occ > 70 ? 'text-emerald-400' : occ > 40 ? 'text-amber-400' : occ > 0 ? 'text-red-400' : 'text-zinc-600'}`}>
                        {occ}%
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold">${(d.revenue / 100).toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Mini slot bar — visual heatmap */}
                  {d.totalSlots > 0 && (
                    <div className="flex gap-0.5">
                      {(d.slots || [])
                        .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                        .map((s, i) => (
                          <div
                            key={i}
                            className={`h-3 flex-1 rounded-sm ${
                              s.booked
                                ? 'bg-emerald-500/60'
                                : s.isPeak
                                ? 'bg-amber-500/20'
                                : 'bg-zinc-800'
                            }`}
                            title={`${s.time} ${s.courtName} — ${s.booked ? 'Reservado' : 'Libre'} $${(s.price / 100).toFixed(0)}`}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 justify-center">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
              <span className="text-[9px] text-zinc-500">{es ? 'Reservado' : 'Booked'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-amber-500/20" />
              <span className="text-[9px] text-zinc-500">Peak {es ? 'libre' : 'free'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-zinc-800" />
              <span className="text-[9px] text-zinc-500">{es ? 'Libre' : 'Free'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
