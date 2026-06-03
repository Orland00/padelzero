import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useClubStore } from '@/stores/clubStore'
import { useI18n } from '@/lib/i18n'
import { usePageTitle } from '@/hooks/usePageTitle'
import AdminOverview from '@/components/clubs/AdminOverview'
import AdminAvailability from '@/components/clubs/AdminAvailability'
import AdminBookings from '@/components/clubs/AdminBookings'
import AdminCourts from '@/components/clubs/AdminCourts'
import AdminOccupancy from '@/components/clubs/AdminOccupancy'
import AdminOverrides from '@/components/clubs/AdminOverrides'
import HeavyUsersList from '@/components/clubs/HeavyUsersList'
import { SkeletonCard } from '@/components/common/LoadingSkeleton'

export default function ClubAdmin() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { lang } = useI18n()
  const es = lang === 'es'
  const { user } = useAuthStore()
  const { club, clubLoading, loadClub } = useClubStore()
  const [tab, setTab] = useState('overview')

  usePageTitle(club ? `Admin — ${club.name}` : 'Admin')

  useEffect(() => {
    loadClub(slug)
  }, [slug, loadClub])

  if (clubLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
        <div className="px-4 pt-6 space-y-4"><SkeletonCard /><SkeletonCard /></div>
      </div>
    )
  }

  // Club not found or not owner
  if (!club || club.owner_user_id !== user?.id) {
    return (
      <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-lg mb-2">{!club ? '404' : '🔒'}</p>
          <p className="text-zinc-400">
            {!club
              ? (es ? 'Club no encontrado' : 'Club not found')
              : (es ? 'No tienes acceso a este panel' : 'No access to this panel')}
          </p>
          <button onClick={() => navigate(club ? `/club/${slug}` : '/clubes')} className="text-emerald-400 text-sm font-bold mt-3">
            {es ? 'Volver' : 'Go back'}
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: es ? 'Resumen' : 'Overview' },
    { id: 'availability', label: es ? 'Horarios' : 'Schedules' },
    { id: 'bookings', label: es ? 'Reservas' : 'Bookings' },
    { id: 'courts', label: es ? 'Canchas' : 'Courts' },
    { id: 'occupancy', label: es ? 'Ocupación' : 'Occupancy' },
    { id: 'overrides', label: es ? 'Cierres' : 'Closures' },
    { id: 'vip', label: es ? 'VIP' : 'VIP' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="px-4 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white">{club.name}</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">{es ? 'Panel de administración' : 'Admin Panel'}</p>
          </div>
          <button onClick={() => navigate(`/club/${slug}`)} className="text-xs text-emerald-400 font-bold">
            {es ? 'Ver perfil' : 'View profile'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                tab === t.id
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && <AdminOverview club={club} />}
        {tab === 'availability' && <AdminAvailability club={club} />}
        {tab === 'bookings' && <AdminBookings club={club} />}
        {tab === 'courts' && <AdminCourts club={club} onCourtsChanged={() => loadClub(slug)} />}
        {tab === 'occupancy' && <AdminOccupancy club={club} />}
        {tab === 'overrides' && <AdminOverrides club={club} />}
        {/* VIP Players — heavy users + debt tracking (Updated: 2026-05-07) */}
        {tab === 'vip' && (
          <section className="mt-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
              {es ? 'Jugadores VIP' : 'VIP Players'}
            </h2>
            <HeavyUsersList />
          </section>
        )}
      </div>
    </div>
  )
}
