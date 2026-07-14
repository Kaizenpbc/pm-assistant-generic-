import { test, expect } from '@playwright/test';
import { login, uniqueName } from './helpers';

test.describe('Project CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigate to projects page', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/projects/);
    // Should see the "New Project" button
    await expect(page.getByRole('button', { name: /New Project/i })).toBeVisible();
  });

  test('create a blank project from scratch', async ({ page }) => {
    const projectName = uniqueName('E2E Test Project');

    await page.goto('/projects');
    await page.getByRole('button', { name: /New Project/i }).click();

    // Template picker modal should open — step: category
    await expect(page.getByText('New Project')).toBeVisible();

    // Click "Start from Scratch" (blank project option)
    await page.getByText(/Start from Scratch|Blank Project/i).click();

    // Fill in the project form
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.clear();
    await nameInput.fill(projectName);

    // Submit the form
    await page.getByRole('button', { name: /Create Project/i }).click();

    // Should navigate to the new project detail page
    await expect(page).toHaveURL(/\/project\//, { timeout: 15_000 });

    // Project name should be visible on the detail page
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10_000 });
  });

  test('view project detail page with tabs', async ({ page }) => {
    // Navigate to projects and click the first one
    await page.goto('/projects');
    const firstProject = page.locator('a[href^="/project/"]').first();
    // If there are no projects, skip
    const count = await firstProject.count();
    if (count === 0) {
      test.skip();
      return;
    }
    await firstProject.click();
    await expect(page).toHaveURL(/\/project\//);

    // Should have tabs (Overview, Schedule, etc.)
    await expect(page.getByText('Overview')).toBeVisible({ timeout: 10_000 });
  });
});
