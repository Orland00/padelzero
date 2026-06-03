import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useUiStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'
import GlassButton from '@/components/ui/GlassButton'

const MAX_TEAMS = 16

export default function CreateSession() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { createSession, startSession, loading } = useSessionStore()
  const { showToast } = useUiStore()

  const defaultType = location.state?.gameMode === 'tournament' ? 'tournament' : 'league'

  const [name, setName] = useState('')
  const [type, setType] = useState(defaultType)
  const [setsToWin, setSetsToWin] = useState(1)
  const [showEloInfo, setShowEloInfo] = useState(false)
  const [teams, setTeams] = useState([]) // [{p1, p2, name?}] where p1/p2 are profile objects
  const [players, setPlayers] = useState([])
  const [search, setSearch] = useState('')

  // Add-team modal state
  const [addingTeam, setAddingTeam] = useState(false) // false | 'p1' | 'p2'
  const [teamDraft, setTeamDraft] = useState({ p1: null, p2: null, name: '' })
  const [editingIndex, setEditingIndex] = useState(null) // null | number
  const [guestName, setGuestName] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, username, elo_rating')
      .order('elo_rating', { ascending: false }).limit(200)
      .then(({ data }) => setPlayers(data || []))
  }, [])

  const usedPlayerIds = teams.flatMap(t => [t.p1?.id, t.p2?.id].filter(Boolean))

  const filteredPlayers = players.filter(p => {
    const q = search.toLowerCase().replace(/^@/, '')
    const matches = !q || p.display_name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q)
    return matches
  })

  const teamName = (team) => {
    if (team.name) return team.name
    const p1 = team.p1?.display_name?.split(' ')[0] || '?'
    const p2 = team.p2?.display_name?.split(' ')[0] || '?'
    return `${p1} / ${p2}`
  }

  const teamAvgElo = (team) => {
    const e1 = team.p1?.elo_rating || 1200
    const e2 = team.p2?.elo_rating || 1200
    return Math.round((e1 + e2) / 2)
  }

  const openAddTeam = (idx = null) => {
    if (idx !== null) {
      setTeamDraft({ ...teams[idx] })
      setEditingIndex(idx)
    } else {
      setTeamDraft({ p1: null, p2: null, name: '' })
      setEditingIndex(null)
    }
    setAddingTeam('p1')
    setSearch('')
    setGuestName('')
  }

  const selectPlayer = (player) => {
    if (addingTeam === 'p1') {
      setTeamDraft(d => ({ ...d, p1: player }))
      setSearch('')
      setGuestName('')
      setAddingTeam('p2')
    } else {
      setTeamDraft(d => ({ ...d, p2: player }))
      setAddingTeam('done')
      setSearch('')
      setGuestName('')
    }
  }

  const addGuest = () => {
    const trimmed = guestName.trim()
    if (!trimmed) return
    selectPlayer({ id: null, display_name: trimmed, elo_rating: 1200, isGuest: true })
  }

  const saveTeam = () => {
    if (!teamDraft.p1 || !teamDraft.p2) return
    if (editingIndex !== null) {
      setTeams(t => t.map((team, i) => i === editingIndex ? teamDraft : team))
    } else {
      setTeams(t => [...t, teamDraft])
    }
    setAddingTeam(false)
    setEditingIndex(null)
    setGuestName('')
  }

  const removeTeam = (idx) => setTeams(t => t.filter((_, i) => i !== idx))

  const handleStart = async () => {
    if (teams.length < 2) {
      showToast({ type: 'warning', message: 'Necesitas mínimo 2 parejas', duration: 2000 })
      return
    }
    const sessionName = name.trim() || (type === 'league' ? 'Liga Rápida' : 'Torneo Relámpago')

    // Create session
    const { data: session, error: sErr } = await createSession(sessionName, type, setsToWin, user?.id)
    if (sErr) {
      showToast({ type: 'error', message: 'Error al crear sesión', duration: 3000 })
      return
    }

    // Insert teams
    const teamInserts = teams.map((t, i) => ({
      session_id: session.id,
      p1_id: t.p1?.id || null,
      p2_id: t.p2?.id || null,
      name: t.name || null,
      sort_order: i,
    }))
    const { data: insertedTeams, error: tErr } = await supabase
      .from('session_teams').insert(teamInserts).select('id, session_id, name, p1_id, p2_id, sort_order')
    if (tErr) {
      showToast({ type: 'error', message: 'Error al guardar parejas', duration: 3000 })
      return
    }

    // Generate and insert schedule
    const { error: startErr } = await startSession(session.id, insertedTeams)
    if (startErr) {
      showToast({ type: 'error', message: 'Error al generar calendario', duration: 3000 })
      return
    }

    showToast({ type: 'success', message: '¡Sesión iniciada!', duration: 2000 })
    navigate(`/session/${session.id}`, { replace: true })
  }

  const isPlayerUsed = (player) => {
    if (!player.id) return false // guests (no id) are always selectable
    const draftIds = [teamDraft.p1?.id, teamDraft.p2?.id].filter(Boolean)
    return usedPlayerIds.filter(id => !draftIds.includes(id)).includes(player.id)
  }

  // ── Add-team modal ───────────────────────────────────────────────────────────
  if (addingTeam && addingTeam !== 'done') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        <div className="glass-card rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setAddingTeam(false); setEditingIndex(null) }} className="text-zinc-400 hover:text-white">←</button>
          <div>
            <p className="text-white font-bold text-sm">
              {addingTeam === 'p1' ? 'Selecciona Jugador 1' : 'Selecciona Jugador 2'}
            </p>
            <p className="text-xs text-zinc-500">
              {teamDraft.p1 ? `J1: ${teamDraft.p1.display_name}${teamDraft.p1.isGuest ? ' 👤' : ''}` : 'Elige el primer jugador'}
              {teamDraft.p2 ? ` · J2: ${teamDraft.p2.display_name}${teamDraft.p2.isGuest ? ' 👤' : ''}` : ''}
            </p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="px-4 py-2 flex gap-2">
          <div className={`h-1.5 flex-1 rounded-full ${teamDraft.p1 ? 'bg-emerald-500' : addingTeam === 'p1' ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
          <div className={`h-1.5 flex-1 rounded-full ${teamDraft.p2 ? 'bg-emerald-500' : addingTeam === 'p2' ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
        </div>

        {/* Guest add section */}
        <div className="px-4 pt-2 pb-1">
          <div className="glass-card p-3">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-2">👤 Agregar Invitado</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre del invitado..."
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGuest()}
                className="flex-1 glass-input"
              />
              <GlassButton
                variant="primary"
                size="sm"
                onClick={addGuest}
                disabled={!guestName.trim()}
              >
                + Añadir
              </GlassButton>
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">Sin cuenta · ATP 1200 por defecto · no afecta rankings</p>
          </div>
        </div>

        <div className="px-4 py-2">
          <input
            type="text"
            placeholder="Buscar por nombre o @usuario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="glass-input"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-1 pb-4">
          {filteredPlayers.map((player, idx) => {
            const used = isPlayerUsed(player)
            const isSelf = player.id === teamDraft.p1?.id || player.id === teamDraft.p2?.id
            return (
              <button
                key={player.id}
                onClick={() => !used && selectPlayer(player)}
                disabled={used}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition backdrop-blur-md ${
                  isSelf ? 'bg-emerald-500/15 border border-emerald-500/30' :
                  used ? 'bg-white/3 opacity-40' : 'bg-white/5 hover:bg-white/8 border border-white/5'
                }`}
              >
                <span className="text-zinc-500 text-xs w-6 text-right">#{idx + 1}</span>
                <div className="flex-1 text-left">
                  <p className="text-white text-sm font-semibold">{player.display_name}</p>
                  <p className="text-xs text-zinc-500">
                    {player.username ? `@${player.username} · ` : ''}{Math.round(player.elo_rating)} ATP
                  </p>
                </div>
                {isSelf && <span className="text-emerald-400 text-xs">✓</span>}
                {used && !isSelf && <span className="text-zinc-600 text-xs">En uso</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── After selecting both players: confirm team ───────────────────────────────
  if (addingTeam === 'done') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        <div className="glass-card rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setAddingTeam('p2')} className="text-zinc-400 hover:text-white">←</button>
          <p className="text-white font-bold">Confirmar pareja</p>
        </div>
        <div className="p-4 space-y-4">
          {/* Team preview */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm border border-blue-500/30">1</div>
              <div>
                <p className="text-white font-semibold">{teamDraft.p1?.display_name} {teamDraft.p1?.isGuest && <span className="text-xs text-zinc-500 font-normal">👤 Invitado</span>}</p>
                <p className="text-xs text-zinc-500">{teamDraft.p1?.isGuest ? 'Sin cuenta · 1200 ATP' : `${Math.round(teamDraft.p1?.elo_rating || 1200)} ATP`}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 font-bold text-sm border border-pink-500/30">2</div>
              <div>
                <p className="text-white font-semibold">{teamDraft.p2?.display_name} {teamDraft.p2?.isGuest && <span className="text-xs text-zinc-500 font-normal">👤 Invitado</span>}</p>
                <p className="text-xs text-zinc-500">{teamDraft.p2?.isGuest ? 'Sin cuenta · 1200 ATP' : `${Math.round(teamDraft.p2?.elo_rating || 1200)} ATP`}</p>
              </div>
            </div>
          </div>
          {/* Optional name */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Nombre de la pareja (opcional)</label>
            <input
              type="text"
              placeholder={`${teamDraft.p1?.display_name?.split(' ')[0]} / ${teamDraft.p2?.display_name?.split(' ')[0]}`}
              value={teamDraft.name}
              onChange={e => setTeamDraft(d => ({ ...d, name: e.target.value }))}
              className="glass-input"
            />
          </div>
          <GlassButton
            variant="primary"
            size="lg"
            fullWidth
            onClick={saveTeam}
          >
            {editingIndex !== null ? 'Actualizar pareja' : 'Agregar pareja'}
          </GlassButton>
        </div>
      </div>
    )
  }

  // ── Main setup screen ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pb-32">
      <div className="glass-card rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white">←</button>
        <h1 className="text-white font-bold">{type === 'league' ? 'Liga Rápida' : 'Torneo Relámpago'}</h1>
      </div>

      {/* ATP Info Modal */}
      {showEloInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowEloInfo(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg glass-card rounded-b-none p-5 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-base">¿Cómo se calcula el ATP?</h2>
              <button onClick={() => setShowEloInfo(false)} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="space-y-3 text-sm text-zinc-300">
              <div className="glass-card p-3 space-y-1" style={{ borderRadius: '12px' }}>
                <p className="text-emerald-400 font-semibold text-xs uppercase tracking-wide">ATP inicial</p>
                <p>Basado en tu nivel declarado:</p>
                <div className="grid grid-cols-2 gap-1 mt-1 text-xs">
                  {[['Principiante', 1000], ['Básico', 1100], ['Intermedio', 1200], ['Avanzado', 1400], ['Pro', 1600]].map(([lvl, elo]) => (
                    <span key={lvl} className="text-zinc-400">{lvl} → <span className="text-white font-medium">{elo}</span></span>
                  ))}
                </div>
              </div>

              <div className="glass-card p-3 space-y-1" style={{ borderRadius: '12px' }}>
                <p className="text-emerald-400 font-semibold text-xs uppercase tracking-wide">Fórmula</p>
                <p>Se calcula el promedio ATP de cada pareja y se compara:</p>
                <p className="text-zinc-400 text-xs font-mono bg-black/30 rounded px-2 py-1 mt-1">
                  ΔElo = K × (resultado − probabilidad esperada)
                </p>
                <p className="text-xs text-zinc-500 mt-1">El ganador suma puntos, el perdedor los resta. La cantidad depende de qué tan sorpresivo fue el resultado.</p>
              </div>

              <div className="glass-card p-3 space-y-1" style={{ borderRadius: '12px' }}>
                <p className="text-emerald-400 font-semibold text-xs uppercase tracking-wide">Factor K (velocidad de cambio)</p>
                <div className="text-xs space-y-0.5">
                  <p><span className="text-white font-medium">K=32</span> — Menos de 50 partidos (más volátil)</p>
                  <p><span className="text-white font-medium">K=24</span> — 50 a 100 partidos</p>
                  <p><span className="text-white font-medium">K=16</span> — Más de 100 partidos (más estable)</p>
                </div>
              </div>

              <div className="glass-card p-3 space-y-1" style={{ borderRadius: '12px' }}>
                <p className="text-emerald-400 font-semibold text-xs uppercase tracking-wide">Ejemplo</p>
                <p className="text-xs text-zinc-400">Pareja A (1500 ATP) vs Pareja B (1300 ATP):</p>
                <p className="text-xs">Si gana A (favorita): <span className="text-emerald-400">+~8 ATP</span></p>
                <p className="text-xs">Si gana B (underdog): <span className="text-emerald-400">+~24 ATP</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        {/* Type toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Formato</p>
            <button
              onClick={() => setShowEloInfo(true)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition"
            >
              <span className="w-4 h-4 rounded-full border border-zinc-600 hover:border-emerald-400 flex items-center justify-center text-[10px] font-bold leading-none">!</span>
              ¿Cómo funciona el ATP?
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'league',     label: '👥 Liga', sub: 'Round-robin' },
              { v: 'tournament', label: '🏆 Torneo', sub: 'Eliminación' },
            ].map(o => (
              <button key={o.v} onClick={() => setType(o.v)}
                className={`glass-card py-3 transition text-left px-3 ${type === o.v ? '!border-emerald-500/40 !bg-emerald-500/10' : ''}`}
                style={{ borderRadius: '16px' }}
              >
                <p className={`font-semibold text-sm ${type === o.v ? 'text-white' : 'text-zinc-300'}`}>{o.label}</p>
                <p className={`text-xs ${type === o.v ? 'text-emerald-400' : 'text-zinc-500'}`}>{o.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <input
          type="text"
          placeholder={type === 'league' ? 'Nombre de la liga (opcional)' : 'Nombre del torneo (opcional)'}
          value={name}
          onChange={e => setName(e.target.value)}
          className="glass-input"
        />

        {/* Sets */}
        <div>
          <p className="text-xs text-zinc-400 font-semibold uppercase mb-2">Puntos por partido</p>
          <div className="flex gap-2">
            {[{l:'1 de 1',v:1},{l:'2 de 3',v:2},{l:'3 de 5',v:3}].map(o => (
              <GlassButton
                key={o.v}
                variant={setsToWin === o.v ? 'primary' : 'ghost'}
                size="sm"
                fullWidth
                onClick={() => setSetsToWin(o.v)}
              >
                {o.l}
              </GlassButton>
            ))}
          </div>
        </div>

        {/* Teams list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 font-semibold uppercase">
              Parejas {teams.length > 0 && `(${teams.length}/${MAX_TEAMS})`}
            </p>
            {type === 'league' && teams.length >= 2 && (
              <p className="text-xs text-zinc-600">{teams.length * (teams.length - 1) / 2} partidos</p>
            )}
          </div>

          {teams.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-4">Agrega al menos 2 parejas para comenzar</p>
          )}

          {teams.map((team, idx) => (
            <div key={idx} className="glass-card px-3 py-2.5 flex items-center gap-3" style={{ borderRadius: '16px' }}>
              <span className="text-zinc-500 font-bold text-sm w-6">{idx + 1}</span>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{teamName(team)}</p>
                <p className="text-xs text-zinc-500">
                  {teamAvgElo(team)} ATP promedio
                  {(team.p1?.isGuest || team.p2?.isGuest) && <span className="ml-1 text-zinc-600">· con invitado 👤</span>}
                </p>
              </div>
              <button onClick={() => openAddTeam(idx)} className="text-zinc-500 hover:text-white text-xs px-2 py-1">✏️</button>
              <button onClick={() => removeTeam(idx)} className="text-zinc-500 hover:text-red-400 text-xs px-2 py-1">✕</button>
            </div>
          ))}

          {teams.length < MAX_TEAMS && (
            <GlassButton
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => openAddTeam()}
              className="!border-dashed !border-zinc-700 hover:!border-emerald-500"
            >
              + Agregar pareja
            </GlassButton>
          )}
        </div>

        {/* Info box */}
        {teams.length >= 2 && type === 'league' && (
          <div className="glass-card p-3 text-xs text-emerald-400" style={{ borderRadius: '14px', borderColor: 'rgba(16,185,129,0.25)', background: 'linear-gradient(165deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.03) 100%)' }}>
            {teams.length} parejas · {teams.length * (teams.length - 1) / 2} partidos · {teams.length - 1} jornadas
          </div>
        )}
        {teams.length >= 2 && type === 'tournament' && (
          <div className="glass-card p-3 text-xs text-yellow-400" style={{ borderRadius: '14px', borderColor: 'rgba(234,179,8,0.25)', background: 'linear-gradient(165deg, rgba(234,179,8,0.1) 0%, rgba(234,179,8,0.03) 100%)' }}>
            {teams.length} parejas · bracket de eliminación directa
          </div>
        )}
      </div>

      {/* Start button */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5">
        <GlassButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleStart}
          disabled={teams.length < 2 || loading}
          loading={loading}
        >
          {teams.length < 2 ? `Faltan parejas (mín. 2)` : `Iniciar ${type === 'league' ? 'Liga' : 'Torneo'} con ${teams.length} parejas`}
        </GlassButton>
      </div>
    </div>
  )
}
