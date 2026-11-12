import {
  CORO_INITIAL_ZOOM,
  CORO_VIEW,
  FALCON_BOUNDS,
  FALCON_MIN_ZOOM,
} from './falcon-bounds';

describe('límites operativos de Falcón', () => {
  it('mantiene la vista inicial de Coro dentro del rectángulo estatal', () => {
    const [[south, west], [north, east]] = FALCON_BOUNDS as [
      [number, number],
      [number, number],
    ];
    const [latitude, longitude] = CORO_VIEW;

    expect(latitude).toBeGreaterThanOrEqual(south);
    expect(latitude).toBeLessThanOrEqual(north);
    expect(longitude).toBeGreaterThanOrEqual(west);
    expect(longitude).toBeLessThanOrEqual(east);
  });

  it('usa un zoom inicial de detalle urbano y un mínimo estatal', () => {
    expect(CORO_INITIAL_ZOOM).toBeGreaterThan(FALCON_MIN_ZOOM);
    expect(FALCON_MIN_ZOOM).toBe(8);
  });
});
