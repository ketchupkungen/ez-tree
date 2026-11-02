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
export const creaturePresets = {
  Mossback: {
    seed: 42,
    length: 4,
    girth: 1,
    legPairs: 2,
    legLength: 1.6,
    headSize: 0.8,
    tailLength: 2.4,
    horns: 2,
    color: '#719b85',
    accent: '#e3c994',
  },
  'Dune crawler': {
    seed: 320,
    length: 5,
    girth: 0.7,
    legPairs: 4,
    legLength: 1.2,
    headSize: 0.6,
    tailLength: 1.8,
    horns: 4,
    color: '#c49762',
    accent: '#5f594c',
  },
  'Little grazer': {
    seed: 64,
    length: 2.6,
    girth: 0.9,
    legPairs: 2,
    legLength: 2.4,
    headSize: 1.1,
    tailLength: 0.6,
    horns: 0,
    color: '#ad8baf',
    accent: '#e8d8bd',
  },
};
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

/** Symmetric static creature assembled from seeded organic forms and jointed limbs. */
export function generateCreature(p) {
  const g = new THREE.Group();
  g.name = 'Creature';
  const rnd = randomSource(p.seed);
  const skin = material(p.color),
    accent = material(p.accent),
    eyes = material('#111d22'),
    white = material('#f2ead6');
  const y = p.legLength + p.girth * 0.5;
  ball(g, skin, v(0, y, 0), [p.length * 0.5, p.girth, p.girth * 0.72]);
  const head = v(p.length * 0.49 + p.headSize * 0.4, y + p.girth * 0.35, 0);
  tube(
    g,
    skin,
    [v(p.length * 0.32, y, 0), head],
    p.girth * 0.45,
    p.headSize * 0.55,
  );
  ball(g, skin, head, [p.headSize, p.headSize * 0.8, p.headSize * 0.7]);
  ball(
    g,
    accent,
    head.clone().add(v(p.headSize * 0.65, -p.headSize * 0.25, 0)),
    [p.headSize * 0.6, p.headSize * 0.4, p.headSize * 0.55],
  );
  for (const side of [-1, 1]) {
    const eye = head
      .clone()
      .add(v(p.headSize * 0.42, p.headSize * 0.25, side * p.headSize * 0.6));
    ball(g, white, eye, [
      p.headSize * 0.21,
      p.headSize * 0.23,
      p.headSize * 0.13,
    ]);
    ball(
      g,
      eyes,
      eye.clone().add(v(p.headSize * 0.06, 0, side * p.headSize * 0.1)),
      [p.headSize * 0.11, p.headSize * 0.14, p.headSize * 0.07],
    );
    const ear = ball(
      g,
      accent,
      head
        .clone()
        .add(
          v(-p.headSize * 0.35, p.headSize * 0.65, side * p.headSize * 0.55),
        ),
      [p.headSize * 0.38, p.headSize * 0.18, p.headSize * 0.25],
    );
    ear.rotation.x = side * 0.4;
  }
  for (let i = 0; i < p.legPairs; i++) {
    const x =
      p.legPairs === 1 ? 0 : (-0.32 + (i / (p.legPairs - 1)) * 0.64) * p.length;
    const spread = p.girth * (1 + rnd() * 0.5);
    for (const side of [-1, 1]) {
      const hip = v(x, y, side * p.girth * 0.5),
        knee = v(x + 0.18, p.legLength * 0.55, side * spread),
        foot = v(x - 0.16, 0.17, side * spread * 1.1);
      tube(g, skin, [hip, knee], p.girth * 0.23, p.girth * 0.15);
      ball(g, skin, knee, [p.girth * 0.2, p.girth * 0.2, p.girth * 0.2]);
      tube(g, skin, [knee, foot], p.girth * 0.15, p.girth * 0.11);
      ball(g, accent, foot, [p.girth * 0.36, 0.17, p.girth * 0.24]);
    }
  }
  if (p.tailLength > 0) {
    const base = v(-p.length * 0.42, y, 0),
      tip = v(-p.length * 0.5 - p.tailLength, y + p.tailLength * 0.35, 0);
    tube(
      g,
      skin,
      [base, v(base.x - p.tailLength * 0.5, y - 0.2, 0), tip],
      p.girth * 0.16,
    );
    ball(g, accent, tip, [p.girth * 0.25, p.girth * 0.25, p.girth * 0.25]);
  }
  for (let i = 0; i < p.horns; i++) {
    const x = head.x - p.headSize * 0.4 - i * p.length * 0.18,
      h = (0.4 + rnd() * 0.5) * p.girth;
    const horn = mesh(
      g,
      new THREE.ConeGeometry(p.girth * 0.18, h, 8),
      accent,
      v(x, y + p.girth * 0.85 + h * 0.4, 0),
    );
    horn.rotation.z = 0.25;
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
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
