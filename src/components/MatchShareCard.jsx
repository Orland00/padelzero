import { useRef, useState, useEffect, forwardRef } from 'react'
import { toPng } from 'html-to-image'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'

/**
 * Visual match card for sharing as image.
 * Renders a styled card with match result, players, scores, and ATP deltas.
 */
export const MatchCardVisual = forwardRef(function MatchCardVisual({ match, ligaName, ligaId, jornadaLabel }, ref) {
  const [sponsor, setSponsor] = useState(null)

  useEffect(() => {
    if (!ligaId) return
    let cancelled = false
    supabase
      .from('liga_sponsors')
      .select('*, sponsors(*)')
      .eq('liga_id', ligaId)
      .eq('placement', 'match_card')
      .eq('is_active', true)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!cancelled && data?.sponsors) setSponsor(data.sponsors)
      })
    return () => { cancelled = true }
  }, [ligaId])

  const teamAWon = match.score_team_a > match.score_team_b
  const dateStr = match.played_at
    ? new Date(match.played_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <div
      ref={ref}
      style={{
        width: 360,
        padding: 24,
        background: 'linear-gradient(165deg, #18181b 0%, #09090b 100%)',
        borderRadius: 16,
        border: '1px solid rgba(16, 185, 129, 0.2)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
      }}
    >
      {/* Header */}
      {ligaName && (
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: 2 }}>
            {ligaName}
          </span>
        </div>
      )}
      {(jornadaLabel || dateStr) && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>
            {jornadaLabel ? `${jornadaLabel} · ` : ''}{dateStr}
          </span>
        </div>
      )}

      {/* Teams + Score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {/* Team A */}
        <div style={{ flex: 1, textAlign: 'right', opacity: teamAWon ? 1 : 0.5 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{match.p1?.display_name || '?'}</p>
          {match.p2 && <p style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0 0' }}>{match.p2.display_name || '?'}</p>}
        </div>

        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: teamAWon ? '#10b981' : '#52525b' }}>
            {match.score_team_a}
          </span>
          <span style={{ fontSize: 14, color: '#3f3f46' }}>-</span>
          <span style={{ fontSize: 32, fontWeight: 900, color: !teamAWon ? '#10b981' : '#52525b' }}>
            {match.score_team_b}
          </span>
        </div>

        {/* Team B */}
        <div style={{ flex: 1, textAlign: 'left', opacity: !teamAWon ? 1 : 0.5 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{match.p3?.display_name || '?'}</p>
          {match.p4 && <p style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0 0' }}>{match.p4.display_name || '?'}</p>}
        </div>
      </div>

      {/* ATP Deltas */}
      {match.elo_delta_a1 != null && match.elo_delta_a1 !== 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #27272a' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: match.elo_delta_a1 > 0 ? '#10b981' : '#ef4444' }}>
            {match.elo_delta_a1 > 0 ? '+' : ''}{match.elo_delta_a1} ATP
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: match.elo_delta_a1 < 0 ? '#10b981' : '#ef4444' }}>
            {match.elo_delta_a1 < 0 ? '+' : ''}{-match.elo_delta_a1} ATP
          </span>
        </div>
      )}

      {/* Sponsor */}
      {sponsor && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
          <span style={{ fontSize: 8, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
            Patrocinado por
          </span>
          {sponsor.logo_url ? (
            <img src={sponsor.logo_url} alt={sponsor.name} style={{ height: 16, maxWidth: 80, objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981' }}>{sponsor.name}</span>
          )}
        </div>
      )}

      {/* Branding */}
      <div style={{ textAlign: 'center', marginTop: sponsor ? 8 : 16, paddingTop: 12, borderTop: '1px solid #27272a' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: 1 }}>
          padelzero.win
        </span>
      </div>
    </div>
  )
})

/**
 * Converts a DOM element to PNG and shares via Web Share API.
 * Falls back to clipboard, then text-only share.
 */
export async function shareMatchCard(element, matchText) {
  try {
    const dataUrl = await toPng(element, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#09090b',
    })

    // Convert data URL to blob
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], 'partido-padel.png', { type: 'image/png' })

    // Try Web Share API with file
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        text: matchText || 'Resultado del partido - padelzero.win',
        files: [file],
      })
      return 'shared'
    }

    // Fallback: copy image to clipboard
    if (navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      return 'copied_image'
    }

    // Fallback: copy text
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(matchText || 'Resultado del partido - padelzero.win')
      return 'copied_text'
    }

    return 'no_action'
  } catch (err) {
    // Share cancelled or failed — try text fallback
    if (navigator.clipboard?.writeText && matchText) {
      await navigator.clipboard.writeText(matchText)
      return 'copied_text'
    }
    return 'error'
  }
}

/**
 * Downloads the match card as a PNG image.
 */
export async function downloadMatchCard(element) {
  try {
    const dataUrl = await toPng(element, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#09090b',
    })
    const link = document.createElement('a')
    link.download = 'partido-padel.png'
    link.href = dataUrl
    link.click()
    return 'downloaded'
  } catch {
    return 'error'
  }
}

/**
 * Share modal/sheet component that wraps the visual card with action buttons.
 */
export default function MatchShareCard({ match, ligaName, ligaId, jornadaLabel, onClose }) {
  const { t } = useI18n()
  const cardRef = useRef(null)
  const [status, setStatus] = useState(null)

  const matchText = [
    ligaName ? `${ligaName}` : '',
    `${match.p1?.display_name || '?'}${match.p2 ? ' / ' + match.p2.display_name : ''} vs ${match.p3?.display_name || '?'}${match.p4 ? ' / ' + match.p4.display_name : ''}`,
    `${match.score_team_a} - ${match.score_team_b}`,
    'padelzero.win',
  ].filter(Boolean).join('\n')

  const handleShare = async () => {
    if (!cardRef.current) return
    setStatus('loading')
    const result = await shareMatchCard(cardRef.current, matchText)
    if (result === 'shared') {
      setStatus('shared')
    } else if (result === 'copied_image' || result === 'copied_text') {
      setStatus('copied')
    } else if (result === 'error') {
      setStatus('error')
    } else {
      setStatus(null)
    }
    if (result === 'copied_image' || result === 'copied_text' || result === 'shared' || result === 'error') {
      setTimeout(() => setStatus(null), 2500)
    }
  }

  const handleDownload = async () => {
    if (!cardRef.current) return
    setStatus('loading')
    const result = await downloadMatchCard(cardRef.current)
    setStatus(result === 'downloaded' ? 'downloaded' : 'error')
    setTimeout(() => setStatus(null), 2500)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(matchText)
      setStatus('copied')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setStatus(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card preview */}
        <div className="flex justify-center">
          <MatchCardVisual ref={cardRef} match={match} ligaName={ligaName} ligaId={ligaId} jornadaLabel={jornadaLabel} />
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          {status === 'error' && (
            <div className="text-xs text-amber-400 text-center bg-amber-500/10 rounded-lg py-2">
              {t('share.error') || 'No se pudo generar la imagen. Usa "Copiar link".'}
            </div>
          )}
          <button
            onClick={handleShare}
            disabled={status === 'loading'}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {status === 'copied' ? t('share.copied') : status === 'shared' ? t('share.copied') : t('share.share_card')}
          </button>

          <button
            onClick={handleDownload}
            disabled={status === 'loading'}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {status === 'downloaded' ? t('share.copied') : t('share.download')}
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold rounded-xl transition text-sm"
          >
            {t('share.copy_link')}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-zinc-500 font-bold text-sm"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
