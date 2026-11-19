import { Page, expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'AdminE2E12345';
const USER_PASSWORD = 'UsuarioE2E123';

async function login(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('cambia rol, estado y revoca sesiones de una cuenta', async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const email = `cuenta-${stamp}@example.com`;
  const name = `Cuenta E2E ${stamp}`;

  const registered = await request.post('/api/auth/register', {
    data: { name, email, password: USER_PASSWORD },
  });

  expect(registered.ok()).toBeTruthy();

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await page.getByRole('link', { name: 'Usuarios', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/usuarios$/);

  await page.locator('#users-search').fill(email);
  await page.getByRole('button', { name: 'Buscar' }).click();

  const row = page.locator('.admin-table tbody tr', { hasText: email });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Turista');

  await row.getByRole('button', { name: `Cambiar rol de ${name}` }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#account-role').selectOption('historian');
  await dialog.locator('#account-password').fill(ADMIN_PASSWORD);
  await dialog.getByRole('button', { name: 'Guardar rol' }).click();

  await expect(page.locator('.form-success')).toContainText('Rol');
  await expect(row).toContainText('Historiador');

  await row.getByRole('button', { name: `Desactivar a ${name}` }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('#account-password').fill(ADMIN_PASSWORD);
  await dialog.getByRole('button', { name: 'Desactivar cuenta' }).click();

  await expect(page.locator('.form-success')).toContainText('desactivada');
  await expect(row.locator('.admin-badge')).toContainText('Desactivado');

  await row.getByRole('button', { name: `Activar a ${name}` }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('#account-password').fill(ADMIN_PASSWORD);
  await dialog.getByRole('button', { name: 'Activar cuenta' }).click();

  await expect(page.locator('.form-success')).toContainText('activada');
  await expect(row.locator('.admin-badge')).toContainText('Activo');

  await row
    .getByRole('button', { name: `Revocar sesiones de ${name}` })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.locator('#account-password').fill(ADMIN_PASSWORD);
  await dialog.getByRole('button', { name: 'Revocar sesiones' }).click();

  await expect(page.locator('.form-success')).toContainText('Sesiones');
});
