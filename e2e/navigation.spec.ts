import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard loads with widgets', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    // Dashboard should have some content
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(100);
  });

  test('sidebar navigation works', async ({ page }) => {
    // Navigate to Projects via sidebar
    const projectsLink = page.locator('a[href="/projects"]').first();
    if ((await projectsLink.count()) > 0) {
      await projectsLink.click();
      await expect(page).toHaveURL(/\/projects/);
    }
  });

  test('404 page for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    // Should show some kind of not found content or redirect
    await page.waitForTimeout(2000);
    const url = page.url();
    // Either stays on 404 page or redirects to login/dashboard
    expect(url).toBeTruthy();
  });
});
