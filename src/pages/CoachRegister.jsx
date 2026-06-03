import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'
import { useUiStore } from '@/stores/uiStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import GlassButton from '@/components/ui/GlassButton'

const SPECIALTIES = ['beginners', 'advanced', 'kids', 'fitness', 'competition', 'technique']

export default function CoachRegister() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  const { showToast } = useUiStore()
  usePageTitle(es ? 'Registrar Coach' : 'Register as Coach')

  const [form, setForm] = useState({
    bio: '', specialties: [], experience_years: '', hourly_rate: '',
    group_rate: '', max_group_size: 4, phone: '', instagram: '', city: '',
  })
  const [saving, setSaving] = useState(false)

  const specLabels = {
    beginners: es ? 'Principiantes' : 'Beginners',
    advanced: es ? 'Avanzado' : 'Advanced',
    kids: es ? 'Niños' : 'Kids',
    fitness: 'Fitness',
    competition: es ? 'Competencia' : 'Competition',
    technique: es ? 'Técnica' : 'Technique',
  }

  const toggleSpec = (s) => {
    setForm(f => ({
      ...f,
      specialties: f.specialties.includes(s)
        ? f.specialties.filter(x => x !== s)
        : [...f.specialties, s],
    }))
  }

  const handleSubmit = async () => {
    if (!form.bio.trim()) { showToast({ type: 'error', message: es ? 'Agrega una bio' : 'Add a bio' }); return }
    setSaving(true)
    const { error } = await supabase.from('coaches').insert({
      profile_id: user.id,
      bio: form.bio.trim(),
      specialties: form.specialties,
      experience_years: parseInt(form.experience_years) || null,
      hourly_rate_cents: parseInt(form.hourly_rate) * 100 || null,
      group_rate_cents: parseInt(form.group_rate) * 100 || null,
      max_group_size: parseInt(form.max_group_size) || 4,
      phone: form.phone.trim() || null,
      instagram: form.instagram.trim() || null,
      city: form.city.trim() || null,
    })
    setSaving(false)
    if (error) {
      if (error.message?.includes('unique')) {
        showToast({ type: 'error', message: es ? 'Ya estás registrado como coach' : 'Already registered as coach' })
      } else {
        showToast({ type: 'error', message: error.message })
      }
      return
    }
    showToast({ type: 'success', message: es ? 'Registrado como coach' : 'Registered as coach' })
    navigate('/coach/dashboard')
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="px-4 pt-6 space-y-4">
        <div>
          <h1 className="text-xl font-black text-white">{es ? 'Registrarme como Coach' : 'Register as Coach'}</h1>
          <p className="text-sm text-zinc-400 mt-1">{es ? 'Comparte tu experiencia y recibe alumnos' : 'Share your experience and get students'}</p>
        </div>

        <div className="glass-card p-4 space-y-4">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Sobre ti' : 'About you'}</label>
            <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder={es ? 'Cuéntale a tus futuros alumnos sobre tu experiencia...' : 'Tell future students about your experience...'}
              className="glass-input w-full py-2 px-3 text-sm h-24 resize-none" />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase mb-2 block">{es ? 'Especialidades' : 'Specialties'}</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map(s => (
                <button key={s} onClick={() => toggleSpec(s)}
                  className={`text-xs px-3 py-1.5 rounded-full transition ${
                    form.specialties.includes(s)
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                  {specLabels[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Años experiencia' : 'Years experience'}</label>
              <input type="number" value={form.experience_years} onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))}
                className="glass-input w-full py-2 px-3 text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Ciudad' : 'City'}</label>
              <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder={es ? 'Ej: Mexico City' : 'E.g.: Mexico City'}
                className="glass-input w-full py-2 px-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Precio/hr (MXN)' : 'Rate/hr (MXN)'}</label>
              <input type="number" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                className="glass-input w-full py-2 px-3 text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Precio grupal/persona' : 'Group rate/person'}</label>
              <input type="number" value={form.group_rate} onChange={e => setForm(f => ({ ...f, group_rate: e.target.value }))}
                className="glass-input w-full py-2 px-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase">{es ? 'Teléfono' : 'Phone'}</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="glass-input w-full py-2 px-3 text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase">Instagram</label>
              <input type="text" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
                placeholder="@usuario" className="glass-input w-full py-2 px-3 text-sm" />
            </div>
          </div>

          <GlassButton variant="primary" fullWidth loading={saving} onClick={handleSubmit}>
            {es ? 'Registrarme como Coach' : 'Register as Coach'}
          </GlassButton>
        </div>
      </div>
    </div>
  )
}
