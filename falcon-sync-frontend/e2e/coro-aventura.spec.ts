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

  await page.goto(
    `/checkin/${ubicacion.locationId}?token=${encodeURIComponent(ubicacion.token)}`,
  );
  await expect(page).toHaveURL(/\/checkin\//);
  await expect(page.locator('.checkin__token-precargado')).toBeVisible();
}

async function registrarCheckIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Registrar check-in' }).click();
  await expect(page.locator('.form-message--success')).toContainText(
    'Check-in registrado',
  );
}

async function visitarParada(
  page: Page,
  ubicacion: Ubicacion,
): Promise<void> {
  await abrirCheckIn(page, ubicacion);
  await registrarCheckIn(page);
}

async function configurarEntorno(request: APIRequestContext): Promise<{
  slug: string;
  cathedral: Ubicacion;
  ventanas: Ubicacion;
  plaza: Ubicacion;
}> {
  const loginAdmin = await request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(loginAdmin.ok(), 'login admin').toBeTruthy();

  const token = (await loginAdmin.json()).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  const slug = `ruta-historica-${Date.now()}`;

  const aventura = await request.post(
    `${BACKEND_URL}/api/admin/adventures`,
    {
      headers,
      data: {
        title: 'Ruta Histórica de Coro',
        slug,
        summary: 'Recorrido por el casco histórico de Coro y sus puntos emblemáticos.',
        description:
          'Aventura patrimonial para recorrer el centro histórico de Santa Ana de Coro, Patrimonio Mundial.',
        difficulty: 'easy',
        estimatedMinutes: 60,
        badge: {
          name: 'Explorador de Coro',
          description: 'Obtenida al completar la ruta histórica del centro.',
          image: '',
        },
      },
    },
  );
  expect(aventura.ok(), 'crear aventura').toBeTruthy();
  const adventureId = (await aventura.json()).data.id;

  const locations = (
    await (await request.get(`${BACKEND_URL}/api/locations`)).json()
  ).data as LocationApi[];
  const porSlug = (nom: string) => locations.find((l) => l.slug === nom);

  const catedralLoc = porSlug('catedral-de-coro');
  const ventanasLoc = porSlug('casa-de-las-ventanas-de-hierro');
  const plazaLoc = porSlug('plaza-bolivar-de-coro');

  expect(catedralLoc).toBeDefined();
  expect(ventanasLoc).toBeDefined();
  expect(plazaLoc).toBeDefined();

  await request.post(
    `${BACKEND_URL}/api/admin/adventures/${adventureId}/stops`,
    {
      headers,
      data: {
        locationId: catedralLoc.id,
        order: 1,
        didacticText: 'Texto didáctico de la catedral.',
        instructions: 'Llega a la entrada principal.',
      },
    },
  );
  await request.post(
    `${BACKEND_URL}/api/admin/adventures/${adventureId}/stops`,
    {
      headers,
      data: {
        locationId: ventanasLoc.id,
        order: 2,
        didacticText: 'Texto didáctico de las ventanas de hierro.',
        instructions: 'Observa el portal colonial.',
      },
    },
  );
  await request.post(
    `${BACKEND_URL}/api/admin/adventures/${adventureId}/stops`,
    {
      headers,
      data: {
        locationId: plazaLoc.id,
        order: 3,
        didacticText: 'Texto didáctico de la plaza.',
        instructions: 'Camina hacia el centro de la plaza.',
      },
    },
  );

  const publicado = await request.post(
    `${BACKEND_URL}/api/admin/adventures/${adventureId}/publish`,
    { headers },
  );
  expect(publicado.ok(), 'publicar aventura').toBeTruthy();

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
    slug,
    cathedral: await aUbicacion(catedralLoc),
    ventanas: await aUbicacion(ventanasLoc),
    plaza: await aUbicacion(plazaLoc),
  };
}

