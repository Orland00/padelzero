import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import { useUiStore } from '@/stores/uiStore'
import GlassButton from '@/components/ui/GlassButton'

export default function AdminOverrides({ club }) {
  const { lang } = useI18n()
  const es = lang === 'es'
  const showToast = useUiStore.getState().showToast
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeCourts = club.courts?.filter(c => c.active) || []

  const [form, setForm] = useState({
    court_id: '',
    override_date: '',
    is_closed: true,
    reason: '',
  })

  const loadOverrides = async () => {
    const { data } = await supabase
      .from('club_availability_overrides')
      .select('*, courts(name, court_number)')
      .eq('club_id', club.id)
      .gte('override_date', new Date().toISOString().split('T')[0])
      .order('override_date')
    setOverrides(data || [])
    setLoading(false)
  }

  useEffect(() => { loadOverrides() }, [club.id])

  const handleAdd = async () => {
    if (!form.override_date) {
      showToast({ type: 'error', message: es ? 'Selecciona una fecha' : 'Select a date' })
      return
    }
    setSaving(true)
    const row = {
      club_id: club.id,
      court_id: form.court_id || null,
      override_date: form.override_date,
      is_closed: form.is_closed,
      reason: form.reason || null,
      custom_slots: null,
    }
    const { error } = await supabase.from('club_availability_overrides').insert(row)
    setSaving(false)
    if (error) { showToast({ type: 'error', message: error.message }); return }
    showToast({ type: 'success', message: es ? 'Cierre agregado' : 'Closure added' })
    setShowForm(false)
    setForm({ court_id: '', override_date: '', is_closed: true, reason: '' })
    loadOverrides()
  }

  const deleteOverride = async (id) => {
    const { error } = await supabase.from('club_availability_overrides').delete().eq('id', id)
    if (error) { showToast({ type: 'error', message: error.message }); return }
    showToast({ type: 'success', message: es ? 'Eliminado' : 'Deleted' })
    loadOverrides()
  }

  const formatDate = (d) => {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString(es ? 'es-MX' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest">
          {es ? 'Cierres y feriados' : 'Closures & holidays'}
        </h3>
        <GlassButton variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕' : '+ ' + (es ? 'Agregar' : 'Add')}
        </GlassButton>
      </div>

      {showForm && (
        <div className="glass-card p-4 space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Fecha' : 'Date'}</label>
            <input
              type="date"
              value={form.override_date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, override_date: e.target.value }))}
              className="glass-input w-full py-2 px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Aplica a' : 'Applies to'}</label>
            <select
              value={form.court_id}
              onChange={e => setForm(f => ({ ...f, court_id: e.target.value }))}
              className="glass-input w-full py-2 px-3 text-sm"
            >
              <option value="">{es ? 'Todo el club' : 'Entire club'}</option>
              {activeCourts.map(c => (
                <option key={c.id} value={c.id}>{c.name || `Cancha ${c.court_number}`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Motivo (opcional)' : 'Reason (optional)'}</label>
            <input
              type="text"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder={es ? 'Ej: Día festivo, mantenimiento...' : 'E.g.: Holiday, maintenance...'}
              className="glass-input w-full py-2 px-3 text-sm"
            />
          </div>

          <GlassButton variant="primary" fullWidth loading={saving} onClick={handleAdd}>
            {es ? 'Guardar cierre' : 'Save closure'}
          </GlassButton>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><div className="glass-spinner mx-auto" /></div>
      ) : overrides.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-zinc-500 text-sm">{es ? 'No hay cierres programados' : 'No closures scheduled'}</p>
          <p className="text-zinc-600 text-xs mt-1">{es ? 'Agrega cierres para feriados o mantenimiento' : 'Add closures for holidays or maintenance'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {overrides.map(o => (
            <div key={o.id} className="glass-card p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{formatDate(o.override_date)}</span>
                  {o.is_closed && (
                    <span className="text-[9px] font-black uppercase text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                      {es ? 'Cerrado' : 'Closed'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {o.courts ? (o.courts.name || `Cancha ${o.courts.court_number}`) : (es ? 'Todo el club' : 'Entire club')}
                  {o.reason && ` · ${o.reason}`}
                </p>
              </div>
              <button onClick={() => deleteOverride(o.id)} className="text-zinc-500 hover:text-red-400 px-2">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
