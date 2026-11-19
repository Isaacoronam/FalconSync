import { APIRequestContext, Locator, Page, expect, test } from '@playwright/test';

const INSPECTOR1_EMAIL = 'inspector1@e2e.local';
const INSPECTOR2_EMAIL = 'inspector2@e2e.local';
const INSPECTOR1_NAME = 'Inspector Uno E2E';
const INSPECTOR2_NAME = 'Inspector Dos E2E';
const INSPECTOR_PASSWORD = 'InspectorE2E123';
const USER_PASSWORD = 'UsuarioE2E123';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQYlWPYEmXzHx9mGBkKAFYNkkGJZkAzAAAAAElFTkSuQmCC',
  'base64',
);

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

async function uploadEvidence(panel: Locator, purpose: string): Promise<void> {
  await panel.getByLabel('Motivo de la evidencia').fill(purpose);
  await panel
    .getByLabel('Archivo (JPEG, PNG, WebP o PDF)')
    .setInputFiles({ name: 'evidencia-e2e.png', mimeType: 'image/png', buffer: PNG });
  await panel.getByRole('button', { name: 'Adjuntar evidencia' }).click();
  await expect(panel.getByText('Evidencia cargada y verificada.')).toBeVisible();
}

async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    data: { accessToken: string };
  };
  return body.data.accessToken;
}

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

