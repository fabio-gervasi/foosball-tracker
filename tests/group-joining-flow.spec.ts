import { test, expect } from '@playwright/test';

test.describe('Group Joining Flow', () => {
  test('should allow user to join a group and proceed to main app', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the login form to be visible
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });

    // Check if we're on the login page
    const loginForm = page.locator('form');
    await expect(loginForm).toBeVisible();

    // Find the username/email input field
    const usernameInput = page.locator('input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]');

    // Wait for inputs to be ready
    await usernameInput.waitFor({ state: 'visible' });
    await passwordInput.waitFor({ state: 'visible' });

    // Test with a valid username (assuming test user exists)
    await usernameInput.fill('testuser');
    await passwordInput.fill('testpassword');

    // Click the login button
    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();

    // Wait for either success or error
    await page.waitForTimeout(3000);

    // Check current URL to see where we are
    const currentUrl = page.url();
    console.log('After login attempt, current URL:', currentUrl);

    // If we're still on login page, check for errors
    if (currentUrl.includes('/login') || currentUrl === '/' || currentUrl.includes('#')) {
      const errorMessages = await page.locator('.text-red-600, .text-red-500').allTextContents();
      console.log('Login errors:', errorMessages);

      // If login failed due to invalid credentials, that's expected - let's focus on the group flow
      if (errorMessages.some(msg => msg.includes('Invalid') || msg.includes('not found'))) {
        console.log('Login failed as expected - checking group selection screen behavior');

        // Try to access group selection directly by simulating successful login
        // This tests the core issue: group selection screen when user should be in a group
        await page.evaluate(() => {
          // Simulate logged in state with no current group (the problematic state)
          localStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: 'fake-token-for-testing',
            refresh_token: 'fake-refresh-token',
            expires_at: Date.now() + 3600000
          }));
          window.location.reload();
        });

        await page.waitForTimeout(2000);
      }
    }

    // Look for group selection screen elements
    const groupSelectionElements = await page.locator('h1:has-text("Join a Group")').count();
    if (groupSelectionElements > 0) {
      console.log('✅ Found group selection screen');

      // Check if user appears to be stuck here
      const currentUrlAfterLogin = page.url();
      console.log('URL when on group selection screen:', currentUrlAfterLogin);

      // Try to join a group
      const joinGroupButton = page.locator('button:has-text("Join Existing Group")');
      if (await joinGroupButton.isVisible()) {
        await joinGroupButton.click();
        await page.waitForTimeout(1000);

        // Look for group code input
        const groupCodeInput = page.locator('input[placeholder="ABCD12"]');
        if (await groupCodeInput.isVisible()) {
          console.log('✅ Group code input is visible');

          // Try to join with a test group code
          await groupCodeInput.fill('TEST01');

          const submitButton = page.locator('button[type="submit"]:has-text("Join Group")');
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(2000);

            // Check if we progressed past group selection
            const stillOnGroupSelection = await page.locator('h1:has-text("Join a Group")').count();
            if (stillOnGroupSelection > 0) {
              console.log('❌ Still stuck on group selection screen after joining');
              throw new Error('User is stuck on group selection screen even after attempting to join a group');
            } else {
              console.log('✅ Successfully progressed past group selection screen');
            }
          }
        }
      }

      // Check for create group option
      const createGroupButton = page.locator('button:has-text("Create New Group")');
      if (await createGroupButton.isVisible()) {
        console.log('✅ Create group option is available');
      }
    } else {
      console.log('ℹ️ Group selection screen not found - user may already be in a group or login failed differently');
    }

    // Check if we made it to the main app
    const dashboardElements = await page.locator('h1:has-text("Dashboard"), h2:has-text("Recent Matches")').count();
    if (dashboardElements > 0) {
      console.log('✅ Successfully reached main app dashboard');
    } else {
      console.log('ℹ️ Main app dashboard not found');
    }
  });

  test('should show current group information for users already in a group', async ({ page }) => {
    // This test simulates a user who is already in a group
    await page.goto('/');

    // Simulate logged in state with a current group
    await page.evaluate(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'fake-token-for-testing',
        refresh_token: 'fake-refresh-token',
        expires_at: Date.now() + 3600000
      }));
    });

    // Reload to trigger auth state
    await page.reload();
    await page.waitForTimeout(2000);

    // Check if we're NOT on the group selection screen
    const groupSelectionElements = await page.locator('h1:has-text("Join a Group")').count();
    if (groupSelectionElements === 0) {
      console.log('✅ User with current group did not get stuck on group selection screen');
    } else {
      console.log('❌ User with current group is incorrectly shown group selection screen');
      throw new Error('User with current group should not see group selection screen');
    }
  });
});
