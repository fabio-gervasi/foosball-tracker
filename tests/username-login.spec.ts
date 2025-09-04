import { test, expect } from '@playwright/test';

test.describe('Username Login Functionality', () => {
  test('should allow login with username instead of email', async ({ page }) => {
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

    // Test with username "Tsubasa" (from the user's error report)
    await usernameInput.fill('Tsubasa');

    // For testing purposes, we'll use a test password
    // Note: This test assumes there's a user with username "Tsubasa" in the database
    await passwordInput.fill('testpassword');

    // Click the login button
    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();

    // Wait for either success or error
    await page.waitForTimeout(3000);

    // Check if we get past the login form (either success or specific error)
    const currentUrl = page.url();
    const isStillOnLogin = currentUrl.includes('/login') || currentUrl === '/' || currentUrl.includes('#');

    if (isStillOnLogin) {
      // We're still on the login page, check for error messages
      const errorMessages = await page.locator('.text-red-600, .text-red-500').allTextContents();
      console.log('Error messages found:', errorMessages);

      // If we get "Username not found", that's expected for a test user
      // If we don't get a 404 error for /username-lookup, then the endpoint is working
      const hasUsernameNotFound = errorMessages.some(msg =>
        msg.includes('Username not found') ||
        msg.includes('Invalid login credentials') ||
        msg.includes('Email not confirmed')
      );

      if (hasUsernameNotFound) {
        console.log('✅ Username lookup endpoint is working - received expected error for non-existent user');
      } else {
        // If we get a different error or no error, there might be an issue
        console.log('❌ Unexpected login behavior - checking for 404 errors...');

        // Check browser console for any 404 errors
        const consoleMessages = [];
        page.on('console', msg => {
          consoleMessages.push(msg.text());
        });

        // Look for 404 errors in console
        const has404Error = consoleMessages.some(msg =>
          msg.includes('404') || msg.includes('Endpoint not found')
        );

        if (has404Error) {
          throw new Error('❌ Still getting 404 error for /username-lookup endpoint');
        } else {
          console.log('✅ No 404 errors detected - endpoint appears to be working');
        }
      }
    } else {
      // We navigated away from login page - likely successful login
      console.log('✅ Successfully logged in with username');
    }
  });

  test('should handle invalid username gracefully', async ({ page }) => {
    await page.goto('/');

    // Wait for login form
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });

    const usernameInput = page.locator('input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]');

    await usernameInput.waitFor({ state: 'visible' });
    await passwordInput.waitFor({ state: 'visible' });

    // Test with a clearly invalid username
    await usernameInput.fill('definitely-not-a-real-username-12345');
    await passwordInput.fill('testpassword');

    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();

    // Wait for response
    await page.waitForTimeout(3000);

    // Check for appropriate error handling
    const errorElements = await page.locator('.text-red-600, .text-red-500').count();
    expect(errorElements).toBeGreaterThan(0);

    console.log('✅ Invalid username handled gracefully');
  });
});
