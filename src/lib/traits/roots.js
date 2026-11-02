import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const rootDefaults = {
  enabled: false,
  count: 7,
  spread: 8,
  thickness: 0.65,
  forks: 2,
  ground: 'Flat',
  relief: 2,
  bakeTerrain: false,
};
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Same contact law as Rune MAP003 RootField015: weight * (height(vertex)-height(anchor)).
// Coordinates here are local right-handed Y-up; the native game uses cm/Z-up.
export function conformRoots(
  geometry,
  sampleHeight,
  anchor = new THREE.Vector3(),
) {
  const position = geometry.attributes.position,
    rest = geometry.attributes.rootRest ?? position.clone(),
    contact = geometry.attributes.uv1;
  geometry.setAttribute('rootRest', rest);
  const base = sampleHeight(anchor.x, anchor.z);
  for (let i = 0; i < position.count; i++)
    position.setXYZ(
      i,
      rest.getX(i),
      rest.getY(i) +
        contact.getY(i) *
          (sampleHeight(rest.getX(i) + anchor.x, rest.getZ(i) + anchor.z) -
            base),
      rest.getZ(i),
    );
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function rootTerrain(options = {}, radius = 1) {
  const settings = { ...rootDefaults, ...options };
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(settings.relief) ||
    settings.relief < 0 ||
    settings.relief > 6 ||
    !Number.isFinite(settings.spread) ||
    settings.spread < 2 ||
    settings.spread > 14 ||
    !['Flat', 'Slope', 'Rocky'].includes(settings.ground)
  )
    throw new Error('Invalid root terrain settings.');
  const reach = Math.max(4, radius * settings.spread),
    edge = reach * 2.5;
  const raw = (x, z) =>
    settings.ground === 'Slope'
      ? (x * settings.relief) / reach
      : settings.ground === 'Rocky'
        ? settings.relief *
          (Math.exp(
            -((x - reach * 0.42) ** 2 + (z + reach * 0.12) ** 2) /
              (reach * 0.23) ** 2,
          ) +
            0.3 * Math.sin(x * 0.65) * Math.sin(z * 0.45))
        : 0;
  const origin = raw(0, 0);
  return (x, z) =>
    (raw(x, z) - origin) * (1 - smooth(reach * 1.25, edge, Math.hypot(x, z)));
}

function tube(points, radii, sides, flatten, radius, chart) {
  const positions = [],
    normals = [],
    uvs = [],
    contact = [],
    indices = [];
  let arc = 0,
    right;
  points.forEach((point, i) => {
    const tangent = points[Math.min(i + 1, points.length - 1)]
      .clone()
      .sub(points[Math.max(i - 1, 0)])
      .normalize();
    right = right
      ? right.clone().addScaledVector(tangent, -right.dot(tangent)).normalize()
      : new THREE.Vector3()
          .crossVectors(
            tangent,
            Math.abs(tangent.y) > 0.85
              ? new THREE.Vector3(0, 0, 1)
              : new THREE.Vector3(0, 1, 0),
          )
          .normalize();
    const up = new THREE.Vector3().crossVectors(tangent, right).normalize();
    if (i) arc += point.distanceTo(points[i - 1]);
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2,
        r = radii[i] * (1 + 0.04 * Math.sin(angle * 3 + chart));
      const p = point
        .clone()
        .addScaledVector(right, r * Math.cos(angle))
        .addScaledVector(up, r * flatten * Math.sin(angle));
      positions.push(p.x, p.y, p.z);
      const normal = p.clone().sub(point).normalize();
      normals.push(normal.x, normal.y, normal.z);
      uvs.push((j / sides) * Math.max(1, Math.round(radius * 2)), arc * 0.35);
      contact.push(
        chart,
        smooth(radius * 0.55, radius * 1.55, Math.hypot(p.x, p.z)) *
          (1 - smooth(radius * 0.85, radius * 2.5, p.y)),
      );
      if (i && j < sides) {
        const a = (i - 1) * (sides + 1) + j,
          b = a + 1,
          c = i * (sides + 1) + j;
        indices.push(a, b, c, b, c + 1, c);
      }
    }
  });
  // Closed root tips/base; UV1 also carries contact weight on cap vertices.
  for (const [i, reverse] of [
    [0, true],
    [points.length - 1, false],
  ]) {
    const p = points[i],
      index = positions.length / 3;
    positions.push(p.x, p.y, p.z);
    normals.push(0, reverse ? -1 : 1, 0);
    uvs.push(0.5, 0.5);
    contact.push(
      chart,
      smooth(radius * 0.55, radius * 1.55, Math.hypot(p.x, p.z)) *
        (1 - smooth(radius * 0.85, radius * 2.5, p.y)),
    );
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      if (reverse) indices.push(index, a + 1, a);
      else indices.push(index, a, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(contact, 2));
  g.setIndex(indices);
  return g;
}

