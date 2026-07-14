import { Page, expect } from '@playwright/test';

/** Test credentials — must match a real user in the dev database */
export const TEST_USER = {
  username: 'admin',
  password: 'admin123',
};

/** Log in via the UI login form */
export async function login(page: Page, user = TEST_USER) {
  await page.goto('/login');
  await page.fill('#username', user.username);
  await page.fill('#password', user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

/** Generate a unique name to avoid collisions between test runs */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}
