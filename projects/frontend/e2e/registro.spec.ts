import { expect, test } from '@playwright/test';

test('valida nombre y apellido y crea la cuenta con nombre completo', async ({ page }) => {
  const email = `registro-${Date.now()}@example.com`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/registro');

  await expect(page.locator('#register-name')).toBeVisible();
  await expect(page.locator('#register-surname')).toBeVisible();
  await page.screenshot({ path: 'test-results/registro-desktop.png' });

  await page.locator('#register-name').fill('Ana2');
  await page.locator('#register-surname').fill('Pérez');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill('Registro12345');
  await page.locator('#register-confirm-password').fill('Registro12345');

  await expect(page.locator('.password-checks__item--ok')).toHaveCount(3);
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
  await expect(page.locator('#register-password')).toHaveAttribute('type', 'text');

  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.locator('#register-name-error')).toContainText('solo puede contener letras');

  await page.locator('#register-name').fill('María José');
  await page.locator('#register-surname').fill("O'Brien-Pérez");
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.site-nav__user')).toContainText("María José O'Brien-Pérez");
});

test('el registro se apila en móvil sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/registro');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const nameBox = await page.locator('#register-name').boundingBox();
  const surnameBox = await page.locator('#register-surname').boundingBox();
  expect(nameBox).not.toBeNull();
  expect(surnameBox).not.toBeNull();
  expect(surnameBox!.y).toBeGreaterThan(nameBox!.y + nameBox!.height - 1);

  await page.screenshot({ path: 'test-results/registro-mobile.png' });
});
