/**
 * MatchConfirm Page — /match/:id/confirm
 *
 * Deep-link target for push notifications.
 * Shows a single pending match for the current user to confirm or dispute.
 * Redirects to /profile after decision.
 *
 * Updated: 2026-05-07
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import MatchConfirmCard from '@/components/MatchConfirmCard'
import TennisballLoader from '@/components/TennisballLoader'

export default function MatchConfirm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // ─── Load match ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || !user?.id) return

    const load = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, p1_id, p1b_id, p2_id, p2b_id, winner, sets, played_at, confirmation_status')
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
      } else if (data.confirmation_status !== 'pending') {
        navigate('/profile', { replace: true })
      } else {
        setMatch(data)
      }
      setLoading(false)
    }

    load()
  }, [id, user?.id])

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <TennisballLoader />

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <p className="text-zinc-400 text-center">Partido no encontrado</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-4">
      <h1 className="text-xl font-bold text-zinc-100">Confirmar resultado</h1>
      {match && (
        <MatchConfirmCard
          match={match}
          onDecide={() => navigate('/profile', { replace: true })}
        />
      )}
    </div>
  )
}
