import { APIRequestContext, expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'AdminE2E12345';
const EXPLORER_PASSWORD = 'PerfilE2E12345';
const BACKEND_URL = 'http://127.0.0.1:3101';

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

type LocationApi = {
  id: string;
  slug: string;
  title: string;
  location: { type: string; coordinates: [number, number] };
};

test.use({ permissions: ['geolocation'] });

async function crearUsuario(request: APIRequestContext): Promise<{
  email: string;
  password: string;
  name: string;
}> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `perfil-${suffix}@e2e.local`,
    password: EXPLORER_PASSWORD,
    name: `Explorador Perfil ${suffix.slice(-4)}`,
  };
}

async function registrarUsuario(
  request: APIRequestContext,
  usuario: { email: string; password: string; name: string },
): Promise<void> {
  const registro = await request.post(`${BACKEND_URL}/api/auth/register`, {
    data: usuario,
  });
  expect(registro.ok(), 'registrar usuario E2E').toBeTruthy();
}

async function iniciarSesion(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function tokenQrDeCatedral(
  request: APIRequestContext,
): Promise<{ id: string; token: string; latitude: number; longitude: number }> {
  const loginAdmin = await request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(loginAdmin.ok(), 'login admin').toBeTruthy();
  const adminToken = (await loginAdmin.json()).data.accessToken;

  const locations = (
    await (await request.get(`${BACKEND_URL}/api/locations`)).json()
  ).data as LocationApi[];
  const catedral = locations.find(
    (location) => location.slug === 'catedral-de-coro',
  );
  expect(catedral).toBeDefined();

  const rotacion = await request.post(
    `${BACKEND_URL}/api/admin/locations/${catedral!.id}/qr/rotate?format=svg`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  expect(rotacion.ok(), 'rotar QR de la catedral').toBeTruthy();

  return {
    id: catedral!.id,
    token: (await rotacion.json()).data.token,
    latitude: catedral!.location.coordinates[1],
    longitude: catedral!.location.coordinates[0],
  };
}

async function abrirCheckIn(
  page: import('@playwright/test').Page,
  ubicacion: { id: string; token: string; latitude: number; longitude: number },
): Promise<void> {
  await page.context().setGeolocation({
    latitude: ubicacion.latitude,
    longitude: ubicacion.longitude,
    accuracy: 10,
  });

  await page.goto('/checkin');
  await page.locator('#escaner-contenido').fill(
    JSON.stringify({
      type: 'falconsync-check-in',
      locationId: ubicacion.id,
      token: ubicacion.token,
    }),
  );
  await page.getByRole('button', { name: 'Abrir check-in' }).click();

  await expect(page).toHaveURL(new RegExp(`/checkin/${ubicacion.id}$`));
  await expect(page.locator('.checkin__token')).toContainText('QR verificado');
}

test('perfil privado: edita datos, sube avatar, registra check-in con foto e insignia', async ({
  page,
  request,
}) => {
  const usuario = await crearUsuario(request);
  await registrarUsuario(request, usuario);
  await iniciarSesion(page, usuario.email, usuario.password);

  await page.goto('/perfil');
  await expect(page.locator('h1')).toContainText(usuario.name);
  await expect(page.locator('.perfil__eyebrow')).toContainText('Perfil privado');
  await expect(page.locator('.perfil__email')).toContainText(usuario.email);
  await expect(page.locator('.perfil__usuario')).toContainText('@');
  await expect(page.locator('.perfil__chivito')).toContainText('Chivito');

  await page.locator('#perfil-nombre').fill('Cronista E2E');
  await page.locator('#perfil-usuario').fill('cronista.e2e');
  await page
    .locator('#perfil-bio')
    .fill('Recorro el casco histórico de Coro y registro cada visita.');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(page.locator('.form-message--success')).toContainText(
    'Perfil actualizado.',
  );
  await expect(page.locator('h1')).toContainText('Cronista E2E');
  await expect(page.locator('.perfil__usuario')).toContainText('@cronista.e2e');
  await expect(page.locator('.site-nav__user')).toContainText('Cronista E2E');

  await page.locator('#perfil-avatar').setInputFiles({
    name: 'avatar-e2e.png',
    mimeType: 'image/png',
    buffer: PNG_PIXEL,
  });
  await expect(page.locator('.form-message--success')).toContainText(
    'Avatar actualizado.',
  );
  await expect(page.locator('.perfil__avatar img')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Quitar avatar' }),
  ).toBeVisible();

  const catedral = await tokenQrDeCatedral(request);
  await abrirCheckIn(page, catedral);

  await page.locator('#checkin-foto').setInputFiles({
    name: 'visita-e2e.png',
    mimeType: 'image/png',
    buffer: PNG_PIXEL,
  });
  await expect(page.locator('.checkin__foto-preview img')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar check-in' }).click();

  await expect(page.locator('.checkin-exito')).toBeVisible();
  await expect(page.locator('.form-message--success').first()).toContainText(
    'Visita confirmada',
  );
  await expect(
    page.locator('.checkin-logro').filter({ hasText: 'Catedral de Coro' }),
  ).toBeVisible();
  await expect(page.locator('.checkin-foto-gestion__estado--ok')).toContainText(
    'Foto guardada',
  );
  await expect(page.locator('.checkin-exito__foto')).toBeVisible();

  await page.goto('/perfil');

  const visita = page
    .locator('.perfil__visita')
    .filter({ hasText: 'Catedral de Coro' });
  await expect(visita).toBeVisible();
  await expect(visita.locator('.perfil__foto-boton img')).toBeVisible();
  await expect(
    page.locator('.perfil__insignia').filter({ hasText: 'Catedral de Coro' }),
  ).toBeVisible();
  await expect(
    page.locator('.perfil__stat').filter({ hasText: 'Check-in' }),
  ).toContainText('1');
  await expect(
    page.locator('.perfil__stat').filter({ hasText: 'Insignias' }),
  ).toContainText('1');

  await visita.locator('.perfil__foto-boton').click();
  const visor = page.getByRole('dialog');
  await expect(visor).toBeVisible();
  await expect(visor).toContainText('Foto 1 de 1');
  await page.keyboard.press('Escape');
  await expect(visor).toBeHidden();

  await visita.locator('input[type="file"]').setInputFiles({
    name: 'visita-reemplazo.png',
    mimeType: 'image/png',
    buffer: PNG_PIXEL,
  });
  await expect(page.locator('.form-message--success')).toContainText(
    'Foto guardada',
  );
  await expect(visita.getByRole('button', { name: 'Cambiar foto' })).toBeVisible();

  await visita.getByRole('button', { name: 'Quitar foto' }).click();
  await visita.getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(page.locator('.form-message--success')).toContainText(
    'Foto eliminada',
  );
  await expect(visita.getByRole('button', { name: 'Añadir foto' })).toBeVisible();

  await page.getByRole('button', { name: 'Con foto', exact: true }).click();
  await expect(page.locator('.perfil__vacio')).toContainText(
    'Todavía no has guardado fotos',
  );

  await page.getByRole('button', { name: 'Sin foto', exact: true }).click();
  await expect(
    page.locator('.perfil__visita').filter({ hasText: 'Catedral de Coro' }),
  ).toBeVisible();
});
