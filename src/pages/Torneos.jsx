import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import GlassButton from '@/components/ui/GlassButton'
import { formatDateSafe, formatDisplayName } from '@/utils/dateFormatters'

const STATUS_LABELS = {
  setup: { label: 'Configurando', color: 'bg-zinc-600 text-zinc-200' },
  registration: { label: 'Inscripciones', color: 'bg-yellow-500/20 text-yellow-300' },
  in_progress: { label: 'En Curso', color: 'bg-red-500/20 text-red-300' },
  finished: { label: 'Finalizado', color: 'bg-emerald-500/20 text-emerald-300' },
}

const FORMAT_LABELS = {
  eliminacion: 'Eliminacion Directa',
  americano: 'Americano',
  liguilla: 'Liguilla',
}

export default function Torneos() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { t: i18n } = useI18n()
  const [tournaments, setTournaments] = useState([])
  const [participantCounts, setParticipantCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, active, finished, mine

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tournaments')
      .select('*, creator:created_by(display_name)')
      .order('created_at', { ascending: false })
    if (!error) {
      setTournaments(data || [])
      // Fetch participant counts for all tournaments
      if (data?.length) {
        const ids = data.map(tr => tr.id)
        const { data: counts } = await supabase
          .from('tournament_participants')
          .select('tournament_id, status')
          .in('tournament_id', ids)
          .neq('status', 'cancelled')
        if (counts) {
          const map = {}
          counts.forEach(c => {
            if (!map[c.tournament_id]) map[c.tournament_id] = { registered: 0, waitlisted: 0 }
            if (c.status === 'registered') map[c.tournament_id].registered++
            else if (c.status === 'waitlisted') map[c.tournament_id].waitlisted++
          })
          setParticipantCounts(map)
        }
      }
    }
    setLoading(false)
  }

  const filtered = tournaments.filter(t => {
    if (filter === 'active') return t.status === 'registration' || t.status === 'in_progress'
    if (filter === 'finished') return t.status === 'finished'
    if (filter === 'mine') return t.created_by === user?.id
    return true
  })

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600/20 via-zinc-900 to-zinc-900 border-b border-zinc-800 px-4 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Torneos</h1>
            <p className="text-zinc-400 text-sm mt-1">{tournaments.length} torneos creados</p>
          </div>
          <GlassButton
            variant="primary"
            size="sm"
            onClick={() => navigate('/create-tournament')}
          >
            + Crear
          </GlassButton>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'Todos', color: 'cyan' },
            { id: 'active', label: 'Activos', color: 'emerald' },
            { id: 'finished', label: 'Finalizados', color: 'purple' },
            { id: 'mine', label: 'Mis Torneos', color: 'amber' },
          ].map(f => (
            <GlassButton
              key={f.id}
              pill
              pillColor={filter === f.id ? f.color : undefined}
              variant={filter === f.id ? 'primary' : 'ghost'}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </GlassButton>
          ))}
        </div>

        {/* Tournament List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-4xl">🏆</p>
            <p className="text-zinc-400">
              {filter === 'mine' ? 'No has creado ningun torneo aun' : 'No hay torneos disponibles'}
            </p>
            <GlassButton
              variant="primary"
              onClick={() => navigate('/create-tournament')}
            >
              Crear Primer Torneo
            </GlassButton>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t, idx) => {
              const status = STATUS_LABELS[t.status] || STATUS_LABELS.setup
              const format = FORMAT_LABELS[t.format] || t.format || 'Formato pendiente'

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => navigate(`/torneo/${t.id}`)}
                  className="glass-card p-4 cursor-pointer transition"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-white font-bold">{t.name}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {format} · máx. {t.max_players} cupos
                      </p>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Spots counter */}
                  {(t.status === 'registration' || t.status === 'in_progress') && (
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-zinc-400">
                        {participantCounts[t.id]?.registered || 0}/{t.max_players} equipos
                      </span>
                      {participantCounts[t.id]?.waitlisted > 0 && (
                        <span className="text-[10px] text-yellow-400">
                          +{participantCounts[t.id].waitlisted} en espera
                        </span>
                      )}
                      {t.status === 'registration' && participantCounts[t.id]?.registered >= t.max_players && (
                        <span className="text-[10px] text-red-400 font-bold">LLENO</span>
                      )}
                    </div>
                  )}

                    <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Creado por {formatDisplayName(t.creator?.display_name, 'Sin creador')}</span>
                    <span>{formatDateSafe(t.created_at, { day: 'numeric', month: 'short', year: 'numeric' }, 'Fecha pendiente')}</span>
                  </div>

                  {t.deadline && t.status === 'registration' && (
                    <div className="mt-1.5 text-[10px] text-zinc-500">
                      Cierre: {formatDateSafe(t.deadline, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, 'Cierre pendiente')}
                    </div>
                  )}

                  {t.join_code && t.status === 'registration' && (
                    <div className="mt-1.5 text-xs">
                      <span className="text-zinc-600">Codigo: </span>
                      <span className="text-emerald-400 font-mono font-bold">#{t.join_code}</span>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
