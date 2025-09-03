import { test, expect } from '@playwright/test';

test.describe('Admin Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Login as admin user - use username/email field (text type, not email)
    await page.fill('input[type="text"]', 'fabio.gervasi@axa.ch');
    await page.fill('input[type="password"]', '121212');
    await page.click('button[type="submit"]');

    // Wait for login to complete and navigate to admin panel
    await page.waitForURL('**/dashboard');
    await page.click('text=Admin Panel');
  });

  test('should load admin panel with user and match data', async ({ page }) => {
    // Check that we're on the admin panel
    await expect(page.locator('text=Admin Panel')).toBeVisible();

    // Check that user management tab is visible
    await expect(page.locator('text=User Management')).toBeVisible();

    // Check that match management tab is visible
    await expect(page.locator('text=Match Management')).toBeVisible();

    // Check that users are loaded (should have at least one user)
    const userCards = page.locator('.border.border-gray-200.rounded-lg.p-4');
    await expect(userCards.first()).toBeVisible();
  });

  test('should toggle admin status for a user', async ({ page }) => {
    // Find a user that's not the current admin
    const userCard = page.locator('.border.border-gray-200.rounded-lg.p-4').first();
    await expect(userCard).toBeVisible();

    // Check if user has admin badge
    const adminBadge = userCard.locator('text=Admin');
    const hasAdminBadge = await adminBadge.isVisible();

    // Click the admin toggle button
    const toggleButton = hasAdminBadge
      ? userCard.locator('text=Remove Admin')
      : userCard.locator('text=Make Admin');

    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // Wait for success message
    await expect(page.locator('text=User admin status')).toBeVisible();

    // Check that the admin badge state has changed
    if (hasAdminBadge) {
      await expect(adminBadge).not.toBeVisible();
    } else {
      await expect(userCard.locator('text=Admin')).toBeVisible();
    }
  });

  test('should delete a match', async ({ page }) => {
    // Switch to matches tab
    await page.click('text=Match Management');

    // Find a match card
    const matchCard = page.locator('.border.border-gray-200.rounded-lg.p-4').first();
    await expect(matchCard).toBeVisible();

    // Click the delete button
    const deleteButton = matchCard.locator('button[title="Delete Match"]');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Confirm deletion in dialog
    await page.click('text=Delete Match');

    // Wait for success message
    await expect(page.locator('text=Match deleted successfully')).toBeVisible();
  });

  test('should handle admin operations error cases', async ({ page }) => {
    // Try to delete the current admin user (should fail)
    const adminUserCard = page.locator('.border.border-gray-200.rounded-lg.p-4').filter({ hasText: 'Admin' }).first();

    if (await adminUserCard.isVisible()) {
      // This should not have a delete button for the current admin
      const deleteButton = adminUserCard.locator('button[title="Delete User"]');
      await expect(deleteButton).not.toBeVisible();
    }
  });
});
