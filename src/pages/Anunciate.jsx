import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import Roadmap from '@/components/Roadmap'
import { normalizeCity, normalizeCountry } from '@/lib/utils'
import { useUiStore } from '@/stores/uiStore'
import GlassButton from '@/components/ui/GlassButton'

export default function Anunciate({ hideHeader = false }) {
  const [searchParams] = useSearchParams()
  const intent = searchParams.get('intent')
  const slug = searchParams.get('slug')
  const [tab, setTab] = useState(intent === 'claim' ? 'claim' : 'stats')
  const [stats, setStats] = useState({ users: 0, activeLigas: 0, activeTorneos: 0, dailyUsers: 0, matches: 0, cities: 0, countries: 0 })
  const [cityData, setCityData] = useState([])
  const [loading, setLoading] = useState(true)

  // Track page visit
  // Removed: prior per-browser visit counter in localStorage that was written
  // but never rendered (dead code). A1 UX audit flagged the "Total de visitantes"
  // line as fake analytics; that line actually renders stats.users (real DB
  // count), but the counter below was genuinely dead-writing to localStorage.

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, ligasRes, torneosRes, recentRes, matchesRes, ligaMatchesRes, locationsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_dummy', false),
          supabase.from('ligas').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('tournaments').select('id', { count: 'exact', head: true }).or('status.eq.registration,status.eq.in_progress'),
          supabase.from('profiles').select('id', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from('matches').select('id', { count: 'exact', head: true }),
          supabase.from('liga_matches').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('city, country').not('city', 'is', null),
        ])

        const profileLocations = locationsRes.data || []
        const uniqueCities    = new Set(profileLocations.map(p => p.city).filter(Boolean))
        const uniqueCountries = new Set(profileLocations.map(p => p.country).filter(Boolean))

        // Build city leaderboard (normalize to merge duplicates like Mexico City/Mexico City)
        const cityCount = {}
        profileLocations.forEach(p => {
          if (!p.city) return
          const normalized = normalizeCity(p.city)
          const country = normalizeCountry(p.country)
          const key = `${normalized}|${country}`
          cityCount[key] = (cityCount[key] || 0) + 1
        })
        const sortedCities = Object.entries(cityCount)
          .map(([key, count]) => {
            const [city, country] = key.split('|')
            return { city, country, count }
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
        setCityData(sortedCities)

        setStats({
          users: usersRes.count || 0,
          activeLigas: ligasRes.count || 0,
          activeTorneos: torneosRes.count || 0,
          dailyUsers: Math.round((recentRes.count || 0) / 30) || 0,
          matches: (matchesRes.count || 0) + (ligaMatchesRes.count || 0),
          cities: uniqueCities.size,
          countries: uniqueCountries.size,
        })
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }

    fetchStats()

    // Realtime: re-fetch cuando cambien perfiles, partidos o sesiones
    const channel = supabase
      .channel('anunciate-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'liga_matches' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ligas' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, fetchStats)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      {!hideHeader && (
        <div className="px-4 pt-6">
          <h1 className="text-2xl font-bold text-white">Anúnciate</h1>
          <p className="text-sm text-zinc-400 mt-1">Llega a la comunidad padelera más activa</p>
        </div>
      )}

      {/* Claim Tab (deep-link from ClubProfile claim button) */}
      {tab === 'claim' && (
        <ClaimClubPanel slug={slug} onDone={() => setTab('stats')} />
      )}

      {/* Tabs */}
      <div className="px-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'stats',   label: 'Stats', color: 'emerald' },
            { key: 'roadmap', label: 'Roadmap', color: 'purple' },
            { key: 'info',    label: 'Trabaja', color: 'cyan' },
          ].map(t => (
            <GlassButton
              key={t.key}
              pill
              pillColor={tab === t.key ? t.color : undefined}
              variant={tab === t.key ? 'primary' : 'ghost'}
              onClick={() => setTab(t.key)}
              fullWidth
            >
              {t.label}
            </GlassButton>
          ))}
        </div>
      </div>

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div className="px-4 space-y-4">
          {/* Live stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: stats.users,          label: 'Jugadores',       color: 'text-emerald-500' },
              { value: stats.matches,        label: 'Partidos jugados',color: 'text-purple-400'  },
              { value: stats.activeLigas,    label: 'Ligas activas',   color: 'text-blue-400'    },
              { value: stats.activeTorneos,  label: 'Torneos activos', color: 'text-yellow-400'  },
              { value: stats.cities,         label: 'Ciudades',        color: 'text-pink-400'    },
              { value: stats.countries,      label: 'Países',          color: 'text-orange-400'  },
            ].map(s => (
              <div key={s.label} className="glass-card p-4 text-center space-y-1">
                <p className={`text-3xl font-bold ${s.color}`}>
                  {loading ? '…' : s.value}
                </p>
                <p className="text-xs text-zinc-400 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Total visitors */}
          {stats.users > 0 && (
            <div className="glass-card p-3 flex items-center justify-between">
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Total de visitantes</p>
              <p className="text-lg font-black text-cyan-400">{stats.users}</p>
            </div>
          )}

          {/* Cities where people play */}
          {cityData.length > 0 && (
            <div className="glass-card p-4 space-y-3">
              <h2 className="text-white font-bold flex items-center gap-2">
                📍 ¿Dónde se juega pádel?
              </h2>
              <div className="space-y-2">
                {cityData.map((c, i) => {
                  const maxCount = cityData[0]?.count || 1
                  const pct = Math.round((c.count / maxCount) * 100)
                  return (
                    <div key={`${c.city}-${c.country}`} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-zinc-500 w-5">{i + 1}</span>
                          <span className="text-sm text-white font-bold">{c.city}</span>
                          {c.country && <span className="text-[10px] text-zinc-600">{c.country}</span>}
                        </div>
                        <span className="text-xs font-bold text-emerald-400">{c.count} jugadores</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden ml-7">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-zinc-600 text-center pt-1">
                Datos en tiempo real de jugadores registrados
              </p>
            </div>
          )}

          {/* Why advertise */}
          <div className="glass-card p-4 space-y-3">
            <h2 className="text-white font-bold">¿Por qué anunciarte aquí?</h2>
            <div className="space-y-2 text-sm">
              {[
                { icon: '🎯', text: 'Audiencia 100% padelera — jugadores activos, no bots' },
                { icon: '📍', text: 'Segmentación local — llega a jugadores de tu zona' },
                { icon: '📊', text: 'Métricas reales — impresiones, clics y conversiones' },
                { icon: '⚡', text: 'Integración nativa — no parece publicidad, parece contenido' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <p className="text-zinc-300">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Formats */}
          <div className="glass-card p-4 space-y-3">
            <h2 className="text-white font-bold">Formatos disponibles</h2>
            <div className="space-y-2">
              {[
                { name: 'Club Destacado', desc: 'Tu club en el top del ranking local', badge: 'Clubs' },
                { name: 'Torneo Patrocinado', desc: 'Tu marca en torneos y ligas activas', badge: 'Torneos' },
                { name: 'Banner Nativo', desc: 'Aparece en el feed de actividad', badge: 'Feed' },
                { name: 'Perfil Verificado', desc: 'Distintivo especial en búsquedas', badge: 'Pro' },
              ].map(f => (
                <div key={f.name} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-zinc-500">{f.desc}</p>
                  </div>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    {f.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* All Sports Expansion */}
          <div className="bg-gradient-to-br from-cyan-500/10 via-zinc-900 to-yellow-500/10 border border-cyan-500/20 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌍</span>
              <h2 className="text-white font-bold">Más allá del pádel</h2>
            </div>
            <p className="text-sm text-zinc-400">
              Estamos construyendo la plataforma de torneos y datos deportivos más grande de Latinoamérica.
              Pronto podrás organizar torneos, ligas y rankings en cualquier deporte.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: '🎾', name: 'Tenis' },
                { icon: '🏓', name: 'Pickleball' },
                { icon: '⚽', name: 'Fútbol' },
                { icon: '🏀', name: 'Básquet' },
              ].map(sport => (
                <div key={sport.name} className="text-center py-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  <p className="text-xl mb-1">{sport.icon}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">{sport.name}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-zinc-800" />
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Próximamente</p>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>
            <p className="text-xs text-zinc-500 text-center">
              Torneos con brackets, estadísticas avanzadas, ATP universal y análisis de datos para cualquier deporte de raqueta y más.
            </p>
          </div>
        </div>
      )}

      {/* Roadmap Tab */}
      {tab === 'roadmap' && (
        <div className="px-4 space-y-4">
          {/* V1 Progress banner */}
          <div className="bg-gradient-to-r from-emerald-500/15 to-transparent border border-emerald-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wide">En desarrollo ahora</p>
                <h2 className="text-white font-bold text-lg">V1 — Cancha Base</h2>
                <p className="text-xs text-zinc-400">Comunidad hiperlocal · Q2 2026</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-500">50%</p>
                <p className="text-xs text-zinc-500">completado</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '50%' }} />
            </div>
            {/* V1 feature checklist */}
            <div className="space-y-1.5 pt-1">
              {[
                { name: 'Perfiles de jugador + ATP inicial', done: true },
                { name: 'Auth (Google + Email)', done: true },
                { name: 'Liga / Torneo (Round-robin + bracket)', done: true },
                { name: 'Ranking Nacional / Amigos / Local', done: true },
                { name: 'Sistema ATP dinámico post-partido', done: false },
                { name: 'Feed social hiperlocal', done: false },
                { name: 'Validación cruzada de partidos', done: false },
                { name: 'PWA + Offline', done: false },
              ].map(f => (
                <div key={f.name} className="flex items-center gap-2">
                  <span className={`text-sm flex-shrink-0 ${f.done ? 'text-emerald-400' : 'text-zinc-600'}`}>
                    {f.done ? '✓' : '○'}
                  </span>
                  <p className={`text-xs ${f.done ? 'text-zinc-300' : 'text-zinc-500'}`}>{f.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Full roadmap component */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <Roadmap />
          </div>
        </div>
      )}

      {/* Info / Work with us Tab */}
      {tab === 'info' && (
        <div className="px-4 space-y-4">
          <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-5 space-y-2">
            <p className="text-2xl">🤝</p>
            <h2 className="text-white font-bold text-lg">Trabaja con nosotros</h2>
            <p className="text-sm text-zinc-400">
              Somos una plataforma en crecimiento y buscamos clubs, marcas y organizadores que quieran crecer junto con la comunidad.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {[
              {
                icon: '🏟️',
                title: 'Soy un club de pádel',
                desc: 'Regístrate como club verificado, aparece en búsquedas de jugadores y gestiona torneos desde la plataforma.',
                cta: 'Registrar mi club',
              },
              {
                icon: '🏷️',
                title: 'Tengo una marca/negocio',
                desc: 'Patrocina torneos, anúnciate en el ranking local o integra tu marca en el feed de actividad.',
                cta: 'Ver opciones de publicidad',
              },
              {
                icon: '🎙️',
                title: 'Soy organizador de torneos',
                desc: 'Usa nuestra plataforma para gestionar brackets, standings y comunicación con participantes.',
                cta: 'Empezar a organizar',
              },
              {
                icon: '👨‍💻',
                title: 'Quiero unirme al equipo',
                desc: 'Buscamos desarrolladores, diseñadores y community managers apasionados por el pádel.',
                cta: 'Ver posiciones abiertas',
              },
            ].map(option => (
              <div key={option.title} className="glass-card p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{option.icon}</span>
                  <h3 className="text-white font-semibold text-sm">{option.title}</h3>
                </div>
                <p className="text-xs text-zinc-400">{option.desc}</p>
                <button
                  onClick={() => window.open('mailto:hola@padelzero.win?subject=' + encodeURIComponent(option.title), '_blank')}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition text-left px-3"
                >
                  {option.cta} →
                </button>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="glass-card p-4 text-center space-y-2">
            <p className="text-white font-semibold">¿Prefieres hablar directo?</p>
            <p className="text-xs text-zinc-400">Escríbenos y te respondemos en menos de 24 horas</p>
            <a
              href="mailto:hola@padelzero.win"
              className="inline-block px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm rounded-lg transition"
            >
              hola@padelzero.win
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function ClaimClubPanel({ slug, onDone }) {
  const showToast = useUiStore(s => s.showToast)
  const [club, setClub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) { setLoading(false); setNotFound(true); return }
    supabase
      .from('clubs')
      .select('id, name, slug, address, owner_user_id, claimed_by')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setNotFound(true) } else { setClub(data) }
        setLoading(false)
      })
  }, [slug])

  const handleClaim = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast({ type: 'error', message: 'Inicia sesión para reclamar' }); setSubmitting(false); return }
      if (club.owner_user_id || club.claimed_by) {
        showToast({ type: 'warning', message: 'Este club ya está reclamado' })
        onDone?.()
        return
      }
      const { error } = await supabase.rpc('request_club_claim', { p_slug: club.slug })
      if (error) {
        if (error.code === 'P0002' || /claimable/.test(error.message || '')) {
          showToast({ type: 'warning', message: 'Este club ya no está disponible para reclamar' })
          onDone?.()
          return
        }
        throw error
      }
      showToast({ type: 'success', message: 'Solicitud enviada. Te contactamos por correo.', duration: 4000 })
      onDone?.()
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Error al reclamar', duration: 4000 })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="px-4 py-8 text-center text-zinc-500 text-sm">Cargando…</div>
  if (notFound) return (
    <div className="px-4 py-8 text-center space-y-3">
      <p className="text-zinc-400 text-sm">No encontramos el club que intentas reclamar.</p>
      <button onClick={onDone} className="text-emerald-400 text-sm font-bold">Ir a Stats</button>
    </div>
  )
  if (club.owner_user_id || club.claimed_by) return (
    <div className="px-4 py-8 text-center space-y-3">
      <p className="text-zinc-400 text-sm">Este club ya fue reclamado.</p>
      <button onClick={onDone} className="text-emerald-400 text-sm font-bold">Ir a Stats</button>
    </div>
  )

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="glass-card p-5 space-y-3">
        <h2 className="text-lg font-black text-white">Reclamar club</h2>
        <div>
          <p className="text-sm text-zinc-300 font-bold">{club.name}</p>
          {club.address && <p className="text-xs text-zinc-500">{club.address}</p>}
        </div>
        <p className="text-xs text-zinc-400">
          Confirma tu solicitud. Validaremos contigo por mail/WhatsApp antes de transferir la administración.
        </p>
        <GlassButton variant="primary" fullWidth onClick={handleClaim} disabled={submitting} loading={submitting}>
          {submitting ? 'Enviando…' : 'Enviar solicitud'}
        </GlassButton>
        <button onClick={onDone} className="w-full text-xs text-zinc-500 mt-2">Cancelar</button>
      </div>
    </div>
  )
}
