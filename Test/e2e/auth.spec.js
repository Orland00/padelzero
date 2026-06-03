import { test, expect } from '@playwright/test';

const e2e = process.env.RUN_E2E === 'true' ? test.describe : test.describe.skip;

e2e('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console logs for debugging
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warn') {
        console.log(`BROWSER ${msg.type().toUpperCase()}: ${msg.text()}`);
      }
    });

    // Mock HIBP API to avoid external calls and ensure success
    await page.route('https://api.pwnedpasswords.com/range/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: '00112233445566778899AABBCCDDEEFF001:0\n',
      });
    });

    // Intercept Supabase Auth and Profiles calls
    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'POST' && (url.includes('token?grant_type=password') || url.includes('signup'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'fake-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'fake-refresh',
            user: { id: 'test-user-id', email: 'test@example.com' },
            session: { access_token: 'fake-token', user: { id: 'test-user-id' } }
          }),
        });
      }
      
      if (url.includes('user')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'test-user-id', email: 'test@example.com' }),
        });
      }
      return route.continue();
    });

    await page.route('**/rest/v1/profiles*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'test-user-id', display_name: 'Test Player', username: 'testplayer' }]),
      });
    });

    // Default RPC mock (for login test)
    await page.route('**/rest/v1/rpc/get_my_profile', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'test-user-id', display_name: 'Test Player', username: 'testplayer' }),
      });
    });
  });

  test('1. Successful email login', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password12345');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*play/, { timeout: 15000 });
  });

  test('2. Successful signup and onboarding redirect', async ({ page }) => {
    // Unroute the default mock to use the specific one for signup
    await page.unroute('**/rest/v1/rpc/get_my_profile');
    
    await page.route('**/rest/v1/rpc/get_my_profile', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'test-user-id', display_name: '', username: '' }),
      });
    });

    await page.goto('/');
    
    // Switch to registration mode
    await page.click('button:has-text("Regístrate"), button:has-text("Sign Up")');
    
    await page.fill('input[name="email"]', 'newuser@example.com');
    await page.fill('input[name="password"]', 'password12345');
    
    // Click submit button (the one that says Create Account or Crear cuenta)
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*onboarding/, { timeout: 15000 });
  });

  test('3. Unauthorized access redirects to home', async ({ page }) => {
    await page.goto('/play');
    await expect(page).toHaveURL('/');
  });

  test('4. Google login button presence', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button:has-text("Google")')).toBeVisible();
  });
});
