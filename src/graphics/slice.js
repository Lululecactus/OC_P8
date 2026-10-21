import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';

function capAt(triangles, plane, axis, sign) {
  const u = (axis + 1) % 3,
    v = (axis + 2) % 3;
  const nodes = new Map(),
    edges = [];
  const key = (p) => `${Math.round(p[u] * 1e5)}:${Math.round(p[v] * 1e5)}`;
  for (const triangle of triangles) {
    const intersections = [];
    for (let i = 0; i < 3; i++) {
      const a = triangle[i],
        b = triangle[(i + 1) % 3];
      const da = a.p[axis] - plane,
        db = b.p[axis] - plane;
      if (da * db < 0)
        intersections.push(
          a.p.map((value, index) => value + ((b.p[index] - value) * da) / (da - db)),
        );
    }
    if (intersections.length !== 2) continue;
    const [a, b] = intersections.map((p) => {
      const k = key(p);
      if (!nodes.has(k)) nodes.set(k, { p, edges: [] });
      return k;
    });
    if (a === b) continue;
    const id = edges.length;
    edges.push({ a, b, used: false });
    nodes.get(a).edges.push(id);
    nodes.get(b).edges.push(id);
  }
  const positions = [],
    normals = [];
  for (const first of edges) {
    if (first.used) continue;
    first.used = true;
    const loop = [nodes.get(first.a).p],
      start = first.a;
    let current = first.b,
      guard = 0;
    while (current !== start && guard++ < edges.length) {
      loop.push(nodes.get(current).p);
      const nextId = nodes.get(current).edges.find((id) => !edges[id].used);
      if (nextId === undefined) break;
      const edge = edges[nextId];
      edge.used = true;
      current = edge.a === current ? edge.b : edge.a;
    }
    if (current !== start || loop.length < 3) continue;
    const faces = ShapeUtils.triangulateShape(
      loop.map((p) => new Vector2(p[u], p[v])),
      [],
    );
    for (const face of faces) {
      let [a, b, c] = face.map((i) => loop[i]);
      const cross = (b[u] - a[u]) * (c[v] - a[v]) - (b[v] - a[v]) * (c[u] - a[u]);
      if (cross * sign < 0) [b, c] = [c, b];
      const normal = [0, 0, 0];
      normal[axis] = sign;
      positions.push(...a, ...b, ...c);
      normals.push(...normal, ...normal, ...normal);
    }
  }
  return { positions, normals };
}

// Clip the actual mesh into slabs, retaining interpolated normals and UVs.
// Separate cap geometry gives the exposed cross-sections their own material.
export function sliceGeometry(source, count = 8) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const triangles = [];
  for (let i = 0; i < position.count; i += 3) {
    triangles.push(
      [0, 1, 2].map((offset) => {
        const j = i + offset;
        return {
          p: [position.getX(j), position.getY(j), position.getZ(j)],
          n: [normal.getX(j), normal.getY(j), normal.getZ(j)],
          uv: uv ? [uv.getX(j), uv.getY(j)] : [0, 0],
        };
      }),
    );
  }
  const interpolate = (a, b, t) => ({
    p: a.p.map((v, i) => v + (b.p[i] - v) * t),
    n: a.n.map((v, i) => v + (b.n[i] - v) * t),
    uv: a.uv.map((v, i) => v + (b.uv[i] - v) * t),
  });
  function clip(polygon, plane, direction) {
    const output = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const da = (a.p[2] - plane) * direction,
        db = (b.p[2] - plane) * direction;
      if (da >= -1e-7) output.push(a);
      if ((da > 1e-7 && db < -1e-7) || (da < -1e-7 && db > 1e-7))
        output.push(interpolate(a, b, da / (da - db)));
    }
    return output;
  }
  const parts = [];
  for (let part = 0; part < count; part++) {
    const low = min.z + ((max.z - min.z) * part) / count;
    const high = min.z + ((max.z - min.z) * (part + 1)) / count;
    const positions = [],
      normals = [],
      uvs = [];
    for (const triangle of triangles) {
      const polygon = clip(clip(triangle, low, 1), high, -1);
      for (let j = 1; j < polygon.length - 1; j++) {
        for (const vertex of [polygon[0], polygon[j], polygon[j + 1]]) {
          positions.push(...vertex.p);
          normals.push(...vertex.n);
          uvs.push(...vertex.uv);
        }
      }
    }
    const body = new BufferGeometry();
    body.setAttribute('position', new Float32BufferAttribute(positions, 3));
    body.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    body.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    body.normalizeNormals();
    body.computeBoundingSphere();
    const lower = part > 0 ? capAt(triangles, low, 2, -1) : { positions: [], normals: [] };
    const upper = part < count - 1 ? capAt(triangles, high, 2, 1) : { positions: [], normals: [] };
    const caps = new BufferGeometry();
    caps.setAttribute(
      'position',
      new Float32BufferAttribute([...lower.positions, ...upper.positions], 3),
    );
    caps.setAttribute(
      'normal',
      new Float32BufferAttribute([...lower.normals, ...upper.normals], 3),
    );
    parts.push({ body, caps });
  }
  geometry.dispose();
  return parts;
}

// Remove the scan's shoulders to keep a compact sculptural portrait.
export function cropAbove(source, threshold) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const p = geometry.getAttribute('position'),
    n = geometry.getAttribute('normal'),
    uv = geometry.getAttribute('uv');
  const positions = [],
    normals = [],
    uvs = [],
    triangles = [];
  for (let i = 0; i < p.count; i += 3) {
    const triangle = [0, 1, 2].map((offset) => {
      const j = i + offset;
      return {
        p: [p.getX(j), p.getY(j), p.getZ(j)],
        n: [n.getX(j), n.getY(j), n.getZ(j)],
        uv: uv ? [uv.getX(j), uv.getY(j)] : [0, 0],
      };
    });
    triangles.push(triangle);
    const polygon = [];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j],
        b = triangle[(j + 1) % 3],
        da = a.p[1] - threshold,
        db = b.p[1] - threshold;
      if (da >= 0) polygon.push(a);
      if (da * db < 0) {
        const t = da / (da - db);
        polygon.push({
          p: a.p.map((v, k) => v + (b.p[k] - v) * t),
          n: a.n.map((v, k) => v + (b.n[k] - v) * t),
          uv: a.uv.map((v, k) => v + (b.uv[k] - v) * t),
        });
      }
    }
    for (let j = 1; j < polygon.length - 1; j++)
      for (const v of [polygon[0], polygon[j], polygon[j + 1]]) {
        positions.push(...v.p);
        normals.push(...v.n);
        uvs.push(...v.uv);
      }
  }
  const cap = capAt(triangles, threshold, 1, -1);
  positions.push(...cap.positions);
  normals.push(...cap.normals);
  uvs.push(...Array((cap.positions.length / 3) * 2).fill(0));
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(positions, 3));
  result.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  result.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  result.normalizeNormals();
  geometry.dispose();
  return result;
}
