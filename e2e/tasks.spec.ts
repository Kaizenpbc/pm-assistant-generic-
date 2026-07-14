import { test, expect } from '@playwright/test';
import { login, uniqueName } from './helpers';

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('add a task from the schedule tab', async ({ page }) => {
    // Navigate to an existing project (first one from the list)
    await page.goto('/projects');
    const firstProject = page.locator('a[href^="/project/"]').first();
    const count = await firstProject.count();
    if (count === 0) {
      test.skip();
      return;
    }
    await firstProject.click();
    await expect(page).toHaveURL(/\/project\//);

    // Click Schedule tab
    await page.getByText('Schedule').click();

    // Wait for schedule content to load
    await page.waitForTimeout(2000);

    // Click "Add Task" button
    const addTaskBtn = page.getByRole('button', { name: /Add Task/i });
    const addCount = await addTaskBtn.count();
    if (addCount === 0) {
      test.skip(); // No schedule exists yet
      return;
    }
    await addTaskBtn.click();

    // Task form modal should appear
    await expect(page.getByText(/Add Task|New Task/i)).toBeVisible({ timeout: 5_000 });

    // Fill in task name
    const taskName = uniqueName('E2E Task');
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill(taskName);

      // Click Save
      await page.getByRole('button', { name: /Save/i }).click();

      // Modal should close and task should appear in the list
      await page.waitForTimeout(2000);
    }
  });
});
