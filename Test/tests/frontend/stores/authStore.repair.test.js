import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const rpcMock = {
  maybeSingle: vi.fn(),
  single: vi.fn(),
};

const fromMock = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(),
    })),
    maybeSingle: vi.fn(),
  })),
  update: vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
  })),
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(() => fromMock),
    rpc: vi.fn(() => rpcMock),
  },
}));

describe('authStore Profile Repair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset individual method mocks too
    rpcMock.maybeSingle.mockReset();
    rpcMock.single.mockReset();
    fromMock.update.mockReset();
    useAuthStore.setState({
      user: null,
      profile: null,
      ready: false,
    });
  });

  it('1. Repairs profile when display_name is missing', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com', user_metadata: { full_name: 'Metadata Name' } };
    const mockProfile = { id: 'user-1', display_name: '', email: 'test@example.com' };
    
    // Mock RPC get_my_profile
    rpcMock.maybeSingle.mockResolvedValue({ data: mockProfile, error: null });
    // Mock update
    fromMock.update.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { ...mockProfile, display_name: 'Metadata Name' }, error: null })
        })
      })
    });

    // We can't easily trigger the internal repair logic without initialize() and onAuthStateChange
    // But we can test if initialize handles it.
    
    let authCallback;
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    useAuthStore.getState().initialize();
    
    // Simulate INITIAL_SESSION
    await authCallback('INITIAL_SESSION', { user: mockUser });

    // Wait for profile resolution
    await vi.waitFor(() => {
      expect(useAuthStore.getState().profile.display_name).toBe('Metadata Name');
    });
    
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });

  it('2. Does not repair profile if display_name is already present', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com', user_metadata: { full_name: 'Metadata Name' } };
    const mockProfile = { id: 'user-1', display_name: 'Existing Name', email: 'test@example.com' };
    
    rpcMock.maybeSingle.mockResolvedValue({ data: mockProfile, error: null });

    let authCallback;
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    useAuthStore.getState().initialize();
    await authCallback('INITIAL_SESSION', { user: mockUser });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().profile.display_name).toBe('Existing Name');
    });
    
    // Update should NOT have been called
    expect(fromMock.update).not.toHaveBeenCalled();
  });

  it('3. Repairs email and avatar_url if missing', async () => {
    const mockUser = { 
      id: 'user-1', 
      email: 'new@example.com', 
      user_metadata: { full_name: 'Name', avatar_url: 'http://avatar.com' } 
    };
    const mockProfile = { id: 'user-1', display_name: '', email: null, avatar_url: null };
    
    rpcMock.maybeSingle.mockResolvedValue({ data: mockProfile, error: null });
    fromMock.update.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { ...mockProfile, display_name: 'Name', email: 'new@example.com', avatar_url: 'http://avatar.com' }, 
            error: null 
          })
        })
      })
    });

    let authCallback;
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    useAuthStore.getState().initialize();
    await authCallback('INITIAL_SESSION', { user: mockUser });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().profile.email).toBe('new@example.com');
      expect(useAuthStore.getState().profile.avatar_url).toBe('http://avatar.com');
    });
  });
});
