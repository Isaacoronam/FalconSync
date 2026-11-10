import { expect, test } from '@playwright/test';

test('el popup del punto aparece al pasar el cursor y permanece al recorrer su ficha', async ({
  page,
}) => {
  const locationsResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/locations') &&
      response.request().method() === 'GET',
  );
  await page.goto('/');
  const locations = (await (await locationsResponse).json()) as {
    data: Array<{
      slug: string;
      location: { coordinates: [number, number] };
    }>;
  };
  const park = locations.data.find(
    (location) => location.slug === 'parque-nacional-medanos-de-coro',
  );
  expect(park?.location.coordinates).toEqual([-69.6677, 11.437]);

  await page
    .locator('.location-card')
    .filter({ hasText: 'Iglesia de San Francisco' })
    .click();
  await expect(page.locator('.leaflet-popup')).toBeVisible();
  await page.evaluate(() => {
    const map = (
      window as Window & {
        __falconsyncMap?: { closePopup(): void };
      }
    ).__falconsyncMap;

    if (!map) {
      throw new Error('No se encontró el mapa Leaflet de pruebas.');
    }

    map.closePopup();
  });
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);

  await page
    .locator('.heritage-marker[title="Iglesia de San Francisco"]')
    .hover();
  const visiblePopup = page.locator('.leaflet-popup:visible');
  await expect(visiblePopup.locator('.heritage-popup__title')).toHaveText(
    'Iglesia de San Francisco',
  );

  await visiblePopup.locator('.leaflet-popup-content').hover();
  await expect(visiblePopup.locator('.heritage-popup__title')).toBeVisible();

  await page.getByRole('button', { name: 'Ver todo Falcón' }).hover();
  await expect(page.locator('.leaflet-popup:visible')).toHaveCount(0);
});
