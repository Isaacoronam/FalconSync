import {
  DEFAULT_PANORAMA_CAMERA,
  cameraBasis,
  clampFov,
  clampPitch,
  normalizeYaw,
  projectHotspot,
  rotateCamera,
  zoomCamera,
} from './panorama-projection';

const VIEWPORT = { width: 1200, height: 600 };

describe('proyección del visor 360°', () => {
  it('normaliza el yaw al intervalo −180…180', () => {
    expect(normalizeYaw(0)).toBe(0);
    expect(normalizeYaw(190)).toBe(-170);
    expect(normalizeYaw(-190)).toBe(170);
    expect(normalizeYaw(540)).toBe(-180);
    expect(normalizeYaw(Number.NaN)).toBe(0);
  });

  it('limita el pitch y el campo de visión a valores seguros', () => {
    expect(clampPitch(120)).toBe(85);
    expect(clampPitch(-120)).toBe(-85);
    expect(clampPitch(15)).toBe(15);
    expect(clampFov(5)).toBe(35);
    expect(clampFov(150)).toBe(100);
    expect(clampFov(Number.NaN)).toBe(DEFAULT_PANORAMA_CAMERA.fov);
  });

  it('rota y acerca la cámara sin alterar los demás ejes', () => {
    const rotated = rotateCamera({ yaw: 179, pitch: 84, fov: 75 }, 4, 5);

    expect(rotated.yaw).toBe(-177);
    expect(rotated.pitch).toBe(85);
    expect(rotated.fov).toBe(75);

    expect(zoomCamera(rotated, -10).fov).toBe(65);
    expect(zoomCamera(rotated, 10).fov).toBe(85);
  });

  it('proyecta un hotspot del centro al centro del lienzo', () => {
    const projection = projectHotspot(0, 0, DEFAULT_PANORAMA_CAMERA, VIEWPORT);

    expect(projection.visible).toBe(true);
    expect(projection.x).toBeCloseTo(VIEWPORT.width / 2, 5);
    expect(projection.y).toBeCloseTo(VIEWPORT.height / 2, 5);
  });

  it('oculta los hotspots que quedan detrás de la cámara', () => {
    const projection = projectHotspot(180, 0, DEFAULT_PANORAMA_CAMERA, VIEWPORT);

    expect(projection.visible).toBe(false);
  });

  it('desplaza la proyección al girar la cámara hacia la derecha', () => {
    const center = projectHotspot(0, 0, DEFAULT_PANORAMA_CAMERA, VIEWPORT);
    const right = projectHotspot(0, 0, { ...DEFAULT_PANORAMA_CAMERA, yaw: 30 }, VIEWPORT);

    expect(center.x).toBeCloseTo(VIEWPORT.width / 2, 5);
    expect(right.x).toBeLessThan(center.x);
  });

  it('tolera un lienzo sin dimensiones', () => {
    const projection = projectHotspot(0, 0, DEFAULT_PANORAMA_CAMERA, {
      width: 0,
      height: 0,
    });

    expect(projection.visible).toBe(false);
  });

  it('construye una base ortonormal para la cámara', () => {
    const basis = cameraBasis({ yaw: 35, pitch: 20, fov: 70 });
    const length = (vector: readonly [number, number, number]) =>
      Math.hypot(vector[0], vector[1], vector[2]);

    expect(length(basis.forward)).toBeCloseTo(1, 5);
    expect(length(basis.right)).toBeCloseTo(1, 5);
    expect(length(basis.up)).toBeCloseTo(1, 5);
    expect(basis.tanHalfFov).toBeCloseTo(Math.tan((70 * Math.PI) / 360), 5);
  });
});
