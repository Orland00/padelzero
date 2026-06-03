import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLigaStore } from '@/stores/ligaStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import TennisballLoader from '@/components/TennisballLoader'
import GlassButton from '@/components/ui/GlassButton'

const LIGA_PRESETS = {
  express: {
    label: 'Liga rapida',
    description: 'Alta hoy, juega ya. A 4 puntos con punto muerto.',
    maxScore: 4,
    rules: {
      preset: 'express',
      deadPoint: true,
      winByTwo: false,
      tieBreak: 'golden_point',
      ratingName: 'ATP',
    },
  },
  club: {
    label: 'Club semanal',
    description: 'Formato estable para ranking de club.',
    maxScore: 6,
    rules: {
      preset: 'club',
      deadPoint: true,
      winByTwo: true,
      tieBreak: 'super_tiebreak',
      ratingName: 'ATP',
    },
  },
  pro: {
    label: 'Pro high end',
    description: 'Control competitivo con ajustes avanzados.',
    maxScore: 7,
    rules: {
      preset: 'pro',
      deadPoint: true,
      winByTwo: true,
      tieBreak: 'admin_decides',
      ratingName: 'ATP',
    },
  },
}

const createInitialLigaForm = () => ({
  name: '',
  description: '',
  mode: 'quick',
  preset: 'express',
  maxScore: LIGA_PRESETS.express.maxScore,
  allowGuests: false,
  deadPoint: LIGA_PRESETS.express.rules.deadPoint,
  winByTwo: LIGA_PRESETS.express.rules.winByTwo,
  tieBreak: LIGA_PRESETS.express.rules.tieBreak,
})

