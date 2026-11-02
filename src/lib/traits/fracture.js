import * as THREE from 'three';

export const destructionDefaults = {
  enabled: false,
  cut: 0.03,
  direction: 135,
  gravity: 9.81,
  breakBranches: true,
};
const up = new THREE.Vector3(0, 1, 0);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sectionCopy = (s) => ({
  origin: s.origin.clone(),
  orientation: s.orientation.clone(),
  radius: s.radius,
});

export function frozenMaterial(source) {
  return new THREE.MeshStandardMaterial({
    name: `${source.name || 'Wood'}_Static`,
    color: source.color,
    map: source.map,
    normalMap: source.normalMap,
    roughnessMap: source.roughnessMap,
    aoMap: source.aoMap,
    roughness: source.roughness,
    metalness: source.metalness,
    side: source.side,
    alphaTest: source.alphaTest,
    transparent: source.transparent,
    opacity: source.opacity,
    flatShading: source.flatShading,
  });
}

export function mainStem(tree) {
  const branches = tree.skeleton.branches,
    chain = [branches[0]];
  while (true) {
    const child = branches.find(
      (b) => b.parentId === chain.at(-1).id && b.continuation,
    );
    if (!child) break;
    chain.push(child);
  }
  return chain;
}
function arcLengths(sections) {
  const values = [0];
  for (let i = 1; i < sections.length; i++)
    values.push(
      values.at(-1) + sections[i].origin.distanceTo(sections[i - 1].origin),
    );
  return values;
}
function nearestArc(sections, p) {
  const arc = arcLengths(sections);
  let best = Infinity,
    at = 0;
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i].origin,
      d = sections[i + 1].origin.clone().sub(a),
      t = clamp(p.clone().sub(a).dot(d) / Math.max(1e-10, d.lengthSq())),
      distance = p.distanceToSquared(a.clone().addScaledVector(d, t));
    if (distance < best) {
      best = distance;
      at = arc[i] + t * (arc[i + 1] - arc[i]);
    }
  }
  return at;
}
function interpolate(a, b, t) {
  return {
    origin: a.origin.clone().lerp(b.origin, t),
    orientation: new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion()
        .setFromEuler(a.orientation)
        .slerp(new THREE.Quaternion().setFromEuler(b.orientation), t),
    ),
    radius: a.radius + (b.radius - a.radius) * t,
  };
}
export function cutLocation(tree, fraction) {
  const chain = mainStem(tree),
    lengths = chain.map((b) => arcLengths(b.sections).at(-1)),
    total = lengths.reduce((a, b) => a + b, 0);
  let remaining = total * clamp(fraction, 0.02, 0.75);
  for (let i = 0; i < chain.length; i++) {
    if (remaining >= lengths[i] - 1e-7 && i < chain.length - 1) {
      remaining -= lengths[i];
      continue;
    }
    const branch = chain[i],
      arc = arcLengths(branch.sections);
    for (let j = 0; j < arc.length - 1; j++)
      if (remaining <= arc[j + 1] || j === arc.length - 2) {
        let segment = j,
          t = clamp(
            (remaining - arc[j]) / Math.max(1e-10, arc[j + 1] - arc[j]),
          );
        if (t > 1 - 1e-6 && j + 1 < arc.length - 1) {
          segment = j + 1;
          t = 0;
        }
        return {
          branchId: branch.id,
          segment,
          t,
          arc: remaining,
          ...interpolate(
            branch.sections[segment],
            branch.sections[segment + 1],
            t,
          ),
          totalStemLength: total,
        };
      }
  }
  throw new Error('Tree has no cuttable stem.');
}

