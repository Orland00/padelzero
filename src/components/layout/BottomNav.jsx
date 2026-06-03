import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { isDark } = useTheme()
  const { user } = useAuthStore()
  const [hasUpcoming, setHasUpcoming] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    const checkUpcoming = async () => {
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('coach_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('booked_by', user.id)
        .eq('status', 'confirmed')
        .gte('booking_date', today)
      setHasUpcoming((count || 0) > 0)
    }
    checkUpcoming()

    // Realtime sub for bookings
    const channel = supabase.channel('nav-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_bookings', filter: `booked_by=eq.${user.id}` }, () => checkUpcoming())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  const TABS = [
    { label: t('nav.play'), path: '/play', icon: '🎾' },
    { label: lang === 'es' ? 'Clubes' : 'Clubs', path: '/clubes', icon: '🏟️' },
    { label: 'Coaches', path: '/coaches', icon: '🎓', badge: hasUpcoming },
    { label: t('nav.ads'), path: '/anunciate', icon: '🎯' },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 px-4 py-2 flex justify-around h-20 z-40"
      style={isDark ? {
        background: 'linear-gradient(170deg, rgba(28,28,38,0.88) 0%, rgba(18,18,26,0.94) 100%)',
        backdropFilter: 'blur(40px) saturate(1.6) brightness(1.08)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.6) brightness(1.08)',
        borderTop: '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -12px 40px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.1)',
      } : {
        background: 'linear-gradient(170deg, rgba(255,255,255,0.92) 0%, rgba(250,250,250,0.96) 100%)',
        backdropFilter: 'blur(40px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
      }}
      aria-label="Main navigation"
    >
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/') || (tab.path === '/clubes' && location.pathname.startsWith('/club/')) || (tab.path === '/coaches' && location.pathname.startsWith('/coach/'))
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition relative ${
              isActive
                ? 'bg-white/[0.04]'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
            style={isActive ? {
              color: '#10b981',
              filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.25))',
            } : undefined}
          >
            <div className="relative">
              <span style={{ fontSize: '19px' }}>{tab.icon}</span>
              {tab.badge && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-zinc-950 animate-pulse" />
              )}
            </div>
            <span style={{ fontSize: '9px' }} className="font-medium">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
