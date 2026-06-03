import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const MCP_CONFIG = `{
  "mcpServers": {
    "padel": {
      "command": "node",
      "args": ["./mcp/index.js"]
    }
  }
}`

const TOOLS = [
  { name: 'login', desc: 'Autenticarte con tu cuenta PadelZero' },
  { name: 'get_my_ligas', desc: 'Ver tus ligas' },
  { name: 'get_standings', desc: 'Ver ranking y ATP de una liga' },
  { name: 'get_matches', desc: 'Ver historial de partidos' },
  { name: 'get_team_stats', desc: 'Ver ranking de parejas' },
  { name: 'record_match', desc: 'Registrar un partido 2v2' },
  { name: 'delete_match', desc: 'Eliminar un partido (admin)' },
  { name: 'search_players', desc: 'Buscar jugadores por nombre' },
  { name: 'add_member', desc: 'Agregar jugador a liga (admin)' },
  { name: 'remove_member', desc: 'Quitar jugador de liga (admin)' },
]

export default function McpSetup() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MCP_CONFIG)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Back + Title */}
        <div>
          <button onClick={() => navigate(-1)} className="text-zinc-500 text-sm font-bold mb-4">&larr; Volver</button>
          <h1 className="text-2xl font-black text-white">Conecta con Claude</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Controla tu liga desde Claude Code con el servidor MCP de PadelZero
          </p>
        </div>

        {/* Steps */}
        <div className="bg-zinc-900 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Configuracion</h2>

          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-black text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-white text-sm font-bold">Clona el repositorio</p>
                <code className="text-emerald-400 text-xs bg-zinc-800 px-2 py-1 rounded mt-1 block">
                  git clone https://github.com/padelzero/mcp.git && cd mcp && npm install
                </code>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-black text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-white text-sm font-bold">Agrega a Claude Code</p>
                <p className="text-zinc-400 text-xs mt-1">Pega esto en <code className="text-emerald-400">~/.claude/settings.json</code>:</p>
                <pre className="text-emerald-400 text-xs bg-zinc-800 px-3 py-2 rounded mt-2 overflow-x-auto">{MCP_CONFIG}</pre>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-black text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div>
                <p className="text-white text-sm font-bold">Usa desde Claude</p>
                <p className="text-zinc-400 text-xs mt-1">"Login to PadelZero" &rarr; "Show me standings" &rarr; "Record a match"</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition active:scale-95 ${
              copied
                ? 'bg-emerald-500 text-black'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            {copied ? 'Copiado!' : 'Copiar Config'}
          </button>
          <a
            href="https://claude.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-[#d97706] text-black text-center transition active:scale-95 hover:bg-[#f59e0b]"
          >
            Abrir Claude
          </a>
        </div>

        {/* Tools List */}
        <div className="bg-zinc-900 rounded-xl p-5">
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">10 Herramientas Disponibles</h2>
          <div className="space-y-2">
            {TOOLS.map(t => (
              <div key={t.name} className="flex items-start gap-2">
                <code className="text-emerald-400 text-xs bg-zinc-800 px-1.5 py-0.5 rounded flex-shrink-0">{t.name}</code>
                <span className="text-zinc-400 text-xs">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GitHub Link */}
        <a
          href="https://github.com/padelzero/mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-zinc-500 text-xs font-bold hover:text-zinc-300 transition"
        >
          Ver codigo fuente en GitHub &rarr;
        </a>
      </div>
    </div>
  )
}
