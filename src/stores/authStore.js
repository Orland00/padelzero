import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { DEFAULT_ELO, LEVEL_ELO } from '@/lib/constants'
import { checkPasswordPwned } from '@/lib/pwnedPasswordCheck'
import { clearQueue } from '@/lib/offlineQueue'
import { validatePasswordPolicy } from '@/lib/authPolicy'

const OWN_PROFILE_COLUMNS = [
  'id',
  'email',
  'display_name',
  'username',
  'avatar_url',
  'city',
  'country',
  'age',
  'gender',
  'phone',
  'preferred_position',
  'level_self',
  'favorite_club',
  'favorite_club_id',
  'zone',
  'availability_days',
  'availability_times',
  'showcase_medal_ids',
  'elo_rating',
  'matches_played',
  'matches_won',
  'win_streak',
  'best_streak',
  'elo_peak',
  'is_founder',
  'preferred_language',
  'level',
  'preferred_side',
  'achievements',
  'role',
  'is_dummy',
  'last_match_at',
  'last_title_won_at',
  'created_at',
  'updated_at',
].join(', ')

const profileSeedFromUser = (user) => ({
  id: user.id,
  email: user.email || null,
  display_name:
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Jugador',
  avatar_url:
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    null,
})

const profileNeedsIdentityRepair = (profile) => !profile?.display_name?.trim()

const profileIdentityPatchFromUser = (user, profile = {}) => {
  const seed = profileSeedFromUser(user)
  const patch = {}

  if (!profile.display_name?.trim()) patch.display_name = seed.display_name
  if (!profile.email && seed.email) patch.email = seed.email
  if (!profile.avatar_url && seed.avatar_url) patch.avatar_url = seed.avatar_url

  return patch
}

const repairProfileIdentity = async (user, profile) => {
  if (!profileNeedsIdentityRepair(profile)) return profile

  const patch = profileIdentityPatchFromUser(user, profile)
  if (Object.keys(patch).length === 0) return profile

  const repairedFallback = { ...profile, ...patch }
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select(OWN_PROFILE_COLUMNS)
    .single()

  if (error) return repairedFallback
  return data || repairedFallback
}

const fetchOrCreateProfile = async (user) => {
  const { data, error } = await supabase.rpc('get_my_profile').maybeSingle()
  if (error) throw error
  if (data) return repairProfileIdentity(user, data)

  const profileSeed = profileSeedFromUser(user)
  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert(profileSeed)
    .select(OWN_PROFILE_COLUMNS)
    .single()

  if (insertError) {
    const { data: retryData, error: retryError } = await supabase.rpc('get_my_profile').maybeSingle()
    if (retryError) throw retryError
    return retryData || profileSeed
  }

  return inserted || profileSeed
}

