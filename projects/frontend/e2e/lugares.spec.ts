import { expect, test } from '@playwright/test';

test('Explorar lugares permite buscar, filtrar, limpiar y recuperar los 23 lugares', async ({
  page,
}) => {
  await page.goto('/lugares');

  const cards = page.locator('.lugar-card');
  await expect(cards).toHaveCount(23);
  await expect(page.locator('.lugares-filters__count')).toHaveText('23 de 23 lugares');

  // Cada tarjeta tiene un único enlace real.
  await expect(cards.first().getByRole('link')).toHaveCount(1);

  // Las 23 portadas cargan desde los recursos locales. Al ser lazy, se
  // recorren primero todos los puntos de la página.
  await page.evaluate(async () => {
    const step = Math.max(320, Math.floor(window.innerHeight * 0.8));

    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    window.scrollTo(0, 0);
  });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll<HTMLImageElement>('.lugar-card__media img')].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    null,
    { timeout: 15_000 },
  );

  const search = page.locator('#lugares-search');
  await search.fill('gelateria');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Gelatería El Sol');

  await page.locator('#lugares-category').selectOption('museum');
  await expect(cards).toHaveCount(0);
  await expect(page.locator('.lugares-state--empty')).toBeVisible();

  await page.getByRole('button', { name: 'Ver todos los lugares' }).click();
  await expect(cards).toHaveCount(23);

  await page.locator('#lugares-category').selectOption('museum');
  await expect(cards).toHaveCount(5);
  await page.locator('#lugares-circuit').selectOption('la-vela');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Casa Museo Locos de la Vela');

  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(cards).toHaveCount(23);
  await expect(page.locator('#lugares-search')).toHaveValue('');
});

test('la ficha enriquecida muestra qué es, historia, galería, fuentes y fecha de revisión', async ({
  page,
}) => {
  await page.goto('/lugares/catedral-de-coro');

  await expect(page.getByRole('heading', { level: 1, name: 'Catedral de Coro' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Qué es este lugar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Galería' })).toBeVisible();
  await expect(page.locator('.lugar-article__gallery img')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Fuentes históricas y lecturas' })).toBeVisible();
  await expect(page.locator('.lugar-article__sources')).toContainText('whc.unesco.org');
  await expect(page.locator('.lugar-article__reviewed')).toContainText('26 de noviembre de 2026');
  await expect(page.getByRole('button', { name: 'Compartir este lugar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver ubicación en el mapa' })).toHaveAttribute(
    'href',
    /google\.com\/maps/,
  );
});

test('el botón de compartir copia el enlace cuando no hay Web Share API', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  await page.goto('/lugares/casa-del-sol');

  await page.getByRole('button', { name: 'Compartir este lugar' }).click();
  await expect(page.locator('.lugar-article__share-status')).toHaveText(
    'Enlace copiado al portapapeles.',
  );

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('/lugares/casa-del-sol');
});

test('los filtros y la ficha no desbordan en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lugares');
  await expect(page.locator('.lugar-card')).toHaveCount(23);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.goto('/lugares/catedral-de-coro');
  await expect(page.getByRole('heading', { level: 1, name: 'Catedral de Coro' })).toBeVisible();
  const detailOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(detailOverflow).toBeLessThanOrEqual(1);
});
