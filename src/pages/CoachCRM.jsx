/**
 * CoachCRM Page — /coach/crm/:playerId
 *
 * Full CRM view for a specific student. Accessible only from CoachDashboard.
 * Shows all private notes (unshared visible only to coach), attendance,
 * and the note entry form. Redirects non-coaches to /coach/dashboard.
 *
 * Updated: 2026-05-07
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useCrmStore } from '@/stores/crmStore'
import { useI18n } from '@/lib/i18n'
import { usePageTitle } from '@/hooks/usePageTitle'
import PlayerNoteForm from '@/components/coaches/PlayerNoteForm'
import PlayerProgressCard from '@/components/coaches/PlayerProgressCard'
import TennisballLoader from '@/components/TennisballLoader'

export default function CoachCRM() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { notes, notesLoading, loadNotes } = useCrmStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  usePageTitle(es ? 'Ficha del alumno' : 'Student profile')

  const [student, setStudent] = useState(null)
  const [stats, setStats] = useState({ classesTaken: 0, classesCancelled: 0 })
  const [loading, setLoading] = useState(true)

  // ─── Verify coach access + load data ──────────────────────────────────────

  useEffect(() => {
    if (!user?.id || !playerId) return

    const init = async () => {
      const { data: coachRow } = await supabase
        .from('coaches')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (!coachRow) {
        navigate('/coach/dashboard', { replace: true })
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name, level, matches_played, elo_rating')
        .eq('id', playerId)
        .single()

      setStudent(profileData)

      const { data: bookings } = await supabase
        .from('coach_bookings')
        .select('status')
        .eq('coach_id', coachRow.id)
        .eq('booked_by', playerId)

      const taken = (bookings || []).filter(b => b.status === 'completed').length
      const cancelled = (bookings || []).filter(b => b.status === 'cancelled').length
      setStats({ classesTaken: taken, classesCancelled: cancelled })

      await loadNotes(playerId)
      setLoading(false)
    }

    init()
  }, [user?.id, playerId])

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <TennisballLoader />

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-zinc-400 hover:text-zinc-200 transition"
      >
        ← {es ? 'Volver' : 'Back'}
      </button>

      <h1 className="text-xl font-bold text-zinc-100">
        {es ? 'Ficha del alumno' : 'Student profile'}
      </h1>

      {student && (
        <PlayerProgressCard
          profile={student}
          notes={notes}
          classesTaken={stats.classesTaken}
          classesCancelled={stats.classesCancelled}
        />
      )}

      <PlayerNoteForm
        targetId={playerId}
        onSaved={() => loadNotes(playerId)}
      />

      {notesLoading && <p className="text-zinc-500 text-sm">{es ? 'Cargando notas…' : 'Loading notes…'}</p>}

      {!notesLoading && notes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            {es ? 'Historial de notas' : 'Note history'}
          </h2>
          <div className="space-y-3">
            {notes.map(note => (
              <NoteRow key={note.id} note={note} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── NoteRow sub-component ────────────────────────────────────────────────────

/**
 * Single CRM note row with tags + share toggle button.
 * Updated: 2026-05-07
 */
function NoteRow({ note }) {
  const { toggleShare } = useCrmStore()
  const { lang } = useI18n()
  const es = lang === 'es'

  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-3 space-y-2">
      <p className="text-sm text-zinc-200">{note.content}</p>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.tags.map(t => (
            <span key={t} className="text-[10px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded">
              {t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-zinc-500">
          {new Date(note.created_at).toLocaleDateString(es ? 'es-MX' : 'en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </span>
        <button
          onClick={() => toggleShare(note.id, note.is_shared)}
          className={`text-[10px] px-2 py-0.5 rounded-full transition ${
            note.is_shared
              ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60'
              : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
          }`}
        >
          {note.is_shared ? (es ? 'Compartida ✓' : 'Shared ✓') : (es ? 'Privada' : 'Private')}
        </button>
      </div>
    </div>
  )
}
