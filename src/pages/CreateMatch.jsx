import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useMatchStore } from '@/stores/matchStore'
import { useUiStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'
import GlassButton from '@/components/ui/GlassButton'

export default function CreateMatch() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuthStore()
  const { createMatch, loading } = useMatchStore()
  const { showToast } = useUiStore()

  const gameMode = location.state?.gameMode || 'ranked'
  const isRanked = gameMode === 'ranked'

  const [players, setPlayers] = useState([])
  const [friends, setFriends] = useState([])
  const [clubs, setClubs] = useState([])
  const [showFriendsOnly, setShowFriendsOnly] = useState(false)
  const [search, setSearch] = useState('')

  const [formData, setFormData] = useState({
    setsToWin: 1,
    isPointsMode: false,
    pointsLimit: 7,
    useAdvantage: true,
    p1_id: user?.id || null,
    p1b_id: null,
    p2_id: null,
    p2b_id: null,
    tipo: 'reta',
    clubId: profile?.favorite_club_id || null,
    courtNumber: 1,
  })
  const [isManualLog, setIsManualLog] = useState(false)
  const [isRankedMatch, setIsRankedMatch] = useState(true)
  // Open match state (Updated: 2026-05-08)
  const [isOpen, setIsOpen] = useState(false)
  const [slotsNeeded, setSlotsNeeded] = useState(1)
  const [levelMin, setLevelMin] = useState(0)
  const [levelMax, setLevelMax] = useState(7)
  const [scores, setScores] = useState([
    { p1: 0, p2: 0 },
    { p1: 0, p2: 0 },
    { p1: 0, p2: 0 },
  ])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [playersRes, clubsRes] = await Promise.all([
          supabase.from('profiles').select('id, display_name, username, elo_rating').order('elo_rating', { ascending: false }).limit(100),
          supabase.from('clubs').select('id, name').order('name'),
        ])
        setPlayers(playersRes.data || [])
        setClubs(clubsRes.data || [])

        // Load friends
        if (user?.id) {
          const { data: fsData } = await supabase
            .from('friendships')
            .select('requester_id, addressee_id, requester:profiles!requester_id(id, display_name, elo_rating), addressee:profiles!addressee_id(id, display_name, elo_rating)')
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
            .eq('status', 'accepted')
          if (fsData) {
            const friendProfiles = fsData.map(f =>
              f.requester_id === user.id ? f.addressee : f.requester
            )
            setFriends(friendProfiles)
          }
        }
      } catch (err) {
        showToast({ type: 'error', message: 'Error al cargar datos', duration: 3000 })
      }
    }
    fetchData()
  }, [user?.id, showToast])

  const filteredPlayers = (showFriendsOnly ? friends : players).filter(p => {
    if (!search) return true
    const q = search.toLowerCase().replace(/^@/, '')
    return p.display_name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q)
  })

  const selectedIds = [formData.p1_id, formData.p1b_id, formData.p2_id, formData.p2b_id].filter(Boolean)

  const handleSelectPlayer = (slot, playerId) => {
    // Prevent selecting same player twice
    const otherSlots = { p1_id: formData.p1_id, p1b_id: formData.p1b_id, p2_id: formData.p2_id, p2b_id: formData.p2b_id }
    delete otherSlots[slot]
    const alreadySelected = Object.values(otherSlots).includes(playerId)
    if (alreadySelected) {
      showToast({ type: 'warning', message: 'Jugador ya seleccionado', duration: 1500 })
      return
    }
    setFormData(prev => ({ ...prev, [slot]: playerId === prev[slot] ? null : playerId }))
  }

  const canCreate = (formData.p1_id && formData.p2_id) &&
                    ((formData.p1b_id && formData.p2b_id) || (!formData.p1b_id && !formData.p2b_id))

  const handleCreate = async () => {
    if (!canCreate) {
      showToast({ type: 'warning', message: 'Selecciona los 4 jugadores', duration: 2000 })
      return
    }

    const { data, error } = await createMatch(
      formData.p1_id, formData.p1b_id,
      formData.p2_id, formData.p2b_id,
      formData.isPointsMode ? formData.pointsLimit : formData.setsToWin,
      isRankedMatch ? 'ranked' : 'friendly',
      formData.clubId,
      formData.courtNumber,
      formData.useAdvantage
    )

    if (error) {
      showToast({ type: 'error', message: 'Error al crear partido', duration: 3000 })
      return
    }

    // Patch open match fields if toggled (Updated: 2026-05-08)
    if (isOpen && data?.id) {
      await supabase.from('matches').update({
        is_open: true,
        slots_needed: slotsNeeded,
        level_min: levelMin,
        level_max: levelMax,
      }).eq('id', data.id)
    }

    if (isManualLog) {
      // Find winner based on sets
      let p1Sets = 0;
      let p2Sets = 0;
      const validSets = scores.slice(0, formData.setsToWin === 1 ? 1 : 3).filter(s => s.p1 > 0 || s.p2 > 0)
      validSets.forEach(s => {
        if (s.p1 > s.p2) p1Sets++
        else if (s.p2 > s.p1) p2Sets++
      })

      const winnerId = p1Sets >= p2Sets ? formData.p1_id : formData.p2_id

      const { error: finishError } = await useMatchStore.getState().finishMatch(
        data.id,
        winnerId,
        p1Sets,
        p2Sets,
        validSets
      )

      if (finishError) {
        showToast({ type: 'error', message: 'Error al registrar score', duration: 3000 })
      } else {
        showToast({ type: 'success', message: '¡Partido registrado!', duration: 1500 })
        setTimeout(() => navigate(`/match/${data.id}`, { replace: true }), 500)
      }
    } else {
      showToast({ type: 'success', message: '¡Partido creado!', duration: 1000 })
      setTimeout(() => navigate(`/match/${data.id}`, {
        replace: true,
        state: {
          isLocal: false,
          isPointsMode: formData.isPointsMode,
          pointsLimit: formData.pointsLimit
        }
      }), 300)
    }
  }

  const getPlayerName = (id) => players.find(p => p.id === id)?.display_name || '—'
  const getPlayerElo = (id) => {
    const p = players.find(x => x.id === id)
    return p ? Math.round(p.elo_rating) : ''
  }

  const SLOTS = [
    { key: 'p1_id',  label: 'Jugador 1', team: 1, color: 'blue' },
    { key: 'p1b_id', label: 'Jugador 2', team: 1, color: 'blue' },
    { key: 'p2_id',  label: 'Jugador 3', team: 2, color: 'pink' },
    { key: 'p2b_id', label: 'Jugador 4', team: 2, color: 'pink' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pb-32">
      {/* Header */}
      <div className="glass-card rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white transition">←</button>
        <h1 className="text-white font-bold">Nuevo Partido Ranqueado</h1>
      </div>

      {/* Mode selectors */}
      <div className="px-4 pt-4 pb-2 space-y-4">
        <div className="flex gap-2 p-1 glass-card" style={{ borderRadius: '16px' }}>
          <GlassButton
            variant={!isManualLog ? 'secondary' : 'ghost'}
            size="sm"
            fullWidth
            onClick={() => setIsManualLog(false)}
          >
            Partido en Vivo
          </GlassButton>
          <GlassButton
            variant={isManualLog ? 'primary' : 'ghost'}
            size="sm"
            fullWidth
            onClick={() => setIsManualLog(true)}
          >
            Registrar Score
          </GlassButton>
        </div>

        <div className="glass-card p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Tipo de Partido</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{isRankedMatch ? 'Afecta ATP' : 'Amistoso'}</p>
          </div>
          <GlassButton
            pill
            pillColor={isRankedMatch ? 'emerald' : undefined}
            variant={isRankedMatch ? 'primary' : 'ghost'}
            onClick={() => setIsRankedMatch(!isRankedMatch)}
          >
            {isRankedMatch ? 'Ranked' : 'Friendly'}
          </GlassButton>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">Sistema de Puntuación</p>
          <div className="flex gap-2 p-1 glass-card mb-4" style={{ borderRadius: '16px' }}>
            <GlassButton
              variant={!formData.isPointsMode ? 'primary' : 'ghost'}
              size="sm"
              fullWidth
              onClick={() => setFormData(f => ({ ...f, isPointsMode: false }))}
            >
              GAMES (15-40)
            </GlassButton>
            <GlassButton
              variant={formData.isPointsMode ? 'primary' : 'ghost'}
              size="sm"
              fullWidth
              onClick={() => setFormData(f => ({ ...f, isPointsMode: true }))}
            >
              PUNTOS (1-2-3)
            </GlassButton>
          </div>

          <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">
            {formData.isPointsMode ? 'Objetivo de Puntos' : 'Formato de Sets'}
          </p>
          <div className="flex gap-2">
            {formData.isPointsMode ? (
              [{label:'7 pts',v:7},{label:'10 pts',v:10},{label:'21 pts',v:21}].map(o => (
                <GlassButton
                  key={o.v}
                  variant={formData.pointsLimit === o.v ? 'primary' : 'ghost'}
                  size="sm"
                  fullWidth
                  onClick={() => setFormData(f => ({ ...f, pointsLimit: o.v }))}
                >
                  {o.label}
                </GlassButton>
              ))
            ) : (
              [{label:'1 de 1',v:1},{label:'2 de 3',v:2},{label:'3 de 5',v:3}].map(o => (
                <GlassButton
                  key={o.v}
                  variant={formData.setsToWin === o.v ? 'primary' : 'ghost'}
                  size="sm"
                  fullWidth
                  onClick={() => setFormData(f => ({ ...f, setsToWin: o.v }))}
                >
                  {o.label}
                </GlassButton>
              ))
            )}
          </div>
        </div>
      </div>

      {isManualLog && (
        <div className="px-4 py-2 space-y-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase">Marcador Final</p>
          {[0, 1, 2].slice(0, formData.setsToWin === 1 ? 1 : 3).map(idx => (
            <div key={idx} className="glass-card p-3 flex items-center gap-4">
              <span className="text-xs font-bold text-zinc-500 italic">Set {idx + 1}</span>
              <div className="flex-1 flex items-center justify-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-blue-400 font-bold mb-1">E1</span>
                  <input
                    type="number"
                    value={scores[idx].p1}
                    onChange={(e) => {
                      const n = [...scores]; n[idx].p1 = parseInt(e.target.value) || 0; setScores(n)
                    }}
                    className="w-12 h-12 glass-input text-center text-xl font-black !p-0"
                  />
                </div>
                <span className="text-zinc-700 mt-4 font-bold">-</span>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-pink-400 font-bold mb-1">E2</span>
                  <input
                    type="number"
                    value={scores[idx].p2}
                    onChange={(e) => {
                      const n = [...scores]; n[idx].p2 = parseInt(e.target.value) || 0; setScores(n)
                    }}
                    className="w-12 h-12 glass-input text-center text-xl font-black !p-0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team preview */}
      <div className="px-4 py-3">
        <div className="glass-card p-3 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          {/* Team 1 */}
          <div className="space-y-1">
            <p className="text-xs text-blue-400 font-semibold uppercase">Equipo 1</p>
            {['p1_id','p1b_id'].map(slot => (
              <div key={slot} className={`text-sm rounded px-2 py-1 ${formData[slot] ? 'text-blue-300 bg-blue-500/10 border border-blue-500/20' : 'text-zinc-600 bg-white/5 border border-white/5'}`}>
                {formData[slot] ? getPlayerName(formData[slot]) : '—'}
              </div>
            ))}
          </div>
          <div className="text-zinc-600 font-bold text-lg">vs</div>
          {/* Team 2 */}
          <div className="space-y-1 text-right">
            <p className="text-xs text-pink-400 font-semibold uppercase">Equipo 2</p>
            {['p2_id','p2b_id'].map(slot => (
              <div key={slot} className={`text-sm rounded px-2 py-1 ${formData[slot] ? 'text-pink-300 bg-pink-500/10 border border-pink-500/20' : 'text-zinc-600 bg-white/5 border border-white/5'}`}>
                {formData[slot] ? getPlayerName(formData[slot]) : '—'}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slot buttons */}
      <div className="px-4 pb-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">Asignar a</p>
        <div className="grid grid-cols-2 gap-2">
          {SLOTS.map(s => (
            <button
              key={s.key}
              onClick={() => {/* slots are assigned by tapping player rows */}}
              className={`py-2 rounded-2xl text-sm font-semibold border transition backdrop-blur-md ${
                formData[s.key]
                  ? s.color === 'blue'
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                    : 'bg-pink-500/15 border-pink-500/30 text-pink-300'
                  : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
            >
              {s.label}: {formData[s.key] ? getPlayerName(formData[s.key]) : '?'}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-2 text-center">Toca un jugador abajo para asignarlo al próximo slot vacío</p>
      </div>

      {/* Search & filter */}
      <div className="px-4 pb-2 space-y-2">
        <input
          type="text"
          placeholder="Buscar jugador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="glass-input"
        />
        <div className="flex gap-2">
          <GlassButton
            variant={!showFriendsOnly ? 'primary' : 'ghost'}
            size="xs"
            fullWidth
            onClick={() => setShowFriendsOnly(false)}
          >
            Todos ({players.length})
          </GlassButton>
          <GlassButton
            variant={showFriendsOnly ? 'primary' : 'ghost'}
            size="xs"
            fullWidth
            onClick={() => setShowFriendsOnly(true)}
          >
            Amigos ({friends.length})
          </GlassButton>
        </div>
      </div>

      {/* Player list */}
      <div className="px-4 space-y-1 flex-1 overflow-y-auto">
        {filteredPlayers.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-4">
            {showFriendsOnly ? 'Sin amigos aún' : 'Sin jugadores'}
          </p>
        )}
        {filteredPlayers.map((player, idx) => {
          const slotIndex = selectedIds.indexOf(player.id)
          const isSelected = slotIndex !== -1
          const slotLabel = isSelected ? SLOTS[slotIndex]?.label : null

          // Determine which slot to fill next
          const nextSlot = SLOTS.find(s => !formData[s.key])?.key

          return (
            <button
              key={player.id}
              onClick={() => {
                if (isSelected) {
                  // Deselect
                  const slot = SLOTS.find(s => formData[s.key] === player.id)?.key
                  if (slot) setFormData(f => ({ ...f, [slot]: null }))
                } else if (nextSlot) {
                  handleSelectPlayer(nextSlot, player.id)
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition backdrop-blur-md ${
                isSelected
                  ? slotLabel?.startsWith('Jugador 1') || slotLabel?.startsWith('Jugador 2')
                    ? 'bg-blue-500/15 border border-blue-500/30'
                    : 'bg-pink-500/15 border border-pink-500/30'
                  : 'bg-white/5 hover:bg-white/8 border border-white/5'
              }`}
            >
              <span className="text-zinc-400 text-xs w-6 text-right">#{idx + 1}</span>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-semibold">{player.display_name}</p>
                <p className="text-xs text-zinc-500">
                  {player.username ? `@${player.username} · ` : ''}{Math.round(player.elo_rating)} ATP
                </p>
              </div>
              {isSelected ? (
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  ['Jugador 1','Jugador 2'].some(l => slotLabel?.startsWith(l))
                    ? 'bg-blue-500/30 text-blue-300'
                    : 'bg-pink-500/30 text-pink-300'
                }`}>
                  {slotLabel}
                </span>
              ) : (
                <span className="text-zinc-600 text-xs">{nextSlot ? '+' : ''}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Open match toggle (Updated: 2026-05-08) ────────────────────── */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-4 space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-zinc-200">Partido abierto</p>
              <p className="text-xs text-zinc-400 mt-0.5">Otros jugadores pueden unirse</p>
            </div>
            <input
              type="checkbox"
              checked={isOpen}
              onChange={e => setIsOpen(e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
          </label>

          {isOpen && (
            <div className="space-y-3 pt-2 border-t border-zinc-700/50">
              <div>
                <label className="text-xs text-zinc-400">Lugares disponibles</label>
                <div className="flex gap-2 mt-1">
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSlotsNeeded(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                        slotsNeeded === n
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-zinc-400">Nivel mín</label>
                  <input
                    type="number"
                    min="0" max="7" step="0.5"
                    value={levelMin}
                    onChange={e => setLevelMin(parseFloat(e.target.value))}
                    className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-400">Nivel máx</label>
                  <input
                    type="number"
                    min="0" max="7" step="0.5"
                    value={levelMax}
                    onChange={e => setLevelMax(parseFloat(e.target.value))}
                    className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create button */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5">
        {/* Advantage Toggle */}
        <div className="glass-card p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-white uppercase tracking-tight">Ventaja (Punto Oro)</p>
            <p className="text-[10px] text-zinc-500 uppercase font-medium">Permite jugar ventajas en el deuce</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, useAdvantage: !prev.useAdvantage }))}
            className={`w-12 h-6 rounded-full transition-colors relative ${formData.useAdvantage ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.useAdvantage ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="pt-2">
          <GlassButton
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleCreate}
            disabled={!canCreate || loading}
            loading={loading}
          >
            {canCreate ? 'Empezar Partido 🎾' : `Faltan ${4 - selectedIds.length} jugadores`}
          </GlassButton>
        </div>
      </div>
    </div>
  )
}
