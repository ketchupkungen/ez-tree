import * as THREE from 'three';

export const plantPresets = {
  'Meadow bloom': {
    seed: 42,
    height: 4,
    stems: 5,
    leaves: 8,
    leafSize: 1,
    petals: 8,
    flowerSize: 0.65,
    bend: 0.4,
    color: '#729a58',
    accent: '#e5aa68',
  },
  Fern: {
    seed: 125,
    height: 3.4,
    stems: 7,
    leaves: 20,
    leafSize: 1.15,
    petals: 0,
    flowerSize: 0.5,
    bend: 1.4,
    color: '#488368',
    accent: '#e5aa68',
  },
  Broadleaf: {
    seed: 82,
    height: 3,
    stems: 3,
    leaves: 7,
    leafSize: 1.8,
    petals: 0,
    flowerSize: 0.5,
    bend: 0.5,
    color: '#598e55',
    accent: '#d1a6d9',
  },
};
export { creaturePresets, generateCreature } from '../creature/creatures.js';
export function randomSource(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const material = (color) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
function mesh(group, geometry, mat, position, scale) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.copy(position);
  if (scale) m.scale.set(...scale);
  m.castShadow = m.receiveShadow = true;
  group.add(m);
  return m;
}
function ball(g, mat, p, s) {
  return mesh(g, new THREE.SphereGeometry(1, 20, 12), mat, p, s);
}
function tube(g, mat, points, radius, endRadius = radius) {
  if (points.length === 2) {
    const delta = points[1].clone().sub(points[0]);
    const m = mesh(
      g,
      new THREE.CylinderGeometry(endRadius, radius, delta.length(), 10),
      mat,
      points[0].clone().add(points[1]).multiplyScalar(0.5),
    );
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return m;
  }
  return mesh(
    g,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      20,
      radius,
      8,
      false,
    ),
    mat,
    new THREE.Vector3(),
  );
}
const v = (x, y, z) => new THREE.Vector3(x, y, z);

/** Curved, double-sided leaf with explicit surface geometry (no image dependency). */
function leaf(g, mat, base, angle, length, width, rise = 0.4) {
  const positions = [],
    indices = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10,
      w = Math.sin(Math.PI * t) * width;
    for (const side of [-1, 1])
      positions.push(
        t * length,
        Math.sin(t * Math.PI) * rise +
          t * rise * 0.4 -
          Math.abs(side * w) * 0.12,
        side * w,
      );
    if (i < 10) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const m = mesh(g, geo, mat, base);
  m.rotation.y = angle;
  return m;
}

export function generatePlant(p) {
  const g = new THREE.Group();
  g.name = 'Plant';
  const rnd = randomSource(p.seed);
  const green = material(p.color),
    flower = material(p.accent),
    center = material('#d8bb64');
  for (let s = 0; s < p.stems; s++) {
    const a = s * 2.39996 + rnd() * 0.5,
      h = p.height * (0.7 + rnd() * 0.3),
      reach = p.bend * (0.7 + rnd() * 0.6);
    const curve = new THREE.CatmullRomCurve3([
      v(0, 0, 0),
      v(Math.cos(a) * reach * 0.25, h * 0.5, Math.sin(a) * reach * 0.25),
      v(Math.cos(a) * reach, h, Math.sin(a) * reach),
    ]);
    mesh(
      g,
      new THREE.TubeGeometry(curve, 24, 0.045, 7, false),
      green,
      v(0, 0, 0),
    );
    for (let i = 0; i < p.leaves; i++) {
      const t = 0.12 + (i / Math.max(1, p.leaves - 1)) * 0.78,
        pos = curve.getPoint(t);
      const size =
        p.leafSize * (0.5 + Math.sin(t * Math.PI) * 0.5) * (0.85 + rnd() * 0.3);
      leaf(g, green, pos, a + i * 2.39996, size, size * 0.24, size * 0.28);
    }
    const top = curve.getPoint(1);
    if (p.petals > 0) {
      ball(g, center, top, [p.flowerSize * 0.27, 0.16, p.flowerSize * 0.27]);
      for (let i = 0; i < p.petals; i++)
        leaf(
          g,
          flower,
          top,
          (i * Math.PI * 2) / p.petals,
          p.flowerSize,
          p.flowerSize * 0.3,
          p.flowerSize * 0.18,
        );
    }
  }
  return g;
}

export function disposeModel(model) {
  const geometries = new Set(),
    materials = new Set();
  model.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material)
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
  });
  const skeletons = new Set();
  model.traverse((o) => {
    if (o.isSkinnedMesh) skeletons.add(o.skeleton);
  });
  skeletons.forEach((s) => s.dispose());
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
