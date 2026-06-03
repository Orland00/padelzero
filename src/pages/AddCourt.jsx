import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'
import { usePageTitle } from '@/hooks/usePageTitle'
import GlassButton from '@/components/ui/GlassButton'

const COURT_TYPES = [
  { key: 'publica', icon: '🏛️' },
  { key: 'comunitaria', icon: '🏘️' },
  { key: 'club', icon: '🏟️' },
  { key: 'country_club', icon: '🏰' },
]

const generateSlug = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export default function AddCourt() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { t } = useI18n()
  const showToast = useUiStore.getState().showToast
  usePageTitle(t('courts.add_title'))

  const [step, setStep] = useState(1)
  const [courtType, setCourtType] = useState(null)
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: 'Mexico City',
    courts_count: '',
    hours: '',
    notes: '',
    phone: '',
    instagram: '',
  })
  const [saving, setSaving] = useState(false)

  const handleTypeSelect = (key) => {
    setCourtType(key)
    setStep(2)
  }

  const handleStep2Next = () => {
    if (!form.name.trim()) {
      showToast({ type: 'error', message: t('courts.name') + ' requerido' })
      return
    }
    if (!form.address.trim()) {
      showToast({ type: 'error', message: t('courts.address') + ' requerida' })
      return
    }
    setStep(3)
  }

  const handleSubmit = async () => {
    setSaving(true)
    const slug = generateSlug(form.name.trim()) + '-' + Date.now().toString(36)

    const payload = {
      name: form.name.trim(),
      slug,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      courts_count: form.courts_count ? Number(form.courts_count) : null,
      hours: form.hours.trim() || null,
      notes: form.notes.trim() || null,
      phone: form.phone.trim() || null,
      instagram: form.instagram.trim() || null,
      court_type: courtType,
      added_by: user?.id || null,
      active: true,
      verified: false,
    }

    if (courtType === 'club' || courtType === 'country_club') {
      payload.owner_user_id = user?.id || null
    }

    const { data, error } = await supabase.from('clubs').insert(payload).select('slug').single()

    setSaving(false)
    if (error) {
      showToast({ type: 'error', message: error.message })
      return
    }

    showToast({ type: 'success', message: t('courts.added') })
    navigate(`/club/${data.slug}`)
  }

  const selectedType = COURT_TYPES.find(ct => ct.key === courtType)

  return (
    <div className="min-h-screen bg-zinc-950 pb-24 glass-ambient">
      {/* Progress bar */}
      <div className="flex gap-1 px-4 pt-4">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              s <= step ? 'bg-emerald-500' : 'bg-zinc-800'
            }`}
          />
        ))}
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Step 1: Court type */}
        {step === 1 && (
          <>
            <div>
              <h1 className="text-2xl font-black text-white">{t('courts.add_title')}</h1>
              <p className="text-sm text-zinc-400 mt-1">{t('courts.step_type')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {COURT_TYPES.map(({ key, icon }) => (
                <button
                  key={key}
                  onClick={() => handleTypeSelect(key)}
                  className="glass-card p-4 text-left active:scale-[0.97] transition-transform"
                >
                  <span className="text-3xl block mb-2">{icon}</span>
                  <div className="text-sm font-bold text-white">{t(`courts.type_${key}`)}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-snug">
                    {t(`courts.type_${key}_desc`)}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Name, address, city, courts count */}
        {step === 2 && (
          <>
            <div className="flex items-center gap-3">
              {selectedType && <span className="text-2xl">{selectedType.icon}</span>}
              <div>
                <h1 className="text-xl font-black text-white">{t('courts.add_title')}</h1>
                <p className="text-xs text-zinc-400">{t(`courts.type_${courtType}`)}</p>
              </div>
            </div>

            <div className="glass-card p-4 space-y-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  {t('courts.name')} *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('courts.name_placeholder')}
                  className="glass-input w-full py-2.5 px-3 text-sm mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  {t('courts.address')} *
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder={t('courts.address_placeholder')}
                  className="glass-input w-full py-2.5 px-3 text-sm mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    {t('courts.city')}
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="glass-input w-full py-2.5 px-3 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    {t('courts.courts_count')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.courts_count}
                    onChange={e => setForm(f => ({ ...f, courts_count: e.target.value }))}
                    placeholder="2"
                    className="glass-input w-full py-2.5 px-3 text-sm mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <GlassButton variant="ghost" onClick={() => setStep(1)}>
                {t('common.back')}
              </GlassButton>
              <GlassButton variant="primary" fullWidth onClick={handleStep2Next}>
                Siguiente →
              </GlassButton>
            </div>
          </>
        )}

        {/* Step 3: Optional details + submit */}
        {step === 3 && (
          <>
            <div className="flex items-center gap-3">
              {selectedType && <span className="text-2xl">{selectedType.icon}</span>}
              <div>
                <h1 className="text-xl font-black text-white">{form.name}</h1>
                <p className="text-xs text-zinc-400">{t(`courts.type_${courtType}`)} · {t('courts.add_title')}</p>
              </div>
            </div>

            <div className="glass-card p-4 space-y-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  {t('courts.hours')}
                </label>
                <input
                  type="text"
                  value={form.hours}
                  onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                  placeholder={t('courts.hours_placeholder')}
                  className="glass-input w-full py-2.5 px-3 text-sm mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  {t('courts.notes')}
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={t('courts.notes_placeholder')}
                  rows={2}
                  className="glass-input w-full py-2.5 px-3 text-sm mt-1 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    {t('courts.phone')}
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+52 999 000 0000"
                    className="glass-input w-full py-2.5 px-3 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    {t('courts.instagram')}
                  </label>
                  <input
                    type="text"
                    value={form.instagram}
                    onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
                    placeholder="@cancha"
                    className="glass-input w-full py-2.5 px-3 text-sm mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <GlassButton variant="ghost" onClick={() => setStep(2)}>
                {t('common.back')}
              </GlassButton>
              <GlassButton variant="primary" fullWidth loading={saving} onClick={handleSubmit}>
                {saving ? t('courts.submitting') : t('courts.submit')}
              </GlassButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
