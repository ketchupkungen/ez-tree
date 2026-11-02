import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export const vec = (x, y, z) => new THREE.Vector3(x, y, z);

// Smooth unions give the torso/neck/limbs one continuous deformable surface.
function distance(part, x, y, z) {
  if (part.type === 'ellipsoid') {
    const dx = (x - part.a.x) / part.r[0],
      dy = (y - part.a.y) / part.r[1],
      dz = (z - part.a.z) / part.r[2];
    return (Math.sqrt(dx * dx + dy * dy + dz * dz) - 1) * Math.min(...part.r);
  }
  const dx = x - part.a.x,
    dy = y - part.a.y,
    dz = z - part.a.z;
  const t = clamp(
    (dx * part.delta.x + dy * part.delta.y + dz * part.delta.z) / part.len2,
  );
  const qx = dx - part.delta.x * t,
    qy = dy - part.delta.y * t,
    qz = dz - part.delta.z * t;
  return (
    Math.sqrt(qx * qx + qy * qy + qz * qz) -
    (part.r[0] + (part.r[1] - part.r[0]) * t)
  );
}

export class CreatureSurface {
  constructor(bones, colorAt, blend = 0.12) {
    this.bones = bones;
    this.colorAt = colorAt;
    this.blend = blend;
    this.parts = [];
    this.details = [];
  }
  ellipsoid(center, radii, bone) {
    this.parts.push({ type: 'ellipsoid', a: center, r: radii, bone });
  }
  capsule(a, b, radius, endRadius, bone, endBone = bone) {
    const delta = b.clone().sub(a);
    this.parts.push({
      type: 'capsule',
      a,
      b,
      delta,
      len2: Math.max(1e-8, delta.lengthSq()),
      r: [radius, endRadius],
      bone,
      endBone,
    });
  }
  field(x, y, z) {
    let d = 1000;
    for (const p of this.parts) {
      const blend =
        p.type === 'capsule'
          ? Math.min(this.blend, Math.max(0.008, Math.min(...p.r) * 0.7))
          : this.blend;
      const b = distance(p, x, y, z),
        h = Math.max(blend - Math.abs(d - b), 0) / blend;
      d = Math.min(d, b) - h * h * blend * 0.25;
    }
    return d;
  }
  skinAt(x, y, z) {
    const ds = this.parts.map((p) => distance(p, x, y, z)),
      nearest = Math.min(...ds),
      weights = new Map();
    const add = (bone, w) => weights.set(bone, (weights.get(bone) ?? 0) + w);
    this.parts.forEach((p, i) => {
      if (ds[i] - nearest > this.blend * 2) return;
      const w = Math.exp(
        (-(ds[i] - nearest) * 25) / Math.max(0.5, this.blend * 8),
      );
      if (p.endBone !== undefined && p.endBone !== p.bone) {
        const t = smooth(
          (clamp(
            ((x - p.a.x) * p.delta.x +
              (y - p.a.y) * p.delta.y +
              (z - p.a.z) * p.delta.z) /
              p.len2,
          ) -
            0.45) /
            0.5,
        );
        add(p.bone, w * (1 - t));
        add(p.endBone, w * t);
      } else add(p.bone, w);
    });
    const sorted = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 4),
      total = sorted.reduce((sum, [, w]) => sum + w, 0) || 1;
    while (sorted.length < 4) sorted.push([0, 0]);
    return {
      indices: sorted.map(([i, w]) => (w > 1e-8 ? i : 0)),
      weights: sorted.map(([, w]) => (w > 1e-8 ? w / total : 0)),
    };
  }
  detail(geometry, bone, color, matrix = new THREE.Matrix4()) {
    geometry.applyMatrix4(matrix);
    geometry.deleteAttribute('uv');
    const count = geometry.attributes.position.count,
      indices = [],
      weights = [],
      colors = [],
      c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      indices.push(bone, 0, 0, 0);
      weights.push(1, 0, 0, 0);
      colors.push(c.r, c.g, c.b);
    }
    if (!geometry.index)
      geometry.setIndex(Array.from({ length: count }, (_, i) => i));
    geometry.setAttribute(
      'skinIndex',
      new THREE.Uint16BufferAttribute(indices, 4),
    );
    geometry.setAttribute(
      'skinWeight',
      new THREE.Float32BufferAttribute(weights, 4),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.details.push(geometry);
  }
  sphere(center, radii, bone, color) {
    this.detail(
      new THREE.SphereGeometry(1, 16, 10),
      bone,
      color,
      new THREE.Matrix4().compose(
        center,
        new THREE.Quaternion(),
        vec(...radii),
      ),
    );
  }

  build(cellSize) {
    const bounds = new THREE.Box3();
    for (const p of this.parts) {
      const radius =
        p.type === 'ellipsoid'
          ? vec(...p.r)
          : vec(...Array(3).fill(Math.max(...p.r)));
      bounds.expandByPoint(p.a.clone().sub(radius));
      bounds.expandByPoint(p.a.clone().add(radius));
      if (p.b) {
        bounds.expandByPoint(p.b.clone().sub(radius));
        bounds.expandByPoint(p.b.clone().add(radius));
      }
    }
    bounds.expandByScalar(this.blend * 1.5 + cellSize);
    const size = bounds.getSize(new THREE.Vector3());
    const nx = Math.ceil(size.x / cellSize) + 1,
      ny = Math.ceil(size.y / cellSize) + 1,
      nz = Math.ceil(size.z / cellSize) + 1;
    if (nx * ny * nz > 2200000)
      throw new Error('Creature detail exceeds the mesh budget.');
    const field = new Float32Array(nx * ny * nz),
      sx = 1,
      sy = nx,
      sz = nx * ny;
    const coord = (id) => {
      const z = Math.floor(id / sz),
        rest = id - z * sz,
        y = Math.floor(rest / sy),
        x = rest - y * sy;
      return [
        bounds.min.x + x * cellSize,
        bounds.min.y + y * cellSize,
        bounds.min.z + z * cellSize,
      ];
    };
    for (let z = 0; z < nz; z++)
      for (let y = 0; y < ny; y++)
        for (let x = 0; x < nx; x++)
          field[x + y * sy + z * sz] = this.field(
            bounds.min.x + x * cellSize,
            bounds.min.y + y * cellSize,
            bounds.min.z + z * cellSize,
          );
    const positions = [],
      normals = [],
      colors = [],
      skinIndices = [],
      skinWeights = [],
      faces = [],
      edges = new Map(),
      total = field.length;
    const vertex = (a, b) => {
      const key = Math.min(a, b) * total + Math.max(a, b);
      if (edges.has(key)) return edges.get(key);
      const t = field[a] / (field[a] - field[b]),
        pa = coord(a),
        pb = coord(b),
        q = pa.map((v, i) => v + (pb[i] - v) * t),
        [x, y, z] = q;
      const e = cellSize * 0.15,
        n = vec(
          this.field(x + e, y, z) - this.field(x - e, y, z),
          this.field(x, y + e, z) - this.field(x, y - e, z),
          this.field(x, y, z + e) - this.field(x, y, z - e),
        ).normalize();
      const index = positions.length / 3,
        skin = this.skinAt(x, y, z),
        color = this.colorAt(x, y, z);
      positions.push(...q);
      normals.push(n.x, n.y, n.z);
      colors.push(color.r, color.g, color.b);
      skinIndices.push(...skin.indices);
      skinWeights.push(...skin.weights);
      edges.set(key, index);
      return index;
    };
    const face = (a, b, c) => {
      const pa = vec(...positions.slice(a * 3, a * 3 + 3)),
        pb = vec(...positions.slice(b * 3, b * 3 + 3)),
        pc = vec(...positions.slice(c * 3, c * 3 + 3));
      const cross = pb.sub(pa).cross(pc.sub(pa)),
        normal = vec(...normals.slice(a * 3, a * 3 + 3));
      if (cross.lengthSq() < 1e-18) return;
      if (cross.dot(normal) < 0) faces.push(a, c, b);
      else faces.push(a, b, c);
    };
    const tetrahedra = [
      [0, 5, 1, 6],
      [0, 1, 2, 6],
      [0, 2, 3, 6],
      [0, 3, 7, 6],
      [0, 7, 4, 6],
      [0, 4, 5, 6],
    ];
    for (let z = 0; z < nz - 1; z++)
      for (let y = 0; y < ny - 1; y++)
        for (let x = 0; x < nx - 1; x++) {
          const id = x + y * sy + z * sz,
            cube = [
              id,
              id + sx,
              id + sx + sy,
              id + sy,
              id + sz,
              id + sx + sz,
              id + sx + sy + sz,
              id + sy + sz,
            ];
          const insideCount = cube.reduce(
            (n, c) => n + (field[c] < 0 ? 1 : 0),
            0,
          );
          if (insideCount === 0 || insideCount === 8) continue;
          for (const tet of tetrahedra) {
            const inside = [],
              outside = [];
            tet.forEach((i) =>
              (field[cube[i]] < 0 ? inside : outside).push(cube[i]),
            );
            if (inside.length === 1 || inside.length === 3) {
              const single = inside.length === 1 ? inside : outside,
                other = inside.length === 1 ? outside : inside;
              face(...other.map((b) => vertex(single[0], b)));
            } else if (inside.length === 2) {
              const a = vertex(inside[0], outside[0]),
                b = vertex(inside[0], outside[1]),
                c = vertex(inside[1], outside[0]),
                d = vertex(inside[1], outside[1]);
              face(a, b, c);
              face(b, d, c);
            }
          }
        }
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(faces);
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(normals, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute(
      'skinIndex',
      new THREE.Uint16BufferAttribute(skinIndices, 4),
    );
    geometry.setAttribute(
      'skinWeight',
      new THREE.Float32BufferAttribute(skinWeights, 4),
    );
    const sources = [geometry, ...this.details],
      merged = mergeGeometries(sources, false);
    sources.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    return merged;
  }
}

export function taperedTube(points, radii, radial = 8) {
  const positions = [],
    indices = [];
  points.forEach((p, i) => {
    const tangent = points[Math.min(i + 1, points.length - 1)]
      .clone()
      .sub(points[Math.max(i - 1, 0)])
      .normalize();
    const u = tangent
        .clone()
        .cross(Math.abs(tangent.y) > 0.9 ? vec(1, 0, 0) : vec(0, 1, 0))
        .normalize(),
      v = tangent.clone().cross(u);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2,
        q = p
          .clone()
          .addScaledVector(u, Math.cos(a) * radii[i])
          .addScaledVector(v, Math.sin(a) * radii[i]);
      positions.push(q.x, q.y, q.z);
    }
    if (i)
      for (let j = 0; j < radial; j++) {
        const a = (i - 1) * radial + j,
          b = (i - 1) * radial + ((j + 1) % radial),
          c = i * radial + j,
          d = i * radial + ((j + 1) % radial);
        indices.push(a, c, b, b, c, d);
      }
  });
  for (let j = 1; j < radial - 1; j++) {
    indices.push(0, j, j + 1);
    const a = (points.length - 1) * radial;
    indices.push(a, a + j + 1, a + j);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
