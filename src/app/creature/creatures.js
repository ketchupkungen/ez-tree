import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { CreatureSurface, taperedTube, vec, clamp, smooth } from './surface.js';
import { createClips } from './locomotion.js';

const base = {
  seed: 42,
  bodyLength: 1,
  build: 1,
  legLength: 1,
  headSize: 1,
  neckLength: 1,
  muzzle: 1,
  earSize: 1,
  tailLength: 1,
  antlers: 1,
  finSize: 1,
  stride: 1,
  gaitSpeed: 1,
  sway: 1,
  detail: 1,
};
export const creaturePresets = {
  Wolf: {
    ...base,
    build: 0.92,
    headSize: 0.95,
    muzzle: 1.2,
    earSize: 0.9,
    tailLength: 1.1,
    species: 'wolf',
    color: '#777b78',
    accent: '#c4b9a2',
  },
  Elk: {
    ...base,
    seed: 53,
    species: 'elk',
    color: '#71503b',
    accent: '#bca17a',
  },
  Snake: {
    ...base,
    seed: 74,
    species: 'snake',
    color: '#64734b',
    accent: '#c5b58b',
  },
  Lizard: {
    ...base,
    seed: 91,
    species: 'lizard',
    color: '#526f53',
    accent: '#b8b48b',
  },
  Fish: {
    ...base,
    seed: 128,
    finSize: 0.85,
    species: 'fish',
    color: '#4d7886',
    accent: '#c7b78b',
  },
};
export const speciesFields = {
  wolf: [
    'bodyLength',
    'build',
    'legLength',
    'headSize',
    'neckLength',
    'muzzle',
    'earSize',
    'tailLength',
    'detail',
  ],
  elk: [
    'bodyLength',
    'build',
    'legLength',
    'headSize',
    'neckLength',
    'muzzle',
    'earSize',
    'antlers',
    'detail',
  ],
  snake: ['bodyLength', 'build', 'headSize', 'tailLength', 'detail'],
  lizard: [
    'bodyLength',
    'build',
    'legLength',
    'headSize',
    'muzzle',
    'tailLength',
    'detail',
  ],
  fish: ['bodyLength', 'build', 'headSize', 'tailLength', 'finSize', 'detail'],
};

class Rig {
  constructor(group) {
    this.group = group;
    this.bones = [];
    this.points = [];
    this.legs = [];
    this.tail = [];
    this.axial = [];
    this.add('Root', -1, vec(0, 0, 0));
  }
  add(name, parent, point) {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.copy(point);
    if (parent >= 0) {
      bone.position.sub(this.points[parent]);
      this.bones[parent].add(bone);
    } else this.group.add(bone);
    this.bones.push(bone);
    this.points.push(point.clone());
    return this.bones.length - 1;
  }
}

function eye(surface, center, scale, bone, side, amber = '#997338') {
  surface.sphere(center, [scale, scale * 0.8, scale * 0.55], bone, '#1e201a');
  surface.sphere(
    center.clone().add(vec(scale * 0.12, 0, side * scale * 0.4)),
    [scale * 0.55, scale * 0.58, scale * 0.22],
    bone,
    amber,
  );
  surface.sphere(
    center.clone().add(vec(scale * 0.17, 0, side * scale * 0.55)),
    [scale * 0.3, scale * 0.3, scale * 0.08],
    bone,
    '#0c100e',
  );
}

