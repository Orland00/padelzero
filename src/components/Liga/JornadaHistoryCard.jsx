import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateJornadaPoints } from '@/utils/americanoEngine'
import { formatDateSafe, formatDisplayName } from '@/utils/dateFormatters'

export default function JornadaHistoryCard({ jornada, ligaId }) {
  const navigate = useNavigate()
  const [jornadaStandings, setJornadaStandings] = useState([])
  const [participantCount, setParticipantCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (jornada.status === 'completed') {
      fetchJornadaResults()
    }
  }, [jornada.id, jornada.status])

  const fetchJornadaResults = async () => {
    setLoading(true)
    try {
      // Get round IDs for this jornada, then fetch matches
      const { data: rounds, error: roundsErr } = await supabase
        .from('americano_rounds')
        .select('id')
        .eq('jornada_id', jornada.id)

      if (roundsErr) throw roundsErr
      const roundIds = (rounds || []).map(r => r.id)
      if (roundIds.length === 0) return

      const { data: matches, error: matchErr } = await supabase
        .from('americano_matches')
        .select('team_a_player1, team_a_player2, team_b_player1, team_b_player2, score_team_a, score_team_b, status, round_id')
        .in('round_id', roundIds)
        .eq('status', 'completed')

      if (matchErr) throw matchErr

      // Calculate per-player points for this jornada
      const pointsByPlayer = calculateJornadaPoints(matches || [])

      // Get check-ins to know how many players participated
      const { data: checkIns, error: checkInErr } = await supabase
        .from('jornada_checkins')
        .select('id')
        .eq('jornada_id', jornada.id)

      if (!checkInErr) {
        setParticipantCount(checkIns?.length || 0)
      }

      // Fetch player profiles for top finishers
      if (Object.keys(pointsByPlayer).length > 0) {
        const playerIds = Object.keys(pointsByPlayer)
        const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', playerIds)

        if (!profileErr && profiles) {
          // Build standings by combining points with profiles
          const standings = playerIds
            .map(playerId => ({
              player_id: playerId,
              total_points: pointsByPlayer[playerId],
              profile: profiles.find(p => p.id === playerId),
            }))
            .sort((a, b) => b.total_points - a.total_points)

          setJornadaStandings(standings)
        }
      }
    } catch (err) {
      // silently fail — card shows empty state
    } finally {
      setLoading(false)
    }
  }

  const topThree = jornadaStandings.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/liga/${ligaId}/jornada/${jornada.id}`)}
      className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg cursor-pointer hover:border-emerald-500 transition"
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-zinc-400 font-bold mb-1">Jornada {jornada.jornada_number}</p>
            <h3 className="font-bold text-white mb-2">
              {formatDateSafe(jornada.date, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              }, 'Fecha pendiente')}
            </h3>

            {/* Status Badge */}
            <div className="inline-flex gap-2">
              {jornada.status === 'completed' && (
                <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                  Completada
                </span>
              )}
              {jornada.status === 'in_progress' && (
                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded font-bold">
                  En Vivo
                </span>
              )}
              {jornada.status === 'upcoming' && (
                <span className="text-xs px-2 py-1 bg-zinc-700 text-zinc-300 rounded font-bold">
                  Próxima
                </span>
              )}
              {participantCount > 0 && (
                <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded">
                  {participantCount} jugadores
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Top 3 Results - Only show if completed */}
        {jornada.status === 'completed' && !loading && topThree.length > 0 && (
          <div className="pt-3 border-t border-zinc-800 space-y-2">
            {topThree.map((standing, idx) => (
              <div key={standing.player_id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-emerald-500 w-6">#{idx + 1}</span>
                  <span className="text-sm text-white font-bold truncate">
                    {formatDisplayName(standing.profile?.display_name)}
                  </span>
                </div>
                <span className="text-xs text-emerald-400 font-bold">{standing.total_points} pts</span>
              </div>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loading && jornada.status === 'completed' && (
          <div className="pt-3 border-t border-zinc-800">
            <p className="text-xs text-zinc-400 text-center">Cargando resultados...</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