test.describe('conservación', () => {
  test.setTimeout(180_000);

  test('recorre reporte, triaje, inspección, intervención y cierre', async ({ page, request }) => {
    const stamp = Date.now();
    const reporterEmail = `reportante-${stamp}@example.com`;
    const reporterName = `Reportante E2E ${stamp}`;
    const description = `Humedad y fisuras detectadas por E2E ${stamp}`;
    const assetCode = `E2E-${String(stamp).slice(-8)}`;
    const assetName = `Casa E2E ${stamp}`;
    const scope = `Inspección de fachada y cubierta del activo ${assetCode}`;
    const findingDescription = 'Fisuras activas en la fachada norte con riesgo de desprendimiento.';
    const reviewNotes = 'Severidad confirmada en sitio por el revisor.';
    const interventionDescription = 'Consolidación de fisuras y reposición del revoque afectado.';

    const registered = await request.post('/api/auth/register', {
      data: { name: reporterName, email: reporterEmail, password: USER_PASSWORD },
    });
    expect(registered.status()).toBe(201);

    // La persona reporta el daño y adjunta evidencia privada.
    await login(page, reporterEmail, USER_PASSWORD);
    await page.getByRole('link', { name: 'Reportes', exact: true }).click();
    await expect(page).toHaveURL(/\/reportes$/);

    await page.locator('#report-location').selectOption({ index: 1 });
    await page.locator('#report-description').fill(description);
    await page.getByRole('button', { name: 'Crear reporte' }).click();

    await expect(page).toHaveURL(/\/reportes\/[a-f0-9]{24}$/);
    const reportUrl = page.url();
    await expect(page.locator('#report-detail-title')).toContainText('Reporte');
    await expect(page.locator('body')).toContainText(description);

    const reportEvidence = page
      .locator('app-evidence-panel')
      .filter({ hasText: 'Evidencia del reporte' });
    await uploadEvidence(reportEvidence, 'Fotografía inicial del daño');
    await expect(reportEvidence.locator('.conservation-evidence-card')).toHaveCount(1);

    await logout(page);

    // El inspector registra el activo, acepta el reporte y lo convierte.
    await login(page, INSPECTOR1_EMAIL, INSPECTOR_PASSWORD);
    await page.getByRole('link', { name: 'Inspecciones', exact: true }).click();
    await expect(page).toHaveURL(/\/inspecciones$/);

    await page.locator('#asset-code').fill(assetCode);
    await page.locator('#asset-name').fill(assetName);
    await page.locator('#asset-location').selectOption({ index: 1 });
    await expect(page.locator('#asset-latitude')).not.toHaveValue('');
    await page.getByRole('button', { name: 'Registrar activo' }).click();
    await expect(page.locator('.conservation-success')).toContainText('registrado');

    const queueCard = page.locator('.conservation-card').filter({ hasText: description });
    await expect(queueCard).toHaveCount(1);
    await queueCard.getByRole('link', { name: 'Tramitar reporte' }).click();
    await expect(page).toHaveURL(reportUrl);

    await page.locator('#triage-decision').selectOption('accept');
    await page.getByRole('button', { name: 'Guardar triaje' }).click();
    await expect(page.getByText('Triaje actualizado.')).toBeVisible();

    await expect(page.locator('#convert-asset')).toBeVisible();
    await page.locator('#convert-asset').selectOption({ label: `${assetName} (${assetCode})` });
    await page.locator('#convert-reviewer').selectOption({ label: INSPECTOR2_NAME });
    await page.locator('#convert-scope').fill(scope);
    await page.getByRole('button', { name: 'Crear inspección' }).click();

    await expect(page).toHaveURL(/\/inspecciones\/[a-f0-9]{24}$/);
    const inspectionUrl = page.url();
    await expect(page.locator('#inspection-detail-title')).toContainText(assetName);

    // El inspector ejecuta, documenta hallazgos con evidencia y envía a revisión.
    await page.getByRole('button', { name: 'Iniciar inspección' }).click();
    await expect(page.getByText('Inspección iniciada.')).toBeVisible();

    await page.locator('#finding-category').selectOption('structural');
    await page.locator('#finding-severity').selectOption('high');
    await page.locator('#finding-description').fill(findingDescription);
    await page.locator('#finding-requires-intervention').check();
    await page.getByRole('button', { name: 'Registrar hallazgo' }).click();
    await expect(page.getByText('Hallazgo registrado.')).toBeVisible();
    await expect(page.locator('.conservation-finding')).toHaveCount(1);

    const inspectionEvidence = page
      .locator('app-evidence-panel')
      .filter({ hasText: 'Evidencia general de la inspección' });
    await uploadEvidence(inspectionEvidence, 'Panorámica de la fachada inspeccionada');

    await page.getByRole('button', { name: 'Enviar a revisión' }).click();
    await expect(page.getByText('Inspección enviada a revisión.')).toBeVisible();
    await logout(page);

    // El revisor confirma severidad, aprueba y propone la intervención.
    await login(page, INSPECTOR2_EMAIL, INSPECTOR_PASSWORD);
    await page.getByRole('link', { name: 'Inspecciones', exact: true }).click();
    const inspectionRow = page.locator('tr').filter({ hasText: assetName });
    await expect(inspectionRow).toHaveCount(1);
    await inspectionRow.getByRole('link', { name: 'Abrir' }).click();
    await expect(page).toHaveURL(inspectionUrl);
    await expect(page.locator('#inspection-detail-title')).toContainText(assetName);

    await page.locator('#review-result').selectOption('fair');
    await page.locator('select[id^="review-severity-"]').first().selectOption('high');
    await page.locator('#review-notes').fill(reviewNotes);
    await page.getByRole('button', { name: 'Registrar revisión' }).click();
    await expect(
      page.getByText('Inspección revisada. Ya se pueden proponer intervenciones.'),
    ).toBeVisible();

    await page.locator('input[id^="intervention-finding-"]').first().check();
    await page.locator('#intervention-type').selectOption('repair');
    await page.locator('#intervention-description').fill(interventionDescription);
    await page.getByRole('button', { name: 'Proponer intervención' }).click();
    await expect(
      page.getByText('Intervención propuesta. Otra persona debe aprobarla.'),
    ).toBeVisible();

    const interventionCard = page
      .locator('.conservation-card')
      .filter({ hasText: interventionDescription });
    await expect(interventionCard).toHaveCount(1);
    await expect(interventionCard.locator('.conservation-badge')).toContainText('Propuesta');
    await logout(page);

    // Otra persona aprueba, ejecuta con evidencia y completa.
    await login(page, INSPECTOR1_EMAIL, INSPECTOR_PASSWORD);
    await page.getByRole('link', { name: 'Inspecciones', exact: true }).click();
    await page
      .locator('tr')
      .filter({ hasText: assetName })
      .getByRole('link', { name: 'Abrir' })
      .click();
    await expect(page).toHaveURL(inspectionUrl);
    await expect(page.locator('#inspection-detail-title')).toContainText(assetName);

    await interventionCard.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await expect(interventionCard.locator('.conservation-badge')).toContainText('Aprobada');

    await interventionCard.getByRole('button', { name: 'Iniciar ejecución' }).click();
    await expect(interventionCard.locator('.conservation-badge')).toContainText('En ejecución');

    const interventionEvidence = interventionCard.locator('app-evidence-panel');
    await uploadEvidence(interventionEvidence, 'Registro fotográfico de la intervención');
    await expect(interventionCard.locator('.conservation-badge')).toContainText('En ejecución');

    await interventionCard.getByRole('button', { name: 'Completar' }).click();
    await expect(interventionCard.locator('.conservation-badge')).toContainText('Completada');
    await logout(page);

    // El revisor verifica la intervención y cierra la inspección.
    await login(page, INSPECTOR2_EMAIL, INSPECTOR_PASSWORD);
    await page.getByRole('link', { name: 'Inspecciones', exact: true }).click();
    await page
      .locator('tr')
      .filter({ hasText: assetName })
      .getByRole('link', { name: 'Abrir' })
      .click();
    await expect(page).toHaveURL(inspectionUrl);

    page.once('dialog', (dialog) => dialog.accept());
    await interventionCard.getByRole('button', { name: 'Verificar intervención' }).click();
    await expect(interventionCard.locator('.conservation-badge')).toContainText('Verificada');
    await expect(
      page.getByText(
        'Todos los hallazgos que requieren intervención están cubiertos por una intervención verificada.',
      ),
    ).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Cerrar inspección' }).click();
    await expect(page.getByText('Inspección cerrada y estado del POI actualizado.')).toBeVisible();
    await expect(page.locator('.conservation-badge--closed').first()).toContainText('Cerrada');

    // El reporte queda enlazado a la inspección cerrada.
    await page.getByRole('link', { name: 'Ver reporte' }).click();
    await expect(page).toHaveURL(reportUrl);
    await expect(page.getByRole('link', { name: 'Abrir inspección' })).toBeVisible();
    await expect(page.locator('.conservation-badge--converted').first()).toContainText(
      'Convertido',
    );
  });

  test('deniega inspecciones y recursos ajenos', async ({ page, request }) => {
    const stamp = Date.now();
    const ownerEmail = `dueno-${stamp}@example.com`;
    const intruderEmail = `intruso-${stamp}@example.com`;
    const description = `Reporte privado E2E ${stamp}`;

    for (const email of [ownerEmail, intruderEmail]) {
      const registered = await request.post('/api/auth/register', {
        data: { name: `Cuenta ${email}`, email, password: USER_PASSWORD },
      });
      expect(registered.status()).toBe(201);
    }

    const ownerToken = await apiLogin(request, ownerEmail, USER_PASSWORD);
    const intruderToken = await apiLogin(request, intruderEmail, USER_PASSWORD);

    const locations = await request.get('/api/locations?limit=1');
    expect(locations.ok()).toBeTruthy();
    const locationId = ((await locations.json()) as { data: { id: string }[] }).data[0].id;

    const created = await request.post('/api/reports', {
      headers: bearer(ownerToken),
      data: { locationId, category: 'cracks', description },
    });
    expect(created.status()).toBe(201);
    const reportId = ((await created.json()) as { data: { id: string } }).data.id;

    const foreignReport = await request.get(`/api/reports/${reportId}`, {
      headers: bearer(intruderToken),
    });
    expect(foreignReport.status()).toBe(404);

    const queue = await request.get('/api/reports/queue', {
      headers: bearer(intruderToken),
    });
    expect(queue.status()).toBe(403);

    const inspections = await request.get('/api/inspections', {
      headers: bearer(intruderToken),
    });
    expect(inspections.status()).toBe(403);

    const evidence = await request.get(`/api/evidence?ownerType=Report&ownerId=${reportId}`, {
      headers: bearer(intruderToken),
    });
    expect(evidence.status()).toBe(404);

    // En la interfaz, la denegación se explica sin revelar el recurso.
    await login(page, intruderEmail, USER_PASSWORD);
    await page.goto(`/reportes/${reportId}`);
    await expect(page.locator('.conservation-alert')).toContainText('No se encontró el reporte');

    await page.goto('/inspecciones');
    await expect(page).toHaveURL(/\/acceso-denegado$/);
    await expect(page.locator('#forbidden-title')).toContainText('Acceso denegado');
  });
});
