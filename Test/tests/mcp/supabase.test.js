import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @supabase/supabase-js
const { mockClient, mockAuth } = vi.hoisted(() => {
  const mockAuth = {
    signInWithPassword: vi.fn()
  }
  const mockClient = {
    auth: mockAuth
  }
  return { mockClient, mockAuth }
})

const loadSupabaseModule = async () => {
  vi.resetModules()
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'test-key'
  process.env.VITEST = 'true'
  const mod = await import('../../../mcp/lib/supabase.js')
  mod.__setClientForTest(mockClient)
  mod.__resetAuthForTest()
  return mod
}

describe('supabase.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getClient returns the supabase client', async () => {
    const { getClient } = await loadSupabaseModule()
    const client = getClient()
    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
    expect(client.auth.signInWithPassword).toBeDefined()
  })

  it('requireAuth throws if not logged in', async () => {
    const { requireAuth } = await loadSupabaseModule()
    expect(() => requireAuth()).toThrow('Not authenticated')
  })

  it('login sets currentUser on success', async () => {
    const { login, getUser, requireAuth } = await loadSupabaseModule()
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'test@test.com' } },
      error: null
    })

    const result = await login('test@test.com', 'pass')
    expect(result.id).toBe('u1')
    expect(getUser().id).toBe('u1')
    expect(requireAuth().id).toBe('u1')
  })

  it('login throws on error', async () => {
    const { login } = await loadSupabaseModule()
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' }
    })

    await expect(login('test@test.com', 'wrong')).rejects.toThrow('Invalid login credentials')
  })
})
