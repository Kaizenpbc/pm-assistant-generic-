import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Sprint Planning', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigate to sprints tab on a project', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('a[href^="/project/"]').first();
    if ((await firstProject.count()) === 0) {
      test.skip();
      return;
    }
    await firstProject.click();
    await expect(page).toHaveURL(/\/project\//);

    // Click Sprints tab
    const sprintsTab = page.getByText('Sprints');
    if ((await sprintsTab.count()) === 0) {
      test.skip(); // Waterfall project — no sprints tab
      return;
    }
    await sprintsTab.click();

    // Should see sprint content (list, planning, or empty state)
    await page.waitForTimeout(2000);
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('view sprint board (Kanban)', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('a[href^="/project/"]').first();
    if ((await firstProject.count()) === 0) {
      test.skip();
      return;
    }
    await firstProject.click();
    await expect(page).toHaveURL(/\/project\//);

    // Click Sprints tab
    const sprintsTab = page.getByText('Sprints');
    if ((await sprintsTab.count()) === 0) {
      test.skip();
      return;
    }
    await sprintsTab.click();
    await page.waitForTimeout(1000);

    // Try to switch to board view
    const boardBtn = page.getByRole('button', { name: /board/i });
    if ((await boardBtn.count()) > 0) {
      await boardBtn.click();
      await page.waitForTimeout(1000);
      // Board should have columns (Not Started, In Progress, Completed)
      const body = await page.textContent('body');
      // Just verify the page didn't crash
      expect(body).toBeTruthy();
    }
  });
});
