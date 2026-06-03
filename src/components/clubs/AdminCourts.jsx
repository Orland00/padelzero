import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import { useUiStore } from '@/stores/uiStore'
import GlassButton from '@/components/ui/GlassButton'

const SURFACES = [
  { value: 'cesped_artificial', label: 'Césped Artificial', labelEn: 'Artificial Grass' },
  { value: 'hormigon', label: 'Hormigón', labelEn: 'Concrete' },
  { value: 'pvc', label: 'PVC', labelEn: 'PVC' },
  { value: 'otro', label: 'Otro', labelEn: 'Other' },
]
const COURT_COLUMNS = 'id, club_id, court_number, name, surface_type, active, created_at, updated_at'

export default function AdminCourts({ club, onCourtsChanged }) {
  const { lang } = useI18n()
  const es = lang === 'es'
  const showToast = useUiStore.getState().showToast
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', surface_type: 'cesped_artificial' })
  const [saving, setSaving] = useState(false)
  const [bulkAvail, setBulkAvail] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    morningStart: '08:00', morningEnd: '14:00', morningPrice: 150,
    eveningStart: '16:00', eveningEnd: '22:00', eveningPrice: 250,
    duration: 90,
  })
  const [bulkSaving, setBulkSaving] = useState(false)

  const loadCourts = async () => {
    const { data } = await supabase
      .from('courts')
      .select(COURT_COLUMNS)
      .eq('club_id', club.id)
      .order('court_number')
    setCourts(data || [])
    setLoading(false)
  }

  useEffect(() => { loadCourts() }, [club.id])

  const nextCourtNumber = courts.length > 0 ? Math.max(...courts.map(c => c.court_number)) + 1 : 1

  const handleAddCourt = async () => {
    setSaving(true)
    const { error } = await supabase.from('courts').insert({
      club_id: club.id,
      court_number: nextCourtNumber,
      name: form.name.trim() || `Cancha ${nextCourtNumber}`,
      surface_type: form.surface_type,
      active: true,
    })
    setSaving(false)
    if (error) { showToast({ type: 'error', message: error.message }); return }
    showToast({ type: 'success', message: es ? 'Cancha agregada' : 'Court added' })
    setShowForm(false)
    setForm({ name: '', surface_type: 'cesped_artificial' })
    loadCourts()
    // Update clubs.courts_count
    const { count } = await supabase.from('courts').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('active', true)
    await supabase.from('clubs').update({ courts_count: count || 0 }).eq('id', club.id)
    if (onCourtsChanged) onCourtsChanged()
  }

  const toggleCourt = async (courtId, currentActive) => {
    const { error } = await supabase.from('courts').update({ active: !currentActive }).eq('id', courtId)
    if (error) { showToast({ type: 'error', message: error.message }); return }
    loadCourts()
    // Update courts_count after toggle
    const { count } = await supabase.from('courts').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('active', true)
    await supabase.from('clubs').update({ courts_count: count || 0 }).eq('id', club.id)
    if (onCourtsChanged) onCourtsChanged()
  }

  const handleBulkAvailability = async () => {
    const activeCourts = courts.filter(c => c.active)
    if (!activeCourts.length) { showToast({ type: 'error', message: es ? 'No hay canchas activas' : 'No active courts' }); return }

    setBulkSaving(true)

    // Delete existing availability for this club first
    await supabase.from('club_availability').delete().eq('club_id', club.id)

    // Generate rows for all courts x all days x morning + evening
    const rows = []
    for (const court of activeCourts) {
      for (let dow = 0; dow <= 6; dow++) {
        // Morning (off-peak)
        if (bulkForm.morningStart && bulkForm.morningEnd) {
          rows.push({
            court_id: court.id, club_id: club.id, day_of_week: dow,
            start_time: bulkForm.morningStart, end_time: bulkForm.morningEnd,
            slot_duration_minutes: bulkForm.duration,
            price_cents: bulkForm.morningPrice * 100, is_peak: false, is_active: true,
          })
        }
        // Evening (peak)
        if (bulkForm.eveningStart && bulkForm.eveningEnd) {
          rows.push({
            court_id: court.id, club_id: club.id, day_of_week: dow,
            start_time: bulkForm.eveningStart, end_time: bulkForm.eveningEnd,
            slot_duration_minutes: bulkForm.duration,
            price_cents: bulkForm.eveningPrice * 100, is_peak: true, is_active: true,
          })
        }
      }
    }

    const { error } = await supabase.from('club_availability').insert(rows)
    setBulkSaving(false)
    if (error) { showToast({ type: 'error', message: error.message }); return }
    showToast({ type: 'success', message: es ? `${rows.length} horarios creados para ${activeCourts.length} canchas` : `${rows.length} schedules created for ${activeCourts.length} courts` })
    setBulkAvail(false)
  }

  return (
    <div className="space-y-4">
      {/* Court List */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">
          {es ? 'Canchas' : 'Courts'} ({courts.filter(c => c.active).length})
        </h3>
        <GlassButton variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕' : '+ ' + (es ? 'Cancha' : 'Court')}
        </GlassButton>
      </div>

      {/* Add Court Form */}
      {showForm && (
        <div className="glass-card p-4 space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Nombre' : 'Name'}</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={`Cancha ${nextCourtNumber}`}
              className="glass-input w-full py-2 px-3 text-sm mt-1" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Superficie' : 'Surface'}</label>
            <select value={form.surface_type} onChange={e => setForm(f => ({ ...f, surface_type: e.target.value }))}
              className="glass-input w-full py-2 px-3 text-sm mt-1">
              {SURFACES.map(s => <option key={s.value} value={s.value}>{es ? s.label : s.labelEn}</option>)}
            </select>
          </div>
          <GlassButton variant="primary" fullWidth loading={saving} onClick={handleAddCourt}>
            {es ? 'Agregar cancha' : 'Add court'}
          </GlassButton>
        </div>
      )}

      {/* Court Cards */}
      {loading ? (
        <div className="text-center py-6"><div className="glass-spinner mx-auto" /></div>
      ) : (
        <div className="space-y-2">
          {courts.map(c => (
            <div key={c.id} className={`glass-card p-3 flex items-center gap-3 ${!c.active ? 'opacity-50' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${c.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                {c.court_number}
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-bold">{c.name || `Cancha ${c.court_number}`}</p>
                <p className="text-[10px] text-zinc-500">{c.surface_type?.replace('_', ' ') || 'N/A'}</p>
              </div>
              <button onClick={() => toggleCourt(c.id, c.active)}
                className={`text-xs font-bold ${c.active ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {c.active ? (es ? 'Activa' : 'Active') : (es ? 'Inactiva' : 'Inactive')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Availability */}
      <div className="pt-2">
        <GlassButton variant="secondary" fullWidth onClick={() => setBulkAvail(!bulkAvail)}>
          {bulkAvail ? '✕ ' + (es ? 'Cerrar' : 'Close') : '⚡ ' + (es ? 'Configurar horarios en bloque' : 'Bulk schedule setup')}
        </GlassButton>
      </div>

      {bulkAvail && (
        <div className="glass-card p-4 space-y-3">
          <p className="text-xs text-zinc-400">
            {es ? 'Configura horarios para TODAS las canchas, todos los días de la semana.' : 'Set schedules for ALL courts, all days of the week.'}
          </p>

          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">{es ? 'Bloque mañana (off-peak)' : 'Morning block (off-peak)'}</p>
            <div className="grid grid-cols-3 gap-2">
              <input type="time" value={bulkForm.morningStart}
                onChange={e => setBulkForm(f => ({ ...f, morningStart: e.target.value }))}
                className="glass-input py-2 px-2 text-sm" />
              <input type="time" value={bulkForm.morningEnd}
                onChange={e => setBulkForm(f => ({ ...f, morningEnd: e.target.value }))}
                className="glass-input py-2 px-2 text-sm" />
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 text-xs">$</span>
                <input type="number" value={bulkForm.morningPrice}
                  onChange={e => setBulkForm(f => ({ ...f, morningPrice: parseInt(e.target.value) || 0 }))}
                  className="glass-input py-2 px-2 text-sm w-full" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">{es ? 'Bloque tarde (peak)' : 'Evening block (peak)'}</p>
            <div className="grid grid-cols-3 gap-2">
              <input type="time" value={bulkForm.eveningStart}
                onChange={e => setBulkForm(f => ({ ...f, eveningStart: e.target.value }))}
                className="glass-input py-2 px-2 text-sm" />
              <input type="time" value={bulkForm.eveningEnd}
                onChange={e => setBulkForm(f => ({ ...f, eveningEnd: e.target.value }))}
                className="glass-input py-2 px-2 text-sm" />
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 text-xs">$</span>
                <input type="number" value={bulkForm.eveningPrice}
                  onChange={e => setBulkForm(f => ({ ...f, eveningPrice: parseInt(e.target.value) || 0 }))}
                  className="glass-input py-2 px-2 text-sm w-full" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Duración slot' : 'Slot duration'}</label>
            <select value={bulkForm.duration} onChange={e => setBulkForm(f => ({ ...f, duration: parseInt(e.target.value) }))}
              className="glass-input w-full py-2 px-3 text-sm mt-1">
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>

          <GlassButton variant="primary" fullWidth loading={bulkSaving} onClick={handleBulkAvailability}>
            {es ? 'Aplicar a todas las canchas' : 'Apply to all courts'}
          </GlassButton>
        </div>
      )}
    </div>
  )
}
