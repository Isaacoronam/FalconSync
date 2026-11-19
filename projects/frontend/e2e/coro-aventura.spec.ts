import { APIRequestContext, Page, expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@e2e.local';
const ADMIN_PASSWORD = 'AdminE2E12345';
const EXPLORER_PASSWORD = 'ExploradorE2E123';

const BACKEND_URL = 'http://127.0.0.1:3101';

type Ubicacion = {
  locationId: string;
  token: string;
  latitude: number;
  longitude: number;
};

type UsuarioE2E = {
  email: string;
  password: string;
};

type LocationApi = {
  id: string;
  slug: string;
  title: string;
  location: { type: string; coordinates: [number, number] };
};

test.use({ permissions: ['geolocation'] });

async function crearUsuario(request: APIRequestContext): Promise<UsuarioE2E> {
  const email = `explorador-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@e2e.local`;

  const registro = await request.post(`${BACKEND_URL}/api/auth/register`, {
    data: { name: 'Explorador E2E', email, password: EXPLORER_PASSWORD },
  });
  expect(registro.ok(), 'registrar usuario E2E').toBeTruthy();

  return { email, password: EXPLORER_PASSWORD };
}

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

async function abrirCheckIn(
  page: Page,
  ubicacion: Ubicacion,
): Promise<void> {
  await page.context().setGeolocation({
    latitude: ubicacion.latitude,
    longitude: ubicacion.longitude,
    accuracy: 10,
  });

  await page.goto('/checkin');
  await expect(page.locator('h1')).toContainText('Escanear QR');
  await page.locator('#escaner-contenido').fill(
    JSON.stringify({
      type: 'falconsync-check-in',
      locationId: ubicacion.locationId,
      token: ubicacion.token,
    }),
  );
  await page.getByRole('button', { name: 'Abrir check-in' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/checkin/${ubicacion.locationId}$`),
  );
  await expect(page.locator('.checkin__token')).toContainText('QR verificado');
}

async function registrarCheckIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Registrar check-in' }).click();
  await expect(page.locator('.checkin-exito')).toBeVisible();
  await expect(page.locator('.form-message--success').first()).toContainText(
    'Visita confirmada',
  );
}

async function visitarLugar(
  page: Page,
  ubicacion: Ubicacion,
): Promise<void> {
  await abrirCheckIn(page, ubicacion);
  await registrarCheckIn(page);
}

async function configurarEntorno(request: APIRequestContext): Promise<{
  cathedral: Ubicacion;
  ventanas: Ubicacion;
}> {
  const loginAdmin = await request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(loginAdmin.ok(), 'login admin').toBeTruthy();

  const token = (await loginAdmin.json()).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  const locations = (
    await (await request.get(`${BACKEND_URL}/api/locations`)).json()
  ).data as LocationApi[];
  const porSlug = (nom: string) => locations.find((l) => l.slug === nom);

  const catedralLoc = porSlug('catedral-de-coro');
  const ventanasLoc = porSlug('casa-de-las-ventanas-de-hierro');

  expect(catedralLoc).toBeDefined();
  expect(ventanasLoc).toBeDefined();

  const rotarQR = async (locationId: string): Promise<string> => {
    const respuesta = await request.post(
      `${BACKEND_URL}/api/admin/locations/${locationId}/qr/rotate?format=svg`,
      { headers },
    );
    expect(respuesta.ok(), `rotar QR ${locationId}`).toBeTruthy();
    const { data } = await respuesta.json();
    return data.token;
  };

  const aUbicacion = async (loc: LocationApi): Promise<Ubicacion> => ({
    locationId: loc.id,
    token: await rotarQR(loc.id),
    latitude: loc.location.coordinates[1],
    longitude: loc.location.coordinates[0],
  });

  return {
    cathedral: await aUbicacion(catedralLoc),
    ventanas: await aUbicacion(ventanasLoc),
  };
}

test('el escáner manual abre login sin exponer el token en la URL', async ({
  page,
  request,
}) => {
  const { cathedral } = await configurarEntorno(request);
  const usuario = await crearUsuario(request);

  await page.goto('/checkin');
  await expect(page.locator('h1')).toContainText('Escanear QR');
  await page.locator('#escaner-contenido').fill(
    JSON.stringify({
      type: 'falconsync-check-in',
      locationId: cathedral.locationId,
      token: cathedral.token,
    }),
  );
  await page.getByRole('button', { name: 'Abrir check-in' }).click();

  await expect(page).toHaveURL(/\/login/);
  const loginUrl = new URL(page.url());
  expect(loginUrl.searchParams.get('returnUrl')).toBe(
    `/checkin/${cathedral.locationId}`,
  );
  expect(page.url()).not.toContain(cathedral.token);
  await expect(page.locator('#login-title')).toContainText('Inicia sesión');

  await page.locator('#login-email').fill(usuario.email);
  await page.locator('#login-password').fill(usuario.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/checkin/${cathedral.locationId}$`),
  );
  await expect(page.locator('.checkin__token')).toContainText('QR verificado');
});