function quadruped(surface, rig, p, variant) {
  const elk = variant === 'elk',
    lizard = variant === 'lizard',
    length = (elk ? 3.5 : lizard ? 2.5 : 3.35) * p.bodyLength;
  const width = (elk ? 0.59 : lizard ? 0.43 : 0.47) * p.build;
  const hipY = (elk ? 2.45 : lizard ? 0.55 : 1.58) * p.legLength;
  const spine = rig.add('Spine', 0, vec(-length * 0.15, hipY, 0)),
    chest = rig.add(
      'Chest',
      spine,
      vec(length * 0.27, hipY + (elk ? 0.24 : lizard ? 0 : 0.08), 0),
    );
  const neckBase = vec(
    length * 0.34,
    hipY + (elk ? 0.4 : lizard ? 0.04 : 0.24),
    0,
  );
  const neckTop = neckBase
    .clone()
    .add(
      vec(
        (elk ? 0.45 : lizard ? 0.48 : 0.5) * p.neckLength,
        (elk ? 1.25 : lizard ? 0.08 : 0.55) * p.neckLength,
        0,
      ),
    );
  const neck = rig.add('Neck', chest, neckBase),
    head = rig.add('Head', neck, neckTop);
  rig.headName = 'Head';
  surface.ellipsoid(
    vec(-length * 0.1, hipY, 0),
    [length * 0.43, width * (elk ? 1.38 : lizard ? 0.64 : 1.25), width],
    spine,
  );
  surface.ellipsoid(
    vec(length * 0.24, hipY + 0.04, 0),
    [length * 0.27, width * (elk ? 1.6 : lizard ? 0.7 : 1.5), width * 1.04],
    chest,
  );
  surface.ellipsoid(
    vec(-length * 0.35, hipY + 0.02, 0),
    [length * 0.2, width * (lizard ? 0.65 : 1.22), width * 0.94],
    spine,
  );
  surface.capsule(
    neckBase,
    neckTop,
    width * (elk ? 0.86 : lizard ? 0.7 : 0.92),
    width * 0.53,
    neck,
    head,
  );
  if (elk)
    surface.ellipsoid(
      neckBase.clone().add(vec(0.05, -0.25, 0)),
      [0.34, 0.75, 0.32],
      neck,
    );
  const skull = neckTop.clone().add(vec(0.19 * p.headSize, 0.03, 0)),
    h = p.headSize;
  surface.ellipsoid(
    skull,
    [
      (lizard ? 0.5 : elk ? 0.42 : 0.4) * h,
      (elk ? 0.34 : lizard ? 0.2 : 0.34) * h,
      (lizard ? 0.32 : 0.25) * h,
    ],
    head,
  );
  const snout = skull
    .clone()
    .add(vec((elk ? 0.55 : lizard ? 0.46 : 0.43) * h * p.muzzle, -0.13 * h, 0));
  surface.capsule(
    skull.clone().add(vec(0.13, -0.09, 0)),
    snout,
    h * (elk ? 0.22 : lizard ? 0.19 : 0.19),
    h * (elk ? 0.19 : lizard ? 0.11 : 0.115),
    head,
  );
  surface.sphere(
    snout.clone().add(vec(0.075 * h, 0.01, 0)),
    [h * 0.12, h * 0.08, h * (elk ? 0.17 : 0.11)],
    head,
    lizard ? '#344735' : '#24241f',
  );
  // A restrained mouth line, nostrils and small inset eyes replace cartoon whites.
  for (const side of [-1, 1]) {
    eye(
      surface,
      skull
        .clone()
        .add(
          vec(
            (elk ? 0.09 : lizard ? 0.18 : 0.1) * h,
            (lizard ? 0.09 : 0.08) * h,
            side * (lizard ? 0.27 : 0.222) * h,
          ),
        ),
      h * (lizard ? 0.06 : 0.045),
      head,
      side,
    );
    surface.detail(
      taperedTube(
        [
          skull.clone().add(vec(0.21 * h, -0.19 * h, side * 0.18 * h)),
          snout.clone().add(vec(0, -0.055 * h, side * 0.1 * h)),
        ],
        [0.012, 0.008],
        6,
      ),
      head,
      '#3c3930',
    );
    if (!lizard) {
      const earBase = skull
          .clone()
          .add(vec(-0.14 * h, 0.23 * h, side * 0.18 * h)),
        ear = p.earSize * h;
      const tip = earBase
        .clone()
        .add(
          vec(
            elk ? -0.15 * ear : 0.02,
            (elk ? 0.23 : 0.33) * ear,
            side * (elk ? 0.42 : 0.09) * ear,
          ),
        );
      surface.detail(
        new ConvexGeometry([
          earBase.clone().add(vec(0.17 * ear, 0, 0)),
          earBase.clone().add(vec(-0.17 * ear, 0, 0)),
          earBase.clone().add(vec(0, 0, side * 0.12 * ear)),
          tip,
        ]),
        head,
        p.color,
      );
      surface.detail(
        new ConvexGeometry([
          earBase.clone().add(vec(0.11 * ear, 0.04, side * 0.012)),
          earBase.clone().add(vec(-0.1 * ear, 0.04, side * 0.012)),
          tip.clone().add(vec(0.015, -0.07 * ear, -side * 0.01)),
          earBase.clone().add(vec(0, 0.08, side * 0.035)),
        ]),
        head,
        '#9d8d7e',
      );
    }
  }

  for (const front of [true, false])
    for (const side of [-1, 1]) {
      const name = `${front ? 'Fore' : 'Hind'}_${side < 0 ? 'L' : 'R'}`;
      const x = (front ? 0.3 : -0.36) * length,
        hip = vec(
          x,
          hipY + (front ? 0.05 : 0),
          side * width * (lizard ? 0.9 : 0.68),
        );
      const knee = vec(
        x + (front ? -0.14 : 0.36) * (lizard ? 0.8 : 1),
        hipY * (lizard ? 0.62 : 0.57),
        side * width * (lizard ? 1.85 : 0.83),
      );
      const foot = vec(
        x + (front ? 0.05 : -0.05),
        lizard ? 0.07 : 0.13,
        side * width * (lizard ? 2.25 : 0.86),
      );
      const upper = rig.add(`${name}_Upper`, front ? chest : spine, hip),
        lower = rig.add(`${name}_Lower`, upper, knee),
        ankle = rig.add(`${name}_Foot`, lower, foot);
      rig.legs.push({
        hip,
        knee,
        foot,
        upperName: `${name}_Upper`,
        lowerName: `${name}_Lower`,
        footName: `${name}_Foot`,
        phase: front ? (side < 0 ? 0 : 0.5) : side < 0 ? 0.7 : 0.2,
      });
      const muscle = width * (front ? (elk ? 0.43 : 0.46) : 0.64),
        thin = width * (elk ? 0.12 : lizard ? 0.18 : 0.18);
      surface.capsule(hip, knee, muscle, thin * 1.2, upper, lower);
      surface.capsule(knee, foot, thin * 1.2, thin * 0.75, lower, ankle);
      if (elk) {
        for (const split of [-1, 1])
          surface.sphere(
            foot.clone().add(vec(0.05, -0.045, split * 0.052)),
            [0.17, 0.105, 0.048],
            ankle,
            '#353329',
          );
      } else if (lizard) {
        for (let toe = 0; toe < 4; toe++) {
          const end = foot
            .clone()
            .add(
              vec(
                0.22 - toe * 0.09,
                -0.015,
                side * (0.13 + Math.sin((toe / 3) * Math.PI) * 0.12),
              ),
            );
          surface.detail(
            taperedTube([foot, end], [0.035, 0.012], 6),
            ankle,
            p.color,
          );
        }
      } else {
        surface.ellipsoid(
          foot.clone().add(vec(0.09, -0.015, 0)),
          [0.22, 0.13, 0.145],
          ankle,
        );
        for (let toe = -1; toe <= 1; toe++)
          surface.sphere(
            foot.clone().add(vec(0.21, -0.025, toe * 0.075)),
            [0.075, 0.08, 0.045],
            ankle,
            p.accent,
          );
      }
    }
  // A tapered, articulated tail with species-specific carriage.
  const tailLength = (elk ? 0.35 : lizard ? 2.9 : 1.65) * p.tailLength;
  let last = spine,
    previous = vec(-length * 0.47, hipY + (elk ? 0.1 : 0.02), 0);
  for (let i = 0; i <= 5; i++) {
    const t = i / 5,
      point = vec(
        -length * 0.47 - tailLength * t,
        hipY +
          (lizard
            ? -0.34 * t
            : -tailLength * 0.48 * Math.sin(t * Math.PI * 0.6)),
        Math.sin(t * Math.PI) * 0.07,
      );
    const bone = rig.add(`Tail_${i}`, last, point);
    rig.tail.push(`Tail_${i}`);
    if (i)
      surface.capsule(
        previous,
        point,
        Math.max(
          0.018,
          width * (lizard ? 0.52 : 0.45) * (1 - (i - 1) / 5) ** 0.7,
        ),
        Math.max(0.012, width * 0.45 * (1 - t) ** 0.7),
        last,
        bone,
      );
    last = bone;
    previous = point;
  }

  if (elk && p.antlers > 0)
    for (const side of [-1, 1]) {
      const origin = skull.clone().add(vec(-0.12, 0.26 * h, side * 0.15 * h)),
        a = p.antlers;
      const beam = [
        origin,
        origin.clone().add(vec(-0.12, 0.45 * a, side * 0.24 * a)),
        origin.clone().add(vec(-0.45 * a, 0.9 * a, side * 0.5 * a)),
        origin.clone().add(vec(-0.8 * a, 1.3 * a, side * 0.7 * a)),
        origin.clone().add(vec(-1.05 * a, 1.6 * a, side * 0.75 * a)),
      ];
      surface.detail(
        taperedTube(beam, [0.085, 0.07, 0.052, 0.033, 0.006]),
        head,
        '#b8a07b',
      );
      for (let i = 1; i <= 3; i++) {
        const start = beam[i],
          tip = start
            .clone()
            .add(vec((0.3 + i * 0.06) * a, (0.5 + i * 0.05) * a, side * 0.03));
        surface.detail(
          taperedTube(
            [
              start,
              start
                .clone()
                .lerp(tip, 0.55)
                .add(vec(0.04, 0, 0)),
              tip,
            ],
            [0.045 - i * 0.006, 0.025, 0.003],
          ),
          head,
          '#c9b28d',
        );
      }
    }
  return { hipY, width, length, head: skull };
}

