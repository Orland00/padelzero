import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GlassButton from '@/components/ui/GlassButton'

export default function ScoreModal({ isOpen, onClose, onSubmit, team1Name, team2Name, loading }) {
  const [team1Sets, setTeam1Sets] = useState(0)
  const [team2Sets, setTeam2Sets] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setTeam1Sets(0)
      setTeam2Sets(0)
    }
  }, [isOpen])

  const canSubmit = !loading && (team1Sets !== team2Sets) && (team1Sets > 0 || team2Sets > 0)

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({ team1Sets, team2Sets })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="glass-card p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-zinc-100 mb-5 text-center">
              Registrar Resultado
            </h2>

            {/* Team 1 row */}
            <div className="flex items-center justify-between mb-3 bg-white/[0.04] rounded-lg px-3 py-2.5">
              <span className="text-sm text-zinc-200 truncate mr-3 flex-1">
                {team1Name || 'Equipo 1'}
              </span>
              <input
                type="number"
                min={0}
                max={9}
                value={team1Sets}
                onChange={(e) => setTeam1Sets(Math.max(0, Math.min(9, parseInt(e.target.value) || 0)))}
                className="glass-input w-14 h-10 text-center text-lg font-bold !p-0"
              />
            </div>

            {/* VS divider */}
            <div className="text-center text-zinc-600 text-xs font-semibold my-1">VS</div>

            {/* Team 2 row */}
            <div className="flex items-center justify-between mt-3 mb-5 bg-white/[0.04] rounded-lg px-3 py-2.5">
              <span className="text-sm text-zinc-200 truncate mr-3 flex-1">
                {team2Name || 'Equipo 2'}
              </span>
              <input
                type="number"
                min={0}
                max={9}
                value={team2Sets}
                onChange={(e) => setTeam2Sets(Math.max(0, Math.min(9, parseInt(e.target.value) || 0)))}
                className="glass-input w-14 h-10 text-center text-lg font-bold !p-0"
              />
            </div>

            {/* Validation hint */}
            {team1Sets === team2Sets && (team1Sets > 0 || team2Sets > 0) && (
              <p className="text-xs text-amber-400 text-center mb-3">
                El marcador no puede quedar empatado
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <GlassButton
                variant="secondary"
                onClick={onClose}
                disabled={loading}
                fullWidth
              >
                Cancelar
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={handleSubmit}
                disabled={!canSubmit}
                loading={loading}
                fullWidth
              >
                Guardar
              </GlassButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
