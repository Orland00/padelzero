import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'

const STATUS_LABELS = {
  setup: { label: 'Configurando', color: 'bg-zinc-600 text-zinc-200' },
  registration: { label: 'Inscripciones', color: 'bg-yellow-500/20 text-yellow-300' },
  in_progress: { label: 'En Curso', color: 'bg-red-500/20 text-red-300' },
  finished: { label: 'Finalizado', color: 'bg-emerald-500/20 text-emerald-300' },
}

export default function TorneosTab({ ligaId, isAdmin }) {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (ligaId) fetchTorneos()
  }, [ligaId])

  const fetchTorneos = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, name, format, max_players, status, created_at')
      .eq('liga_id', ligaId)
      .order('created_at', { ascending: false })
    if (!error) setTournaments(data || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <button
          onClick={() => navigate(`/create-tournament?liga=${ligaId}`)}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition"
        >
          + Crear Torneo
        </button>
      )}

      {tournaments.length > 0 ? (
        tournaments.map((t, idx) => {
          const status = STATUS_LABELS[t.status] || STATUS_LABELS.setup
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => navigate(`/torneo/${t.id}`)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 cursor-pointer hover:border-zinc-600 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold">{t.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {t.format || 'eliminacion'} · máx. {t.max_players} cupos
                  </p>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${status.color}`}>
                  {status.label}
                </span>
              </div>
            </motion.div>
          )
        })
      ) : (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-zinc-400 text-sm">No hay torneos en esta liga</p>
          {isAdmin && (
            <p className="text-zinc-500 text-xs mt-2">Crea el primer torneo con el boton de arriba</p>
          )}
        </div>
      )}
    </div>
  )
}