function serpent(surface, rig, p) {
  const length = 6.5 * p.bodyLength,
    radius = 0.21 * p.build,
    count = 18;
  let parent = 0;
  const points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count,
      point = vec(
        length * (0.5 - t),
        radius * 0.85,
        Math.sin(t * Math.PI * 2) * length * 0.035,
      ),
      bone = rig.add(`Spine_${i}`, parent, point);
    rig.axial.push(`Spine_${i}`);
    points.push({ point, bone });
    parent = bone;
  }
  points.forEach(({ point, bone }, i) => {
    if (!i) return;
    const t = i / count,
      previous = points[i - 1],
      taper = (u) =>
        radius *
        Math.max(0.055, Math.min(1, (1 - u) * (p.tailLength * 3.8))) *
        (0.82 + 0.18 * Math.sin(Math.PI * u));
    surface.capsule(
      previous.point,
      point,
      taper((i - 1) / count),
      taper(t),
      previous.bone,
      bone,
    );
  });
  const head = points[0].point.clone().add(vec(0.16, 0.035, 0)),
    h = p.headSize;
  surface.ellipsoid(
    head,
    [0.43 * h, radius * 0.8 * h, radius * 1.35 * h],
    points[0].bone,
  );
  const snout = head.clone().add(vec(0.3 * h, -0.025, 0));
  surface.ellipsoid(
    snout,
    [0.2 * h, radius * 0.6 * h, radius * 0.95 * h],
    points[0].bone,
  );
  for (const side of [-1, 1]) {
    eye(
      surface,
      head
        .clone()
        .add(vec(0.11 * h, radius * 0.52 * h, side * radius * 1.1 * h)),
      0.035 * h,
      points[0].bone,
      side,
      '#ab842d',
    );
    surface.sphere(
      snout.clone().add(vec(0.09 * h, radius * 0.36, side * radius * 0.6)),
      [0.015, 0.012, 0.013],
      points[0].bone,
      '#1c2419',
    );
  }
  rig.headName = 'Spine_0';
  return { hipY: radius, width: radius, length };
}

