import { expect, test } from '@playwright/test';

const BASE = 'http://127.0.0.1:4201';

test('identidad de escritorio: fondo, marca y sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();

  const background = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    return shell ? getComputedStyle(shell, '::before').backgroundImage : '';
  });
  expect(background).toContain('fondo-medanos.webp');

  const logo = page.locator('.brand__mark');
  await expect(logo).toBeVisible();
  const naturalWidth = await logo.evaluate((image) => (image as HTMLImageElement).naturalWidth);
  expect(naturalWidth).toBeGreaterThan(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({ path: 'test-results/identidad-home-desktop.png', fullPage: false });
});

test('identidad móvil: el fondo no produce scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('.brand__mark')).toBeVisible();
  await page.screenshot({ path: 'test-results/identidad-home-mobile.png', fullPage: false });
});

test('Chivito aparece en la guía con avatar y saludo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/guia');

  await expect(page.locator('.chat__avatar')).toBeVisible();
  await expect(page.locator('.chat__top')).toContainText('Chivito');
  await expect(page.locator('.chat__top')).toContainText('Guía turístico de FalconSync');
  await expect(page.locator('.chat-welcome')).toContainText('¡Epa! Soy Chivito');
  await page.screenshot({ path: 'test-results/identidad-chat-desktop.png', fullPage: false });
});

test('Chivito y el login se adaptan a móvil sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/guia');

  await expect(page.locator('.chat__avatar')).toBeVisible();
  const chatOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(chatOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/identidad-chat-mobile.png', fullPage: false });

  await page.goto('/login');
  await expect(page.locator('.auth-brand__logo')).toBeVisible();
  const loginOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(loginOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/identidad-login-mobile.png', fullPage: false });
});

test('la autenticación muestra el logo completo', async ({ page }) => {
  await page.goto('/login');

  const brand = page.locator('.auth-brand__logo');
  await expect(brand).toBeVisible();
  await expect(brand).toHaveAttribute('src', /brand\/falconsync-logo-128\.png/);
  const naturalWidth = await brand.evaluate((image) => (image as HTMLImageElement).naturalWidth);
  expect(naturalWidth).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/identidad-login.png', fullPage: false });
});

test('los recursos de identidad responden 200', async ({ page }) => {
  for (const asset of [
    '/brand/falconsync-logo.png',
    '/brand/falconsync-logo-128.png',
    '/brand/falconsync-mark-96.png',
    '/brand/chivito-avatar.png',
    '/brand/chivito-welcome.webp',
    '/images/badges/religious.svg',
    '/images/fondo-medanos.webp',
  ]) {
    const response = await page.request.get(`${BASE}${asset}`);
    expect(response.status(), asset).toBe(200);
  }
});