export function createRootGeometry(radius, seed, options = {}, lod = 0) {
  const settings = { ...rootDefaults, ...options },
    random = rng(seed ^ 0x6a09e667),
    geometries = [],
    profiles = [];
  const steps = [18, 10, 5][lod],
    sides = [12, 8, 5][lod];
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isInteger(settings.count) ||
    settings.count < 3 ||
    settings.count > 16 ||
    !Number.isFinite(settings.spread) ||
    settings.spread < 2 ||
    settings.spread > 14 ||
    !Number.isFinite(settings.thickness) ||
    settings.thickness < 0.2 ||
    settings.thickness > 1.2 ||
    !Number.isInteger(settings.forks) ||
    settings.forks < 0 ||
    settings.forks > 3 ||
    !Number.isInteger(lod) ||
    lod < 0 ||
    lod > 2
  )
    throw new Error('Invalid root trait parameters.');
  for (let j = 0; j < settings.count; j++) {
    const angle = (j * Math.PI * 2) / settings.count + (random() - 0.5) * 0.35,
      length = radius * settings.spread * (0.8 + random() * 0.4),
      width = radius * settings.thickness * (0.85 + random() * 0.3),
      curl = (random() - 0.5) * 0.42;
    const path = (t) => {
      const a = angle + curl * Math.sin(Math.PI * t),
        r = radius * 0.3 + length * t;
      return new THREE.Vector3(
        Math.cos(a) * r,
        width * 0.08 * Math.sin(Math.PI * t) * (1 - t),
        Math.sin(a) * r,
      );
    };
    const points = [],
      radii = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      points.push(path(t));
      radii.push(
        Math.max(radius * 0.009, width * (1 - t) ** 1.22) *
          (1 + 0.58 * Math.exp(-((t / 0.17) ** 2))),
      );
    }
    geometries.push(tube(points, radii, sides, 0.6, radius, j + 1));
    profiles.push({
      id: j,
      parentId: null,
      points: points.map((p) => p.toArray()),
      radii,
    });
    for (let k = 0; k < settings.forks; k++) {
      const t = 0.32 + k * 0.19 + (random() - 0.5) * 0.06,
        origin = path(t),
        az = angle + ((j + k) % 2 ? 1 : -1) * (0.45 + random() * 0.6),
        extent = length * (0.28 + random() * 0.2),
        r = width * (1 - t) ** 1.22 * 0.48;
      const fork = [],
        rs = [];
      for (let v = 0; v <= Math.max(3, steps - 4); v++) {
        const f = v / Math.max(3, steps - 4),
          a = az + 0.13 * Math.sin(f * 4);
        fork.push(
          origin
            .clone()
            .add(
              new THREE.Vector3(
                Math.cos(a) * extent * f,
                -origin.y * (1 - (1 - f) ** 3),
                Math.sin(a) * extent * f,
              ),
            ),
        );
        rs.push(Math.max(radius * 0.006, r * (1 - f) ** 1.15));
      }
      geometries.push(
        tube(fork, rs, Math.max(4, sides - 3), 0.65, radius, 40 + j * 3 + k),
      );
      profiles.push({
        id: `fork_${j}_${k}`,
        parentId: j,
        points: fork.map((p) => p.toArray()),
        radii: rs,
      });
    }
  }
  // Lobed buttress collar encloses the original trunk base; lateral roots emerge
  // into the same visible collar. Unlike Blender authoring, no voxel union is run.
  const collar = [],
    collarRadius = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    collar.push(new THREE.Vector3(0, radius * (-0.35 + t * 0.95), 0));
    collarRadius.push(radius * (0.92 + 0.58 * (1 - t) ** 2));
  }
  geometries.push(
    tube(collar, collarRadius, Math.max(12, sides * 2), 1, radius, 0),
  );
  const geometry = mergeGeometries(geometries, false);
  geometries.forEach((g) => g.dispose());
  geometry.setAttribute('rootRest', geometry.attributes.position.clone());
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, profiles };
}
