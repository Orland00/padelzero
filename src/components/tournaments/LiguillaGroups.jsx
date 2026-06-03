import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { formatDisplayName } from '@/utils/dateFormatters'

const getTeamName = (teamId, participants) => {
  if (!teamId) return 'Equipo pendiente'
  const p = participants.find(p => p.id === teamId)
  if (!p) return 'Equipo pendiente'
  const names = [p.p1_profile?.display_name, p.p2_profile?.display_name]
    .map(name => formatDisplayName(name, 'Jugador sin nombre'))
    .filter(Boolean)
  return p.team_name || names.join(' & ') || 'Equipo'
}

function computeStandings(teams, matches, participants) {
  const statsMap = {}

  // Initialize stats for each team in the group
  teams.forEach((t) => {
    statsMap[t.participant_id] = {
      participantId: t.participant_id,
      name: getTeamName(t.participant_id, participants),
      pj: 0, // Partidos jugados
      pg: 0, // Partidos ganados
      pp: 0, // Partidos perdidos
      pe: 0, // Partidos empatados
      gf: 0, // Games/sets a favor
      gc: 0, // Games/sets en contra
      dif: 0, // Diferencia
      pts: 0, // Puntos
    }
  })

  // Calculate stats from matches
  matches.forEach((m) => {
    if (m.status !== 'finished' && !m.winner_team_id) return

    const t1 = m.team1_id
    const t2 = m.team2_id
    if (!statsMap[t1] || !statsMap[t2]) return

    const s1 = m.team1_sets ?? 0
    const s2 = m.team2_sets ?? 0

    statsMap[t1].pj++
    statsMap[t2].pj++
    statsMap[t1].gf += s1
    statsMap[t1].gc += s2
    statsMap[t2].gf += s2
    statsMap[t2].gc += s1

    if (m.winner_team_id === t1) {
      statsMap[t1].pg++
      statsMap[t1].pts += 3
      statsMap[t2].pp++
    } else if (m.winner_team_id === t2) {
      statsMap[t2].pg++
      statsMap[t2].pts += 3
      statsMap[t1].pp++
    } else {
      // Draw
      statsMap[t1].pe++
      statsMap[t2].pe++
      statsMap[t1].pts += 1
      statsMap[t2].pts += 1
    }
  })

  // Compute difference and sort
  return Object.values(statsMap)
    .map((s) => ({ ...s, dif: s.gf - s.gc }))
    .sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf)
}

const STAT_COLS = [
  { key: 'pj', label: 'PJ' },
  { key: 'pg', label: 'PG' },
  { key: 'pp', label: 'PP' },
  { key: 'pe', label: 'PE' },
  { key: 'gf', label: 'GF' },
  { key: 'gc', label: 'GC' },
  { key: 'dif', label: 'DIF' },
  { key: 'pts', label: 'PTS' },
]

