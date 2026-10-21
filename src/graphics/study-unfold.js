import { Vector3 } from 'three';

export function smoothRange(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function coverScale(imageAspect, viewportAspect) {
  return imageAspect > viewportAspect
    ? [viewportAspect / imageAspect, 1]
    : [1, imageAspect / viewportAspect];
}

const point = new Vector3();
const target = new Vector3();

// Morph the actual picked surface into a plane parallel to the camera.
// A small horizontal delay makes the surface unfold from one edge to the other.
export function unfoldGeometry(geometry, source, camera, progress) {
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const distance = 5;
  const height = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance;
  const width = height * camera.aspect;
  camera.updateMatrixWorld();
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i),
      v = uv.getY(i);
    const phase = smoothRange(u * 0.11, 0.89 + u * 0.11, progress);
    point.fromArray(source, i * 3);
    target.set((u - 0.5) * width, (v - 0.5) * height, -distance).applyMatrix4(camera.matrixWorld);
    point.lerp(target, phase);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
}
