import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'
import Roadmap from '@/components/Roadmap'
import { supabase } from '@/lib/supabase'
import { PLAYER_LEVELS, CITIES, ADMIN_USER_ID } from '@/lib/constants'
import AdminPanel from '@/components/admin/AdminPanel'
import { normalizeCity } from '@/lib/utils'
import { lazy, Suspense } from 'react'
import GlassButton from '@/components/ui/GlassButton'
import EloBadge from '@/components/EloBadge'
import { PASSWORD_MIN_LENGTH } from '@/lib/authPolicy'

/**
 * Profile Page Component
 * 
 * Manages user profile settings, activity history, trophies, and social connections.
 * Allows users to edit their personal information and preferences.
 * 
 * Updated: 2026-04-29
 */

const EloSparkline = lazy(() => import('@/components/EloSparkline'))

const COUNTRIES = [
  'México', 'España', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Venezuela',
  'Ecuador', 'Bolivia', 'Uruguay', 'Paraguay', 'Costa Rica', 'Guatemala',
  'Honduras', 'El Salvador', 'Nicaragua', 'Panamá', 'Cuba', 'República Dominicana',
  'Puerto Rico', 'Estados Unidos', 'Otro',
]

const hasRecentTitle = (p) =>
  p?.last_title_won_at &&
  new Date(p.last_title_won_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

const PROFILE_COLUMNS = 'id, display_name, level_self, favorite_club_id, elo_rating, matches_played, matches_won, win_streak, best_streak, elo_peak, is_founder, created_at, updated_at, username, avatar_url, preferred_position, zone, last_match_at, city, country, last_title_won_at, favorite_club, is_dummy, preferred_language, level, preferred_side, achievements, role, age, gender'
const MATCH_HISTORY_COLUMNS = 'id, p1_id, p1b_id, p2_id, p2b_id, winner_id, sets, finished, created_at, played_at, confirmation_status, tipo, p1:profiles!p1_id(id, display_name), p1b:profiles!p1b_id(id, display_name), p2:profiles!p2_id(id, display_name), p2b:profiles!p2b_id(id, display_name)'
const ELO_HISTORY_COLUMNS = 'id, player_id, match_id, elo_before, elo_after, delta_elo, level_before, level_after, created_at'
const PROFILE_MEDAL_COLUMNS = 'id, profile_id, medal_id, awarded_at, medal:medals(id, name, description, icon_text, rarity)'
const SEASON_RESULT_COLUMNS = 'id, profile_id, season_id, position, points, created_at, season:seasons(id, name, start_date, end_date)'

export default function Profile() {
  const { id: playerId } = useParams()
  const navigate = useNavigate()
  const { user, profile, updateProfile, ready } = useAuthStore()
  const { showToast } = useUiStore()

  const [playerProfile, setPlayerProfile] = useState(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editPosition, setEditPosition] = useState('')
  const [editLevel, setEditLevel] = useState(3)
  const [editCity, setEditCity] = useState('')
  const [editCountry, setEditCountry] = useState('')
  const [editFavoriteClub, setEditFavoriteClub] = useState('')
  const [editZone, setEditZone] = useState('')
  const [editShowcase, setEditShowcase] = useState([])
  const [editAge, setEditAge] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editAvailabilityDays, setEditAvailabilityDays] = useState([])
  const [editAvailabilityTimes, setEditAvailabilityTimes] = useState([])
  const [matchHistory, setMatchHistory] = useState([])
  const [eloHistory, setEloHistory] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [addHandleInput, setAddHandleInput] = useState('')
  const [addHandleLoading, setAddHandleLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [medals, setMedals] = useState([])
  const [seasonResults, setSeasonResults] = useState([])
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const fileInputRef = useRef(null)

  /**
   * Initializes profile data and secondary information.
   * Fetches matches, ATP history, medals, and friendships in parallel.
   */
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)
      try {
        const targetId = playerId || user?.id
        if (!targetId || !ready) {
          setLoading(false)
          return
        }

        const isOwn = !playerId || playerId === user?.id
        setIsOwnProfile(isOwn)

        // For own profile, use auth store's profile first (instant, no fetch needed)
        let profileData = null
        if (isOwn && profile) {
          profileData = profile
        } else {
          // Fetch from DB for other users or if auth profile not ready
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, display_name, level_self, favorite_club_id, elo_rating, matches_played, matches_won, win_streak, best_streak, elo_peak, is_founder, created_at, updated_at, username, avatar_url, preferred_position, zone, last_match_at, city, country, last_title_won_at, favorite_club, is_dummy, preferred_language, level, preferred_side, achievements, role')
            .eq('id', targetId)
            .single()

          if (profileError && profileError.code === 'PGRST116') {
            const baseUsername = user?.email?.split('@')[0] || 'jugador'
            const randomSuffix = Math.random().toString(36).substring(2, 8)
            const username = `${baseUsername}_${randomSuffix}`.slice(0, 20).toLowerCase()

            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: targetId,
                email: user?.email,
                display_name: user?.email?.split('@')[0] || 'Jugador',
                username: username
              })
              .select(PROFILE_COLUMNS)
              .single()
            if (createError) throw createError
            profileData = newProfile
          } else if (profileError) {
            throw profileError
          } else {
            profileData = data
          }
        }
        setPlayerProfile(profileData)
        setEditName(profileData.display_name || '')
        setEditUsername(profileData.username || '')
        setEditPosition(profileData.preferred_position || '')
        setEditLevel(profileData.level_self || 3)
        setEditCity(profileData.city || '')
        setEditCountry(profileData.country || '')
        setEditFavoriteClub(profileData.favorite_club || '')
        setEditZone(profileData.zone || '')
        setEditAge(profileData.age || '')
        setEditGender(profileData.gender || '')

        // Fetch all secondary data in PARALLEL (not sequential)
        const targetIsOwn = !playerId || playerId === user?.id
        const [matchRes, eloRes, medalRes, seasonRes, friendRes] = await Promise.all([
          // Match history
          supabase
            .from('matches')
            .select(MATCH_HISTORY_COLUMNS)
            .or(`p1_id.eq.${targetId},p1b_id.eq.${targetId},p2_id.eq.${targetId},p2b_id.eq.${targetId}`)
            .eq('finished', true)
            .order('created_at', { ascending: false })
            .limit(10),
          // ATP history
          supabase
            .from('elo_history')
            .select(ELO_HISTORY_COLUMNS)
            .eq('player_id', targetId)
            .order('created_at', { ascending: true })
            .limit(15),
          // Medals (table may not exist)
          supabase.from('profile_medals').select(PROFILE_MEDAL_COLUMNS).eq('profile_id', targetId).order('awarded_at', { ascending: false }).then(r => r).catch(() => ({ data: null })),
          // Season results (table may not exist)
          supabase.from('season_results').select(SEASON_RESULT_COLUMNS).eq('profile_id', targetId).order('created_at', { ascending: false }).then(r => r).catch(() => ({ data: null })),
          // Friendships (only own profile)
          targetIsOwn && user?.id
            ? supabase
                .from('friendships')
                .select('id, status, requester_id, addressee_id, requester:profiles!requester_id(id, display_name, elo_rating), addressee:profiles!addressee_id(id, display_name, elo_rating)')
                .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
            : Promise.resolve({ data: null }),
        ])

        if (!matchRes.error) setMatchHistory(matchRes.data || [])
        setEloHistory(eloRes.data || [])
        setMedals(medalRes.data || [])
        setSeasonResults(seasonRes.data || [])

        if (friendRes.data) {
          const accepted = friendRes.data
            .filter(f => f.status === 'accepted')
            .map(f => f.requester_id === user.id ? f.addressee : f.requester)
          const pending = friendRes.data.filter(f => f.status === 'pending' && f.addressee_id === user.id)
          setFriends(accepted)
          setPendingRequests(pending)
        }
      } catch (err) {
        showToast({ type: 'error', message: 'Error al cargar perfil', duration: 3000 })
      } finally {
        setLoading(false)
      }
    }

    if (ready) {
      loadProfile()

      // Subscribe to profile changes for auto-refresh
      const targetId = playerId || user?.id
      if (targetId) {
        const channel = supabase
          .channel(`profile-${targetId}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${targetId}` }, () => loadProfile())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${targetId}` }, () => loadProfile())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${targetId}` }, () => loadProfile())
          .subscribe()
        return () => supabase.removeChannel(channel)
      }
    }
  }, [playerId, user?.id, showToast, ready, profile?.id])

  /**
   * Saves updated profile information to Supabase.
   * Validates display name and username before submission.
   */
  const handleSaveName = async () => {
    try {
      const name = (editName || '').trim()
      if (!name) {
        showToast({ type: 'warning', message: 'Nombre público requerido', duration: 2000 })
        return
      }

      const username = (editUsername || '').trim().replace(/^@+/, '').replace(/\s+/g, '').toLowerCase()
      if (!username) {
        showToast({ type: 'warning', message: '@usuario requerido', duration: 2000 })
        return
      }
      if (username.length < 3 || username.length > 20) {
        showToast({ type: 'warning', message: '@usuario: 3-20 caracteres', duration: 2000 })
        return
      }
      if (!/^[a-z0-9_]+$/.test(username)) {
        showToast({ type: 'warning', message: '@usuario: letras, números, _', duration: 2000 })
        return
      }

      if (!user?.id) {
        showToast({ type: 'error', message: 'Debes estar logueado', duration: 2000 })
        return
      }

      setIsSaving(true)

      const { error } = await updateProfile({
        display_name: name,
        username: username,
        preferred_position: editPosition || null,
        level_self: editLevel,
        city: normalizeCity(editCity) || null,
        country: editCountry || null,
        favorite_club: (editFavoriteClub || '').trim() || null,
        zone: (editZone || '').trim() || null,
        age: editAge ? parseInt(editAge) : null,
        gender: editGender || null,
      })

      if (error) {
        if (error.code === '23505' || error.message?.includes('unique')) {
          showToast({ type: 'error', message: '@usuario ya existe', duration: 2500 })
        } else {
          showToast({ type: 'error', message: error.message || 'Error al guardar', duration: 2500 })
        }
        return
      }

      // Use the fresh data returned from the store (already set in authStore.profile)
      const freshProfile = useAuthStore.getState().profile
      if (freshProfile) {
        setPlayerProfile(freshProfile)
      }

      showToast({ type: 'success', message: 'Guardado ✓', duration: 2000 })
      setIsEditing(false)
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Error', duration: 2500 })
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      showToast({ type: 'warning', message: 'Completa ambos campos de contraseña', duration: 2000 })
      return
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      showToast({ type: 'warning', message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`, duration: 2000 })
      return
    }
    if (newPassword !== confirmPassword) {
      showToast({ type: 'error', message: 'Las contraseñas no coinciden', duration: 2000 })
      return
    }

    setIsChangingPassword(true)
    try {
      const { updatePassword } = useAuthStore.getState()
      const { error } = await updatePassword(newPassword)
      if (error) {
        const msg = error.message?.startsWith('password_breached')
          ? 'Esta contraseña apareció en filtraciones públicas. Por tu seguridad, elige otra.'
          : error.message || 'Error al cambiar contraseña'
        showToast({ type: 'error', message: msg, duration: 4000 })
        return
      }
      showToast({ type: 'success', message: '¡Contraseña actualizada! ✓', duration: 2000 })
      setShowPasswordModal(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Error', duration: 2500 })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleAddByHandle = async () => {
    const handle = addHandleInput.trim().replace(/^@/, '').toLowerCase()
    if (!handle) return
    setAddHandleLoading(true)
    try {
      const { data: found } = await supabase
        .from('profiles').select('id, display_name, username, elo_rating')
        .eq('username', handle).maybeSingle()
      if (!found) {
        showToast({ type: 'error', message: `@${handle} no encontrado`, duration: 2500 })
        return
      }
      if (found.id === user?.id) {
        showToast({ type: 'warning', message: 'Ese eres tú 😄', duration: 2000 })
        return
      }
      // Check if already friends
      const { data: existing } = await supabase.from('friendships').select('id, status')
        .or(`and(requester_id.eq.${user.id},and(requester_id.eq.${found.id}),and(addressee_id.eq.${found.id}),and(requester_id.eq.${found.id},addressee_id.eq.${user.id})`)
        .maybeSingle()
      if (existing) {
        showToast({ type: 'warning', message: existing.status === 'accepted' ? 'Ya son amigos' : 'Solicitud ya enviada', duration: 2000 })
        return
      }
      await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: found.id })
      showToast({ type: 'success', message: `Solicitud enviada a @${handle}`, duration: 2500 })
      setAddHandleInput('')
    } finally {
      setAddHandleLoading(false)
    }
  }

  /**
   * Handles avatar image upload to Supabase Storage.
   * Enforces size and file type restrictions.
   */
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    const MAX_SIZE = 5 * 1024 * 1024 // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (file.size > MAX_SIZE) {
      showToast({ type: 'error', message: 'La imagen no puede superar 5 MB', duration: 3000 })
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast({ type: 'error', message: 'Solo se permiten imágenes (JPG, PNG, WebP, GIF)', duration: 3000 })
      return
    }

    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '')
      const filePath = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const avatarUrl = `${publicUrl}?t=${Date.now()}`
      await updateProfile({ avatar_url: avatarUrl })
      setPlayerProfile(p => ({ ...p, avatar_url: avatarUrl }))
      showToast({ type: 'success', message: 'Foto actualizada', duration: 2000 })
    } catch {
      showToast({ type: 'error', message: 'Error al subir foto', duration: 3000 })
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const [activeTab, setActiveTab ] = useState('activity')

  useEffect(() => {
    if (playerProfile && !isOwnProfile) {
      setActiveTab('trophies')
    }
  }, [playerProfile, isOwnProfile])


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Cargando perfil...</p>
        </div>
      </div>
    )
  }

  if (!playerProfile) {
    return <div className="p-4 text-center text-zinc-400">Perfil no encontrado</div>
  }

  /**
   * Renders the trophies tab content.
   * Displays earned medals with rarity-based styling.
   */
  const TrophiesTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
        {medals.map(({ medal, awarded_at }) => (
          <div 
            key={medal.id}
            className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border aspect-square transition-all group ${
              medal.rarity === 'legendary' ? 'bg-yellow-500/10 border-yellow-500/30' :
              medal.rarity === 'epic' ? 'bg-purple-500/10 border-purple-500/30' :
              medal.rarity === 'rare' ? 'bg-blue-500/10 border-blue-500/30' :
              'bg-zinc-900 border-zinc-800'
            }`}
          >
            <div className="text-4xl mb-2 drop-shadow-lg group-hover:scale-110 transition-transform">
              {medal.icon_text}
            </div>
            <p className="text-[10px] font-black text-white uppercase text-center leading-tight">
              {medal.name}
            </p>
            <p className="text-[8px] text-zinc-500 uppercase mt-1">
              {new Date(awarded_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
            </p>
            {medal.rarity !== 'common' && (
              <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse ${
                medal.rarity === 'legendary' ? 'bg-yellow-400' : 
                medal.rarity === 'epic' ? 'bg-purple-400' : 'bg-blue-400'
              }`} />
            )}
          </div>
        ))}
        {/* Empty slots to encourage collection */}
        {[...Array(Math.max(0, 6 - medals.length))].map((_, i) => (
          <div key={`empty-${i}`} className="bg-zinc-900/30 border border-zinc-800/50 border-dashed rounded-2xl flex items-center justify-center aspect-square opacity-40">
            <span className="text-2xl grayscale">❓</span>
          </div>
        ))}
      </div>
      
      {medals.length === 0 && (
        <div className="text-center py-8">
          <p className="text-zinc-500 text-sm">Aún no tienes medallas.</p>
          <p className="text-xs text-zinc-600 mt-1 uppercase font-bold">¡Juega torneos para coleccionarlas!</p>
        </div>
      )}
    </div>
  )

  /**
   * Main profile page layout.
   * Includes header with avatar, ATP badge, and tab navigation.
   */
  return (
    <div className="pb-32 min-h-screen bg-zinc-950 glass-ambient">
      {/* Profile Header */}
      <div className="bg-gradient-to-b from-emerald-500/10 to-transparent px-4 pt-4 pb-4 border-b border-zinc-900">
        <div className="flex justify-between items-start mb-6">
           {/* Language toggle */}
           <LanguageToggle />
           <div className="flex-1 flex flex-col items-center">
              <div className="relative group mb-3">
                 <button
                    onClick={() => isOwnProfile && fileInputRef.current?.click()}
                    className={isOwnProfile ? 'cursor-pointer' : 'cursor-default'}
                    disabled={uploadingAvatar}
                 >
                    {playerProfile.avatar_url ? (
                      <img
                        src={playerProfile.avatar_url}
                        alt={playerProfile.display_name}
                        className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500 shadow-xl shadow-emerald-500/10" style={{ borderTopColor: 'rgba(255,255,255,0.4)' }}
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center" style={{ borderTopColor: 'rgba(255,255,255,0.4)' }}>
                        <span className="text-4xl font-bold text-emerald-400">
                          {(playerProfile.display_name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    {isOwnProfile && (
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                         <span className="text-white text-xs font-bold uppercase tracking-tighter">Cambiar</span>
                      </div>
                    )}
                 </button>
                 {hasRecentTitle(playerProfile) && (
                    <span className="absolute -top-1 -right-1 text-3xl drop-shadow-md">👑</span>
                 )}
              </div>
              <h1 className="text-2xl font-black text-white">{playerProfile.display_name}</h1>
              <p className="text-sm text-zinc-500">@{playerProfile.username || 'jugador_padel'}</p>
              <div className="mt-2">
                 <EloBadge elo={playerProfile.elo_rating} showIcon className="scale-110" />
              </div>
           </div>
           {isOwnProfile ? (
              <button
                onClick={() => navigate('/settings')}
                className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 active:scale-95 transition shadow-lg hover:text-white"
                title="Settings"
              >
                ⚙️
              </button>
           ) : (
             <div className="w-10 h-10" />
           )}
        </div>

        {/* Level & Position Badges */}
        <div className="flex justify-center gap-2 mb-4">
           {playerProfile.level_self && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full border border-zinc-700">
                Lvl {playerProfile.level_self} · {PLAYER_LEVELS[playerProfile.level_self]}
              </span>
           )}
           {playerProfile.preferred_position && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
                {playerProfile.preferred_position === 'drive' ? 'Drive' : playerProfile.preferred_position === 'reves' ? 'Revés' : 'Drive / Revés'}
              </span>
           )}
        </div>

        {/* Stats Summary Row */}
        {isOwnProfile && (
          <div className="grid grid-cols-3 gap-2 px-2 max-w-sm mx-auto">
             <div className="glass-card text-center p-2">
                <p className="text-[10px] text-zinc-500 uppercase font-black">Rating</p>
                <p className="text-lg font-black text-emerald-500">{Math.round(playerProfile.elo_rating || 1200)}</p>
             </div>
             <div className="glass-card text-center p-2">
                <p className="text-[10px] text-zinc-500 uppercase font-black">Partidos</p>
                <p className="text-lg font-black text-white">{playerProfile.matches_played || 0}</p>
             </div>
             <div className="glass-card text-center p-2">
                <p className="text-[10px] text-zinc-500 uppercase font-black">Win %</p>
                <p className="text-lg font-black text-white">
                   {playerProfile.matches_played > 0 ? Math.round((playerProfile.matches_won / playerProfile.matches_played) * 100) : 0}%
                </p>
             </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />

      {/* TABS */}
      <div className="px-4 mt-6">
        <div className="flex gap-2 flex-wrap mb-6">
           {['activity', 'trophies', 'friends', 'settings']
             .filter(tab => isOwnProfile || tab === 'trophies')
             .map(tab => {
              const pillColors = { activity: 'emerald', trophies: 'amber', friends: 'cyan', settings: 'purple' }
              return (
                <GlassButton
                  key={tab}
                  pill
                  pillColor={activeTab === tab ? pillColors[tab] : undefined}
                  variant={activeTab === tab ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 text-[10px] font-black uppercase tracking-widest"
                >
                  {tab === 'activity' ? 'Actividad' : tab === 'trophies' ? 'Trofeos' : tab === 'friends' ? 'Amigos' : 'Ajustes'}
                </GlassButton>
              )
           })}
        </div>

        {/* Tab Content */}
        {activeTab === 'activity' && isOwnProfile && (
          <div className="space-y-6">
             {/* ATP History Sparkline (lazy-loaded to reduce bundle size) */}
             {eloHistory.length > 1 && (
               <Suspense fallback={<div className="h-32 bg-zinc-900 rounded-2xl animate-pulse" />}>
                 <EloSparkline data={eloHistory} />
               </Suspense>
             )}

             {/* Recent Matches */}
             {matchHistory.length > 0 ? (
                <div className="space-y-3">
                   <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest px-1">Partidos Recientes</h2>
                   {matchHistory.map((match) => {
                      const isTeam1 = match.p1_id === playerProfile.id || match.p1b_id === playerProfile.id
                      const won = isTeam1 ? (match.winner_id === match.p1_id || match.winner_id === match.p1b_id) : (match.winner_id === match.p2_id || match.winner_id === match.p2b_id)
                      const opponents = isTeam1
                        ? [match.p2?.display_name, match.p2b?.display_name].filter(Boolean)
                        : [match.p1?.display_name, match.p1b?.display_name].filter(Boolean)
                      return (
                        <div key={match.id} className="glass-card p-4 flex items-center justify-between group active:scale-95 transition">
                          <div className="flex items-center gap-3">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${won ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                                {won ? 'W' : 'L'}
                             </div>
                             <div>
                                <p className="text-sm font-bold text-white">vs {opponents.join(' / ')}</p>
                                <p className="text-[10px] text-zinc-500 uppercase font-black mt-0.5">{new Date(match.created_at).toLocaleDateString()}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${won ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                {won ? 'Victoria' : 'Finalizado'}
                             </span>
                          </div>
                        </div>
                      )
                   })}
                </div>
             ) : (
               <div className="glass-card text-center py-12 border-dashed">
                  <p className="text-zinc-500 text-sm">Sin historial de partidos</p>
                  <GlassButton variant="primary" size="sm" pill onClick={() => navigate('/play')} className="mt-4">¡Jugar ahora!</GlassButton>
               </div>
             )}
          </div>
        )}

        {activeTab === 'trophies' && <TrophiesTab />}

        {activeTab === 'friends' && isOwnProfile && (
          <div className="space-y-6">
             {/* Pending Requests */}
             {pendingRequests.length > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 space-y-3">
                   <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Solicitudes por aceptar ({pendingRequests.length})</p>
                   {pendingRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between">
                         <p className="text-sm font-bold text-white">{req.requester?.display_name}</p>
                         <div className="flex gap-2">
                            <GlassButton variant="primary" size="icon" className="!w-8 !h-8 !min-h-0 !rounded-full text-xs" onClick={async () => {
                               const { data } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', req.id).select('id, status, requester_id, addressee_id, requester:profiles!requester_id(id, display_name, elo_rating), addressee:profiles!addressee_id(id, display_name, elo_rating)').single()
                               if (data) {
                                 setPendingRequests(p => p.filter(r => r.id !== req.id))
                                 setFriends(f => [...f, data.requester])
                               }
                            }}>✓</GlassButton>
                            <GlassButton variant="secondary" size="icon" className="!w-8 !h-8 !min-h-0 !rounded-full text-xs" onClick={async () => {
                               await supabase.from('friendships').delete().eq('id', req.id)
                               setPendingRequests(p => p.filter(r => r.id !== req.id))
                            }}>✕</GlassButton>
                         </div>
                      </div>
                   ))}
                </div>
             )}

             {/* Friends List */}
             <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 flex items-center gap-1 glass-input !py-3">
                    <span className="text-zinc-500 text-sm">@</span>
                    <input
                      type="text"
                      placeholder="Buscar por usuario..."
                      value={addHandleInput}
                      onChange={e => setAddHandleInput(e.target.value.replace(/\s/g, ''))}
                      className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                    />
                  </div>
                  <GlassButton variant="primary" size="icon" onClick={handleAddByHandle}>+</GlassButton>
                </div>

                <div className="grid grid-cols-1 gap-2">
                   {friends.length === 0 ? (
                      <div className="text-center py-12">
                         <p className="text-zinc-500 text-sm">Aún no tienes amigos agregados.</p>
                      </div>
                   ) : (
                      friends.map(friend => (
                        <div key={friend.id} className="glass-card p-4 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                                 {friend.display_name[0].toUpperCase()}
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-white">{friend.display_name}</p>
                                 <p className="text-[10px] text-zinc-500 uppercase font-black">{Math.round(friend.elo_rating || 1200)} ATP</p>
                              </div>
                           </div>
                           <button onClick={async () => {
                              const { data: fs } = await supabase.from('friendships').select('id').or(`and(requester_id.eq.${user.id},addressee_id.eq.${friend.id}),and(requester_id.eq.${friend.id},addressee_id.eq.${user.id})`).maybeSingle()
                              if (fs) {
                                await supabase.from('friendships').delete().eq('id', fs.id)
                                setFriends(f => f.filter(fr => fr.id !== friend.id))
                              }
                           }} className="text-[10px] font-black text-red-400/50 uppercase tracking-widest hover:text-red-400">Eliminar</button>
                        </div>
                      ))
                   )}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'settings' && isOwnProfile && (
           <div className="space-y-6">
              <div className="glass-card space-y-4 p-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nombre Público</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="glass-input"
                      placeholder="Tu nombre"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">@Usuario</label>
                    <div className="glass-input flex items-center gap-1 !p-3">
                      <span className="text-zinc-500 text-sm">@</span>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value.replace(/^@/, '').replace(/\s/g, ''))}
                        className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                        placeholder="usuario"
                        maxLength={20}
                      />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Edad</label>
                       <input
                          type="number"
                          value={editAge}
                          onChange={(e) => setEditAge(e.target.value)}
                          className="glass-input"
                          placeholder="—"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Sexo</label>
                       <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value)}
                          className="glass-input"
                       >
                          <option value="">—</option>
                          <option value="masculino">Masc.</option>
                          <option value="femenino">Fem.</option>
                          <option value="otro">Otro</option>
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">País</label>
                       <select
                          value={editCountry}
                          onChange={(e) => setEditCountry(e.target.value)}
                          className="glass-input"
                       >
                          <option value="">—</option>
                          {COUNTRIES.map(country => (
                            <option key={country} value={country}>{country}</option>
                          ))}
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ciudad</label>
                       <select
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          className="glass-input"
                       >
                          <option value="">—</option>
                          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="pt-2">
                    <GlassButton
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={handleSaveName}
                      loading={isSaving}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </GlassButton>
                    <p className="text-[9px] text-zinc-600 text-center mt-3 uppercase font-bold px-4">
                       Nota: Algunos cambios pueden tardar unos segundos en reflejarse.
                    </p>
                 </div>
              </div>

              {/* Password Change */}
              <div className="glass-card p-6">
                 <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Seguridad</p>
                 </div>
                 <GlassButton
                    variant="accent-purple"
                    size="md"
                    fullWidth
                    onClick={() => setShowPasswordModal(true)}
                 >
                    Cambiar Contraseña
                 </GlassButton>
              </div>

              {/* Advanced info summary */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4">
                 <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Información Técnica</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[9px] text-zinc-700 uppercase font-black">ID Usuario</p>
                       <p className="text-[10px] text-zinc-500 font-mono truncate">{user?.id}</p>
                    </div>
                    <div>
                       <p className="text-[9px] text-zinc-700 uppercase font-black">Email</p>
                       <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
                    </div>
                 </div>
              </div>

               {/* Legal links */}
               <div className="flex justify-center gap-6 py-4">
                  <Link to="/terms" className="text-[10px] font-black text-zinc-600 hover:text-emerald-500 uppercase tracking-widest transition">Términos de Servicio</Link>
                  <Link to="/privacy" className="text-[10px] font-black text-zinc-600 hover:text-emerald-500 uppercase tracking-widest transition">Privacidad</Link>
               </div>
            </div>
         )}
      </div>

      {/* Experimental Roadmap Button */}
      {isOwnProfile && activeTab === 'activity' && (
        <div className="px-4 mt-8">
           <GlassButton
             variant="ghost"
             size="md"
             fullWidth
             onClick={() => setShowRoadmap(!showRoadmap)}
           >
              {showRoadmap ? 'Ocultar Roadmap' : 'Ver Roadmap PadelZero'}
           </GlassButton>
           {showRoadmap && (
             <div className="mt-4 bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 animate-in fade-in slide-in-from-bottom-2">
                <Roadmap />
             </div>
           )}
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 max-w-sm w-full">
            <h2 className="text-xl font-black text-white mb-6">Cambiar Contraseña</h2>

            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
                  className="glass-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="glass-input"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <GlassButton
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => {
                  setShowPasswordModal(false)
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                disabled={isChangingPassword}
              >
                Cancelar
              </GlassButton>
              <GlassButton
                variant="primary"
                size="md"
                className="flex-1"
                onClick={handleChangePassword}
                loading={isChangingPassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Cambiando...' : 'Cambiar'}
              </GlassButton>
            </div>
          </div>
        </div>
      )}
      {/* Super Admin Panel — only visible to admin */}
      {isOwnProfile && user?.id === ADMIN_USER_ID && (
        <div className="px-4 mt-6 mb-6">
          <div className="glass-card p-4 border border-red-500/10">
            <AdminPanel />
          </div>
        </div>
      )}

      {/* Publicity Banner */}
      <AdBanner />
    </div>
  )
}

function LanguageToggle() {
  const { lang, toggleLang } = useI18n()
  return (
    <button
      onClick={toggleLang}
      className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-xs font-black active:scale-95 transition shadow-lg text-zinc-400 hover:text-white"
      title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      {lang === 'es' ? '🇪🇸' : '🇺🇸'}
    </button>
  )
}

function AdBanner() {
  const [adUrl, setAdUrl] = useState(null)
  useEffect(() => {
    async function fetchAd() {
      try {
        const { data: files } = await supabase.storage.from('banners').list('', { limit: 100 })
        const images = (files || []).filter(f => f.name && !f.name.startsWith('.') && f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i))
        if (images.length > 0) {
          const random = images[Math.floor(Math.random() * images.length)]
          const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(random.name)
          setAdUrl(publicUrl)
        }
      } catch {}
    }
    fetchAd()
  }, [])
  if (!adUrl) return null
  return (
    <div className="mx-4 mb-6 rounded-2xl overflow-hidden border border-zinc-800">
      <img src={adUrl} alt="Publicidad" className="w-full" style={{ display: 'block', objectFit: 'contain', maxHeight: 200, background: '#000' }}
        onError={(e) => { e.currentTarget.closest('div').style.display = 'none' }} />
    </div>
  )
}
