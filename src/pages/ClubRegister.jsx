import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'
import { usePageTitle } from '@/hooks/usePageTitle'
import GlassButton from '@/components/ui/GlassButton'

export default function ClubRegister() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { lang } = useI18n()
  const es = lang === 'es'
  const showToast = useUiStore.getState().showToast
  usePageTitle(es ? 'Registrar Club' : 'Register Club')

  const [form, setForm] = useState({ name: '', slug: '', address: '', city: 'Mexico City', phone: '', instagram: '' })
  const [saving, setSaving] = useState(false)

  const generateSlug = (name) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleNameChange = (name) => {
    setForm(f => ({ ...f, name, slug: generateSlug(name) }))
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { showToast({ type: 'error', message: es ? 'Nombre requerido' : 'Name required' }); return }
    if (!form.slug.trim()) { showToast({ type: 'error', message: es ? 'Slug requerido' : 'Slug required' }); return }

    setSaving(true)
    const { data, error } = await supabase.from('clubs').insert({
      name: form.name.trim(),
      slug: form.slug.trim(),
      address: form.address.trim() || null,
      city: form.city.trim(),
      phone: form.phone.trim() || null,
      instagram: form.instagram.trim() || null,
      owner_user_id: user.id,
      active: true,
      verified: false,
      courts_count: 0,
    }).select('slug').single()

    setSaving(false)
    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        showToast({ type: 'error', message: es ? 'Ese slug ya existe, elige otro' : 'That slug already exists, pick another' })
      } else {
        showToast({ type: 'error', message: error.message })
      }
      return
    }

    showToast({ type: 'success', message: es ? 'Club registrado' : 'Club registered' })
    navigate(`/club/${data.slug}/admin`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      <div className="px-4 pt-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-white">{es ? 'Registrar Club' : 'Register Club'}</h1>
          <p className="text-sm text-zinc-400 mt-1">{es ? 'Crea tu club y empieza a recibir reservas' : 'Create your club and start receiving bookings'}</p>
        </div>

        <div className="glass-card p-4 space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{es ? 'Nombre del club' : 'Club name'} *</label>
            <input type="text" value={form.name} onChange={e => handleNameChange(e.target.value)}
              placeholder="Club Pádel Mexico City" className="glass-input w-full py-2.5 px-3 text-sm mt-1" />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Slug (URL)</label>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-zinc-600">padelzero.win/club/</span>
              <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="glass-input flex-1 py-2 px-3 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{es ? 'Dirección' : 'Address'}</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Calle 60 x 33, Centro" className="glass-input w-full py-2.5 px-3 text-sm mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{es ? 'Ciudad' : 'City'}</label>
              <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="glass-input w-full py-2.5 px-3 text-sm mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{es ? 'Teléfono' : 'Phone'}</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="glass-input w-full py-2.5 px-3 text-sm mt-1" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Instagram</label>
            <input type="text" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
              placeholder="@tuclub" className="glass-input w-full py-2.5 px-3 text-sm mt-1" />
          </div>
        </div>

        <GlassButton variant="primary" fullWidth loading={saving} onClick={handleSubmit}>
          {es ? 'Crear Club' : 'Create Club'}
        </GlassButton>
      </div>
    </div>
  )
}
