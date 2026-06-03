import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'

export default function AdminOverview({ club }) {
  const { lang } = useI18n()
  const es = lang === 'es'
  const [stats, setStats] = useState({ todayBookings: 0, todayRevenue: 0, totalBookings: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const d = new Date()
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const [todayRes, totalRes] = await Promise.all([
        supabase.from('club_bookings').select('id, price_cents').eq('club_id', club.id).eq('booking_date', today).neq('status', 'cancelled'),
        supabase.from('club_bookings').select('id', { count: 'exact' }).eq('club_id', club.id).neq('status', 'cancelled'),
      ])
      const todayData = todayRes.data || []
      setStats({
        todayBookings: todayData.length,
        todayRevenue: todayData.reduce((sum, b) => sum + (b.price_cents || 0), 0),
        totalBookings: totalRes.count || 0,
      })
      setLoading(false)
    }
    load()
  }, [club.id])

  const cards = [
    { label: es ? 'Reservas hoy' : 'Today\'s bookings', value: stats.todayBookings, icon: '📅' },
    { label: es ? 'Ingresos hoy' : 'Today\'s revenue', value: `$${(stats.todayRevenue / 100).toFixed(0)}`, icon: '💰' },
    { label: es ? 'Canchas activas' : 'Active courts', value: club.courts?.filter(c => c.active).length || 0, icon: '🏟️' },
    { label: es ? 'Total reservas' : 'Total bookings', value: stats.totalBookings, icon: '📊' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map(c => (
          <div key={c.label} className="glass-card p-4">
            <span className="text-xl">{c.icon}</span>
            <p className={`text-xl font-black text-white mt-1 ${loading ? 'animate-pulse' : ''}`}>
              {loading ? '—' : c.value}
            </p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
