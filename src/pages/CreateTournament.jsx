import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import GlassButton from '@/components/ui/GlassButton'

const FORMATS = [
  {
    value: 'eliminacion',
    label: 'Eliminacion Directa',
    desc: 'Pierde y te vas',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h4l3 4-3 4H3m18-8h-4l-3 4 3 4h4M12 3v18" />
      </svg>
    ),
  },
  {
    value: 'americano',
    label: 'Americano',
    desc: 'Todos contra todos con rotacion',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
      </svg>
    ),
  },
  {
    value: 'liguilla',
    label: 'Liguilla',
    desc: 'Fase de grupos + eliminacion',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M21.375 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M12 17.25v-5.25" />
      </svg>
    ),
  },
]

const MAX_PLAYERS_OPTIONS = [4, 8, 16, 32]

const stepVariants = {
  enter: (direction) => ({ x: direction > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -200 : 200, opacity: 0 }),
}

export default function CreateTournament() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Step 1 fields
  const [name, setName] = useState('')
  const [format, setFormat] = useState('eliminacion')
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')

  // Step 2 fields
  const [maxScore, setMaxScore] = useState(4)
  const [entryFee, setEntryFee] = useState(0)
  const [eloImpact, setEloImpact] = useState(true)
  const [minElo, setMinElo] = useState('')

  const canNext = () => {
    if (step === 1) return name.trim().length > 0
    return true
  }

  const goNext = () => {
    if (!canNext()) return
    setDirection(1)
    setStep((s) => Math.min(s + 1, 3))
  }

  const goBack = () => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 1))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      const { data, error: insertError } = await supabase
        .from('tournaments')
        .insert({
          name,
          format,
          max_players: maxPlayers,
          max_score: maxScore,
          description: description || null,
          deadline: deadline || null,
          entry_fee: entryFee || null,
          elo_impact: eloImpact,
          min_elo: minElo ? Number(minElo) : null,
          created_by: currentUser.id,
          status: 'registration',
        })
        .select('id, name, format, max_players, status, created_by')
        .single()

      if (insertError) throw insertError
      navigate(`/torneo/${data.id}`)
    } catch (err) {
      setError(err.message || 'Error al crear torneo')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedFormat = FORMATS.find((f) => f.value === format)

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">Crear Torneo</h1>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  s <= step ? 'bg-emerald-500' : 'bg-zinc-800'
                }`}
              />
            </div>
          ))}
          <span className="text-xs text-zinc-500 ml-2">
            {step}/3
          </span>
        </div>
      </div>

      {/* Step content */}
      <div className="px-4 pt-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">Informacion del torneo</h2>
                <p className="text-zinc-500 text-sm">Define el nombre, formato y capacidad</p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Nombre del torneo *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Torneo Navidad 2026"
                  className="glass-input"
                />
              </div>

              {/* Format */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-400">Formato</label>
                <div className="grid grid-cols-1 gap-3">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      className={`glass-card flex items-center gap-4 p-4 transition-all text-left ${
                        format === f.value
                          ? '!border-emerald-500/40 !bg-emerald-500/10'
                          : 'hover:!border-white/15'
                      }`}
                      style={{ borderRadius: '16px' }}
                    >
                      <div
                        className={`shrink-0 ${
                          format === f.value ? 'text-emerald-400' : 'text-zinc-500'
                        }`}
                      >
                        {f.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{f.label}</p>
                        <p className="text-xs text-zinc-500">{f.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Players */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-400">Equipos maximos</label>
                <div className="flex gap-3">
                  {MAX_PLAYERS_OPTIONS.map((n) => (
                    <GlassButton
                      key={n}
                      variant={maxPlayers === n ? 'primary' : 'ghost'}
                      size="sm"
                      fullWidth
                      onClick={() => setMaxPlayers(n)}
                    >
                      {n}
                    </GlassButton>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Descripcion (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles del torneo, premios, etc."
                  rows={3}
                  className="glass-input resize-none"
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Fecha del torneo</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="glass-input"
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">Configuracion</h2>
                <p className="text-zinc-500 text-sm">Ajusta costos y reglas del torneo</p>
              </div>

              {/* Max Score (Points per match) */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-400">Puntos maximos por partido</label>
                <div className="flex gap-3">
                  {[3, 4, 5, 6, 7].map((n) => (
                    <GlassButton
                      key={n}
                      variant={maxScore === n ? 'primary' : 'ghost'}
                      size="sm"
                      fullWidth
                      onClick={() => setMaxScore(n)}
                    >
                      {n}
                    </GlassButton>
                  ))}
                </div>
                <p className="text-xs text-zinc-600">Maximo de puntos que gana un equipo en un partido</p>
              </div>

              {/* Entry Fee */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Cuota de inscripcion (MXN)</label>
                <input
                  type="number"
                  value={entryFee}
                  onChange={(e) => setEntryFee(Number(e.target.value))}
                  min={0}
                  placeholder="0"
                  className="glass-input"
                />
                <p className="text-xs text-zinc-600">Deja en 0 si es gratuito</p>
              </div>

              {/* ATP Impact */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">Impacto ATP</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Los resultados afectan el rating ATP</p>
                  </div>
                  <button
                    onClick={() => setEloImpact(!eloImpact)}
                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                      eloImpact ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                        eloImpact ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Min ATP */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">ATP minimo para inscripcion (opcional)</label>
                <input
                  type="number"
                  value={minElo}
                  onChange={(e) => setMinElo(e.target.value)}
                  min={0}
                  placeholder="Sin restriccion"
                  className="glass-input"
                />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold mb-1">Resumen</h2>
                <p className="text-zinc-500 text-sm">Confirma los detalles antes de crear</p>
              </div>

              <div className="glass-card divide-y divide-white/5">
                <div className="p-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Nombre</p>
                  <p className="font-bold text-lg">{name}</p>
                </div>
                <div className="p-4 flex items-center gap-3">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Formato</p>
                    <p className="font-semibold">{selectedFormat?.label}</p>
                    <p className="text-xs text-zinc-500">{selectedFormat?.desc}</p>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Equipos Max</p>
                    <p className="font-semibold">{maxPlayers}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Fecha</p>
                    <p className="font-semibold">{deadline || 'Sin definir'}</p>
                  </div>
                </div>
                {description && (
                  <div className="p-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Descripcion</p>
                    <p className="text-sm text-zinc-300">{description}</p>
                  </div>
                )}
                <div className="p-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Inscripcion</p>
                    <p className="font-semibold">{entryFee ? `$${entryFee}` : 'Gratis'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">ATP</p>
                    <p className="font-semibold">{eloImpact ? 'Si' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Min ATP</p>
                    <p className="font-semibold">{minElo || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="glass-card p-3 text-red-400 text-sm" style={{ borderColor: 'rgba(239,68,68,0.25)', background: 'linear-gradient(165deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.03) 100%)' }}>
                  {error}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 p-4 pb-24 flex gap-3 z-50">
        {step > 1 ? (
          <GlassButton
            variant="secondary"
            size="md"
            fullWidth
            onClick={goBack}
          >
            Atras
          </GlassButton>
        ) : (
          <div className="flex-1" />
        )}

        {step < 3 ? (
          <GlassButton
            variant="primary"
            size="md"
            fullWidth
            onClick={goNext}
            disabled={!canNext()}
          >
            Siguiente
          </GlassButton>
        ) : (
          <GlassButton
            variant="primary"
            size="md"
            fullWidth
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
          >
            Crear Torneo
          </GlassButton>
        )}
      </div>
    </div>
  )
}
