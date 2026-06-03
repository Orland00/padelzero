import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import { useUiStore } from '@/stores/uiStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import GlassButton from '@/components/ui/GlassButton'

const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COACH_COLUMNS = 'id, profile_id, bio, specialties, hourly_rate_cents, city, active, verified, created_at, updated_at'
const COACH_AVAILABILITY_COLUMNS = 'id, coach_id, day_of_week, start_time, end_time, slot_duration_minutes, is_group, max_participants, price_cents, is_active, created_at, updated_at'

export default function CoachDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  const { showToast } = useUiStore()
  const dayNames = es ? DAY_NAMES_ES : DAY_NAMES_EN
  usePageTitle(es ? 'Panel Coach' : 'Coach Dashboard')

  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('schedule')
  const [availability, setAvailability] = useState([])
  const [bookings, setBookings] = useState([])
  const [pastBookings, setPastBookings] = useState([])
  const [bookingFilter, setBookingFilter] = useState('upcoming')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ day_of_week: 1, start_time: '08:00', end_time: '10:00', slot_duration_minutes: 60, is_group: false })

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data: c } = await supabase.from('coaches').select(COACH_COLUMNS).eq('profile_id', user.id).maybeSingle()
      if (!c) { navigate('/coach/register'); return }
      setCoach(c)

      const today = new Date().toISOString().split('T')[0]
      const [availRes, bookRes, pastRes] = await Promise.all([
        supabase.from('coach_availability').select(COACH_AVAILABILITY_COLUMNS).eq('coach_id', c.id).order('day_of_week').order('start_time'),
        supabase.from('coach_bookings').select('id, coach_id, booked_by, booking_date, start_time, end_time, status, notes, created_at, profiles!booked_by(display_name, phone)').eq('coach_id', c.id)
          .gte('booking_date', today).neq('status', 'cancelled')
          .order('booking_date').order('start_time').limit(30),
        supabase.from('coach_bookings').select('id, coach_id, booked_by, booking_date, start_time, end_time, status, notes, created_at, profiles!booked_by(display_name, phone)').eq('coach_id', c.id)
          .lt('booking_date', today)
          .order('booking_date', { ascending: false }).order('start_time', { ascending: false }).limit(30),
      ])
      setAvailability(availRes.data || [])
      setBookings(bookRes.data || [])
      setPastBookings(pastRes.data || [])
      setLoading(false)
    }
    load()
  }, [user])

  const addSchedule = async () => {
    if (!coach) return
    setSaving(true)
    const { error } = await supabase.from('coach_availability').insert({ coach_id: coach.id, ...form })
    setSaving(false)
    if (error) { showToast({ type: 'error', message: error.message }); return }
    showToast({ type: 'success', message: es ? 'Horario agregado' : 'Schedule added' })
    setShowAddForm(false)
    const { data } = await supabase.from('coach_availability').select(COACH_AVAILABILITY_COLUMNS).eq('coach_id', coach.id).order('day_of_week').order('start_time')
    setAvailability(data || [])
  }

  const deleteSchedule = async (id) => {
    const ok = await useUiStore.getState().confirm({
      message: es ? '¿Eliminar este horario?' : 'Delete this schedule?',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('coach_availability').delete().eq('id', id)
    if (error) {
      showToast({ type: 'error', message: error.message || (es ? 'Error al eliminar' : 'Delete failed') })
      return
    }
    setAvailability(prev => prev.filter(a => a.id !== id))
    showToast({ type: 'success', message: es ? 'Horario eliminado' : 'Schedule deleted' })
  }

  const updateBookingStatus = async (id, status) => {
    const prevBookings = bookings
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    const { error } = await supabase.from('coach_bookings').update({ status }).eq('id', id)
    if (error) {
      setBookings(prevBookings)
      showToast({ type: 'error', message: error.message || (es ? 'Error al actualizar' : 'Update failed') })
      return
    }
    showToast({ type: 'success', message: es ? 'Estado actualizado' : 'Status updated' })
  }

  if (loading) return <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient"><div className="px-4 pt-6"><div className="glass-spinner mx-auto" /></div></div>

  const tabs = [
    { id: 'schedule', label: es ? 'Horarios' : 'Schedule' },
    { id: 'bookings', label: es ? 'Reservas' : 'Bookings' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="px-4 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white">{es ? 'Panel Coach' : 'Coach Dashboard'}</h1>
            <p className="text-xs text-zinc-500">{es ? 'Gestiona tus horarios y reservas' : 'Manage your schedule and bookings'}</p>
          </div>
          <button onClick={() => navigate(`/coach/${coach.id}`)} className="text-xs text-emerald-400 font-bold">{es ? 'Ver perfil' : 'View profile'}</button>
        </div>

        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === t.id ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'schedule' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">{es ? 'Mis horarios' : 'My schedule'}</h3>
              <GlassButton variant="primary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? '✕' : '+ ' + (es ? 'Agregar' : 'Add')}
              </GlassButton>
            </div>

            {showAddForm && (
              <div className="glass-card p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))} className="glass-input py-2 px-3 text-sm">
                    {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <select value={form.slot_duration_minutes} onChange={e => setForm(f => ({ ...f, slot_duration_minutes: parseInt(e.target.value) }))} className="glass-input py-2 px-3 text-sm">
                    <option value={30}>30 min</option><option value={60}>60 min</option><option value={90}>90 min</option><option value={120}>120 min</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px] text-zinc-500 uppercase">{es ? 'Inicio' : 'Start'}</label><input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="glass-input w-full py-2 px-3 text-sm" /></div>
                  <div><label className="text-[10px] text-zinc-500 uppercase">{es ? 'Fin' : 'End'}</label><input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="glass-input w-full py-2 px-3 text-sm" /></div>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={form.is_group} onChange={e => setForm(f => ({ ...f, is_group: e.target.checked }))} className="rounded" />
                  {es ? 'Clase grupal' : 'Group class'}
                </label>
                <GlassButton variant="primary" fullWidth loading={saving} onClick={addSchedule}>{es ? 'Guardar' : 'Save'}</GlassButton>
              </div>
            )}

            {availability.length === 0 ? (
              <p className="text-center text-zinc-500 text-sm py-6">{es ? 'No hay horarios configurados' : 'No schedule configured'}</p>
            ) : (
              availability.map(a => (
                <div key={a.id} className="glass-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400 w-8">{dayNames[a.day_of_week]}</span>
                    <span className="text-white font-bold">{a.start_time?.substring(0,5)}-{a.end_time?.substring(0,5)}</span>
                    <span className="text-zinc-600">{a.slot_duration_minutes}min</span>
                    {a.is_group && <span className="text-amber-400 text-[9px] font-black uppercase">Grupal</span>}
                  </div>
                  <button onClick={() => deleteSchedule(a.id)} className="text-zinc-500 hover:text-red-400 px-2">✕</button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'bookings' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">
                {bookingFilter === 'upcoming' ? (es ? 'Próximas reservas' : 'Upcoming bookings') : (es ? 'Reservas pasadas' : 'Past bookings')}
              </h3>
              <div className="flex bg-zinc-900 rounded-lg p-0.5">
                <button 
                  onClick={() => setBookingFilter('upcoming')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${bookingFilter === 'upcoming' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
                >
                  {es ? 'Próximas' : 'Upcoming'}
                </button>
                <button 
                  onClick={() => setBookingFilter('past')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${bookingFilter === 'past' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
                >
                  {es ? 'Pasadas' : 'Past'}
                </button>
              </div>
            </div>

            {(bookingFilter === 'upcoming' ? bookings : pastBookings).length === 0 ? (
              <p className="text-center text-zinc-500 text-sm py-6">
                {bookingFilter === 'upcoming' 
                  ? (es ? 'No hay reservas próximas' : 'No upcoming bookings')
                  : (es ? 'No hay reservas pasadas' : 'No past bookings')}
              </p>
            ) : (
              (bookingFilter === 'upcoming' ? bookings : pastBookings).map(b => (
                <div key={b.id} className="glass-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">{b.profiles?.display_name || (es ? 'Alumno' : 'Student')}</p>
                        {/* Ver ficha CRM (Updated: 2026-05-07) */}
                        {b.booked_by && (
                          <button
                            onClick={() => navigate(`/coach/crm/${b.booked_by}`)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline transition"
                          >
                            {es ? 'Ver ficha' : 'View profile'}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">{b.booking_date} · {b.start_time?.substring(0,5)}-{b.end_time?.substring(0,5)}</p>
                      {b.is_group && <span className="text-[9px] text-amber-400 font-black uppercase">Grupal ({b.participants})</span>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold text-emerald-400">${(b.price_cents / 100).toFixed(0)}</span>
                      {b.status === 'confirmed' && bookingFilter === 'upcoming' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateBookingStatus(b.id, 'completed')} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">✓</button>
                          <button onClick={() => updateBookingStatus(b.id, 'no_show')} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">✕</button>
                        </div>
                      )}
                      {b.status !== 'confirmed' && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          b.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                          b.status === 'no_show' ? 'bg-red-500/10 text-red-400' :
                          'bg-zinc-800 text-zinc-500'
                        }`}>
                          {b.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
