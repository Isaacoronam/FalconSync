import { Page, expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'AdminE2E12345';
const PENDING_ADMIN_EMAIL = 'pending-admin@e2e.local';
const PENDING_ADMIN_PASSWORD = 'PendingE2E12345';

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('protege /admin, registra, conserva la sesión y cierra sesión', async ({ page }) => {
  const email = `usuario-${Date.now()}@example.com`;

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fadmin$/);
  await expect(page.locator('#login-title')).toContainText('Inicia sesión');

  await page.getByRole('link', { name: 'Crear una cuenta' }).click();
  await expect(page).toHaveURL(/\/registro$/);

  await page.locator('#register-name').fill('Usuario E2E');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill('UsuarioE2E123');
  await page.locator('#register-confirm-password').fill('UsuarioE2E123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.site-nav__user')).toContainText('Usuario E2E');
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.site-nav__user')).toContainText('Usuario E2E');

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/acceso-denegado$/);
  await expect(page.locator('#forbidden-title')).toContainText('Acceso denegado');

  await page.goto('/');
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();

  await login(page, email, 'UsuarioE2E123');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.site-nav__user')).toContainText('Usuario E2E');
});

test('rechaza credenciales inválidas con un mensaje accesible', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-email').fill('nadie@example.com');
  await page.locator('#login-password').fill('Incorrecta123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.locator('.form-error')).toContainText('Correo o contraseña incorrectos');
  await expect(page).toHaveURL(/\/login$/);
});

test('un administrador accede al panel y ve métricas', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('link', { name: 'Admin', exact: true }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('#admin-title')).toContainText('Panel de control');
  await expect(page.locator('.admin-card')).toHaveCount(4);
  await expect(page.locator('.admin-card').first()).toContainText('Visitantes únicos');
  await expect(page.locator('.admin-card').last()).toContainText('Usuarios registrados');
});

test.describe('cambio obligatorio del admin inicial', () => {
  test.describe.configure({ retries: 0 });

  test('redirige a cambiar contraseña y desbloquea el panel', async ({ page }) => {
    await login(page, PENDING_ADMIN_EMAIL, PENDING_ADMIN_PASSWORD);

    await expect(page).toHaveURL(/\/cambiar-contrasena$/);
    await expect(page.locator('#change-password-title')).toContainText('Cambia tu contraseña');
    await expect(page.locator('.auth-card__lead')).toContainText(
      'El administrador inicial debe cambiar la contraseña',
    );

    await page.locator('#current-password').fill(PENDING_ADMIN_PASSWORD);
    await page.locator('#new-password').fill('PendingNueva456');
    await page.locator('#confirm-new-password').fill('PendingNueva456');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.locator('.form-success')).toContainText('Contraseña actualizada');
    await page.getByRole('link', { name: 'Continuar' }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('#admin-title')).toContainText('Panel de control');
  });
});
