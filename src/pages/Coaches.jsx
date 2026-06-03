import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import { usePageTitle } from '@/hooks/usePageTitle'
import { SkeletonCard } from '@/components/common/LoadingSkeleton'
import GlassButton from '@/components/ui/GlassButton'

const SPECIALTIES = ['beginners', 'advanced', 'kids', 'fitness', 'competition', 'technique']

export default function Coaches() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  usePageTitle('Coaches')

  const [activeTab, setActiveTab] = useState('list') // 'list' or 'reservations'
  const [coaches, setCoaches] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSpec, setFilterSpec] = useState('')
  const [isCoach, setIsCoach] = useState(false)

  const specLabels = {
    beginners: es ? 'Principiantes' : 'Beginners',
    advanced: es ? 'Avanzado' : 'Advanced',
    kids: es ? 'Niños' : 'Kids',
    fitness: 'Fitness',
    competition: es ? 'Competencia' : 'Competition',
    technique: es ? 'Técnica' : 'Technique',
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('coaches')
        .select('*, profiles!inner(display_name, avatar_url, elo_rating)')
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (!error) setCoaches(data || [])

      if (user?.id) {
        // Check if current user is coach
        const { data: myCoach } = await supabase
          .from('coaches')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle()
        setIsCoach(!!myCoach)

        // Fetch user's bookings as player
        const { data: bookings } = await supabase
          .from('coach_bookings')
          .select('*, coach:coaches(id, profiles(display_name, avatar_url))')
          .eq('booked_by', user.id)
          .order('booking_date', { ascending: false })
          .order('start_time', { ascending: false })
        
        setMyBookings(bookings || [])
      }

      setLoading(false)
    }
    load()
  }, [user?.id])

  // Filter coaches
  const filtered = coaches.filter(c => {
    const name = c.profiles?.display_name?.toLowerCase() || ''
    const city = c.city?.toLowerCase() || ''
    const q = search.toLowerCase()
    const matchesSearch = !q || name.includes(q) || city.includes(q)
    const matchesSpec = !filterSpec || c.specialties?.includes(filterSpec)
    return matchesSearch && matchesSpec
  })

  // Calculate average rating from reviews (we'll fetch inline)
  const CoachCard = ({ coach }) => {
    const [avgRating, setAvgRating] = useState(null)
    const [reviewCount, setReviewCount] = useState(0)

    useEffect(() => {
      supabase
        .from('coach_reviews')
        .select('rating')
        .eq('coach_id', coach.id)
        .then(({ data }) => {
          if (data?.length) {
            setAvgRating((data.reduce((s, r) => s + r.rating, 0) / data.length).toFixed(1))
            setReviewCount(data.length)
          }
        })
    }, [coach.id])

    return (
      <button
        onClick={() => navigate(`/coach/${coach.id}`)}
        className="glass-card p-4 flex gap-3 items-start w-full text-left hover:border-emerald-500/30 transition"
      >
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {coach.profiles?.avatar_url
            ? <img src={coach.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-lg">🎓</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white truncate">{coach.profiles?.display_name}</h3>
            {coach.verified && <span className="text-emerald-400 text-xs">✓</span>}
            <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Coach</span>
          </div>
          {coach.city && <p className="text-xs text-zinc-500 mt-0.5">{coach.city}</p>}
          <div className="flex items-center gap-2 mt-1">
            {coach.experience_years && (
              <span className="text-[10px] text-zinc-400">{coach.experience_years} {es ? 'años exp.' : 'yrs exp.'}</span>
            )}
            {coach.hourly_rate_cents && (
              <span className="text-[10px] text-emerald-400 font-bold">${(coach.hourly_rate_cents / 100).toFixed(0)}/hr</span>
            )}
            {avgRating && (
              <span className="text-[10px] text-yellow-400">⭐ {avgRating} ({reviewCount})</span>
            )}
          </div>
          {coach.specialties?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {coach.specialties.map(s => (
                <span key={s} className="text-[9px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded-full">
                  {specLabels[s] || s}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-zinc-600 text-sm mt-1">›</span>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="px-4 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Coaches</h1>
            <p className="text-sm text-zinc-400 mt-1">
              {es ? 'Encuentra tu entrenador de padel' : 'Find your padel coach'}
            </p>
          </div>
          {user && (
            <div className="flex bg-zinc-900 rounded-xl p-1">
              <button 
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'list' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500'}`}
              >
                {es ? 'Explorar' : 'Explore'}
              </button>
              <button 
                onClick={() => setActiveTab('reservations')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'reservations' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500'}`}
              >
                {es ? 'Reservas' : 'Bookings'}
              </button>
            </div>
          )}
        </div>

        {activeTab === 'list' ? (
          <>
            {/* Search bar */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={es ? 'Buscar coach, ciudad...' : 'Search coach, city...'}
                className="glass-input w-full pl-9 pr-4 py-2.5 text-sm"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
            </div>

            {/* Specialty filter chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setFilterSpec('')}
                className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                  !filterSpec ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {es ? 'Todos' : 'All'}
              </button>
              {SPECIALTIES.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSpec(filterSpec === s ? '' : s)}
                  className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                    filterSpec === s ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {specLabels[s]}
                </button>
              ))}
            </div>

            {/* Register CTA */}
            {!isCoach && (
              <button
                onClick={() => navigate('/coach/register')}
                className="glass-card p-3 flex items-center justify-between w-full text-left hover:border-emerald-500/30 transition"
              >
                <div>
                  <p className="text-sm text-white font-bold">{es ? '¿Eres entrenador?' : 'Are you a coach?'}</p>
                  <p className="text-[10px] text-zinc-500">{es ? 'Registra tu perfil y recibe alumnos' : 'Register your profile and get students'}</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                  {es ? 'Registrarme' : 'Register'}
                </div>
              </button>
            )}

            {/* Coach Dashboard link for registered coaches */}
            {isCoach && (
              <button
                onClick={() => navigate('/coach/dashboard')}
                className="glass-card p-3 flex items-center justify-between w-full text-left hover:border-emerald-500/30 transition"
              >
                <div>
                  <p className="text-sm text-white font-bold">{es ? 'Mi panel de coach' : 'My coach dashboard'}</p>
                  <p className="text-[10px] text-zinc-500">{es ? 'Gestiona horarios y reservas' : 'Manage schedule and bookings'}</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold">
                  {es ? 'Ir al panel' : 'Dashboard'}
                </div>
              </button>
            )}

            {/* Coach list */}
            {loading ? (
              <div className="space-y-3">
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">🎓</span>
                <p className="text-zinc-400 text-sm">
                  {search || filterSpec
                    ? (es ? 'No se encontraron coaches con esos filtros' : 'No coaches match those filters')
                    : (es ? 'Aún no hay coaches registrados' : 'No coaches registered yet')
                  }
                </p>
                {!search && !filterSpec && (
                  <p className="text-zinc-600 text-xs mt-2">
                    {es ? 'Sé el primero en registrarte' : 'Be the first to register'}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                  {filtered.length} {filtered.length === 1 ? 'coach' : 'coaches'}
                </p>
                {filtered.map(c => <CoachCard key={c.id} coach={c} />)}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest">{es ? 'Mis reservas de clases' : 'My lesson bookings'}</h2>
            
            {loading ? (
              <div className="space-y-3">
                <SkeletonCard /><SkeletonCard />
              </div>
            ) : myBookings.length === 0 ? (
              <div className="text-center py-12 glass-card">
                <p className="text-zinc-500 text-sm">{es ? 'No tienes reservas' : 'No bookings found'}</p>
                <GlassButton variant="primary" size="sm" onClick={() => setActiveTab('list')} className="mt-4">
                  {es ? 'Explorar coaches' : 'Explore coaches'}
                </GlassButton>
              </div>
            ) : (
              myBookings.map(b => (
                <div key={b.id} className="glass-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center">
                      {b.coach?.profiles?.avatar_url ? (
                        <img src={b.coach.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg">🎓</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{b.coach?.profiles?.display_name || 'Coach'}</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-black">
                        {b.booking_date} · {b.start_time?.substring(0,5)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${
                      b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' :
                      b.status === 'completed' ? 'bg-blue-500/10 text-blue-400' :
                      b.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>
                      {b.status === 'confirmed' ? (es ? 'Confirmada' : 'Confirmed') : 
                       b.status === 'completed' ? (es ? 'Completada' : 'Completed') :
                       b.status === 'cancelled' ? (es ? 'Cancelada' : 'Cancelled') : b.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
