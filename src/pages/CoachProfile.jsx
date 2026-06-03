import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import { useUiStore } from '@/stores/uiStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { SkeletonCard } from '@/components/common/LoadingSkeleton'
import GlassButton from '@/components/ui/GlassButton'

const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COACH_COLUMNS = 'id, profile_id, bio, specialties, hourly_rate_cents, experience_years, city, active, verified, created_at, updated_at, profiles!inner(display_name, avatar_url, elo_rating)'
const COACH_REVIEW_COLUMNS = 'id, coach_id, reviewer_id, rating, comment, created_at, profiles!reviewer_id(display_name, avatar_url)'
const COACH_AVAILABILITY_COLUMNS = 'id, coach_id, day_of_week, start_time, end_time, slot_duration_minutes, is_group, max_participants, price_cents, is_active, created_at'

export default function CoachProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  const dayNames = es ? DAY_NAMES_ES : DAY_NAMES_EN

  const [coach, setCoach] = useState(null)
  const [reviews, setReviews] = useState([])
  const [availability, setAvailability] = useState([])
  const [loading, setLoading] = useState(true)

  usePageTitle(coach?.profiles?.display_name ? `Coach ${coach.profiles.display_name}` : 'Coach')

  useEffect(() => {
    const load = async () => {
      const [coachRes, reviewsRes, availRes] = await Promise.all([
        supabase.from('coaches').select(COACH_COLUMNS).eq('id', id).single(),
        supabase.from('coach_reviews').select(COACH_REVIEW_COLUMNS).eq('coach_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('coach_availability').select(COACH_AVAILABILITY_COLUMNS).eq('coach_id', id).eq('is_active', true).order('day_of_week').order('start_time'),
      ])
      setCoach(coachRes.data)
      setReviews(reviewsRes.data || [])
      setAvailability(availRes.data || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient"><div className="px-4 pt-6 space-y-4"><SkeletonCard /><SkeletonCard /></div></div>
  if (!coach) return <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient flex items-center justify-center"><p className="text-zinc-400">{es ? 'Coach no encontrado' : 'Coach not found'}</p></div>

  const specLabels = { beginners: es ? 'Principiantes' : 'Beginners', advanced: es ? 'Avanzado' : 'Advanced', kids: es ? 'Niños' : 'Kids', fitness: 'Fitness', competition: es ? 'Competencia' : 'Competition', technique: es ? 'Técnica' : 'Technique' }
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="px-4 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
            {coach.profiles?.avatar_url ? <img src={coach.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🎓</span>}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">{coach.profiles?.display_name}</h1>
              {coach.verified && <span className="text-emerald-400">✓</span>}
            </div>
            <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Coach</span>
            {coach.city && <p className="text-xs text-zinc-500 mt-1">{coach.city}</p>}
            <div className="flex items-center gap-3 mt-1">
              {coach.experience_years && <span className="text-xs text-zinc-400">{coach.experience_years} {es ? 'años' : 'years'}</span>}
              {avgRating && <span className="text-xs text-yellow-400">⭐ {avgRating} ({reviews.length})</span>}
              {coach.profiles?.elo_rating && <span className="text-xs text-emerald-400">ATP {coach.profiles.elo_rating}</span>}
            </div>
          </div>
        </div>

        {/* Bio */}
        {coach.bio && <div className="glass-card p-3"><p className="text-sm text-zinc-300">{coach.bio}</p></div>}

        {/* Specialties */}
        {coach.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {coach.specialties.map(s => <span key={s} className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full">{specLabels[s] || s}</span>)}
          </div>
        )}

        {/* Pricing */}
        <div className="glass-card p-3 flex items-center justify-around">
          {coach.hourly_rate_cents && (
            <div className="text-center">
              <p className="text-lg font-black text-emerald-400">${(coach.hourly_rate_cents / 100).toFixed(0)}</p>
              <p className="text-[10px] text-zinc-500">{es ? 'por hora' : 'per hour'}</p>
            </div>
          )}
          {coach.group_rate_cents && (
            <div className="text-center">
              <p className="text-lg font-black text-emerald-400">${(coach.group_rate_cents / 100).toFixed(0)}</p>
              <p className="text-[10px] text-zinc-500">{es ? 'grupal/persona' : 'group/person'}</p>
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="flex gap-2">
          {coach.phone && <a href={`tel:${coach.phone}`} className="flex-1"><GlassButton variant="primary" fullWidth>{es ? 'Llamar' : 'Call'}</GlassButton></a>}
          {coach.instagram && (
            <a href={`https://instagram.com/${coach.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex-1">
              <GlassButton variant="ghost" fullWidth>Instagram</GlassButton>
            </a>
          )}
        </div>

        {/* Availability */}
        {availability.length > 0 && (
          <div>
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-2">{es ? 'Horarios' : 'Schedule'}</h2>
            <div className="glass-card p-3 space-y-1.5">
              {availability.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 w-8">{dayNames[a.day_of_week]}</span>
                  <span className="text-white font-bold">{a.start_time?.substring(0,5)}-{a.end_time?.substring(0,5)}</span>
                  <span className="text-zinc-600">{a.slot_duration_minutes}min</span>
                  {a.is_group && <span className="text-amber-400 text-[9px] font-black uppercase">Grupal</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Book a Class */}
        {user && coach.profile_id !== user.id && availability.length > 0 && (
          <div>
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-2">{es ? 'Reservar clase' : 'Book a class'}</h2>
            <BookingForm coach={coach} availability={availability} user={user} es={es} dayNames={dayNames} />
          </div>
        )}

        {/* Reviews */}
        <div>
          <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-2">{es ? 'Reseñas' : 'Reviews'} ({reviews.length})</h2>
          {reviews.length > 0 ? (
            <div className="space-y-2">
              {reviews.map(r => (
                <div key={r.id} className="glass-card p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{r.profiles?.display_name}</span>
                    <span className="text-yellow-400 text-xs">{'⭐'.repeat(r.rating)}</span>
                  </div>
                  {r.comment && <p className="text-xs text-zinc-400 mt-1">{r.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">{es ? 'Sin reseñas todavía' : 'No reviews yet'}</p>
          )}
        </div>

        {/* Leave Review */}
        {user && coach.profile_id !== user.id && (
          <ReviewForm coachId={coach.id} userId={user.id} es={es} onReviewAdded={(r) => setReviews(prev => [r, ...prev])} />
        )}
      </div>
    </div>
  )
}

function BookingForm({ coach, availability, user, es, dayNames }) {
  const { showToast } = useUiStore()
  const [date, setDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [saving, setSaving] = useState(false)

  // Get available slots for the selected date
  const dayOfWeek = date ? new Date(date + 'T12:00:00').getDay() : null
  const daySlots = availability.filter(a => a.day_of_week === dayOfWeek)

  const handleBook = async () => {
    if (!selectedSlot || !date) return
    setSaving(true)
    const priceCents = selectedSlot.is_group ? (coach.group_rate_cents || 0) : (coach.hourly_rate_cents || 0)
    const { error } = await supabase.from('coach_bookings').insert({
      coach_id: coach.id,
      booked_by: user.id,
      booking_date: date,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      is_group: selectedSlot.is_group,
      price_cents: priceCents,
    })
    setSaving(false)
    if (error) {
      // DB EXCLUDE constraint `coach_bookings_no_overlap` rejects overlapping
      // bookings with ERRCODE 23P01 (exclusion_violation). Translate to
      // a friendly message — the raw Postgres error is unreadable.
      const isOverlap = error.code === '23P01' || /exclusion|overlap/i.test(error.message || '')
      showToast({
        type: 'error',
        message: isOverlap
          ? (es ? 'Ese horario ya está ocupado, elige otro.' : 'That slot is already booked — pick another.')
          : error.message,
      })
    } else {
      showToast({ type: 'success', message: es ? 'Clase reservada' : 'Class booked' })
      setDate('')
      setSelectedSlot(null)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="glass-card p-4 space-y-3">
      <input
        type="date"
        value={date}
        min={today}
        onChange={e => { setDate(e.target.value); setSelectedSlot(null) }}
        className="glass-input w-full py-2 px-3 text-sm"
      />
      {date && daySlots.length === 0 && (
        <p className="text-xs text-zinc-500">{es ? 'No hay horarios este día' : 'No slots on this day'}</p>
      )}
      {daySlots.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {daySlots.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSlot(s)}
              className={`text-xs p-2 rounded-lg border transition ${
                selectedSlot?.id === s.id
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <span className="font-bold">{s.start_time?.substring(0,5)}-{s.end_time?.substring(0,5)}</span>
              {s.is_group && <span className="block text-[9px] text-amber-400 mt-0.5">Grupal</span>}
            </button>
          ))}
        </div>
      )}
      {selectedSlot && (
        <GlassButton variant="primary" fullWidth loading={saving} onClick={handleBook}>
          {es ? 'Reservar clase' : 'Book class'}
          {(coach.hourly_rate_cents || coach.group_rate_cents) && (
            <span className="ml-1 opacity-70">
              — ${((selectedSlot.is_group ? coach.group_rate_cents : coach.hourly_rate_cents) / 100).toFixed(0)} MXN
            </span>
          )}
        </GlassButton>
      )}
    </div>
  )
}

function ReviewForm({ coachId, userId, es, onReviewAdded }) {
  const { showToast } = useUiStore()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) { showToast({ type: 'warning', message: es ? 'Selecciona una calificación' : 'Select a rating' }); return }
    setSaving(true)
    const { data, error } = await supabase.from('coach_reviews').insert({
      coach_id: coachId,
      reviewer_id: userId,
      rating,
      comment: comment.trim() || null,
    }).select('*, profiles!reviewer_id(display_name, avatar_url)').single()
    setSaving(false)
    if (error) {
      if (error.message?.includes('unique') || error.code === '23505') {
        showToast({ type: 'warning', message: es ? 'Ya dejaste una reseña' : 'You already left a review' })
      } else {
        showToast({ type: 'error', message: error.message })
      }
    } else {
      showToast({ type: 'success', message: es ? 'Reseña publicada' : 'Review posted' })
      setSubmitted(true)
      if (data) onReviewAdded(data)
    }
  }

  if (submitted) return null

  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">{es ? 'Dejar reseña' : 'Leave a review'}</h3>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setRating(n)} className={`text-xl transition ${n <= rating ? 'opacity-100' : 'opacity-30'}`}>⭐</button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder={es ? 'Comentario opcional...' : 'Optional comment...'}
        className="glass-input w-full py-2 px-3 text-sm h-16 resize-none"
      />
      <GlassButton variant="secondary" fullWidth loading={saving} onClick={handleSubmit}>
        {es ? 'Publicar reseña' : 'Post review'}
      </GlassButton>
    </div>
  )
}
