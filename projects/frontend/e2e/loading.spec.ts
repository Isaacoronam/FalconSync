import { expect, test } from '@playwright/test';

test('muestra el skeleton de arranque mientras se resuelve la sesión', async ({ page }) => {
  let releaseRefresh: () => void = () => undefined;
  const heldRefresh = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });

  await page.route('**/api/auth/refresh', async (route) => {
    await heldRefresh;
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'NO_SESSION', message: 'Sin sesión activa' },
      }),
    });
  });

  await page.goto('/');

  const boot = page.locator('.boot-skeleton');
  await expect(boot).toBeVisible();
  await expect(boot).toContainText('Cargando FalconSync');

  releaseRefresh();
  await expect(boot).not.toBeVisible({ timeout: 15_000 });

  await expect(page.locator('.site-header')).toBeVisible();
});

test('muestra el skeleton de la vista y luego el contenido real', async ({ page }) => {
  await page.route('**/api/locations**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });

  await page.goto('/lugares');

  const skeleton = page.locator('app-page-skeleton');
  await expect(skeleton).toBeVisible();
  await expect(skeleton.locator('[role="status"]')).toContainText('Cargando lugares');
  await expect(skeleton.locator('.sk-visual')).toHaveAttribute('aria-hidden', 'true');

  await expect(page.locator('.lugar-card').first()).toBeVisible({ timeout: 15_000 });
  await expect(skeleton).not.toBeVisible();
});
