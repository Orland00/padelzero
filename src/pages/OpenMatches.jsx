/**
 * OpenMatches Page — /partidos-abiertos
 *
 * Feed of open matches filtered by the current user's level ±0.5.
 * Allows browsing and joining matches with available slots.
 *
 * Updated: 2026-05-08
 */
import { useEffect } from 'react'
import { useOpenMatchStore } from '@/stores/openMatchStore'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import { usePageTitle } from '@/hooks/usePageTitle'
import OpenMatchCard from '@/components/OpenMatchCard'

export default function OpenMatches() {
  const { profile } = useAuthStore()
  const { feed, loading, error, loadFeed } = useOpenMatchStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  usePageTitle(es ? 'Buscar partido' : 'Find a match')

  // ─── Load feed on mount using viewer's level ───────────────────────────────

  useEffect(() => {
    loadFeed(profile?.level ?? null)
  }, [profile?.level])

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-zinc-700 border-t-emerald-500 rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100">
          {es ? 'Buscar partido' : 'Find a match'}
        </h1>
        {profile?.level != null && (
          <p className="text-sm text-zinc-400 mt-1">
            {es
              ? `Partidos para nivel ${Math.max(0, profile.level - 0.5).toFixed(1)}–${Math.min(7, profile.level + 0.5).toFixed(1)}`
              : `Matches for level ${Math.max(0, profile.level - 0.5).toFixed(1)}–${Math.min(7, profile.level + 0.5).toFixed(1)}`}
          </p>
        )}
      </div>

      {/* Error state */}
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {/* Empty state */}
      {!error && feed.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400">
            {es ? 'No hay partidos abiertos para tu nivel' : 'No open matches for your level'}
          </p>
          <p className="text-zinc-500 text-sm mt-2">
            {es ? 'Crea uno desde la sección Jugar' : 'Create one from the Play section'}
          </p>
        </div>
      )}

      {/* Feed */}
      <div className="space-y-3">
        {feed.map(match => (
          <OpenMatchCard
            key={match.id}
            match={match}
            onJoined={() => loadFeed(profile?.level ?? null)}
          />
        ))}
      </div>
    </div>
  )
}