function GroupTable({ group, matches, participants, isAdmin, onRecordResult, groupIndex }) {
  const groupMatches = useMemo(
    () => matches.filter((m) => m.group_name === group.group_name || m.group_id === group.id),
    [matches, group]
  )

  const standings = useMemo(
    () => computeStandings(group.teams || [], groupMatches, participants),
    [group.teams, groupMatches, participants]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: groupIndex * 0.1, duration: 0.35 }}
      className="mb-6"
    >
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 mb-2 px-1">
        {group.group_name || `Grupo ${String.fromCharCode(65 + groupIndex)}`}
      </h3>

      <div className="overflow-x-auto rounded-lg border border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-800/80 text-zinc-400 text-[11px] uppercase tracking-wider">
              <th className="text-left py-2 px-3 font-semibold">Equipo</th>
              {STAT_COLS.map((col) => (
                <th key={col.key} className="text-center py-2 px-1.5 font-semibold w-9">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((row, idx) => {
              const qualifies = idx < 2
              return (
                <tr
                  key={row.participantId}
                  className={`border-t border-zinc-800 ${
                    qualifies ? 'border-l-2 border-l-emerald-500' : ''
                  } hover:bg-zinc-800/40 transition-colors`}
                >
                  <td className="py-2 px-3 text-zinc-200 font-medium truncate max-w-[160px]">
                    {row.name}
                  </td>
                  {STAT_COLS.map((col) => (
                    <td
                      key={col.key}
                      className={`text-center py-2 px-1.5 font-mono text-xs ${
                        col.key === 'pts'
                          ? 'text-emerald-400 font-bold'
                          : col.key === 'dif'
                          ? row.dif > 0
                            ? 'text-emerald-400'
                            : row.dif < 0
                            ? 'text-red-400'
                            : 'text-zinc-500'
                          : 'text-zinc-400'
                      }`}
                    >
                      {col.key === 'dif' && row.dif > 0 ? `+${row.dif}` : row[col.key]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Group matches list */}
      {groupMatches.length > 0 && (
        <div className="mt-3 space-y-1.5 px-1">
          {groupMatches.map((m) => {
            const t1 = getTeamName(m.team1_id, participants)
            const t2 = getTeamName(m.team2_id, participants)
            const finished = m.status === 'finished' || m.winner_team_id
            const pending = !finished && m.team1_id && m.team2_id

            return (
              <div
                key={m.id}
                className="flex items-center justify-between bg-zinc-800/40 rounded px-3 py-1.5 text-xs"
              >
                <span className={`truncate flex-1 ${m.winner_team_id === m.team1_id ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}`}>
                  {t1}
                </span>
                <span className="mx-2 text-zinc-500 font-mono shrink-0">
                  {finished ? `${m.team1_sets ?? 0} - ${m.team2_sets ?? 0}` : 'vs'}
                </span>
                <span className={`truncate flex-1 text-right ${m.winner_team_id === m.team2_id ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}`}>
                  {t2}
                </span>
                {pending && isAdmin && onRecordResult && (
                  <button
                    onClick={() => onRecordResult(m.id)}
                    className="ml-2 text-[10px] px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shrink-0"
                  >
                    Registrar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

export default function LiguillaGroups({ groups, matches, participants, isAdmin, onRecordResult }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-10">
        No hay grupos configurados todavia.
      </div>
    )
  }

  const groupStageMatches = useMemo(
    () => (matches || []).filter((m) => m.stage === 'group'),
    [matches]
  )

  const eliminationMatches = useMemo(
    () => (matches || []).filter((m) => m.stage !== 'group'),
    [matches]
  )

  return (
    <div className="space-y-2">
      {/* Group tables */}
      {groups.map((group, i) => (
        <GroupTable
          key={group.id || group.group_name || i}
          group={group}
          matches={groupStageMatches}
          participants={participants}
          isAdmin={isAdmin}
          onRecordResult={onRecordResult}
          groupIndex={i}
        />
      ))}

      {/* Elimination phase section */}
      {eliminationMatches.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="border-t border-zinc-700 mt-6 pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-4 text-center">
              Fase Final
            </h3>
            <div className="space-y-2">
              {eliminationMatches.map((m) => {
                const t1 = getTeamName(m.team1_id, participants)
                const t2 = getTeamName(m.team2_id, participants)
                const finished = m.status === 'finished' || m.winner_team_id
                const pending = !finished && m.team1_id && m.team2_id

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm"
                  >
                    <span className={`truncate flex-1 ${m.winner_team_id === m.team1_id ? 'text-emerald-400 font-bold' : finished ? 'text-zinc-500' : 'text-zinc-200'}`}>
                      {m.team1_id ? t1 : 'Por definir'}
                    </span>
                    <span className="mx-3 text-zinc-500 font-mono text-xs shrink-0">
                      {finished ? `${m.team1_sets ?? 0} - ${m.team2_sets ?? 0}` : 'vs'}
                    </span>
                    <span className={`truncate flex-1 text-right ${m.winner_team_id === m.team2_id ? 'text-emerald-400 font-bold' : finished ? 'text-zinc-500' : 'text-zinc-200'}`}>
                      {m.team2_id ? t2 : 'Por definir'}
                    </span>
                    {pending && isAdmin && onRecordResult && (
                      <button
                        onClick={() => onRecordResult(m.id)}
                        className="ml-3 text-xs px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shrink-0"
                      >
                        Registrar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