test('un enlace heredado con token se limpia y conserva el acceso tras el login', async ({
  page,
  request,
}) => {
  const { cathedral } = await configurarEntorno(request);
  const usuario = await crearUsuario(request);

  await page.goto(
    `/checkin/${cathedral.locationId}?token=${encodeURIComponent(cathedral.token)}`,
  );
  await expect(page).toHaveURL(/\/login/);

  const loginUrl = new URL(page.url());
  expect(loginUrl.searchParams.get('returnUrl')).toBe(
    `/checkin/${cathedral.locationId}`,
  );
  expect(page.url()).not.toContain(cathedral.token);

  await page.locator('#login-email').fill(usuario.email);
  await page.locator('#login-password').fill(usuario.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/checkin/${cathedral.locationId}$`),
  );
  await expect(page.locator('.checkin__token')).toContainText('QR verificado');
});

test('login vuelve al check-in con el token conservado en memoria', async ({
  page,
  request,
}) => {
  const { cathedral } = await configurarEntorno(request);
  const usuario = await crearUsuario(request);

  await login(page, usuario.email, usuario.password);
  await abrirCheckIn(page, cathedral);

  await expect(page.locator('h1')).toContainText('Registrar visita');
  await expect(page.locator('.checkin__token')).toContainText('QR verificado');
  await expect(page).not.toHaveURL(/token=/);
});

test('check-in válido felicita, otorga insignia y enlaza la ficha del lugar', async ({
  page,
  request,
}) => {
  const { cathedral } = await configurarEntorno(request);
  const usuario = await crearUsuario(request);

  await login(page, usuario.email, usuario.password);
  await visitarLugar(page, cathedral);
  await expect(
    page.locator('.checkin-logro').filter({ hasText: 'Catedral de Coro' }),
  ).toBeVisible();
  await expect(page.locator('.checkin-chivito')).toContainText('Catedral de Coro');
  await page.getByRole('link', { name: 'Volver a la historia del lugar' }).click();
  await expect(page).toHaveURL(/\/lugares\/catedral-de-coro$/);
  await expect(page.locator('h1')).toContainText('Catedral de Coro');
});

test('check-in duplicado y fuera de radio rechazados', async ({
  page,
  request,
}) => {
  const { cathedral, ventanas } = await configurarEntorno(request);
  const usuario = await crearUsuario(request);

  await login(page, usuario.email, usuario.password);
  await visitarLugar(page, cathedral);

  await abrirCheckIn(page, cathedral);
  await page.getByRole('button', { name: 'Registrar check-in' }).click();
  await expect(page.locator('.form-message--error')).toContainText(
    'Ya registraste un check-in en este punto de interés.',
  );

  await abrirCheckIn(page, ventanas);
  await page.context().setGeolocation({
    latitude: 0,
    longitude: 0,
    accuracy: 10,
  });
  await page.getByRole('button', { name: 'Registrar check-in' }).click();
  await expect(page.locator('.form-message--error')).toContainText(
    'demasiado lejos del punto de interés',
  );
});

test('catálogo muestra lugares y las URL heredadas de rutas vuelven al catálogo', async ({
  page,
}) => {
  await page.goto('/lugares');
  await expect(page.locator('h1')).toContainText('Explora los lugares de Coro');
  await expect(
    page.getByRole('heading', { name: 'Catedral de Coro', exact: true }),
  ).toBeVisible();

  await page.goto('/aventuras/una-ruta-antigua/progreso');
  await expect(page).toHaveURL(/\/lugares$/);
  await expect(page.locator('h1')).toContainText('Explora los lugares de Coro');
});
