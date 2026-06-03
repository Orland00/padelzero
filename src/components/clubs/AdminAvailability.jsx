import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import { useUiStore } from '@/stores/uiStore'
import GlassButton from '@/components/ui/GlassButton'

const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AdminAvailability({ club }) {
  const { lang } = useI18n()
  const es = lang === 'es'
  const dayNames = es ? DAY_NAMES_ES : DAY_NAMES_EN
  const showToast = useUiStore.getState().showToast
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    court_id: '', day_of_week: 1, start_time: '08:00', end_time: '14:00',
    slot_duration_minutes: 90, price_cents: 15000, is_peak: false,
  })
  const [saving, setSaving] = useState(false)

  const activeCourts = club.courts?.filter(c => c.active) || []

  const loadRules = async () => {
    const { data } = await supabase
      .from('club_availability')
      .select('*, courts(name, court_number)')
      .eq('club_id', club.id)
      .order('day_of_week')
      .order('start_time')
    setRules(data || [])
    setLoading(false)
  }

  useEffect(() => { loadRules() }, [club.id])

  const handleAdd = async () => {
    if (!form.court_id) { showToast({ type: 'error', message: es ? 'Selecciona una cancha' : 'Select a court' }); return }
    setSaving(true)
    const { error } = await supabase.from('club_availability').insert({
      court_id: form.court_id, club_id: club.id,
      day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time,
      slot_duration_minutes: form.slot_duration_minutes, price_cents: form.price_cents, is_peak: form.is_peak,
    })
    setSaving(false)
    if (error) { showToast({ type: 'error', message: error.message }); return }
    showToast({ type: 'success', message: es ? 'Horario agregado' : 'Schedule added' })
    setShowForm(false)
    loadRules()
  }

  const toggleRule = async (id, currentActive) => {
    const { error } = await supabase.from('club_availability').update({ is_active: !currentActive }).eq('id', id)
    if (error) { showToast({ type: 'error', message: error.message }); return }
    loadRules()
  }

  const deleteRule = async (id) => {
    const { error } = await supabase.from('club_availability').delete().eq('id', id)
    if (error) { showToast({ type: 'error', message: error.message }); return }
    showToast({ type: 'success', message: es ? 'Eliminado' : 'Deleted' })
    loadRules()
  }

  const formatPrice = (cents) => `$${(cents / 100).toFixed(0)}`
  const formatTime = (t) => t?.substring(0, 5) || ''

  // Group rules by court
  const grouped = {}
  for (const r of rules) {
    const key = r.court_id
    if (!grouped[key]) grouped[key] = { courtName: r.courts?.name || `Cancha ${r.courts?.court_number}`, rules: [] }
    grouped[key].rules.push(r)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">
          {es ? 'Horarios recurrentes' : 'Recurring schedules'}
        </h3>
        <GlassButton variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕' : '+ ' + (es ? 'Agregar' : 'Add')}
        </GlassButton>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="glass-card p-4 space-y-3">
          <select value={form.court_id} onChange={e => setForm(f => ({ ...f, court_id: e.target.value }))}
            className="glass-input w-full py-2 px-3 text-sm">
            <option value="">{es ? 'Seleccionar cancha' : 'Select court'}</option>
            {activeCourts.map(c => (
              <option key={c.id} value={c.id}>{c.name || `Cancha ${c.court_number}`}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))}
              className="glass-input py-2 px-3 text-sm">
              {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <select value={form.slot_duration_minutes} onChange={e => setForm(f => ({ ...f, slot_duration_minutes: parseInt(e.target.value) }))}
              className="glass-input py-2 px-3 text-sm">
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Inicio' : 'Start'}</label>
              <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="glass-input w-full py-2 px-3 text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Fin' : 'End'}</label>
              <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="glass-input w-full py-2 px-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Precio (MXN)' : 'Price (MXN)'}</label>
              <input type="number" value={form.price_cents / 100}
                onChange={e => setForm(f => ({ ...f, price_cents: parseInt(e.target.value) * 100 || 0 }))}
                className="glass-input w-full py-2 px-3 text-sm" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={form.is_peak}
                  onChange={e => setForm(f => ({ ...f, is_peak: e.target.checked }))}
                  className="rounded" />
                Peak
              </label>
            </div>
          </div>

          <GlassButton variant="primary" fullWidth loading={saving} onClick={handleAdd}>
            {es ? 'Guardar horario' : 'Save schedule'}
          </GlassButton>
        </div>
      )}

      {/* Rules list grouped by court */}
      {loading ? (
        <div className="text-center py-8"><div className="glass-spinner mx-auto" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-8">
          <p className="text-zinc-500 text-sm">{es ? 'No hay horarios configurados' : 'No schedules configured'}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([courtId, { courtName, rules: courtRules }]) => (
          <div key={courtId} className="glass-card p-3">
            <h4 className="text-xs font-bold text-white mb-2">{courtName}</h4>
            <div className="space-y-1.5">
              {courtRules.map(r => (
                <div key={r.id} className={`flex items-center gap-2 text-xs p-2 rounded-lg ${r.is_active ? 'bg-zinc-800/50' : 'bg-zinc-900 opacity-50'}`}>
                  <span className="text-zinc-400 w-8">{dayNames[r.day_of_week]}</span>
                  <span className="text-white font-bold">{formatTime(r.start_time)}-{formatTime(r.end_time)}</span>
                  <span className="text-emerald-400">{formatPrice(r.price_cents)}</span>
                  {r.is_peak && <span className="text-amber-400 text-[9px] font-black uppercase">Peak</span>}
                  <span className="text-zinc-600">{r.slot_duration_minutes}m</span>
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => toggleRule(r.id, r.is_active)} className="text-zinc-500 hover:text-white px-1">
                      {r.is_active ? '⏸' : '▶'}
                    </button>
                    <button onClick={() => deleteRule(r.id)} className="text-zinc-500 hover:text-red-400 px-1">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