function fin(surface, points, bone, color) {
  const center = points
    .reduce((v, p) => v.add(p), vec(0, 0, 0))
    .multiplyScalar(1 / points.length);
  const normal = points[1]
    .clone()
    .sub(points[0])
    .cross(points[2].clone().sub(points[0]))
    .normalize();
  const positions = [],
    indices = [],
    count = points.length + 1;
  for (const side of [1, -1]) {
    for (const point of [center, ...points]) {
      const p = point
        .clone()
        .addScaledVector(normal, side * (point === center ? 0.022 : 0.006));
      positions.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < points.length; i++) {
    const a = i + 1,
      b = ((i + 1) % points.length) + 1;
    indices.push(
      0,
      a,
      b,
      count,
      count + b,
      count + a,
      a,
      count + a,
      b,
      b,
      count + a,
      count + b,
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  surface.detail(geo, bone, color);
  const rayColor = new THREE.Color(color).multiplyScalar(0.65).getHex();
  for (let i = 1; i < points.length; i++) {
    const tip = points[i]
      .clone()
      .lerp(center, 0.08)
      .addScaledVector(normal, 0.01);
    surface.detail(
      taperedTube(
        [points[0].clone().lerp(center, 0.05), tip],
        [0.009, 0.003],
        5,
      ),
      bone,
      rayColor,
    );
  }
}

function fish(surface, rig, p) {
  const length = 3.6 * p.bodyLength,
    y = 1.25,
    height = 0.72 * p.build,
    width = 0.32 * p.build,
    bones = [];
  let parent = 0;
  for (let i = 0; i < 7; i++) {
    const point = vec(length * (0.32 - (i / 6) * 0.9), y, 0);
    const bone = rig.add(`Spine_${i}`, parent, point);
    bones.push(bone);
    rig.axial.push(`Spine_${i}`);
    parent = bone;
  }
  for (let i = 0; i < 6; i++) {
    const t = i / 6,
      point = rig.points[bones[i]],
      next = rig.points[bones[i + 1]],
      r = Math.sin((t * 0.82 + 0.14) * Math.PI);
    surface.ellipsoid(
      point.clone().lerp(next, 0.5),
      [length * 0.2, Math.max(0.12, height * r), Math.max(0.07, width * r)],
      bones[i],
    );
  }
  const head = vec(length * 0.33, y + 0.015, 0),
    h = p.headSize;
  surface.ellipsoid(
    head,
    [0.48 * h, height * 0.62 * h, width * 0.91 * h],
    bones[0],
  );
  surface.sphere(
    head.clone().add(vec(0.35 * h, -0.1, 0)),
    [0.16 * h, 0.09 * h, width * 0.6],
    bones[0],
    p.accent,
  );
  for (const side of [-1, 1]) {
    eye(
      surface,
      head.clone().add(vec(0.12 * h, height * 0.2, side * width * 0.83 * h)),
      0.07 * h,
      bones[0],
      side,
      '#c49b4b',
    );
    const gill = new THREE.CatmullRomCurve3([
      vec(length * 0.22, y + height * 0.5, side * width * 0.8),
      vec(length * 0.12, y, side * width),
      vec(length * 0.22, y - height * 0.6, side * width * 0.7),
    ]).getPoints(10);
    surface.detail(
      taperedTube(
        gill,
        gill.map((_, i) => 0.008 + Math.sin((i / 10) * Math.PI) * 0.003),
        6,
      ),
      bones[1],
      '#405756',
    );
    fin(
      surface,
      [
        vec(length * 0.13, y - 0.12, side * width * 0.85),
        vec(-0.4, y - 0.5 * p.finSize, side * (width + 0.5 * p.finSize)),
        vec(-0.55, y - 0.3, side * width),
      ],
      bones[1],
      p.accent,
    );
  }
  fin(
    surface,
    [
      vec(length * 0.12, y + height * 0.8, 0),
      vec(-length * 0.15, y + height + 0.5 * p.finSize, 0),
      vec(-length * 0.4, y + height * 0.5, 0),
    ],
    bones[2],
    p.accent,
  );
  fin(
    surface,
    [
      vec(-0.15, y - height * 0.7, 0),
      vec(-0.7, y - height - 0.25 * p.finSize, 0),
      vec(-1.1, y - height * 0.4, 0),
    ],
    bones[3],
    p.accent,
  );
  const tailBase = rig.points[bones[6]],
    tailX = tailBase.x - 0.65 * p.tailLength;
  fin(
    surface,
    [
      tailBase.clone(),
      vec(tailX, y + 0.85 * p.finSize, 0),
      vec(tailX + 0.2, y, 0),
      vec(tailX, y - 0.85 * p.finSize, 0),
    ],
    bones[6],
    p.accent,
  );
  rig.headName = 'Spine_0';
  return { hipY: y, width, length };
}

export function generateCreature(p) {
  // A seed adds restrained anatomical variation, without changing the species plan.
  p = {
    ...p,
    bodyLength: p.bodyLength * (1 + Math.sin(p.seed * 0.71) * 0.018),
    build: p.build * (1 + Math.cos(p.seed * 0.43) * 0.022),
  };
  if (!['wolf', 'elk', 'snake', 'lizard', 'fish'].includes(p.species))
    throw new Error('Unsupported creature species.');
  const group = new THREE.Group();
  group.name = 'Creature';
  const rig = new Rig(group),
    primary = new THREE.Color(p.color),
    accent = new THREE.Color(p.accent),
    seed = p.seed * 0.017;
  let anatomy;
  const colorAt = (x, y, z) => {
    const n =
      Math.sin(x * 33 + y * 61 + z * 47 + seed) *
      Math.sin(x * 71 - z * 83 + seed);
    const c = primary.clone();
    if (p.species === 'snake') {
      const diamonds = Math.cos(x * 7.5 + seed) * Math.cos(z * 15);
      c.multiplyScalar(diamonds > 0.32 ? 0.58 : 1.02);
      c.lerp(accent, (1 - smooth((y - 0.04) / 0.14)) * 0.9);
    } else if (p.species === 'fish') {
      c.lerp(accent, 1 - smooth((y - anatomy.hipY + 0.18) / 0.7));
      c.multiplyScalar(
        0.92 + Math.sin(x * 38 + Math.sin(y * 31) * 0.5) * 0.045,
      );
    } else {
      const underside =
        1 -
        smooth(
          (y - anatomy.hipY + anatomy.width * 0.8) / (anatomy.width * 1.8),
        );
      c.lerp(accent, underside * (p.species === 'elk' ? 0.25 : 0.65));
      const dorsal = smooth((y - anatomy.hipY) / Math.max(0.25, anatomy.width));
      c.multiplyScalar(1 - dorsal * (p.species === 'wolf' ? 0.27 : 0.13));
      if (p.species === 'lizard')
        c.multiplyScalar(
          0.88 + Math.sin(x * 8 + seed) * Math.cos(z * 17) * 0.15,
        );
      if (p.species === 'elk' && x > anatomy.length * 0.35)
        c.multiplyScalar(0.72);
    }
    c.multiplyScalar(1 + n * 0.045);
    return c;
  };
  const surface = new CreatureSurface(
    rig.bones,
    colorAt,
    p.species === 'snake' ? 0.045 : p.species === 'lizard' ? 0.075 : 0.12,
  );
  anatomy =
    p.species === 'snake'
      ? serpent(surface, rig, p)
      : p.species === 'fish'
        ? fish(surface, rig, p)
        : quadruped(surface, rig, p, p.species);
  const cell =
    (p.species === 'snake' ? 0.055 : p.species === 'lizard' ? 0.055 : 0.075) /
    [0.78, 1, 1.32][p.detail];
  const geometry = surface.build(cell),
    material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: p.species === 'fish' ? 0.46 : 0.82,
      metalness: p.species === 'fish' ? 0.12 : 0,
    });
  const skin = new THREE.SkinnedMesh(geometry, material);
  skin.name = `${p.species}_Skin`;
  skin.castShadow = skin.receiveShadow = true;
  skin.frustumCulled = false;
  group.add(skin);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(rig.bones);
  skin.bind(skeleton);
  skin.normalizeSkinWeights();
  group.animations = createClips(rig, p);
  group.userData = {
    species: p.species,
    locomotion: group.animations[1].name,
    rigBones: rig.bones.length,
    recipeVersion: 2,
  };
  return group;
}
