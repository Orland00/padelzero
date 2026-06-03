export const createProfile = (overrides = {}) => ({
  id: 'user-' + Math.random().toString(36).substr(2, 9),
  display_name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  role: 'user',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createAuthUser = (overrides = {}) => ({
  id: 'user-' + Math.random().toString(36).substr(2, 9),
  email: 'test@example.com',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
  ...overrides,
});
