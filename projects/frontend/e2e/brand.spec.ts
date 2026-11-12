import { expect, test } from '@playwright/test';

const BASE = 'http://127.0.0.1:4201';

test('header muestra el logo maestro y sirve los iconos de marca', async ({ page }) => {
  const responses: Record<string, number> = {};
  page.on('response', (response) => {
    const url = response.url();
    if (
      url.includes('/brand/falconsync-logo.png') ||
      url.includes('/favicon.ico') ||
      url.includes('/favicon-32.png') ||
      url.includes('/apple-touch-icon.png')
    ) {
      responses[url] = response.status();
    }
  });

  await page.goto('/');

  const logo = page.locator('.brand__mark');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('alt', '');
  await expect(logo).toHaveAttribute('src', /brand\/falconsync-logo\.png/);
  await expect(logo).toHaveAttribute('width', '48');
  await expect(logo).toHaveAttribute('height', '48');

  const naturalWidth = await logo.evaluate((img) => (img as HTMLImageElement).naturalWidth);
  expect(naturalWidth).toBeGreaterThan(0);

  const box = await logo.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeCloseTo(48, 0);
  expect(box!.height).toBeCloseTo(48, 0);

  // No debe quedar la letra F como marca textual en el encabezado.
  await expect(page.locator('.brand__mark span')).toHaveCount(0);

  const logoRes = await page.request.fetch(`${BASE}/brand/falconsync-logo.png`);
  expect(logoRes.status()).toBe(200);
  const faviconRes = await page.request.fetch(`${BASE}/favicon.ico`);
  expect(faviconRes.status()).toBe(200);
  const favicon32Res = await page.request.fetch(`${BASE}/favicon-32.png`);
  expect(favicon32Res.status()).toBe(200);
  const appleRes = await page.request.fetch(`${BASE}/apple-touch-icon.png`);
  expect(appleRes.status()).toBe(200);

  await page.screenshot({
    path: 'test-results/brand-header-desktop.png',
    fullPage: false,
  });
});

test('header sin overflow horizontal en móvil a 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  const logo = page.locator('.brand__mark');
  await expect(logo).toBeVisible();

  await page.screenshot({
    path: 'test-results/brand-header-mobile.png',
    fullPage: false,
  });
});
