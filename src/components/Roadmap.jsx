import { useState } from 'react'

const VERSIONS = [
  {
    version: 'V1',
    title: 'Cancha Base',
    subtitle: 'Comunidad hiperlocal — Mexico City first',
    status: 'current',
    eta: 'Q2 2026',
    features: [
      { name: 'Perfiles de jugador', desc: 'Registro con nivel, foto, club favorito, posición preferida', priority: 'core' },
      { name: 'Sistema ATP', desc: 'Rating dinámico post-partido. Decay por inactividad', priority: 'core' },
      { name: 'Registro de partidos', desc: 'Log 2v2 con validación cruzada de resultados', priority: 'core' },
      { name: 'Feed social hiperlocal', desc: 'Muro de actividad con rankings y nuevos jugadores', priority: 'core' },
      { name: 'Búsqueda de rivales', desc: 'Match por ATP ±100 con solicitud de partido', priority: 'nice' },
      { name: 'PWA + Offline', desc: 'Instalable en home screen, cache y sync', priority: 'core' },
    ],
  },
  {
    version: 'V2',
    title: 'Torneo Engine',
    subtitle: 'Liguilla + Mexicano — los formatos que el padel usa',
    status: 'planned',
    eta: 'Q3 2026',
    features: [
      { name: 'Formato Liguilla', desc: 'Round-robin → eliminación con bracket automático', priority: 'core' },
      { name: 'Formato Mexicano', desc: 'Rotación de parejas con algoritmo de balance competitivo', priority: 'core' },
      { name: 'Bracket interactivo en vivo', desc: 'Visualización real-time con push notifications', priority: 'core' },
      { name: 'Creación de torneos', desc: 'Config: formato, cuota, premio, participantes', priority: 'core' },
      { name: 'Historial de torneos', desc: 'Perfil muestra torneos y ranking de ganados', priority: 'nice' },
      { name: 'Tabla de posiciones en vivo', desc: 'Leaderboard auto-actualizado del torneo', priority: 'core' },
    ],
  },
  {
    version: 'V3',
    title: 'Coleccionables',
    subtitle: 'Medallas, rachas y logros — el hook de retención',
    status: 'planned',
    eta: 'Q4 2026',
    features: [
      { name: 'Medallas coleccionables', desc: 'Logros: Primera victoria, rachas, Campeón', priority: 'core' },
      { name: 'Rachas y streaks', desc: 'Racha de victorias con multiplier de ATP', priority: 'core' },
      { name: 'Temporadas', desc: 'Reset trimestral de ranking con medallas por tier', priority: 'core' },
      { name: 'Showcase de perfil', desc: 'Elige 5 medallas para mostrar públicamente', priority: 'nice' },
      { name: 'Retos semanales', desc: 'Misiones: ganar 3 partidos, jugar con nuevo', priority: 'nice' },
      { name: 'Leaderboards por zona', desc: 'Rankings por colonia, club y ciudad', priority: 'core' },
    ],
  },
  {
    version: 'V4',
    title: 'Ecosistema Club',
    subtitle: 'Directorio + reservaciones — el revenue engine',
    status: 'planned',
    eta: 'Q1 2027',
    features: [
      { name: 'Directorio de clubes', desc: 'Perfil de negocio: fotos, horarios, precios, rating', priority: 'core' },
      { name: 'Reservación de canchas', desc: 'Calendario en tiempo real, pago in-app, split de costo', priority: 'core' },
      { name: 'Marketplace de servicios', desc: 'Clases, renta de palas, encordado. Comisión 5-10%', priority: 'revenue' },
      { name: 'Eventos patrocinados', desc: 'Marcas patrocinan torneos con branding', priority: 'revenue' },
      { name: 'Analytics para clubes', desc: 'Dashboard de ocupación, jugadores frecuentes, revenue', priority: 'revenue' },
      { name: 'Programa de lealtad', desc: 'Puntos por jugar en clubes afiliados', priority: 'nice' },
    ],
  },
  {
    version: 'V5',
    title: 'Inteligencia Deportiva',
    subtitle: 'Voice + smart matchmaking + analytics avanzados',
    status: 'planned',
    eta: 'Q2 2027',
    features: [
      { name: 'Control por voz', desc: 'Registra partidos con voice commands en español', priority: 'core' },
      { name: 'Smart matchmaking', desc: 'IA sugiere parejas óptimas para balance competitivo', priority: 'core' },
      { name: 'Análisis de rendimiento', desc: 'Dashboard personal con trends de ATP y patrones', priority: 'core' },
      { name: 'Coaching AI básico', desc: 'Tips personalizados post-partido basados en datos', priority: 'nice' },
      { name: 'Predicciones de partido', desc: 'Win probability pre-partido, gamification', priority: 'nice' },
      { name: 'Heat maps de actividad', desc: 'Mapa de zonas con densidad de partidos', priority: 'nice' },
    ],
  },
  {
    version: 'V6',
    title: 'Narrador AI',
    subtitle: 'Comentarista deportivo artificial — cada partido como una final',
    status: 'planned',
    eta: 'Q3-Q4 2027',
    features: [
      { name: 'Narración en vivo por texto', desc: 'Feed de comentarios estilo deportivo durante partido', priority: 'core' },
      { name: 'Narración por voz (TTS)', desc: 'Voz sintética narrando en tiempo real', priority: 'core' },
      { name: 'Personalidad del narrador', desc: '3 estilos: Formal, Callejero, Épico + frases yucatecas', priority: 'core' },
      { name: 'Contexto histórico en vivo', desc: 'El narrador conoce historial y H2H de rivales', priority: 'core' },
      { name: 'Highlights automáticos', desc: 'Resumen narrado de mejores momentos, shareable', priority: 'core' },
      { name: 'Estadísticas narradas', desc: 'Integración con analytics, citas en vivo', priority: 'nice' },
      { name: 'Modo espectador', desc: 'Usuarios sintonizar partidos en vivo con reacciones', priority: 'nice' },
      { name: 'Podcast de recap semanal', desc: 'Audio resumen de la semana en la comunidad', priority: 'nice' },
    ],
  },
]

