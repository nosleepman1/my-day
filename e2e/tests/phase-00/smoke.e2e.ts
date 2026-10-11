import { expect, test } from '@playwright/test';

test.describe('PHASE-00 smoke', () => {
  test('the home page reaches the API through the same-origin proxy', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'ORBIT' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('API OK');
  });
});