test('escaneo abre login y conserva la URL completa con returnUrl', async ({
  page,
  request,
}) => {
  const { cathedral } = await configurarEntorno(request);

  await page.goto(
    `/checkin/${cathedral.locationId}?token=${encodeURIComponent(cathedral.token)}`,
  );
  await expect(page).toHaveURL(/\/login/);

  const loginUrl = page.url();
  expect(loginUrl).toContain('returnUrl=');

  const returnUrlEncoded = loginUrl.split('returnUrl=')[1].split('&')[0];
  const returnUrl = decodeURIComponent(returnUrlEncoded);
  expect(returnUrl).toBe(
    `/checkin/${cathedral.locationId}?token=${encodeURIComponent(cathedral.token)}`,
  );

  await expect(page.locator('#login-title')).toContainText('Inicia sesión');
});

test('login vuelve al check-in con el token conservado', async ({
  page,
  request,
}) => {
  const { cathedral } = await configurarEntorno(request);
  const usuario = await crearUsuario(request);

  await login(page, usuario.email, usuario.password);
  await abrirCheckIn(page, cathedral);

  await expect(page.locator('h1')).toContainText('Check-in en punto de interés');
  await expect(page.locator('.checkin__token-precargado')).toContainText(
    'Token del QR precargado',
  );
});

test('check-in dentro del radio aceptado y progreso actualizado', async ({
  page,
  request,
}) => {
  const { slug, cathedral } = await configurarEntorno(request);
  const usuario = await crearUsuario(request);

  await login(page, usuario.email, usuario.password);
  await visitarParada(page, cathedral);

  await page.goto(`/aventuras/${slug}/progreso`);
  await expect(page.locator('h1')).toContainText(
    'Progreso de Ruta Histórica de Coro',
  );
  await expect(
    page.locator('.progreso-item').filter({ hasText: 'Catedral de Coro' }),
  ).toContainText('Visitada');
  await expect(page.locator('.progreso-tarjeta__valor').first()).toContainText(
    '33%',
  );
  await expect(page.locator('.progreso-siguiente__lugar')).toContainText(
    'Casa de las Ventanas de Hierro',
  );
});

test('check-in duplicado y fuera de radio rechazados', async ({
  page,
  request,
}) => {
  const { cathedral, ventanas } = await configurarEntorno(request);
  const usuario = await crearUsuario(request);

  await login(page, usuario.email, usuario.password);
  await visitarParada(page, cathedral);

  await abrirCheckIn(page, cathedral);
  await page.getByRole('button', { name: 'Registrar check-in' }).click();
  await expect(page.locator('.form-message--error')).toContainText(
    'Ya registraste un check-in en este punto de interés.',
  );

  await page.context().setGeolocation({
    latitude: 0,
    longitude: 0,
    accuracy: 10,
  });
  await page.goto(
    `/checkin/${ventanas.locationId}?token=${encodeURIComponent(ventanas.token)}`,
  );
  await expect(page.locator('.checkin__token-precargado')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar check-in' }).click();
  await expect(page.locator('.form-message--error')).toContainText(
    'demasiado lejos del punto de interés',
  );
});

test('ruta completada muestra cierre con insignia y fecha', async ({
  page,
  request,
}) => {
  const { slug, cathedral, ventanas, plaza } = await configurarEntorno(request);
  const usuario = await crearUsuario(request);

  await login(page, usuario.email, usuario.password);
  await visitarParada(page, cathedral);
  await visitarParada(page, ventanas);
  await visitarParada(page, plaza);

  await page.goto(`/aventuras/${slug}/progreso`);
  await expect(page.locator('.progreso-tarjeta__valor').first()).toContainText(
    '100%',
  );
  await expect(
    page.locator('h2', { hasText: '¡Ruta completada!' }),
  ).toBeVisible();
  await expect(page.locator('.progreso-insignia__nombre')).toContainText(
    'Explorador de Coro',
  );
  await expect(page.locator('.progreso-cierre__fecha')).toBeVisible();
});