function cap(section, reverse, radial = 12) {
  const positions = [],
    normals = [],
    uv = [],
    colors = [],
    indices = [],
    q = new THREE.Quaternion().setFromEuler(section.orientation),
    normal = up
      .clone()
      .applyQuaternion(q)
      .multiplyScalar(reverse ? -1 : 1),
    rings = 8;
  const center = section.origin,
    push = (r, a) => {
      const p = new THREE.Vector3(
        Math.cos(a) * r * section.radius,
        0,
        Math.sin(a) * r * section.radius,
      )
        .applyQuaternion(q)
        .add(center);
      positions.push(p.x, p.y, p.z);
      normals.push(normal.x, normal.y, normal.z);
      uv.push(0.5 + Math.cos(a) * r * 0.5, 0.5 + Math.sin(a) * r * 0.5);
      const c = new THREE.Color(
        r > 0.96 ? '#544130' : Math.floor(r * 19) % 2 ? '#bc9561' : '#d2ae78',
      );
      colors.push(c.r, c.g, c.b);
    };
  push(0, 0);
  for (let ring = 1; ring <= rings; ring++)
    for (let j = 0; j <= radial; j++)
      push(ring / rings, (j / radial) * Math.PI * 2);
  const face = (a, b, c) => {
    if (reverse) indices.push(a, b, c);
    else indices.push(a, c, b);
  };
  for (let j = 0; j < radial; j++) face(0, 1 + j, 2 + j);
  for (let ring = 1; ring < rings; ring++)
    for (let j = 0; j < radial; j++) {
      const a = 1 + (ring - 1) * (radial + 1) + j,
        b = a + radial + 1;
      face(a, b, a + 1);
      face(a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  return g;
}

export function createBreakableTree(
  tree,
  options = {},
  { detail = {}, roots = null } = {},
) {
  const settings = { ...destructionDefaults, ...options };
  if (
    !Number.isFinite(settings.cut) ||
    settings.cut < 0.02 ||
    settings.cut > 0.75 ||
    !Number.isFinite(settings.gravity) ||
    settings.gravity < 1 ||
    settings.gravity > 30 ||
    !Number.isFinite(settings.direction)
  )
    throw new Error('Invalid tree destruction parameters.');
  if (!tree.skeleton?.branches?.length || tree.skeleton.branches.length > 1800)
    throw new Error(
      'Choose a tree with 1–1800 branches for a breakable preview.',
    );
  const cut = cutLocation(tree, settings.cut),
    stem = new Set(mainStem(tree).map((b) => b.id)),
    defs = [],
    byBranch = new Map();
  for (const branch of tree.skeleton.branches) {
    let sections = branch.sections.map(sectionCopy);
    if (branch.id === cut.branchId && cut.t > 1e-6 && cut.t < 1 - 1e-6)
      sections.splice(cut.segment + 1, 0, sectionCopy(cut));
    const branchDefs = [],
      arcs = arcLengths(sections);
    if (stem.has(branch.id)) {
      for (let i = 0; i < sections.length - 1; i++)
        branchDefs.push({
          id: `Stem_${branch.id}_${i}`,
          branchId: branch.id,
          parentBranchId: branch.parentId,
          sections: [sections[i], sections[i + 1]],
          origin: sections[i].origin.clone(),
          stem: true,
          startArc: arcs[i],
          endArc: arcs[i + 1],
          leafIndices: [],
        });
    } else
      branchDefs.push({
        id: `Branch_${branch.id}`,
        branchId: branch.id,
        parentBranchId: branch.parentId,
        sections,
        origin: sections[0].origin.clone(),
        stem: false,
        startArc: 0,
        endArc: arcs.at(-1),
        leafIndices: [],
      });
    defs.push(...branchDefs);
    byBranch.set(branch.id, branchDefs);
  }
  const cutDef = byBranch
    .get(cut.branchId)
    .find((d) => d.origin.distanceTo(cut.origin) < 1e-4);
  if (!cutDef) throw new Error('Cut boundary could not be constructed.');
  for (const def of defs) {
    const siblings = byBranch.get(def.branchId),
      at = siblings.indexOf(def);
    if (at > 0) def.parentId = siblings[at - 1].id;
    else if (def.parentBranchId >= 0) {
      const parent = tree.skeleton.branches[def.parentBranchId],
        arc = nearestArc(parent.sections, def.origin),
        candidates = byBranch.get(parent.id);
      def.parentId = (
        candidates.find((d) => arc < d.endArc - 1e-5) ?? candidates.at(-1)
      ).id;
    } else def.parentId = null;
  }
  const lookup = new Map(defs.map((d) => [d.id, d]));
  const falls = (def) =>
    def.id === cutDef.id ||
    (def.parentId ? falls(lookup.get(def.parentId)) : false);
  defs.forEach((d) => (d.falling = falls(d)));
  tree.skeleton.leaves.forEach((leaf, index) => {
    const branch = tree.skeleton.branches[leaf.branchId],
      candidates = byBranch.get(leaf.branchId);
    if (!candidates) return;
    const at = nearestArc(branch.sections, leaf.origin);
    (
      candidates.find((d) => at < d.endArc - 1e-5) ?? candidates.at(-1)
    ).leafIndices.push(index);
  });
  const model = new THREE.Group();
  model.name = 'BreakableTree';
  const rooted = new THREE.Group();
  rooted.name = 'Stump';
  model.add(rooted);
  const falling = new THREE.Group();
  falling.name = 'FallingTree';
  falling.position.copy(cut.origin);
  model.add(falling);
  const bark = frozenMaterial(tree.branchesMesh.material),
    leaves = frozenMaterial(tree.leavesMesh.material),
    wood = new THREE.MeshStandardMaterial({
      name: 'ExposedGrowthRings',
      vertexColors: true,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
  const groups = new Map();
  for (const def of defs) {
    const group = new THREE.Group();
    group.name = def.id;
    group.userData = {
      branchId: def.branchId,
      parentPart: def.parentId,
      breakable: true,
      mainStem: def.stem,
      strengthProxy: def.sections[0].radius ** 3,
      attachment: def.origin.toArray(),
    };
    groups.set(def.id, group);
    const geometry = tree.createGeometry({
      ...detail,
      branchIds: [def.branchId],
      branchSections: { [def.branchId]: def.sections },
      leafIndices: def.leafIndices,
    });
    for (const [key, material] of [
      ['branches', bark],
      ['leaves', leaves],
    ]) {
      const g = geometry[key];
      if (g.attributes.position.count && g.index.count) {
        g.translate(-def.origin.x, -def.origin.y, -def.origin.z);
        if (material.normalMap && g.attributes.uv) g.computeTangents();
        const mesh = new THREE.Mesh(g, material);
        mesh.name = `${def.id}_${key}`;
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
      } else g.dispose();
    }
    for (const [section, reverse] of [
      [def.sections[0], true],
      [def.sections.at(-1), false],
    ]) {
      const geometry = cap(
        section,
        reverse,
        Math.max(8, tree.skeleton.branches[def.branchId].segmentCount),
      );
      geometry.translate(-def.origin.x, -def.origin.y, -def.origin.z);
      const mesh = new THREE.Mesh(geometry, wood);
      mesh.name = `${def.id}_${reverse ? 'BaseCut' : 'TipCut'}`;
      group.add(mesh);
    }
  }
  for (const def of defs) {
    const group = groups.get(def.id),
      parent = lookup.get(def.parentId);
    if (parent && parent.falling === def.falling) {
      groups.get(parent.id).add(group);
      group.position.copy(def.origin).sub(parent.origin);
    } else {
      (def.falling ? falling : rooted).add(group);
      group.position
        .copy(def.origin)
        .sub(def.falling ? cut.origin : new THREE.Vector3());
    }
  }
  if (roots) {
    const rootGeometry = roots.geometry.clone();
    if (bark.normalMap) rootGeometry.computeTangents();
    const mesh = new THREE.Mesh(rootGeometry, bark);
    mesh.name = 'Roots_Anchored';
    mesh.userData = { ...roots.userData, anchoredTo: 'Stump' };
    rooted.add(mesh);
  }
  model.updateMatrixWorld(true);
  const manifest = {
    version: 1,
    format: 'EZ_TREE_BREAKABLE',
    axes: 'right-handed Y-up',
    unitScaleMeters: 1,
    seed: tree.options.seed,
    cut: {
      partId: cutDef.id,
      position: cut.origin.toArray(),
      radius: cut.radius,
      stemFraction: settings.cut,
    },
    settings,
    rootContact: roots?.userData ?? null,
    parts: defs.map((d) => ({
      id: d.id,
      branchId: d.branchId,
      parentId: d.parentId,
      fallingAtSelectedCut: d.falling,
      mainStem: d.stem,
      attachment: d.origin.toArray(),
      centerline: d.sections.map((s) => ({
        position: s.origin.toArray(),
        radius: s.radius,
      })),
      massKgProxy: d.sections
        .slice(1)
        .reduce(
          (m, s, i) =>
            m +
            (Math.PI / 3) *
              s.origin.distanceTo(d.sections[i].origin) *
              (s.radius ** 2 +
                s.radius * d.sections[i].radius +
                d.sections[i].radius ** 2) *
              600,
          0,
        ),
    })),
  };
  model.userData = {
    breakableTree: {
      version: 1,
      cutPart: cutDef.id,
      descriptor:
        'Export matching tree-breakable.json for joints, capsules and impact events.',
    },
  };
  return {
    model,
    rooted,
    falling,
    defs,
    groups,
    cut,
    manifest,
    materials: [bark, leaves, wood],
  };
}

// Deterministic fixed-step rod/capsule proxy. The exported clip is a demonstration;
// a host engine can replace it with its own rigid bodies and damage/debris rules.
export function simulateChop(asset, options = {}, sampleHeight = () => 0) {
  const settings = { ...destructionDefaults, ...options },
    heading = THREE.MathUtils.degToRad(settings.direction),
    direction = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading)),
    axis = new THREE.Vector3().crossVectors(up, direction).normalize();
  const fallingDefs = asset.defs.filter((d) => d.falling),
    stem = fallingDefs.filter((d) => d.stem),
    collisions = fallingDefs.filter((d) => !d.stem);
  const allPoints = stem.flatMap((d) => d.sections),
    height = Math.max(
      2,
      ...allPoints.map((s) => s.origin.distanceTo(asset.cut.origin)),
    ),
    comLocal = new THREE.Vector3(0, height * 0.46, 0);
  const dt = 1 / 120,
    duration = Math.min(15, 5 + Math.sqrt(height / settings.gravity) * 4),
    release = 0.65;
  let angle = 0,
    omega = 0.28,
    free = false,
    landed = false,
    contactAt = null;
  const pivot = asset.cut.origin.clone(),
    q = new THREE.Quaternion(),
    velocity = new THREE.Vector3(),
    com = pivot.clone().add(comLocal),
    broken = new Set(),
    events = [],
    times = [],
    positions = [],
    quaternions = [];
  const lookup = new Map(asset.defs.map((d) => [d.id, d]));
  const ancestorBroken = (def) =>
    broken.has(def.id) ||
    (def.parentId && lookup.get(def.parentId)?.falling
      ? ancestorBroken(lookup.get(def.parentId))
      : false);
  const world = (point) =>
    point.clone().sub(asset.cut.origin).applyQuaternion(q).add(pivot);
  const minClearance = (def, skipBase = false) => {
    let best = Infinity,
      point = null;
    for (let i = 1; i < def.sections.length; i++) {
      const a = def.sections[i - 1],
        b = def.sections[i],
        steps = Math.min(
          6,
          Math.max(2, Math.ceil(a.origin.distanceTo(b.origin) / 1.5)),
        );
      for (let k = skipBase && i === 1 ? 1 : 0; k <= steps; k++) {
        const t = k / steps,
          p = world(a.origin.clone().lerp(b.origin, t)),
          radius = a.radius + (b.radius - a.radius) * t,
          value = p.y - sampleHeight(p.x, p.z) - radius;
        if (value < best) {
          best = value;
          point = p;
        }
      }
    }
    return { distance: best, point };
  };
  const frameCount = Math.ceil(duration / dt);
  for (let frame = 0; frame <= frameCount; frame++) {
    const t = frame * dt;
    if (t >= release && !landed) {
      if (!free) {
        omega +=
          ((settings.gravity * 1.5) / height) * Math.sin(angle + 0.06) * dt;
        angle += omega * dt;
        q.setFromAxisAngle(axis, angle);
        if (angle > 1.12) {
          free = true;
          com.copy(comLocal).applyQuaternion(q).add(pivot);
          velocity.crossVectors(
            axis.clone().multiplyScalar(omega),
            comLocal.clone().applyQuaternion(q),
          );
        }
      } else {
        velocity.y -= settings.gravity * dt;
        com.addScaledVector(velocity, dt);
        angle += omega * dt;
        q.setFromAxisAngle(axis, angle);
        pivot.copy(com).sub(comLocal.clone().applyQuaternion(q));
      }
      if (settings.breakBranches)
        for (const def of collisions) {
          if (ancestorBroken(def)) continue;
          const hit = minClearance(def);
          if (hit.distance <= 0 && angle > 0.18) {
            broken.add(def.id);
            events.push({
              type: 'branchImpact',
              time: t,
              partId: def.id,
              branchId: def.branchId,
              position: hit.point.toArray(),
              speedProxy: omega * hit.point.distanceTo(pivot),
              action: 'demolish-subtree',
              debrisPolicy: 'host-defined',
            });
          }
        }
      const contact = stem
        .map((d) =>
          minClearance(d, !free && d.id === asset.manifest.cut.partId),
        )
        .sort((a, b) => a.distance - b.distance)[0];
      if (free && contact.distance <= 0) {
        if (contactAt === null) {
          contactAt = t;
          events.push({
            type: 'trunkImpact',
            time: t,
            position: contact.point.toArray(),
            action: 'settle',
          });
        }
        pivot.y -= contact.distance;
        com.copy(comLocal).applyQuaternion(q).add(pivot);
        velocity.multiplyScalar(0.28);
        velocity.y = Math.abs(velocity.y) * 0.1;
        omega *= 0.35;
      }
      if (contactAt !== null && t - contactAt > 0.65) {
        landed = true;
        events.push({ type: 'settled', time: t });
      }
    }
    if (frame % 2 === 0 || frame === frameCount) {
      times.push(t);
      positions.push(pivot.x, pivot.y, pivot.z);
      quaternions.push(q.x, q.y, q.z, q.w);
    }
  }
  const tracks = [
    new THREE.VectorKeyframeTrack('FallingTree.position', times, positions),
    new THREE.QuaternionKeyframeTrack(
      'FallingTree.quaternion',
      times,
      quaternions,
    ),
  ];
  for (const event of events.filter((e) => e.type === 'branchImpact'))
    tracks.push(
      new THREE.VectorKeyframeTrack(
        `${event.partId}.scale`,
        [0, event.time, event.time + 0.045, duration],
        [
          1, 1, 1, 1, 1, 1, 0.00001, 0.00001, 0.00001, 0.00001, 0.00001,
          0.00001,
        ],
      ),
    );
  const clip = new THREE.AnimationClip('TryChop', duration, tracks);
  asset.model.animations = [clip];
  asset.manifest.events = events;
  asset.manifest.demo = {
    duration,
    fixedStep: dt,
    branchImpacts: events.filter((e) => e.type === 'branchImpact').length,
    landed,
    physics:
      'gravity-driven rod/capsule preview; host replaces with runtime rigid bodies',
  };
  return { clip, events, landed, duration };
}

export function disposeBreakable(asset) {
  const geometries = new Set();
  asset.model.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
  });
  geometries.forEach((g) => g.dispose());
  asset.materials.forEach((m) => m.dispose());
}