/**
 * Authentication and Profile State Management Store
 * 
 * Handles Supabase auth sessions, OAuth providers, profile data syncing,
 * and security-related operations like password breach checks.
 * 
 * Updated: 2026-04-29
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  session: null,
  ready: false,
  profileLoading: false,
  profileError: null,
  authLoading: false,
  error: null,

  /**
   * Initializes the auth listener and fetches the current session.
   * Sets up the global onAuthStateChange listener to handle all auth events.
   * 
   * Updated: 2026-04-29
   */
  initialize: async () => {
    if (get().ready) return

    // Set up listener FIRST — INITIAL_SESSION fires after OAuth code exchange
    supabase.auth.onAuthStateChange((event, session) => {

      if (event === 'INITIAL_SESSION') {
        // This fires after Supabase processes the URL (including OAuth codes)
        // Now we know definitively if user is logged in or not
        if (session?.user) {
          set({ user: session.user, session, profileLoading: true, profileError: null })
          // Fetch profile async — ready fires immediately so UI doesn't hang
          fetchOrCreateProfile(session.user)
            .then((profile) => {
              set({ profile: profile || null, ready: true, profileLoading: false, profileError: null })
            })
            .catch((err) => set({ profile: null, ready: true, profileLoading: false, profileError: err.message || 'PROFILE_LOAD_FAILED' }))
        } else {
          set({ ready: true, profileLoading: false, profileError: null })
        }
        return
      }

      if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null, session: null, profileLoading: false, profileError: null })
        // Clear offline match queue to prevent cross-user leak on shared browser
        clearQueue().catch(() => {})
        return
      }

      /**
       * Handle password recovery redirection.
       * Redirects the user to the profile page with a recovery flag when
       * they click a reset-email link.
       * 
       * Updated: 2026-04-29
       */
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the reset-email link. Supabase already swapped the
        // recovery token for a session; surface a hint so Profile.jsx can
        // auto-open the password modal even if they manually edit the URL.
        if (session?.user) {
          set({ user: session.user, session })
          try {
            const url = new URL(window.location.href)
            if (url.pathname !== '/profile' || url.searchParams.get('recovery') !== '1') {
              window.location.replace('/profile?recovery=1')
            }
          } catch {}
        }
        return
      }

      if (event === 'TOKEN_REFRESHED') return

      if (session?.user) {
        set({ user: session.user, session, profileLoading: true, profileError: null })
        fetchOrCreateProfile(session.user)
          .then((profile) => set({ profile: profile || null, profileLoading: false, profileError: null }))
          .catch((err) => set({ profile: null, profileLoading: false, profileError: err.message || 'PROFILE_LOAD_FAILED' }))
      }
    })
  },

  /**
   * Triggers Google OAuth sign-in flow.
   * Configured to redirect to the onboarding flow for new users.
   * 
   * Updated: 2026-04-29
   */
  signInWithGoogle: async () => {
    set({ authLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          },
          scopes: 'openid email profile',
          redirectTo: window.location.origin,
        },
      })

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      set({ error: err.message })
      return { data: null, error: err }
    } finally {
      set({ authLoading: false })
    }
  },

  /**
   * Traditional email/password sign-in.
   * Immediately updates local state to ensure smooth routing transitions.
   * 
   * Updated: 2026-04-29
   */
  signInWithEmail: async (email, password) => {
    set({ authLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      
      // Prevent race conditions: instantly set user and session so that router doesn't kick us out to /
      if (data.session) {
        const profileData = await fetchOrCreateProfile(data.session.user)
        set({ user: data.session.user, session: data.session, profile: profileData || null, profileLoading: false, profileError: null })
      }

      return { data, error: null }
    } catch (err) {
      set({ error: err.message })
      get().logDebug('error', 'auth', `signInWithEmail fail: ${err.message}`, { emailDomain: email.split('@')[1] })
      return { data: null, error: err }
    } finally {
      set({ authLoading: false })
    }
  },

  /**
   * New user registration with email and password.
   * Includes k-anonymity check against HIBP database to prevent using breached passwords.
   * 
   * Updated: 2026-04-29
   */
  signUpWithEmail: async (email, password) => {
    set({ authLoading: true, error: null })
    try {
      const passwordPolicy = validatePasswordPolicy(password)
      if (!passwordPolicy.valid) throw new Error(passwordPolicy.message)

      // Free client-side replacement for Supabase's Pro-tier HIBP check.
      // k-anonymity: only first 5 chars of the SHA-1 hash reach the API.
      // Fail-open: if the check can't run, continue with signup.
      const pwnCheck = await checkPasswordPwned(password)
      if (pwnCheck.pwned) {
        const err = new Error(`password_breached:${pwnCheck.count}`)
        throw err
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            full_name: email.split('@')[0],
          }
        }
      })
      if (error) throw error

      if (data.session) {
        const profileData = await fetchOrCreateProfile(data.session.user)
        set({ user: data.session.user, session: data.session, profile: profileData || null, profileLoading: false, profileError: null })
      }

      return { data, error: null }
    } catch (err) {
      set({ error: err.message })
      get().logDebug('error', 'auth', `signUpWithEmail fail: ${err.message}`, { emailDomain: email.split('@')[1] })
      return { data: null, error: err }
    } finally {
      set({ authLoading: false })
    }
  },

  // signInAsGuest removed: anonymous sign-ins disabled — only registered users log in.

  signOut: async () => {
    set({ authLoading: true })
    try {
      await supabase.auth.signOut()
      set({ user: null, profile: null, session: null })
      return { error: null }
    } catch (err) {
      set({ error: err.message })
      return { error: err }
    } finally {
      set({ authLoading: false })
    }
  },

  fetchProfile: async (_userId) => {
    try {
      const { data, error } = await supabase
        .rpc('get_my_profile')
        .maybeSingle()

      if (error) throw error
      return data
    } catch (err) {
      set({ error: err.message })
      return null
    }
  },

  /**
   * Centralized logging for authentication and critical app failures.
   * Captures metadata for debugging production issues.
   * 
   * Updated: 2026-04-29
   */
  logDebug: async (level, category, message, metadata) => {
    try {
      const { user } = get()
      await supabase.from('debug_logs').insert({
        user_id: user?.id || null,
        level,
        category,
        message,
        metadata: {
          ...metadata,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      })
    } catch (e) {
      console.error('🔴 FAILED TO LOG DEBUG:', e)
    }
  },

  /**
   * Updates user profile fields in Supabase.
   * Implements a safety whitelist and handles potential race conditions
   * between auth user creation and profile row insertion.
   * 
   * Updated: 2026-04-29
   */
  updateProfile: async (updates) => {
    set({ authLoading: true, error: null })

    const safetyTimeout = setTimeout(() => {
      const { authLoading } = get()
      if (authLoading) {
        set({ authLoading: false, error: 'TIMEOUT' })
        get().logDebug('error', 'auth', 'updateProfile timeout', {})
      }
    }, 10000)

    try {
      const { user } = get()
      if (!user) throw new Error('NO_USER')

      const { password: _ignoredPassword, ...rawUpdates } = updates

      // Whitelist allowed profile fields to prevent arbitrary column updates
      const ALLOWED_PROFILE_FIELDS = [
        'display_name', 'username', 'city', 'country', 'age', 'gender',
        'avatar_url', 'preferred_position', 'level_self', 'favorite_club',
        'zone', 'phone', 'availability_days', 'availability_times',
        'showcase_medal_ids', 'email',
      ]
      const profileUpdates = {}
      for (const key of ALLOWED_PROFILE_FIELDS) {
        if (key in rawUpdates) profileUpdates[key] = rawUpdates[key]
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id)
        .select(OWN_PROFILE_COLUMNS)
        .single()

      if (updateError) {
        if (updateError.code === 'PGRST116') {
          const { data: insertData, error: insertError } = await supabase
            .from('profiles')
            .insert({ id: user.id, email: user.email, ...profileUpdates })
            .select(OWN_PROFILE_COLUMNS)
            .single()
          if (insertError) throw insertError
          set({ profile: insertData })
          return { data: insertData, error: null }
        }

        get().logDebug('error', 'auth', `Update fail: ${updateError.message}`, { code: updateError.code })
        throw updateError
      }

      if (!data) throw new Error('No se pudo guardar el perfil')

      set({ profile: data, profileError: null })
      return { data, error: null }
    } catch (err) {
      set({ error: err.message })
      get().logDebug('error', 'auth', `updateProfile CRITICAL: ${err.message}`, {})
      return { data: null, error: err }
    } finally {
      clearTimeout(safetyTimeout)
      set({ authLoading: false })
    }
  },

  refreshProfile: async () => {
    try {
      const { user } = get()
      if (!user) return
      const profileData = await get().fetchProfile(user.id)
      if (profileData) {
        set({ profile: profileData, profileError: null })
      }
    } catch (err) {
      set({ error: err.message })
    }
  },

  /**
   * Initiates password recovery flow.
   * Redirects users back to the profile with a flag to prompt for a new password.
   * 
   * Updated: 2026-04-29
   */
  resetPassword: async (email) => {
    set({ authLoading: true, error: null })
    try {
      // Land on Profile with ?recovery=1 so the UI auto-opens the password
      // modal; Profile.jsx detects the query string and prompts for new pw.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/profile?recovery=1`,
      })
      if (error) throw error
      return { error: null }
    } catch (err) {
      set({ error: err.message })
      return { error: err }
    } finally {
      set({ authLoading: false })
    }
  },

  /**
   * Updates user's password with breach check.
   * Uses checkPasswordPwned for local security validation.
   * 
   * Updated: 2026-04-29
   */
  updatePassword: async (newPassword) => {
    set({ authLoading: true, error: null })
    try {
      const passwordPolicy = validatePasswordPolicy(newPassword)
      if (!passwordPolicy.valid) throw new Error(passwordPolicy.message)

      // Same HIBP protection as signup: refuse breached passwords on change.
      const pwnCheck = await checkPasswordPwned(newPassword)
      if (pwnCheck.pwned) {
        const err = new Error(`password_breached:${pwnCheck.count}`)
        throw err
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      return { error: null }
    } catch (err) {
      set({ error: err.message })
      get().logDebug('error', 'auth', 'updatePassword failed', { reason: err.message })
      return { error: err }
    } finally {
      set({ authLoading: false })
    }
  },
}))
