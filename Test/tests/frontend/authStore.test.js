/**
 * authStore flow tests — login, signup (with HIBP), password reset,
 * password update (with HIBP), sign out.
 *
 * Supabase + HIBP are mocked so tests are deterministic and offline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock() is hoisted above all imports, so any referenced symbols must
// also be defined in a hoisted block.
const hoisted = vi.hoisted(() => {
  const mockAuth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    onAuthStateChange: vi.fn(),
  }
  const makeFromChain = () => {
    const chain = {}
    chain.select = vi.fn(() => chain)
    chain.insert = vi.fn(() => chain)
    chain.update = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    chain.single = vi.fn(async () => ({ data: null, error: null }))
    return chain
  }
  const makeRpcChain = () => {
    const chain = {}
    chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    chain.single = vi.fn(async () => ({ data: null, error: null }))
    return chain
  }
  const mockHibp = vi.fn(async () => ({ pwned: false, count: 0, checked: true }))
  return { mockAuth, makeFromChain, makeRpcChain, mockHibp }
})

const { mockAuth, makeFromChain, makeRpcChain, mockHibp } = hoisted

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: hoisted.mockAuth,
    from: vi.fn(() => hoisted.makeFromChain()),
    rpc: vi.fn(() => hoisted.makeRpcChain()),
  },
}))

vi.mock('@/lib/pwnedPasswordCheck', () => ({
  checkPasswordPwned: hoisted.mockHibp,
}))

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
const checkPasswordPwned = mockHibp

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, profile: null, session: null, ready: false, authLoading: false, error: null })
})

// =======================================================================
// initialize & onAuthStateChange
// =======================================================================
describe('initialize', () => {
  it('sets up onAuthStateChange listener', async () => {
    await useAuthStore.getState().initialize()
    expect(mockAuth.onAuthStateChange).toHaveBeenCalled()
  })

  it('handles INITIAL_SESSION event with user', async () => {
    let callback
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      callback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    await useAuthStore.getState().initialize()

    const mockUser = { id: 'u1', email: 'u@e.com' }
    const mockSession = { user: mockUser }
    const mockProfile = { id: 'u1', display_name: 'Test' }

    vi.mocked(supabase.rpc).mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    })

    await callback('INITIAL_SESSION', mockSession)

    expect(useAuthStore.getState().user).toEqual(mockUser)
    expect(useAuthStore.getState().session).toEqual(mockSession)
    // Profile fetch is async, need to wait or check state after a bit
    await vi.waitFor(() => {
      expect(useAuthStore.getState().profile).toEqual(mockProfile)
      expect(useAuthStore.getState().ready).toBe(true)
    })
  })

  it('handles SIGNED_OUT event', async () => {
    let callback
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      callback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    await useAuthStore.getState().initialize()
    useAuthStore.setState({ user: { id: 'u1' }, session: {}, profile: {} })

    await callback('SIGNED_OUT', null)

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().session).toBeNull()
    expect(useAuthStore.getState().profile).toBeNull()
  })

  it('handles PASSWORD_RECOVERY event', async () => {
    let callback
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      callback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    const replaceSpy = vi.fn()
    const originalLocation = window.location
    
    // In jsdom, we can mock window.location by deleting and reassignment
    delete window.location
    window.location = { ...originalLocation, replace: replaceSpy }
    
    await useAuthStore.getState().initialize()
    const mockUser = { id: 'u1' }
    const mockSession = { user: mockUser }

    await callback('PASSWORD_RECOVERY', mockSession)

    expect(useAuthStore.getState().user).toEqual(mockUser)
    expect(replaceSpy).toHaveBeenCalledWith('/profile?recovery=1')
    
    window.location = originalLocation
  })
})

// =======================================================================
// signUpWithEmail
// =======================================================================
describe('signUpWithEmail', () => {
  it('calls HIBP BEFORE Supabase signUp (safe-first ordering)', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null })

    await useAuthStore.getState().signUpWithEmail('test@example.com', 'cleanpass1234')

    expect(checkPasswordPwned).toHaveBeenCalledWith('cleanpass1234')
    expect(mockAuth.signUp).toHaveBeenCalledOnce()
    // HIBP must fire before Supabase ever sees the password
    const hibpCall = checkPasswordPwned.mock.invocationCallOrder[0]
    const supaCall = mockAuth.signUp.mock.invocationCallOrder[0]
    expect(hibpCall).toBeLessThan(supaCall)
  })

  it('throws password_breached:N and never calls Supabase on pwned password', async () => {
    checkPasswordPwned.mockResolvedValueOnce({ pwned: true, count: 9_659_365, checked: true })

    const { error, data } = await useAuthStore.getState().signUpWithEmail('u@e.com', 'leakedpassword')

    expect(error).toBeTruthy()
    expect(error.message).toBe('password_breached:9659365')
    expect(data).toBeNull()
    expect(mockAuth.signUp).not.toHaveBeenCalled()
  })

  it('proceeds to Supabase when HIBP reports clean', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'new-uid', email: 'u@e.com' } },
      error: null,
    })
    const { error } = await useAuthStore.getState().signUpWithEmail('u@e.com', 'verylongstrongpass2026!')
    expect(error).toBeNull()
    expect(mockAuth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'u@e.com',
      password: 'verylongstrongpass2026!',
      options: expect.objectContaining({
        emailRedirectTo: expect.stringContaining('/onboarding'),
      }),
    }))
  })

  it('fails open when HIBP is unreachable (checked=false + pwned=false)', async () => {
    checkPasswordPwned.mockResolvedValueOnce({ pwned: false, count: 0, checked: false })
    mockAuth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null })

    const { error } = await useAuthStore.getState().signUpWithEmail('u@e.com', 'anypass2026!')
    expect(error).toBeNull()
    expect(mockAuth.signUp).toHaveBeenCalled()
  })

  it('surfaces Supabase errors as-is (e.g., "already registered")', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    })
    const { error } = await useAuthStore.getState().signUpWithEmail('u@e.com', 'cleanpass2026')
    expect(error.message).toBe('User already registered')
  })

  it('rejects passwords shorter than 12 before HIBP or Supabase', async () => {
    const { error, data } = await useAuthStore.getState().signUpWithEmail('u@e.com', 'shortpass')

    expect(data).toBeNull()
    expect(error.message).toBe('password_min_length:12')
    expect(checkPasswordPwned).not.toHaveBeenCalled()
    expect(mockAuth.signUp).not.toHaveBeenCalled()
  })
})

// =======================================================================
// signInWithEmail
// =======================================================================
describe('signInWithEmail', () => {
  it('calls Supabase signInWithPassword with the exact credentials', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    })
    await useAuthStore.getState().signInWithEmail('u@e.com', 'pw')
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'u@e.com', password: 'pw' })
  })

  it('does NOT run HIBP on login (login is intentionally permissive)', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null })
    await useAuthStore.getState().signInWithEmail('u@e.com', 'pw')
    expect(checkPasswordPwned).not.toHaveBeenCalled()
  })

  it('returns the Supabase error unchanged on wrong credentials', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    })
    const { error } = await useAuthStore.getState().signInWithEmail('u@e.com', 'wrong')
    expect(error.message).toBe('Invalid login credentials')
  })
})

// =======================================================================
// resetPassword
// =======================================================================
describe('resetPassword', () => {
  it('calls resetPasswordForEmail with /profile?recovery=1 redirect', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null })
    await useAuthStore.getState().resetPassword('u@e.com')
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
      'u@e.com',
      expect.objectContaining({
        redirectTo: expect.stringContaining('/profile?recovery=1'),
      })
    )
  })

  it('returns null error on success', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null })
    const { error } = await useAuthStore.getState().resetPassword('u@e.com')
    expect(error).toBeNull()
  })

  it('propagates Supabase errors (rate limit, unknown email, etc.)', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } })
    const { error } = await useAuthStore.getState().resetPassword('u@e.com')
    expect(error.message).toBe('Email rate limit exceeded')
  })
})

// =======================================================================
// updatePassword — must also run HIBP
// =======================================================================
describe('updatePassword', () => {
  it('runs HIBP BEFORE Supabase updateUser', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null })
    await useAuthStore.getState().updatePassword('cleanpass2026')
    expect(checkPasswordPwned).toHaveBeenCalledWith('cleanpass2026')
    const hibpCall = checkPasswordPwned.mock.invocationCallOrder[0]
    const supaCall = mockAuth.updateUser.mock.invocationCallOrder[0]
    expect(hibpCall).toBeLessThan(supaCall)
  })

  it('refuses breached password and does not call Supabase', async () => {
    checkPasswordPwned.mockResolvedValueOnce({ pwned: true, count: 42, checked: true })
    const { error } = await useAuthStore.getState().updatePassword('leakedpassword')
    expect(error.message).toBe('password_breached:42')
    expect(mockAuth.updateUser).not.toHaveBeenCalled()
  })

  it('updates on clean password', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null })
    const { error } = await useAuthStore.getState().updatePassword('newlongunique2026!')
    expect(error).toBeNull()
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'newlongunique2026!' })
  })

  it('rejects passwords shorter than 12 before HIBP or Supabase', async () => {
    const { error } = await useAuthStore.getState().updatePassword('shortpass')

    expect(error.message).toBe('password_min_length:12')
    expect(checkPasswordPwned).not.toHaveBeenCalled()
    expect(mockAuth.updateUser).not.toHaveBeenCalled()
  })
})

// =======================================================================
// signOut
// =======================================================================
describe('signOut', () => {
  it('calls supabase.auth.signOut and clears store state', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null })
    useAuthStore.setState({
      user: { id: 'u1' }, profile: { display_name: 'A' }, session: { access_token: 't' },
    })
    await useAuthStore.getState().signOut()
    expect(mockAuth.signOut).toHaveBeenCalled()
    const s = useAuthStore.getState()
    expect(s.user).toBeNull()
    expect(s.profile).toBeNull()
    expect(s.session).toBeNull()
  })
})

// =======================================================================
// signInWithGoogle
// =======================================================================
describe('signInWithGoogle', () => {
  it('calls signInWithOAuth with google provider', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    await useAuthStore.getState().signInWithGoogle()
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
    }))
  })

  it('sets authLoading during the call', async () => {
    mockAuth.signInWithOAuth.mockImplementation(() => {
      expect(useAuthStore.getState().authLoading).toBe(true)
      return Promise.resolve({ data: {}, error: null })
    })
    await useAuthStore.getState().signInWithGoogle()
    expect(useAuthStore.getState().authLoading).toBe(false)
  })

  // Regression: after Google OAuth, land on the root route so Home decides
  // whether to send the user to the app or onboarding.
  it('redirectTo is origin root — not /onboarding', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    await useAuthStore.getState().signInWithGoogle()
    const call = mockAuth.signInWithOAuth.mock.calls[0][0]
    const redirectTo = call.options?.redirectTo ?? ''
    expect(redirectTo).not.toContain('/onboarding')
    expect(redirectTo).toBe(window.location.origin)
  })

  it('returns error and clears authLoading on signInWithOAuth failure', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({ data: null, error: { message: 'popup_closed' } })
    const { error } = await useAuthStore.getState().signInWithGoogle()
    expect(error.message).toBe('popup_closed')
    expect(useAuthStore.getState().authLoading).toBe(false)
  })
})

// =======================================================================
// initialize — INITIAL_SESSION uses get_my_profile RPC
// =======================================================================
describe('initialize — get_my_profile RPC', () => {
  let callback

  beforeEach(async () => {
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      callback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    await useAuthStore.getState().initialize()
  })

  // Regression: v15_08b revoked SELECT * on profiles from the authenticated
  // role. Old code did from('profiles').select('*') which silently returned
  // null/error, setting profile=null and landing users in onboarding.
  // New code uses the get_my_profile() SECURITY DEFINER RPC which bypasses
  // column-level grants and always returns the caller's full row.
  it('INITIAL_SESSION calls get_my_profile RPC, not from(profiles).select', async () => {
    const mockUser = { id: 'u1', email: 'u@e.com' }
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'u1', display_name: 'A' }, error: null }),
    })

    await callback('INITIAL_SESSION', { user: mockUser })

    await vi.waitFor(() => expect(useAuthStore.getState().ready).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('get_my_profile')
    expect(supabase.from).not.toHaveBeenCalledWith('profiles')
  })

  it('INITIAL_SESSION — existing user with display_name sets profile and ready', async () => {
    const mockUser = { id: 'u1', email: 'u@e.com' }
    const mockProfile = { id: 'u1', display_name: 'Player A', elo_rating: 1256 }
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    })

    await callback('INITIAL_SESSION', { user: mockUser })

    await vi.waitFor(() => {
      expect(useAuthStore.getState().profile).toEqual(mockProfile)
      expect(useAuthStore.getState().ready).toBe(true)
    })
    // Existing users must NOT be stuck in onboarding — profile.display_name present
    expect(useAuthStore.getState().profile?.display_name).toBe('Player A')
  })

  it('INITIAL_SESSION — existing registered user without display_name is repaired from auth metadata', async () => {
    const mockUser = {
      id: 'u1',
      email: 'player@example.com',
      user_metadata: { full_name: 'Test Player', avatar_url: 'https://example.com/o.png' },
    }
    const incompleteProfile = { id: 'u1', email: 'player@example.com', display_name: null, avatar_url: null }
    const repairedProfile = { ...incompleteProfile, display_name: 'Test Player', avatar_url: 'https://example.com/o.png' }

    vi.mocked(supabase.rpc).mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValue({ data: incompleteProfile, error: null }),
    })
    vi.mocked(supabase.from).mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: repairedProfile, error: null }),
          })),
        })),
      })),
    })

    await callback('INITIAL_SESSION', { user: mockUser })

    await vi.waitFor(() => {
      expect(useAuthStore.getState().ready).toBe(true)
      expect(useAuthStore.getState().profile).toEqual(repairedProfile)
    })
    expect(useAuthStore.getState().profile?.display_name).toBe('Test Player')
  })

  it('INITIAL_SESSION — get_my_profile throws sets profile=null and ready=true', async () => {
    const mockUser = { id: 'u1', email: 'u@e.com' }
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      maybeSingle: vi.fn().mockRejectedValue(new Error('network error')),
    })

    await callback('INITIAL_SESSION', { user: mockUser })

    await vi.waitFor(() => expect(useAuthStore.getState().ready).toBe(true))
    expect(useAuthStore.getState().profile).toBeNull()
    // App is still usable — user logged in, profile just not loaded
    expect(useAuthStore.getState().user).toEqual(mockUser)
  })

  it('INITIAL_SESSION — get_my_profile returns null creates profile from auth user', async () => {
    const mockUser = {
      id: 'new-user',
      email: 'new@e.com',
      user_metadata: { full_name: 'New Player', avatar_url: 'https://example.com/avatar.png' },
    }
    const insertedProfile = {
      id: 'new-user',
      email: 'new@e.com',
      display_name: 'New Player',
      avatar_url: 'https://example.com/avatar.png',
    }
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: insertedProfile, error: null }),
        })),
      })),
    })

    await callback('INITIAL_SESSION', { user: mockUser })

    await vi.waitFor(() => expect(useAuthStore.getState().ready).toBe(true))
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(useAuthStore.getState().profile).toEqual(insertedProfile)
  })

  it('INITIAL_SESSION — no session sets ready=true without calling RPC', async () => {
    await callback('INITIAL_SESSION', null)

    expect(useAuthStore.getState().ready).toBe(true)
    expect(useAuthStore.getState().user).toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

// =======================================================================
// fetchProfile
// =======================================================================
describe('fetchProfile', () => {
  it('fetches profile from supabase', async () => {
    const mockProfile = { id: 'u1', display_name: 'Test' }
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    })

    const profile = await useAuthStore.getState().fetchProfile('u1')
    expect(profile).toEqual(mockProfile)
  })

  it('returns null on error', async () => {
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'Fail' } }),
    })

    const profile = await useAuthStore.getState().fetchProfile('u1')
    expect(profile).toBeNull()
    expect(useAuthStore.getState().error).toBe('Fail')
  })
})

// =======================================================================
// updateProfile
// =======================================================================
describe('updateProfile', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u@e.com' } })
  })

  it('updates profile fields', async () => {
    const mockProfile = { id: 'u1', display_name: 'New Name' }
    vi.mocked(supabase.from).mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    })

    const { data, error } = await useAuthStore.getState().updateProfile({ display_name: 'New Name' })
    expect(error).toBeNull()
    expect(data).toEqual(mockProfile)
    expect(useAuthStore.getState().profile).toEqual(mockProfile)
  })

  it('handles PGRST116 by inserting profile', async () => {
    const mockProfile = { id: 'u1', display_name: 'New Name' }
    
    // First call to update fails with PGRST116
    const updateMock = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    }
    
    // Second call to insert succeeds
    const insertMock = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    }

    vi.mocked(supabase.from)
      .mockReturnValueOnce(updateMock)
      .mockReturnValueOnce(insertMock)

    const { data, error } = await useAuthStore.getState().updateProfile({ display_name: 'New Name' })
    expect(error).toBeNull()
    expect(data).toEqual(mockProfile)
  })

  it('ignores password if provided; password changes must use updatePassword', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null })
    vi.mocked(supabase.from).mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'u1' }, error: null }),
    })

    await useAuthStore.getState().updateProfile({ password: 'newpassword' })
    expect(mockAuth.updateUser).not.toHaveBeenCalled()
  })
})

// =======================================================================
// refreshProfile
// =======================================================================
describe('refreshProfile', () => {
  it('re-fetches profile for current user', async () => {
    useAuthStore.setState({ user: { id: 'u1' } })
    const mockProfile = { id: 'u1', display_name: 'Refreshed' }

    vi.mocked(supabase.rpc).mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    })

    await useAuthStore.getState().refreshProfile()
    expect(useAuthStore.getState().profile).toEqual(mockProfile)
  })
})

// =======================================================================
// logDebug
// =======================================================================
describe('logDebug', () => {
  it('inserts log into debug_logs table', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: insertMock,
    })

    await useAuthStore.getState().logDebug('info', 'test', 'message', { key: 'val' })
    expect(supabase.from).toHaveBeenCalledWith('debug_logs')
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      level: 'info',
      category: 'test',
      message: 'message',
    }))
  })
})