export default function Liga() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { showToast } = useUiStore()
  const { ligas, fetchMyLigas, createLiga, loading } = useLigaStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState(createInitialLigaForm)
  const [creating, setCreating] = useState(false)

  // Search / Browse
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    fetchMyLigas()
  }, [fetchMyLigas])

  const handleCreateLiga = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    setCreating(true)
    try {
      const schedule = {
        days: [],
        time: '',
        rules: {
          preset: formData.preset,
          mode: formData.mode,
          maxScore: formData.maxScore,
          deadPoint: formData.deadPoint,
          winByTwo: formData.winByTwo,
          tieBreak: formData.tieBreak,
          ratingName: 'ATP',
          allowGuests: formData.allowGuests,
        },
      }
      const liga = await createLiga(formData.name, formData.description, schedule)
      // Update max_score after creation
      if (formData.maxScore && formData.maxScore !== 4) {
        await supabase.from('ligas').update({ max_score: formData.maxScore }).eq('id', liga.id)
      }
      setFormData(createInitialLigaForm())
      setShowCreateModal(false)
      showToast({ type: 'success', message: `Liga "${liga.name}" creada` })
      navigate(`/liga/${liga.id}`)
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Error al crear liga' })
    } finally {
      setCreating(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      // Search by name or join_code
      const q = searchQuery.trim().toLowerCase().replace(/[,.()"']/g, '')
      if (!q) return
      const { data, error } = await supabase
        .from('ligas')
        .select('id, name, description, is_active, join_code, max_members')
        .or(`name.ilike.%${q}%,join_code.eq.${q}`)
        .eq('is_active', true)
        .limit(20)
      if (error) throw error
      setSearchResults(data || [])
    } catch (err) {
      showToast({ type: 'error', message: 'Error buscando ligas' })
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/play')}
            className="text-zinc-400 text-sm font-bold mb-3 flex items-center gap-1 hover:text-white transition"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-black uppercase tracking-widest text-white">
            ⚡ Ligas
          </h1>
        </div>

        {/* Big Search Section */}
        <div className="glass-card p-5 mb-6" style={{ borderColor: 'rgba(16,185,129,0.15)' }}>
          <h2 className="text-lg font-black text-white mb-1">🌍 Buscar ligas</h2>
          <p className="text-xs text-zinc-400 mb-4">Encuentra ligas en Mexico City, tu ciudad o el mundo</p>
          <div className="flex gap-2">
            <input
              className="glass-input flex-1"
              placeholder="Nombre de liga o código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <GlassButton variant="primary" onClick={handleSearch} loading={searching}>
              🔍
            </GlassButton>
          </div>
          {!showSearch && (
            <button onClick={() => setShowSearch(true)} className="text-xs text-emerald-400 mt-2 font-bold">
              Ver todas las ligas públicas →
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <GlassButton variant="primary" fullWidth onClick={() => setShowCreateModal(true)}>
            + CREAR LIGA
          </GlassButton>
        </div>

        {/* Liga vs Torneo explainer */}
        <div className="glass-card p-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3 border-emerald-500/20">
              <p className="text-emerald-400 font-black text-xs uppercase tracking-widest mb-1">⚡ Liga</p>
              <p className="text-zinc-400 text-[10px]">Temporada continua. Ranking ATP. Todos juegan contra todos. Sin eliminacion.</p>
            </div>
            <div
              onClick={() => navigate('/torneos')}
              className="glass-card p-3 border-yellow-500/20 cursor-pointer transition"
            >
              <p className="text-yellow-400 font-black text-xs uppercase tracking-widest mb-1">🏆 Torneo</p>
              <p className="text-zinc-400 text-[10px]">Evento unico. Bracket de eliminacion. Ganador se lleva todo. Ver torneos →</p>
            </div>
          </div>
        </div>

        {/* Search Panel */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="glass-card p-4 space-y-3">
                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Buscar por nombre o código</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Nombre de liga o código (ej: abc123)..."
                    className="glass-input flex-1 text-sm"
                  />
                  <GlassButton
                    variant="primary"
                    onClick={handleSearch}
                    disabled={searching}
                    loading={searching}
                  >
                    {searching ? '...' : 'Buscar'}
                  </GlassButton>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map(liga => (
                      <div
                        key={liga.id}
                        onClick={() => navigate(`/liga/${liga.id}`)}
                        className="glass-card p-4 cursor-pointer transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-bold">{liga.name}</p>
                            <p className="text-zinc-400 text-xs mt-0.5">{liga.description || 'Sin descripción'}</p>
                          </div>
                          <div className="text-right">
                            {liga.join_code && (
                              <p className="text-[10px] text-zinc-500 font-mono uppercase">{liga.join_code}</p>
                            )}
                            <span className="text-emerald-400 text-xs font-bold">VER →</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.length === 0 && searchQuery && !searching && (
                  <p className="text-zinc-500 text-sm text-center py-2">No se encontraron ligas</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* My Ligas List */}
        {loading && ligas.length === 0 ? (
          <div className="flex justify-center py-12">
            <TennisballLoader size="lg" />
          </div>
        ) : ligas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-400 mb-4">No estás en ninguna liga aún.</p>
            <p className="text-zinc-600 text-sm mb-6">Crea una liga o busca una existente para unirte.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ligas.map(liga => (
              <motion.div
                key={liga.id}
                onClick={() => navigate(`/liga/${liga.id}`)}
                className="glass-card p-6 cursor-pointer hover:border-emerald-500/50 transition"
                whileHover={{ scale: 1.02 }}
              >
                <h3 className="text-lg font-bold text-white mb-2">{liga.name}</h3>
                <p className="text-sm text-zinc-400 mb-4">{liga.description || 'Sin descripción'}</p>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{liga.format || 'americano'}</span>
                  <span className="text-emerald-500 font-bold">ENTRAR →</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Liga Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-card p-6 max-w-md w-full"
            >
              <h2 className="text-xl font-bold text-white mb-4">CREAR NUEVA LIGA</h2>
              <form onSubmit={handleCreateLiga} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['quick', 'Liga rapida'],
                    ['advanced', 'Config avanzada'],
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFormData({ ...formData, mode })}
                      className={`py-2.5 rounded-lg text-xs font-black uppercase tracking-widest border transition ${
                        formData.mode === mode
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Preset</label>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(LIGA_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          preset: key,
                          maxScore: preset.maxScore,
                          deadPoint: preset.rules.deadPoint,
                          winByTwo: preset.rules.winByTwo,
                          tieBreak: preset.rules.tieBreak,
                        })}
                        className={`text-left p-3 rounded-lg border transition ${
                          formData.preset === key
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-zinc-700 bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-white">{preset.label}</p>
                          <span className="text-[10px] text-emerald-400 font-bold">ATP</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Nombre *</label>
                  <input
                    type="text"
                    placeholder="Ej: Liga Demo Brand"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="glass-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Descripción</label>
                  <textarea
                    placeholder="Descripción de la liga (opcional)"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="glass-input w-full h-20 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Puntos máximos por partido</label>
                  <div className="flex gap-2">
                    {[3, 4, 5, 6, 7].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFormData({ ...formData, maxScore: n })}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition border ${
                          formData.maxScore === n
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">Máximo de puntos que gana un equipo en un partido</p>
                </div>
                {formData.mode === 'advanced' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                      <div>
                        <p className="text-xs font-bold text-zinc-300">Punto muerto</p>
                        <p className="text-[10px] text-zinc-500">Empate decisivo tipo liga premium: el siguiente punto cierra.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, deadPoint: !formData.deadPoint })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${formData.deadPoint ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.deadPoint ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                      <div>
                        <p className="text-xs font-bold text-zinc-300">Ganar por 2</p>
                        <p className="text-[10px] text-zinc-500">Mantiene presión competitiva antes del desempate.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, winByTwo: !formData.winByTwo })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${formData.winByTwo ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.winByTwo ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Desempate</label>
                      <select
                        value={formData.tieBreak}
                        onChange={(e) => setFormData({ ...formData, tieBreak: e.target.value })}
                        className="glass-input w-full"
                      >
                        <option value="golden_point">Punto muerto</option>
                        <option value="super_tiebreak">Super tie-break</option>
                        <option value="admin_decides">Admin decide</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                  <div>
                    <p className="text-xs font-bold text-zinc-300">¿Habrá jugadores sin cuenta?</p>
                    <p className="text-[10px] text-zinc-500">Si sí, los partidos NO impactan el ATP oficial</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, allowGuests: !formData.allowGuests })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${formData.allowGuests ? 'bg-yellow-500' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.allowGuests ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                {formData.allowGuests && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-[10px] text-yellow-400 font-bold">⚠️ Los partidos en esta liga NO afectarán el ATP oficial.</p>
                  </div>
                )}
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Al crear la liga:</p>
                  <ul className="text-[10px] text-zinc-400 space-y-0.5">
                    <li>• Tú serás el admin/dueño</li>
                    <li>• Se genera un código para invitar</li>
                    <li>• {formData.deadPoint ? 'Punto muerto activado' : 'Sin punto muerto'}</li>
                    <li>• {formData.allowGuests ? 'ATP no oficial (hay invitados)' : 'Los partidos participan en el ATP'}</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <GlassButton variant="secondary" fullWidth type="button" onClick={() => setShowCreateModal(false)}>
                    CANCELAR
                  </GlassButton>
                  <GlassButton variant="primary" fullWidth type="submit" disabled={creating || !formData.name.trim()} loading={creating}>
                    {creating ? 'CREANDO...' : 'CREAR'}
                  </GlassButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
