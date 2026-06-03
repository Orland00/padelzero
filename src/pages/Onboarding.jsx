import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import GlassButton from '@/components/ui/GlassButton'
import { CITIES, COUNTRIES, GENDERS } from '@/lib/constants'

const inputClass = (hasError) =>
  `glass-input w-full px-5 py-4 rounded-2xl text-white placeholder-zinc-700 text-lg transition-all ${
    hasError ? '!border-red-500 focus:!border-red-400' : ''
  }`

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, profile, updateProfile, authLoading } = useAuthStore()
  const { showToast } = useUiStore()

  const googleName = user?.user_metadata?.full_name || user?.user_metadata?.name || ''
  const [displayName, setDisplayName] = useState(profile?.display_name || googleName)
  const [username, setUsername] = useState(profile?.username || '')
  const [city, setCity] = useState(profile?.city || '')
  const [country, setCountry] = useState(profile?.country || '')
  const [age, setAge] = useState(profile?.age || '')
  const [gender, setGender] = useState(profile?.gender || '')
  const [errors, setErrors] = useState({})
  const [geoLoading, setGeoLoading] = useState(true)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)

  // Auto-fill location from IP
  useEffect(() => {
    if (profile?.city) { setGeoLoading(false); return } // already has data
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    fetch('https://ipapi.co/json/', { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.city) setCity(prev => prev || data.city)
        if (data.country_name) setCountry(prev => prev || data.country_name)
      })
      .catch(() => {}) // silent fail, user fills manually
      .finally(() => { clearTimeout(timeout); setGeoLoading(false) })
  }, [])

  const validate = () => {
    const e = {}
    if (!displayName.trim()) e.displayName = 'Ingresa tu nombre'
    if (!username.trim()) e.username = 'Ingresa un @usuario'
    else if (!username.startsWith('@')) e.username = 'Debe empezar con @'
    else if (username.length < 3) e.username = 'Muy corto, mínimo 3 caracteres'
    else if (!/^@[a-zA-Z0-9_.]+$/.test(username)) e.username = 'Solo letras, números, puntos y guion bajo'
    if (!city.trim()) e.city = 'Ingresa tu ciudad'
    if (age && (isNaN(age) || age < 5 || age > 99)) e.age = 'Edad no válida'
    return e
  }

  const handleComplete = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})

    const { normalizeCity, normalizeCountry } = await import('@/lib/utils')
    const cleanUsername = username.trim().replace(/^@+/, '').toLowerCase()
    const { error } = await updateProfile({
      display_name: displayName.trim(),
      username: cleanUsername,
      city: normalizeCity(city),
      country: normalizeCountry(country),
      age: age ? parseInt(age) : null,
      gender: gender || null,
    })

    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        setErrors({ username: 'Este @usuario ya está tomado, elige otro' })
      } else {
        showToast({ type: 'error', message: error.message || 'Error al guardar, intenta de nuevo' })
      }
    } else {
      showToast({ type: 'success', message: '¡Listo!' })
      setTimeout(() => navigate('/play', { replace: true }), 500)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-8 glass-ambient">
      <div className="max-w-sm w-full">
        <h1 className="text-3xl font-black text-white mb-2">Crea tu perfil</h1>
        <p className="text-sm text-zinc-500 mb-8">Solo unos datos y listo</p>

        <div className="space-y-4 mb-8">
          {/* NOMBRE */}
          <div>
            <label className="text-[10px] font-black text-zinc-500 mb-1 block uppercase tracking-widest">Nombre</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setErrors(prev => ({ ...prev, displayName: null })) }}
              placeholder="Tu nombre"
              className={inputClass(errors.displayName)}
            />
            {errors.displayName && <p className="text-red-500 text-xs mt-1 ml-1">{errors.displayName}</p>}
          </div>

          {/* USERNAME */}
          <div>
            <label className="text-[10px] font-black text-zinc-500 mb-1 block uppercase tracking-widest">ID de Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setErrors(prev => ({ ...prev, username: null })) }}
              placeholder="@tuusuario"
              maxLength={20}
              className={inputClass(errors.username)}
            />
            {errors.username
              ? <p className="text-red-500 text-xs mt-1 ml-1">{errors.username}</p>
              : <p className="text-[10px] text-zinc-600 mt-1 ml-1">Solo letras, números y puntos</p>
            }
          </div>

          {/* PAÍS */}
          <div>
            <label className="text-[10px] font-black text-zinc-500 mb-1 block uppercase tracking-widest">País</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={inputClass(false)}
            >
              <option value="">Selecciona país</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* CIUDAD */}
          <div>
            <label className="text-[10px] font-black text-zinc-500 mb-1 block uppercase tracking-widest">
              Ciudad {geoLoading && <span className="text-zinc-700 normal-case font-normal">(detectando...)</span>}
            </label>
            <select
              value={city}
              onChange={(e) => { setCity(e.target.value); setErrors(prev => ({ ...prev, city: null })) }}
              className={inputClass(errors.city)}
            >
              <option value="">Selecciona ciudad</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.city && <p className="text-red-500 text-xs mt-1 ml-1">{errors.city}</p>}
          </div>

          {/* SEXO */}
          <div>
            <label className="text-[10px] font-black text-zinc-500 mb-1 block uppercase tracking-widest">Sexo <span className="text-zinc-700 normal-case font-normal">(opcional)</span></label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={inputClass(false)}
            >
              <option value="">—</option>
              {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>

          {/* EDAD */}
          <div>
            <label className="text-[10px] font-black text-zinc-500 mb-1 block uppercase tracking-widest">Edad <span className="text-zinc-700 normal-case font-normal">(opcional)</span></label>
            <input
              type="number"
              value={age}
              onChange={(e) => { setAge(e.target.value); setErrors(prev => ({ ...prev, age: null })) }}
              placeholder="Tu edad"
              min={5}
              max={99}
              className={inputClass(errors.age)}
            />
            {errors.age && <p className="text-red-500 text-xs mt-1 ml-1">{errors.age}</p>}
          </div>
        </div>

        {/* Privacy consent */}
        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedPrivacy}
            onChange={(e) => setAcceptedPrivacy(e.target.checked)}
            className="mt-1 w-5 h-5 accent-emerald-500 rounded flex-shrink-0"
          />
          <span className="text-xs text-zinc-400 leading-relaxed">
            Acepto el{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">
              Aviso de Privacidad
            </a>{' '}
            y el tratamiento de mis datos personales conforme a la LFPDPPP.
          </span>
        </label>

        <GlassButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleComplete}
          disabled={authLoading || !acceptedPrivacy}
        >
          {authLoading ? 'Guardando...' : 'Empezar a jugar 🎾'}
        </GlassButton>
      </div>
    </div>
  )
}
