import { Page, expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'AdminE2E12345';
const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('crea, publica, archiva y restaura un POI con imagen', async ({ page }) => {
  const title = `POI E2E ${Date.now()}`;

  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Puntos de interés' }).click();
  await expect(page).toHaveURL(/\/admin\/poi$/);
  await expect(page.locator('#poi-title')).toContainText('Puntos de interés');

  await page.getByRole('link', { name: 'Nuevo POI' }).click();
  await expect(page).toHaveURL(/\/admin\/poi\/nuevo$/);

  await page.locator('#poi-title-field').fill(title);
  await page.locator('#poi-category-field').selectOption('architecture');
  await page
    .locator('#poi-description-field')
    .fill('Punto de interés creado por la suite E2E para validar el flujo administrativo completo.');
  await page.locator('#poi-period-field').fill('Época contemporánea');
  await page.getByRole('button', { name: 'Crear POI' }).click();

  await expect(page).toHaveURL(/\/admin\/poi\/[a-f0-9]+\/editar\?creado=1$/);
  await expect(page.locator('#poi-form-title')).toContainText('Editar punto de interés');
  await expect(page.locator('.form-success')).toContainText('POI creado');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'pixel-e2e.png',
    mimeType: 'image/png',
    buffer: PNG_PIXEL,
  });

  await expect(page.locator('.admin-image-card')).toHaveCount(1);
  await expect(page.locator('.admin-image-card img')).toBeVisible();

  await page.locator('#poi-status-field').selectOption('published');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('.form-success')).toContainText('Cambios guardados');

  await page.getByRole('link', { name: 'Volver al mapa' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.location-card', { hasText: title })).toBeVisible();

  await page.goto('/admin/poi');
  await page.locator('#poi-search').fill(title);
  await page.getByRole('button', { name: 'Filtrar' }).click();

  const row = page.locator('.admin-table tbody tr', { hasText: title });
  await expect(row).toHaveCount(1);
  await expect(row.locator('.admin-badge')).toContainText('Publicado');

  await row.getByRole('button', { name: `Archivar ${title}` }).click();
  await row.getByRole('button', { name: 'Sí, archivar' }).click();

  await expect(page.locator('.form-success')).toContainText('se archivó');
  await expect(row.locator('.admin-badge')).toContainText('Archivado');

  await page.goto('/');
  await expect(page.locator('.location-card', { hasText: title })).toHaveCount(0);

  await page.goto('/admin/poi');
  await page.locator('#poi-search').fill(title);
  await page.getByRole('button', { name: 'Filtrar' }).click();

  const archivedRow = page.locator('.admin-table tbody tr', { hasText: title });
  await archivedRow.getByRole('button', { name: `Restaurar ${title}` }).click();

  await expect(page.locator('.form-success')).toContainText('se restauró como borrador');
  await expect(archivedRow.locator('.admin-badge')).toContainText('Borrador');
});
