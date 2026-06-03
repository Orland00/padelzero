import { useNavigate } from 'react-router-dom'

export default function Bracket({ matches, participants }) {
  const navigate = useNavigate()

  // Helper to find player by ID
  const getPlayer = (id) => participants.find(p => p.player_id === id)?.profile || { display_name: 'TBD' }

  // Group matches by round
  const rounds = {}
  matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = []
    rounds[m.round].push(m)
  })

  // Sort rounds descending (8 -> 4 -> 2 -> 1)
  const sortedRounds = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => b - a)

  if (sortedRounds.length === 0) {
    return (
      <div className="text-center py-12 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
        <p className="text-zinc-500 text-sm italic">Cargando bracket...</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-8 pt-4">
      <div className="flex gap-12 px-4 min-w-max">
        {sortedRounds.map((round, rIdx) => (
          <div key={round} className="flex flex-col justify-around gap-8">
            <h3 className="text-[10px] font-black uppercase text-zinc-600 tracking-widest text-center mb-2">
              {round === 1 ? 'Final' : round === 2 ? 'Semis' : round === 4 ? 'Cuartos' : `Ronda de ${round * 2}`}
            </h3>
            
            {rounds[round].map((m, mIdx) => {
              const p1 = getPlayer(m.player1_id)
              const p2 = getPlayer(m.player2_id)
              return (
                <div
                  key={m.id}
                  onClick={() => m.match_id && navigate(`/match/${m.match_id}`)}
                  className={`relative w-48 bg-zinc-900 border ${m.match?.status === 'finished' ? 'border-emerald-500/30' : 'border-zinc-800'} rounded-xl p-3 shadow-lg active:scale-95 transition cursor-pointer`}
                >
                  {/* Match Node Content */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white font-bold truncate">{p1.display_name}</span>
                      <span className="text-xs font-black text-zinc-700">{m.match?.p1_score ?? '—'}</span>
                    </div>
                    <div className="h-px bg-zinc-800" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white font-bold truncate">{p2.display_name}</span>
                      <span className="text-xs font-black text-zinc-700">{m.match?.p2_score ?? '—'}</span>
                    </div>
                  </div>

                  {/* Connecting lines for rounds > 1 */}
                  {round > 1 && (
                    <div className="absolute top-1/2 -right-12 w-12 h-px bg-zinc-800 -translate-y-1/2">
                      <div className={`absolute right-0 w-px ${mIdx % 2 === 0 ? 'h-full top-0' : 'h-full bottom-0'} bg-zinc-800`} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
