import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'

export default function EloGuide() {
  const navigate = useNavigate()
  const { lang } = useI18n()
  const es = lang === 'es'
  const [expandedSection, setExpandedSection] = useState('what-is-elo')
  const [adImageUrl, setAdImageUrl] = useState(null)

  useEffect(() => {
    async function fetchAd() {
      try {
        const { data: files } = await supabase.storage.from('banners').list('', { limit: 100 })
        const images = (files || []).filter(f => f.name && !f.name.startsWith('.') && f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i))
        if (images.length > 0) {
          const random = images[Math.floor(Math.random() * images.length)]
          const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(random.name)
          setAdImageUrl(publicUrl)
        }
      } catch {}
    }
    fetchAd()
  }, [])

  const sections = es ? [
    {
      id: 'what-is-elo',
      title: '¿Qué es ATP?',
      content: 'ATP es un sistema de clasificación que mide el nivel de habilidad de los jugadores basándose en resultados de partidos. Fue creado para ajedrez y ahora se usa en padel, tenis y otros deportes.'
    },
    {
      id: 'individual-elo',
      title: 'ATP Individual',
      content: `Todos empiezan en 1200 puntos. Tu ATP sube al ganar y baja al perder.

El cambio depende de:
• ATP promedio de tu equipo vs el equipo rival
• Si ganaste o perdiste
• Tu factor K (volatilidad)

Fórmula: ATP nuevo = ATP actual + K × (Resultado - Probabilidad esperada)

Donde:
• K = 40 si tienes <20 partidos (cambios grandes, calibración)
• K = 32 si tienes ≥20 partidos (más estable)
• Resultado = 1 si ganas, 0 si pierdes
• Prob. esperada = 1 / (1 + 10^((ATP rival - Tu ATP) / 400))
• ATP mínimo: 800 (nunca bajas de ahí)`
    },
    {
      id: 'team-elo',
      title: 'ATP por Parejas',
      content: `El ATP por parejas es independiente del ATP individual.

Se calcula como:
• ATP de la pareja = Promedio de los dos jugadores
• Se compara con el ATP promedio del equipo contrario
• Se actualiza con la misma fórmula que ATP individual

Ejemplo:
Pareja A: Player A (1200) + Daniel (1200) = ATP promedio 1200
Pareja B: Oma (1200) + Jesús (1200) = ATP promedio 1200

Si Pareja A gana: ambas parejas ajustan su team_elo`
    },
    {
      id: 'k-factor',
      title: 'K-Factor (factor de volatilidad)',
      content: `El K-Factor determina cuán rápido sube/baja tu ATP:

• K = 40: Para jugadores nuevos (<20 partidos)
  - Cambios grandes en ATP
  - Se estabiliza rápidamente

• K = 32: Para jugadores experimentados (≥20 partidos)
  - Cambios moderados en ATP
  - Mayor estabilidad`
    },
    {
      id: 'example',
      title: 'Ejemplo Práctico',
      content: `Equipo A: Player A (1250) + Daniel (1150) = Promedio 1200
Equipo B: Oma (1300) + Carlos (1100) = Promedio 1200

Equipos iguales → Probabilidad esperada: 50%

Si Equipo A gana (jugadores nuevos, K=40):
• Player A: 40 × (1 - 0.50) = +20 → 1250 → 1270
• Daniel: 40 × (1 - 0.50) = +20 → 1150 → 1170

Si Equipo A pierde:
• Player A: 40 × (0 - 0.50) = -20 → 1250 → 1230
• Daniel: 40 × (0 - 0.50) = -20 → 1150 → 1130

Ejemplo con equipos desiguales:
Equipo A (promedio 1300) vs Equipo B (promedio 1100)
• Probabilidad A gana: ~76%
• Si A gana (esperado): +8 pts (poco cambio)
• Si B gana (sorpresa): +30 pts (gran subida)`
    },
    {
      id: 'tips',
      title: 'Consejos',
      content: `• ATP es relativo: Solo importa compararse con tu grupo
• Consistencia: Juega regularmente para que tu ATP sea preciso
• Pareja importa: Tu pareja afecta tu ATP individual
• Racha: Ganadores suben rápido, perdedores bajan rápido
• Objetivo: Mejorar con el tiempo, no solo subir puntos`
    }
  ] : [
    {
      id: 'what-is-elo',
      title: 'What is ATP?',
      content: 'ATP is a rating system that measures a player\u2019s skill level based on match results. Originally designed for chess, it\u2019s now widely used in padel, tennis and other sports.'
    },
    {
      id: 'individual-elo',
      title: 'Individual ATP',
      content: `Everyone starts at 1200 points. Your ATP goes up when you win and down when you lose.

The change depends on:
• Average ATP of your team vs the opposing team
• Whether you won or lost
• Your K factor (volatility)

Formula: new ATP = current ATP + K × (Result − Expected probability)

Where:
• K = 40 if you have <20 matches (bigger swings, calibration phase)
• K = 32 if you have ≥20 matches (more stable)
• Result = 1 if you win, 0 if you lose
• Expected prob. = 1 / (1 + 10^((Opponent ATP − Your ATP) / 400))
• Minimum ATP: 800 (it never drops below this floor)`
    },
    {
      id: 'team-elo',
      title: 'Team (Pair) ATP',
      content: `Pair ATP is independent from individual ATP.

It is calculated as:
• Pair ATP = Average of the two players
• Compared against the opposing pair\u2019s average ATP
• Updated using the same formula as individual ATP

Example:
Pair A: Player A (1200) + Daniel (1200) = Avg ATP 1200
Pair B: Oma (1200) + Jesús (1200) = Avg ATP 1200

If Pair A wins: both pairs adjust their team_elo`
    },
    {
      id: 'k-factor',
      title: 'K-Factor (volatility)',
      content: `The K-Factor controls how fast your ATP changes:

• K = 40: New players (<20 matches)
  - Large ATP swings
  - Stabilizes quickly

• K = 32: Established players (≥20 matches)
  - Moderate ATP changes
  - Greater stability`
    },
    {
      id: 'example',
      title: 'Worked Example',
      content: `Team A: Player A (1250) + Daniel (1150) = Avg 1200
Team B: Oma (1300) + Carlos (1100) = Avg 1200

Even teams → Expected probability: 50%

If Team A wins (new players, K=40):
• Player A: 40 × (1 − 0.50) = +20 → 1250 → 1270
• Daniel: 40 × (1 − 0.50) = +20 → 1150 → 1170

If Team A loses:
• Player A: 40 × (0 − 0.50) = −20 → 1250 → 1230
• Daniel: 40 × (0 − 0.50) = −20 → 1150 → 1130

Example with uneven teams:
Team A (avg 1300) vs Team B (avg 1100)
• Probability A wins: ~76%
• If A wins (expected): +8 pts (small change)
• If B wins (upset): +30 pts (big jump)`
    },
    {
      id: 'tips',
      title: 'Tips',
      content: `• ATP is relative: what matters is comparison within your group
• Consistency: play regularly so your ATP is accurate
• Your partner matters: they affect your individual ATP
• Streaks: winners climb fast, losers drop fast
• Goal: improve over time, not just chase points`
    }
  ]

  return (
    <div className="min-h-screen bg-zinc-950 pb-20 glass-ambient">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-[#6b2f9d] to-[#3273dc] px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          className="text-white/80 font-black text-sm tracking-tighter mb-1 block hover:text-white transition"
        >
          padel<span className="text-emerald-300">zero</span>
        </button>
        <h1 className="text-white font-black text-lg">{es ? 'Cómo funciona el ATP' : 'How ATP works'}</h1>
        <p className="text-white/70 text-xs mt-1">{es ? 'Guía educativa sobre el sistema de calificación' : 'Educational guide to the rating system'}</p>
      </div>

      {/* Content */}
      <div className="space-y-2 px-4 mt-4">
        {sections.map(section => (
          <motion.div
            key={section.id}
            className="glass-card overflow-hidden"
          >
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
            >
              <h2 className="text-white font-bold text-sm text-left">{section.title}</h2>
              <motion.div
                animate={{ rotate: expandedSection === section.id ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-[#6b2f9d] text-xl"
              >
                ▼
              </motion.div>
            </button>

            <AnimatePresence>
              {expandedSection === section.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-white/10"
                >
                  <div className="p-4 bg-white/[0.03] text-zinc-300 text-xs whitespace-pre-wrap leading-relaxed">
                    {section.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Calculator CTA */}
      <div className="px-4 pt-4">
        <button
          onClick={() => navigate('/calculator')}
          className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/5 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xl">
              🧮
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-sm">{es ? 'Calculadora ATP' : 'ATP Calculator'}</p>
              <p className="text-zinc-500 text-xs">{es ? 'Simula partidos y ve el impacto' : 'Simulate matches and see the impact'}</p>
            </div>
          </div>
          <span className="text-zinc-600 group-hover:text-purple-400 transition">→</span>
        </button>
      </div>

      {/* Ad Banner */}
      {adImageUrl && (
        <div className="px-4 pt-4 pb-6">
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center mb-2">{es ? 'Esta página es presentada por' : 'This page is presented by'}</p>
          <img
            src={adImageUrl}
            alt={es ? 'Publicidad' : 'Advertisement'}
            className="w-full rounded-2xl object-contain border border-zinc-800"
          />
        </div>
      )}

      {/* Footer */}
      <div className="pb-6 text-center">
        <p className="text-zinc-600 text-xs">{es ? 'Liga ProLeague • Dobles 2v2 • ATP en Vivo' : 'Liga ProLeague • 2v2 Doubles • Live ATP'}</p>
      </div>
    </div>
  )
}
