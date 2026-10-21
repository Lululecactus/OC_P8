export const PANEL_WIDTH = 4.4;
export const PANEL_HEIGHT = 2.8;
export const PANEL_GAP = 0.025;

// A single profile in world space: crossing a project boundary never resets it.
export function ribbonDepth(x, mobile = false) {
  return (mobile ? 1.05 : 1.35) * Math.sin(x * 0.72 + 2.2);
}

export function ribbonLift(x) {
  return x * 0.045;
}

export function deformRibbonGeometry(geometry, center, mobile = false) {
  const positions = geometry.getAttribute('position');
  const { width, height, widthSegments, heightSegments } = geometry.parameters;
  const columns = widthSegments + 1;
  for (let column = 0; column < columns; column++) {
    const x = center + (column / widthSegments - 0.5) * width;
    const z = ribbonDepth(x, mobile);
    for (let row = 0; row <= heightSegments; row++) {
      const index = row * columns + column;
      positions.setX(index, x);
      positions.setY(index, (0.5 - row / heightSegments) * height + ribbonLift(x));
      positions.setZ(index, z);
    }
  }
  positions.needsUpdate = true;
  // Keep raycasting and culling aligned with the actual surface, including after a loop.
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
