import sharp from 'sharp';
import { Page, expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'AdminE2E12345';
const HISTORIAN_EMAIL = 'historian@e2e.local';
const HISTORIAN_PASSWORD = 'HistorianE2E123';

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
}

async function buildEquirectangularImage(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2048,
      height: 1024,
      channels: 3,
      background: { r: 84, g: 116, b: 138 },
    },
  })
    .jpeg({ quality: 82 })
    .toBuffer();
}

test.describe('visita 360°', () => {
  test.setTimeout(180_000);

  test('crea, aprueba, publica y muestra el panorama en galería y ficha del POI', async ({
    page,
  }) => {
    const stamp = Date.now();
    const title = `Plaza 360 E2E ${stamp}`;
    const description = `Vista equirectangular de prueba generada para E2E ${stamp}.`;

    // Administración prepara la ficha técnica y la imagen privada.
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/admin/panoramas');
    await expect(page.getByRole('heading', { name: 'Panoramas 360°' })).toBeVisible();
    await page.getByRole('link', { name: 'Nuevo panorama' }).click();
    await expect(page).toHaveURL(/\/admin\/panoramas\/nuevo$/);

    await page.locator('#panorama-title-field').fill(title);
    await page.locator('#panorama-description-field').fill(description);
    await page.locator('#panorama-location-field').selectOption({ label: 'Catedral de Coro' });
    await page.locator('#panorama-author-field').fill('Equipo E2E');
    await page.locator('#panorama-license-field').fill('CC BY-SA 4.0');
    await page
      .locator('#panorama-license-url-field')
      .fill('https://creativecommons.org/licenses/by-sa/4.0/');
    await page.locator('#panorama-credit-field').fill('Equipo E2E · CC BY-SA 4.0');
    await page.getByLabel('Derechos documentados').check();
    await page.getByLabel('Permiso de captura o publicación documentado').check();
    await page.getByLabel('Personas identificables difuminadas').check();
    await page.locator('#panorama-fallback-alt-field').fill('Vista panorámica de la plaza');
    await page
      .locator('#panorama-fallback-description-field')
      .fill('Escena de prueba con una plaza y edificios coloniales.');
    await page.locator('#panorama-image-field').setInputFiles({
      name: 'panorama-e2e.jpg',
      mimeType: 'image/jpeg',
      buffer: await buildEquirectangularImage(),
    });

    await page.getByRole('button', { name: 'Crear panorama' }).click();
    await expect(page).toHaveURL(/\/admin\/panoramas\/[a-f0-9]{24}/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.locator('.admin-badge', { hasText: 'Borrador' })).toBeVisible();

    // El historiador revisa, aprueba y publica la visita turística.
    await logout(page);
    await login(page, HISTORIAN_EMAIL, HISTORIAN_PASSWORD);
    await page.getByRole('link', { name: 'Curaduría 360°' }).click();
    await expect(page).toHaveURL(/\/curaduria\/panoramas$/);

    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: 'Revisar' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Aprobar panorama' }).click();
    await expect(page.getByText('Panorama aprobado.')).toBeVisible();

    await page.getByRole('button', { name: 'Publicar en la visita 360°' }).click();
    await expect(page.getByText('Panorama publicado.')).toBeVisible();
    await expect(page.locator('.admin-badge', { hasText: 'Publicado' })).toBeVisible();

    // La galería pública y el detalle ofrecen la visita con alternativa fija.
    await logout(page);
    await page.goto('/panoramas');
    await expect(page.getByRole('heading', { name: 'Panoramas del patrimonio' })).toBeVisible();
    await expect(page.getByText('1 visita publicada')).toBeVisible();

    await page.getByRole('link', { name: new RegExp(title) }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.locator('.panorama-viewer__fallback')).toBeVisible();

    const webglSupported = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      return Boolean(canvas.getContext('webgl'));
    });

    if (webglSupported) {
      await page.getByRole('button', { name: 'Activar vista 360°' }).click();
      await expect(
        page.getByRole('group', { name: 'Controles de la vista 360°' }),
      ).toBeVisible();
      await page.keyboard.press('ArrowRight');
      await page.getByRole('button', { name: 'Ver imagen fija' }).click();
      await expect(page.getByRole('button', { name: 'Activar vista 360°' })).toBeVisible();
    } else {
      await expect(page.getByText('Este navegador no admite WebGL')).toBeVisible();
    }

    // La ficha del POI descubre la visita publicada.
    await page.goto('/lugares/catedral-de-coro');
    await expect(page.getByRole('heading', { name: 'Panoramas 360°' })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
  });
});
