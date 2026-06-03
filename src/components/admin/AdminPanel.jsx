import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { ADMIN_USER_ID } from '@/lib/constants'

export default function AdminPanel() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [recentInterests, setRecentInterests] = useState([])
  const [recentErrors, setRecentErrors] = useState([])
  const [loading, setLoading] = useState(true)

  // Only render for admin
  if (user?.id !== ADMIN_USER_ID) return null

  useEffect(() => {
    const load = async () => {
      const [usersRes, clubsRes, coachesRes, bookingsRes, matchesRes, interestsRes, waUsersRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('clubs').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('coaches').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('club_bookings').select('id', { count: 'exact', head: true }).neq('status', 'cancelled'),
        supabase.from('liga_matches').select('id', { count: 'exact', head: true }),
        supabase.from('feature_interests').select('feature_key, user_id, created_at, profiles:user_id(display_name)')
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('whatsapp_users').select('id', { count: 'exact', head: true }),
      ])

      setStats({
        users: usersRes.count || 0,
        clubs: clubsRes.count || 0,
        coaches: coachesRes.count || 0,
        bookings: bookingsRes.count || 0,
        matches: matchesRes.count || 0,
        waUsers: waUsersRes.count || 0,
      })

      setRecentInterests(interestsRes.data || [])

      // Get recent error-like bookings (cancelled by webhook = payment failed)
      const { data: failedBookings } = await supabase
        .from('club_bookings')
        .select('id, booking_date, status, created_at, cancelled_at, profiles!booked_by(display_name)')
        .eq('status', 'cancelled')
        .not('cancelled_at', 'is', null)
        .order('cancelled_at', { ascending: false })
        .limit(5)

      setRecentErrors(failedBookings || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-center py-4"><div className="glass-spinner mx-auto" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🛡️</span>
        <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">Super Admin</h3>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Usuarios', value: stats?.users, icon: '👥' },
          { label: 'Clubes', value: stats?.clubs, icon: '🏟️' },
          { label: 'Coaches', value: stats?.coaches, icon: '🎓' },
          { label: 'Reservas', value: stats?.bookings, icon: '📅' },
          { label: 'Partidos', value: stats?.matches, icon: '🎾' },
          { label: 'WA Users', value: stats?.waUsers, icon: '🤖' },
        ].map(s => (
          <div key={s.label} className="glass-card p-2 text-center">
            <span className="text-sm">{s.icon}</span>
            <p className="text-lg font-black text-white">{s.value ?? '—'}</p>
            <p className="text-[9px] text-zinc-500 uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent "Me interesa" clicks */}
      <div>
        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
          Últimos "Me interesa"
        </h4>
        {recentInterests.length === 0 ? (
          <p className="text-xs text-zinc-600">Sin intereses aún</p>
        ) : (
          <div className="space-y-1">
            {recentInterests.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">{r.profiles?.display_name || 'Anon'}</span>
                  <span className="text-zinc-500">→</span>
                  <span className="text-zinc-300">{r.feature_key?.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-[9px] text-zinc-600">
                  {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent cancelled/failed bookings */}
      <div>
        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
          Reservas canceladas recientes
        </h4>
        {recentErrors.length === 0 ? (
          <p className="text-xs text-zinc-600">Sin cancelaciones recientes</p>
        ) : (
          <div className="space-y-1">
            {recentErrors.map(b => (
              <div key={b.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-zinc-900/50">
                <div>
                  <span className="text-red-400 font-bold">{b.profiles?.display_name || 'User'}</span>
                  <span className="text-zinc-500 ml-2">{b.booking_date}</span>
                </div>
                <span className="text-[9px] text-red-400/60 uppercase font-black">{b.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Quick Links */}
      <div>
        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
          Admin tools
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Feature Interests', path: '/admin/interests', icon: '📊' },
            { label: 'Supabase', url: 'https://supabase.com/dashboard/project/your-project', icon: '🗄️' },
            { label: 'Cloudflare', url: 'https://dash.cloudflare.com', icon: '☁️' },
          ].map(link => (
            <button
              key={link.label}
              onClick={() => link.path ? navigate(link.path) : window.open(link.url, '_blank')}
              className="glass-card p-2.5 text-left flex items-center gap-2 hover:bg-white/[0.03] transition active:scale-[0.98]"
            >
              <span className="text-sm">{link.icon}</span>
              <span className="text-xs text-zinc-300 font-bold">{link.label}</span>
              {link.url && <span className="text-[9px] text-zinc-600 ml-auto">↗</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
