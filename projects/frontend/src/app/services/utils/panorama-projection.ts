export interface PanoramaCamera {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface PanoramaViewport {
  width: number;
  height: number;
}

export interface HotspotProjection {
  x: number;
  y: number;
  visible: boolean;
  scale: number;
}

type Vec3 = readonly [number, number, number];

export interface CameraBasis {
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  tanHalfFov: number;
}

export const DEFAULT_PANORAMA_CAMERA: PanoramaCamera = Object.freeze({
  yaw: 0,
  pitch: 0,
  fov: 75,
});

const DEG_TO_RAD = Math.PI / 180;
const MIN_FOV = 35;
const MAX_FOV = 100;
const MAX_PITCH = 85;

export function normalizeYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) {
    return 0;
  }

  return ((((yaw + 180) % 360) + 360) % 360) - 180;
}

export function clampPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) {
    return 0;
  }

  return Math.min(MAX_PITCH, Math.max(-MAX_PITCH, pitch));
}

export function clampFov(fov: number): number {
  if (!Number.isFinite(fov)) {
    return DEFAULT_PANORAMA_CAMERA.fov;
  }

  return Math.min(MAX_FOV, Math.max(MIN_FOV, fov));
}

export function rotateCamera(
  camera: PanoramaCamera,
  deltaYaw: number,
  deltaPitch = 0,
): PanoramaCamera {
  return {
    yaw: normalizeYaw(camera.yaw + deltaYaw),
    pitch: clampPitch(camera.pitch + deltaPitch),
    fov: camera.fov,
  };
}

export function zoomCamera(
  camera: PanoramaCamera,
  deltaFov: number,
): PanoramaCamera {
  return {
    ...camera,
    fov: clampFov(camera.fov + deltaFov),
  };
}

export function cameraBasis(camera: PanoramaCamera): CameraBasis {
  const yaw = camera.yaw * DEG_TO_RAD;
  const pitch = camera.pitch * DEG_TO_RAD;
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);

  const forward: Vec3 = [cosPitch * sinYaw, sinPitch, cosPitch * cosYaw];
  const right: Vec3 = [cosYaw, 0, -sinYaw];
  const up: Vec3 = [
    forward[1] * right[2] - forward[2] * right[1],
    forward[2] * right[0] - forward[0] * right[2],
    forward[0] * right[1] - forward[1] * right[0],
  ];

  return {
    forward,
    right,
    up,
    tanHalfFov: Math.tan((camera.fov * DEG_TO_RAD) / 2),
  };
}

export function projectHotspot(
  yaw: number,
  pitch: number,
  camera: PanoramaCamera,
  viewport: PanoramaViewport,
): HotspotProjection {
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, y: 0, visible: false, scale: 1 };
  }

  const hotspotYaw = yaw * DEG_TO_RAD;
  const hotspotPitch = pitch * DEG_TO_RAD;
  const cosPitch = Math.cos(hotspotPitch);
  const direction: Vec3 = [
    cosPitch * Math.sin(hotspotYaw),
    Math.sin(hotspotPitch),
    cosPitch * Math.cos(hotspotYaw),
  ];
  const basis = cameraBasis(camera);
  const cameraX = dot(direction, basis.right);
  const cameraY = dot(direction, basis.up);
  const cameraZ = dot(direction, basis.forward);

  if (cameraZ <= 0.01) {
    return { x: 0, y: 0, visible: false, scale: 1 };
  }

  const aspect = viewport.width / viewport.height;
  const ndcX = cameraX / cameraZ / (basis.tanHalfFov * aspect);
  const ndcY = cameraY / cameraZ / basis.tanHalfFov;
  const visible = Math.abs(ndcX) <= 1.02 && Math.abs(ndcY) <= 1.02;
  const scale = Math.min(1.6, Math.max(0.78, 70 / camera.fov));

  return {
    x: ((ndcX + 1) / 2) * viewport.width,
    y: ((1 - ndcY) / 2) * viewport.height,
    visible,
    scale,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
