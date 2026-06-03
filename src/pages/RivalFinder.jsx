import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import GlassButton from '@/components/ui/GlassButton'

const RIVAL_PROFILE_COLUMNS = 'id, display_name, avatar_url, elo_rating, level_self, city, zone, availability_days, availability_times'

export default function RivalFinder({ hideHeader = false }) {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { showToast } = useUiStore()
  const [rivals, setRivals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterZone, setFilterZone] = useState(true)
  const [pendingRequests, setPendingRequests] = useState([])

  const fetchPending = async () => {
    if (!user) return
    const { data } = await supabase
      .from('friendships')
      .select('id, requester:profiles!requester_id(id, display_name, avatar_url, elo_rating)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
    setPendingRequests(data || [])
  }

  useEffect(() => {
    fetchPending()
  }, [user])

  useEffect(() => {
    const findRivals = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('profiles')
          .select(RIVAL_PROFILE_COLUMNS)
          .neq('id', user?.id)
          .order('elo_rating', { ascending: false })

        if (search) {
          const safe = search.replace(/[%_\\,.()"']/g, '')
          query = query.ilike('display_name', `%${safe}%`)
        } else {
          // Default: Suggest people within ATP ±150 if not searching
          const myElo = profile?.elo_rating || 1200
          query = query.gte('elo_rating', myElo - 150).lte('elo_rating', myElo + 150)
        }

        const { data, error } = await query
        if (error) throw error

        // Calculate overlap and score
        const scoredRivals = (data || []).map(rival => {
          let score = 0
          const overlappingDays = rival.availability_days?.filter(d => profile?.availability_days?.includes(d)) || []
          const overlappingTimes = rival.availability_times?.filter(t => profile?.availability_times?.includes(t)) || []
          
          if (rival.zone === profile?.zone) score += 50
          score += (overlappingDays.length * 10)
          score += (overlappingTimes.length * 15)

          return { ...rival, score, overlappingDays, overlappingTimes }
        })

        // Sort by score
        setRivals(scoredRivals.sort((a, b) => b.score - a.score))
      } catch (err) {
        showToast({ type: 'error', message: 'Error al buscar rivales' })
      } finally {
        setLoading(false)
      }
    }

    if (user?.id) findRivals()
  }, [user?.id, search, profile, filterZone])

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      {!hideHeader && (
        <div className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 pt-6 pb-4 space-y-4">
          <h1 className="text-2xl font-black text-white italic tracking-tighter">BUSCAR <span className="text-emerald-500">RIVALES</span></h1>
          
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input pl-10"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
          </div>
        </div>
      )}

      {/* Search Bar when inside Hub */}
      {hideHeader && (
        <div className="px-4 py-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input pl-10"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
          </div>
        </div>
      )}

      {/* Suggestion List */}
      <div className="px-4 py-6 space-y-6">
        <section>
          {/* Pending Friend Requests Section */}
          {pendingRequests.length > 0 && !search && (
            <section className="mb-8 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <h2 className="text-xs font-black uppercase text-emerald-500 tracking-[0.2em]">Solicitudes Pendientes ({pendingRequests.length})</h2>
              </div>
              <div className="space-y-3">
                {pendingRequests.map(req => (
                  <div key={req.id} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/player/${req.requester.id}`)}>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold overflow-hidden">
                        {req.requester.avatar_url ? (
                          <img src={req.requester.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          req.requester.display_name[0].toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{req.requester.display_name}</p>
                        <p className="text-[10px] text-zinc-500 font-black uppercase">{Math.round(req.requester.elo_rating)} ATP</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <GlassButton
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', req.id)
                          if (!error) {
                            showToast({ type: 'success', message: '¡Pala aceptada! 🎾' })
                            fetchPending()
                          }
                        }}
                      >
                        Aceptar
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await supabase.from('friendships').delete().eq('id', req.id)
                          showToast({ type: 'info', message: 'Solicitud eliminada' })
                          fetchPending()
                        }}
                      >
                        ✕
                      </GlassButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xs font-black uppercase text-zinc-500 tracking-[0.2em]">{search ? 'Resultado de búsqueda' : 'Sugerencias para ti'}</h2>
            {!search && <span className="text-[10px] text-zinc-700">Basado en ATP y Zona</span>}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-zinc-900/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : rivals.length === 0 ? (
            <div className="text-center py-10 glass-card border-dashed">
              <p className="text-zinc-500 text-sm italic">No encontramos rivales compatibles hoy</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {rivals.map(rival => (
                <div
                  key={rival.id}
                  onClick={() => navigate(`/player/${rival.id}`)}
                  className="glass-card p-4 active:scale-[0.98] transition relative overflow-hidden group"
                >
                  {/* Match Score Badge */}
                  {rival.score > 0 && (
                    <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded-bl-xl border-l border-b border-emerald-500/20">
                      MODO MATCH 🔥
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-zinc-800 flex items-center justify-center text-xl font-bold text-white uppercase group-hover:border-emerald-500 transition">
                      {rival.avatar_url ? (
                        <img src={rival.avatar_url} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        rival.display_name?.[0]
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold truncate">{rival.display_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-emerald-500 font-black text-sm">{Math.round(rival.elo_rating)} ATP</span>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-500 text-xs">{rival.zone || 'Sin zona'}</span>
                      </div>

                      {/* Overlap Badges */}
                      <div className="flex flex-wrap gap-1 mt-3">
                        {rival.zone === profile?.zone && (
                          <span className="bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border border-blue-500/20">
                            Misma Zona 📍
                          </span>
                        )}
                        {rival.overlappingDays.length > 0 && (
                          <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Horario Compatible 🕒
                          </span>
                        )}
                        {Math.abs(rival.elo_rating - (profile?.elo_rating || 1200)) < 50 && (
                          <span className="bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border border-purple-500/20">
                            Nivel Similar ⚡
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