const PRIORITY_CONFIG = {
  core: { label: 'core', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/50' },
  revenue: { label: 'revenue', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' },
  nice: { label: 'nice-to-have', color: 'bg-zinc-700/20 text-zinc-400 border border-zinc-600/50' },
}

export default function Roadmap() {
  const [selected, setSelected] = useState(0)
  const v = VERSIONS[selected]

  return (
    <div className="space-y-4">
      {/* Version selector pills */}
      <div className="flex gap-2 flex-wrap">
        {VERSIONS.map((ver, i) => (
          <button
            key={ver.version}
            onClick={() => setSelected(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              i === selected
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div>{ver.version}</div>
            <div className="text-xs opacity-70">{ver.title.split(' ')[0]}</div>
          </button>
        ))}
      </div>

      {/* Selected version header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-2xl text-emerald-400 font-bold">{v.version}</span>
          <span className="text-xl font-semibold text-white">{v.title}</span>
          <span className={`text-xs px-2 py-1 rounded ${
            v.status === 'current'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-zinc-800 text-zinc-400'
          }`}>
            {v.status === 'current' ? 'En desarrollo' : v.eta}
          </span>
        </div>
        <p className="text-sm text-zinc-400">{v.subtitle}</p>
      </div>

      {/* Features list */}
      <div className="space-y-2">
        {v.features.map((f, i) => (
          <div
            key={i}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 border-l-4 border-l-emerald-500"
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-sm text-white">{f.name}</span>
              <span className={`text-xs px-2 py-1 rounded ${PRIORITY_CONFIG[f.priority].color}`}>
                {PRIORITY_CONFIG[f.priority].label}
              </span>
            </div>
            <p className="text-xs text-zinc-400">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Timeline indicator */}
      <div className="pt-2 space-y-1">
        <div className="flex gap-0.5 h-1 rounded overflow-hidden">
          {VERSIONS.map((ver, i) => (
            <div
              key={ver.version}
              className={`flex-1 transition-colors ${
                i <= selected ? 'bg-emerald-500' : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>
        <div className="flex gap-2 text-xs text-zinc-500 font-mono">
          {VERSIONS.map((ver, i) => (
            <span key={ver.version} className={i <= selected ? 'text-emerald-400' : ''}>
              {ver.version}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
