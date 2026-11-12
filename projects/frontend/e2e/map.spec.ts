import { expect, test } from '@playwright/test';

type LeafletMap = {
  options: {
    minZoom: number;
    maxBoundsViscosity: number;
    maxBounds: {
      getSouthWest(): { lat: number; lng: number };
      getNorthEast(): { lat: number; lng: number };
    };
  };
  getCenter(): { lat: number; lng: number };
  getZoom(): number;
  panTo(latlng: [number, number], options?: { animate?: boolean }): void;
};

declare global {
  interface Window {
    __falconsyncMap?: LeafletMap;
  }
}

test('el mapa carga los POI, limita Falcón y responde en móvil', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/');

  await expect(page.locator('#map-title')).toContainText('El patrimonio de Coro');
  await expect(page.locator('.location-card')).toHaveCount(23);
  await expect(page.locator('.location-card__thumb')).toHaveCount(23);
  await expect(page.locator('.location-card__status')).toHaveCount(0);
  await expect(
    page.locator('.location-card').filter({ hasText: 'Gelatería El Sol' }),
  ).toHaveCount(1);
  await expect(
    page
      .locator('.location-card')
      .filter({ hasText: 'Parque Nacional Médanos de Coro' }),
  ).toHaveCount(1);
  await expect(
    page.locator('.location-card').filter({ hasText: 'Mirador del Pueblo' }),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Explorar por circuito' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Explorar por etiqueta' })).toHaveCount(0);
  await expect(page.locator('#coro-map')).toBeVisible();
  await expect(page.locator('.heritage-cluster').first()).toBeVisible();
  await expect(page.locator('.map-hero__notice')).toHaveCount(0);

  const poiList = page.locator('.map-panel__section--list');
  const listMetrics = await poiList.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(listMetrics.overflowY).toBe('auto');
  expect(listMetrics.scrollHeight).toBeGreaterThan(listMetrics.clientHeight);

  await poiList.hover();
  const pageScrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 800);
  await expect
    .poll(() => poiList.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);

  await page.waitForFunction(() => Boolean(window.__falconsyncMap));

  const initial = await page.evaluate(() => {
    const map = window.__falconsyncMap!;
    const center = map.getCenter();
    const bounds = map.options.maxBounds;
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();

    return {
      center: { lat: center.lat, lng: center.lng },
      zoom: map.getZoom(),
      minZoom: map.options.minZoom,
      viscosity: map.options.maxBoundsViscosity,
      bounds: {
        south: southWest.lat,
        west: southWest.lng,
        north: northEast.lat,
        east: northEast.lng,
      },
    };
  });

  expect(initial.center.lat).toBeCloseTo(11.4078, 2);
  expect(initial.center.lng).toBeCloseTo(-69.6785, 2);
  expect(initial.zoom).toBe(13);
  expect(initial.minZoom).toBe(8);
  expect(initial.viscosity).toBe(1);
  expect(initial.bounds.south).toBeCloseTo(10.3, 4);
  expect(initial.bounds.west).toBeCloseTo(-71.35, 4);
  expect(initial.bounds.north).toBeCloseTo(12.19, 4);
  expect(initial.bounds.east).toBeCloseTo(-68.18, 4);

  const clampedCenter = await page.evaluate(() => {
    const map = window.__falconsyncMap!;
    map.panTo([0, 0], { animate: false });
    const center = map.getCenter();

    return { lat: center.lat, lng: center.lng };
  });

  expect(clampedCenter.lat).toBeGreaterThanOrEqual(10.3);
  expect(clampedCenter.lat).toBeLessThanOrEqual(12.19);
  expect(clampedCenter.lng).toBeGreaterThanOrEqual(-71.35);
  expect(clampedCenter.lng).toBeLessThanOrEqual(-68.18);

  await page.getByRole('button', { name: 'Ver todo Falcón' }).click();
  await page.waitForTimeout(400);

  const overviewZoom = await page.evaluate(() => window.__falconsyncMap!.getZoom());
  expect(overviewZoom).toBeLessThan(10);
  expect(overviewZoom).toBeGreaterThanOrEqual(8);

  await page
    .locator('.location-card')
    .filter({ hasText: 'Iglesia de San Francisco' })
    .click();
  await expect(page.locator('.heritage-popup__notice')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.map-stage')).toBeVisible();
  const mobileListMetrics = await poiList.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(mobileListMetrics.scrollHeight).toBeGreaterThan(mobileListMetrics.clientHeight);

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'Museo', exact: true }).click();
  await expect(page.locator('.location-card')).toHaveCount(5);

  await page.getByRole('button', { name: 'Todas las categorías' }).click();
  await page.getByRole('button', { name: 'Monumento', exact: true }).click();
  await expect(page.locator('.location-card')).toHaveCount(3);

  const appErrors = consoleErrors.filter(
    (message) =>
      !message.includes('tile.openstreetmap.org') &&
      !message.includes('net::ERR') &&
      !message.includes('Failed to load resource'),
  );
  expect(appErrors).toEqual([]);
});
