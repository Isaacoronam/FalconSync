import { expect, test } from '@playwright/test';

test('la barra mantiene la estructura, el estado activo y el sticky', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const header = page.locator('.site-header');
  await expect(header).toBeVisible();
  await expect(header).toHaveCSS('position', 'static');
  await expect(page.locator('app-site-header')).toHaveCSS('position', 'sticky');
  await expect(page.locator('.brand__name')).toHaveText('FALCONSYNC');

  const coroMap = page.getByRole('link', { name: 'CoroMap', exact: true });
  await expect(coroMap).toHaveAttribute('aria-current', 'page');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.evaluate(() => window.scrollTo(0, 800));
  await expect(page.locator('.site-header-shell')).toHaveClass(/site-header-shell--scrolled/);

  // El sticky se comprueba por comportamiento: la barra sigue dentro del
  // viewport tras desplazarse y sus enlaces siguen siendo clicables.
  const box = await header.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(40);

  await page.getByRole('link', { name: 'Explorar lugares', exact: true }).click();
  await expect(page).toHaveURL(/\/lugares$/);
  await expect(header).toBeVisible();
});

test('el menú móvil atrapa el foco, navega y se cierra con Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const burger = page.locator('.site-nav__burger');
  await expect(burger).toBeVisible();
  await expect(burger).toHaveAccessibleName('Abrir menú de navegación');
  await burger.click();

  const dialog = page.getByRole('dialog', { name: 'Navegación principal' });
  await expect(dialog).toBeVisible();
  await expect(burger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.screenshot({ path: 'test-results/navigation-mobile-menu.png' });

  await dialog.getByRole('link', { name: 'Explorar lugares', exact: true }).click();
  await expect(page).toHaveURL(/\/lugares$/);
  await expect(dialog).not.toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.locator('.site-nav__burger').click();
  await expect(page.getByRole('dialog', { name: 'Navegación principal' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Navegación principal' })).not.toBeVisible();
  await expect(page.locator('.site-nav__burger')).toBeFocused();
  await expect(page.locator('.site-nav__burger')).toHaveAccessibleName('Abrir menú de navegación');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('la barra no desborda en tablet y cambia a menú móvil', async ({ page }) => {
  for (const width of [1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.brand__mark')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `overflow a ${width}px`).toBeLessThanOrEqual(1);

    if (width > 960) {
      await expect(page.getByRole('link', { name: 'Explorar lugares', exact: true })).toBeVisible();
      await expect(page.locator('.site-nav__burger')).toBeHidden();
    } else {
      await expect(page.locator('.site-nav__burger')).toBeVisible();
    }

    await page.screenshot({ path: `test-results/navigation-${width}.png` });
  }
});

test('el menú de cuenta muestra el perfil y las áreas por rol', async ({ page, request }) => {
  const email = `navegacion-${Date.now()}@example.com`;

  const registered = await request.post('/api/auth/register', {
    data: {
      name: 'Navegante',
      surname: 'Local',
      email,
      password: 'Navegacion123',
    },
  });
  expect(registered.ok()).toBeTruthy();

  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill('Navegacion123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/$/);

  const account = page.locator('.site-nav__user');
  await expect(account).toContainText('Navegante Local');
  await account.click();
  await expect(page.locator('#account-menu')).toContainText('Mi perfil');
  await expect(page.locator('#account-menu')).toContainText('Cambiar contraseña');

  await page.keyboard.press('Escape');
  await expect(account).toBeFocused();

  const areas = page.getByRole('button', { name: 'Áreas' });
  await areas.click();
  await expect(page.locator('#areas-menu')).toContainText('Reportes');
  await page.keyboard.press('Escape');
  await expect(page.locator('#areas-menu')).not.toBeVisible();
  await expect(areas).toBeFocused();
});
