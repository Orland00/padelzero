import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMatchStore } from '@/stores/matchStore'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import BannerOverlay from '@/components/BannerOverlay'
import GlassButton from '@/components/ui/GlassButton'
import MatchShareCard from '@/components/MatchShareCard'

export default function MatchResult() {
  const { id: matchId } = useParams()
  const navigate = useNavigate()
  const { fetchMatch, currentMatch, loading } = useMatchStore()
  const { user } = useAuthStore()
  const { showToast } = useUiStore()
  const [confirmations, setConfirmations] = useState([])
  const [isFinishing, setIsFinishing] = useState(false)
  const [showBanner, setShowBanner] = useState(true)
  const [showShareCard, setShowShareCard] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')

  useEffect(() => {
    const loadMatch = async () => {
      const { data, error } = await fetchMatch(matchId)
      if (error) {
        showToast({ type: 'error', message: 'Error al cargar resultado', duration: 3000 })
        navigate('/play')
        return
      }

      // Load confirmations (table may not exist yet)
      try {
        const { data: confs } = await supabase
          .from('match_confirmations')
          .select('*, profile:profiles(display_name)')
          .eq('match_id', matchId)
        setConfirmations(confs || [])
      } catch { setConfirmations([]) }
    }

    loadMatch()
  }, [matchId, fetchMatch, showToast, navigate])

  const handleConfirm = async () => {
    setIsFinishing(true)
    const { error } = await supabase.rpc('confirm_match', { m_id: matchId })
    if (error) {
      showToast({ type: 'error', message: 'Error al confirmar' })
    } else {
      showToast({ type: 'success', message: '¡Resultado confirmado!' })
      // Update local state
      setConfirmations(prev => prev.map(c => c.player_id === user.id ? { ...c, status: 'confirmed' } : c))
    }
    setIsFinishing(false)
  }

  const handleDispute = () => {
    // Open inline dispute form — replaces native prompt() (F3 landmine on iOS PWA).
    setDisputeReason('')
    setDisputeOpen(true)
  }

  const submitDispute = async () => {
    const reason = disputeReason.trim()
    if (!reason) {
      showToast({ type: 'error', message: 'Escribe una razón' })
      return
    }
    setDisputeOpen(false)
    setIsFinishing(true)
    const { error } = await supabase.rpc('dispute_match', { m_id: matchId, reason })
    if (error) {
      showToast({ type: 'error', message: 'Error al enviar disputa' })
    } else {
      showToast({ type: 'warning', message: 'Resultado disputado. Revisaremos el caso.' })
      setConfirmations(prev => prev.map(c => c.player_id === user.id ? { ...c, status: 'disputed', notes: reason } : c))
    }
    setIsFinishing(false)
  }

  if (loading || !currentMatch) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Cargando resultado...</p>
        </div>
      </div>
    )
  }

  const p1 = currentMatch.p1
  const p2 = currentMatch.p2
  const isP1Winner = currentMatch.winner_id === p1?.id
  const finalScore = currentMatch.live_state ? `${currentMatch.live_state.p1_points} - ${currentMatch.live_state.p2_points}` : 'N/A'

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-8 glass-ambient">
      <div className="w-full max-w-md space-y-6">
        {/* Winner Badge */}
        <div className="text-center">
          <div className="glass-card w-20 h-20 flex items-center justify-center mx-auto mb-4" style={{ borderRadius: '50%', borderColor: 'rgba(234,179,8,0.3)', background: 'linear-gradient(165deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.05) 100%)' }}>
            <span className="text-3xl">🏆</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">¡Partido Finalizado!</h1>
        </div>

        {/* Final Score */}
        <div className="glass-card p-8 space-y-6 relative overflow-hidden">
          {/* Decorative background emoji */}
          <div className="absolute -right-4 -bottom-4 text-8xl opacity-10 grayscale pointer-events-none">🎾</div>

          <div className="flex items-center justify-between gap-4">
            {/* P1 */}
            <div className={`flex-1 text-center space-y-2 ${isP1Winner ? 'scale-110 transition-transform' : 'opacity-60'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {isP1Winner ? '🏆 Ganador' : 'Rival'}
              </p>
              <p className="text-xl font-bold text-white truncate max-w-[120px] mx-auto">{p1?.display_name}</p>
              <div className={`text-6xl font-black ${isP1Winner ? 'text-emerald-500' : 'text-zinc-700'}`}>
                {currentMatch.live_state?.p1_points || 0}
              </div>
            </div>

            <div className="text-zinc-800 font-black text-2xl italic">VS</div>

            {/* P2 */}
            <div className={`flex-1 text-center space-y-2 ${!isP1Winner ? 'scale-110 transition-transform' : 'opacity-60'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {!isP1Winner ? '🏆 Ganador' : 'Rival'}
              </p>
              <p className="text-xl font-bold text-white truncate max-w-[120px] mx-auto">{p2?.display_name}</p>
              <div className={`text-6xl font-black ${!isP1Winner ? 'text-emerald-500' : 'text-zinc-700'}`}>
                {currentMatch.live_state?.p2_points || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Status Dashboard */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Validación de Jugadores</h3>
            <span className="text-[10px] text-zinc-600">Realtime</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {confirmations.map(conf => (
              <div key={conf.id} className="flex items-center justify-between glass-card p-3" style={{ borderRadius: '16px' }}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    conf.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                    conf.status === 'disputed' ? 'bg-red-500/20 text-red-400' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>
                    {conf.status === 'confirmed' ? '✓' : conf.status === 'disputed' ? '✗' : '⏳'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{conf.profile?.display_name}</p>
                    <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-tighter">
                      {conf.status === 'confirmed' ? 'Confirmado' : conf.status === 'disputed' ? 'Disputado' : 'Pendiente'}
                    </p>
                  </div>
                </div>
                {conf.status === 'disputed' && conf.notes && (
                  <div className="text-[10px] text-zinc-600 italic bg-zinc-900/50 px-2 py-1 rounded max-w-[100px] truncate">
                    "{conf.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* User Actions if Pending */}
          {confirmations.find(c => c.player_id === user?.id && c.status === 'pending') && (
            <div className="pt-2 space-y-2">
              <GlassButton
                variant="primary"
                size="md"
                fullWidth
                disabled={isFinishing}
                loading={isFinishing}
                onClick={handleConfirm}
              >
                Confirmar Resultado ✅
              </GlassButton>
              <GlassButton
                variant="danger"
                size="sm"
                fullWidth
                disabled={isFinishing}
                onClick={handleDispute}
              >
                Disputar Resultado ✋
              </GlassButton>
            </div>
          )}
        </div>

        {/* Match Info */}
        <div className="glass-card p-4 space-y-2 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Tipo:</span>
            <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${currentMatch.tipo === 'ranked' ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500'}`}>
              {currentMatch.tipo}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Formato:</span>
            <span className="text-white font-medium capitalize">{currentMatch.formato}</span>
          </div>
          <div className="flex justify-between text-zinc-400 text-xs">
            <span>Club:</span>
            <span className="text-white font-medium">{currentMatch.club?.name || 'N/A'}</span>
          </div>
        </div>

        {/* Share Button */}
        <GlassButton
          variant="secondary"
          size="md"
          fullWidth
          onClick={() => setShowShareCard(true)}
        >
          Compartir resultado
        </GlassButton>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <GlassButton
            variant="secondary"
            size="md"
            onClick={() => navigate(-1)}
          >
            ←
          </GlassButton>
          <GlassButton
            variant="primary"
            size="md"
            fullWidth
            onClick={() => navigate('/play')}
          >
            Volver al inicio
          </GlassButton>
          <GlassButton
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => navigate('/ranking')}
          >
            Ver ranking
          </GlassButton>
        </div>
      </div>

      {showBanner && (
        <BannerOverlay onClose={() => setShowBanner(false)} />
      )}

      {/* Match Share Card Modal */}
      {showShareCard && currentMatch && (
        <MatchShareCard
          match={{
            p1: currentMatch.p1,
            p2: null,
            p3: currentMatch.p2,
            p4: null,
            score_team_a: currentMatch.live_state?.p1_points || 0,
            score_team_b: currentMatch.live_state?.p2_points || 0,
            elo_delta_a1: currentMatch.elo_delta_a1 || null,
            played_at: currentMatch.created_at || currentMatch.played_at,
          }}
          onClose={() => setShowShareCard(false)}
        />
      )}

      {/* Dispute form — replaces window.prompt() (iOS PWA incompatible) */}
      {disputeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setDisputeOpen(false)}
        >
          <div
            role="document"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5"
          >
            <h2 className="text-base font-black text-zinc-100 mb-2">Disputar resultado</h2>
            <p className="text-sm text-zinc-400 mb-3">Explica brevemente por qué este resultado no es correcto.</p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={4}
              autoFocus
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm p-3 focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Ej: El marcador no coincide con lo que jugamos..."
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDisputeOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitDispute}
                disabled={!disputeReason.trim() || isFinishing}
                className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-widest hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar disputa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
