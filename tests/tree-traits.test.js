import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  Tree,
  createRootGeometry,
  conformRoots,
  rootTerrain,
  createBreakableTree,
  simulateChop,
  disposeBreakable,
  cutLocation,
  mainStem,
} from '../build/ez-tree.es.js';
const load = (name) => {
  const tree = new Tree();
  tree.loadPreset(name);
  return tree;
};
function hash(g) {
  const h = createHash('sha256');
  for (const name of ['position', 'normal', 'uv'])
    h.update(new Uint8Array(g.attributes[name].array.buffer));
  h.update(new Uint8Array(g.index.array.buffer));
  return h.digest('hex');
}
test('tree geometry stays byte-identical to pre-trait commit 41a939c', () => {
  const baseline = JSON.parse(
    readFileSync(
      new URL('./fixtures/tree-seed-baseline.json', import.meta.url),
      'utf8',
    ),
  );
  for (const [name, p] of Object.entries(baseline.presets)) {
    const tree = load(name),
      pair = tree.createGeometry();
    assert.equal(hash(pair.branches), p.branches, name);
    assert.equal(hash(pair.leaves), p.leaves, name);
  }
});
test('branch and leaf attachment graph is complete, acyclic and deterministic', () => {
  const tree = load('Ash Medium');
  for (const branch of tree.skeleton.branches) {
    assert.equal(tree.skeleton.branches[branch.id], branch);
    assert.ok(branch.parentId < branch.id);
    assert.ok(branch.parentId >= -1);
  }
  for (const leaf of tree.skeleton.leaves)
    assert.ok(tree.skeleton.branches[leaf.branchId]);
  assert.ok(mainStem(tree).length >= 2);
  assert.equal(mainStem(tree)[0].id, 0);
  const again = load('Ash Medium');
  assert.deepEqual(
    tree.skeleton.branches.map((b) => [
      b.id,
      b.parentId,
      b.level,
      b.continuation,
    ]),
    again.skeleton.branches.map((b) => [
      b.id,
      b.parentId,
      b.level,
      b.continuation,
    ]),
  );
});
test('root LODs are deterministic, smaller and wrap with the native weighted height-delta law', () => {
  const geos = [0, 1, 2].map((l) => createRootGeometry(2, 42, {}, l).geometry);
  assert.ok(
    geos[0].index.count > geos[1].index.count &&
      geos[1].index.count > geos[2].index.count,
  );
  const expected = createRootGeometry(2, 42).geometry;
  assert.deepEqual(
    geos[0].attributes.position.array,
    expected.attributes.position.array,
  );
  const sample = (x, z) => x * 0.25 + Math.sin(z * 0.5),
    anchor = new THREE.Vector3(30, 9, -20),
    g = geos[0];
  conformRoots(g, sample, anchor);
  const rest = g.attributes.rootRest,
    weights = g.attributes.uv1,
    positions = g.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const w = weights.getY(i);
    assert.ok(w >= 0 && w <= 1);
    const y =
      rest.getY(i) +
      w *
        (sample(rest.getX(i) + anchor.x, rest.getZ(i) + anchor.z) -
          sample(anchor.x, anchor.z));
    assert.ok(Math.abs(positions.getY(i) - y) < 1e-5);
  }
  const once = positions.array.slice();
  conformRoots(g, sample, anchor);
  assert.deepEqual(positions.array, once);
  assert.ok([...g.attributes.normal.array].every(Number.isFinite));
  assert.throws(() => createRootGeometry(2, 42, { count: 999 }));
  assert.throws(() => createRootGeometry(2, 42, { spread: NaN }));
  assert.throws(() => rootTerrain({ relief: NaN }, 2));
  [...geos, expected].forEach((g) => g.dispose());
});
test('capped stump/mid-stem pieces have single ownership, correct parents and all leaves', () => {
  for (const cut of [0.03, 0.25, 0.5, 0.75]) {
    const tree = load('Ash Medium'),
      asset = createBreakableTree(tree, { cut });
    assert.equal(
      asset.defs.reduce((n, d) => n + d.leafIndices.length, 0),
      tree.skeleton.leaves.length,
    );
    const ids = new Set(asset.defs.map((d) => d.id));
    assert.equal(ids.size, asset.defs.length);
    for (const d of asset.defs) {
      if (d.parentId) assert.ok(ids.has(d.parentId));
      assert.ok(d.sections.length >= 2);
    }
    const joint = asset.defs.find((d) => d.id === asset.manifest.cut.partId);
    assert.ok(joint.origin.distanceTo(asset.cut.origin) < 1e-5);
    assert.ok(joint.falling);
    const parent = asset.defs.find((d) => d.id === joint.parentId);
    assert.ok(parent && !parent.falling);
    assert.ok(asset.defs.filter((d) => d.stem).length > 10);
    asset.model.traverse((o) => {
      if (o.geometry)
        assert.ok(
          [...o.geometry.attributes.position.array].every(Number.isFinite),
        );
    });
    disposeBreakable(asset);
  }
  const tree = load('Pine Medium');
  for (const cut of [0.25, 0.5, 0.75]) {
    const asset = createBreakableTree(tree, { cut });
    assert.ok(asset.cut.radius > 0);
    disposeBreakable(asset);
  }
});
test('gravity demo settles with anchored stump, impact events and optional branch demolition', () => {
  for (const preset of ['Ash Medium', 'Pine Medium']) {
    const tree = load(preset),
      asset = createBreakableTree(tree, { cut: 0.03 }),
      demo = simulateChop(asset, { cut: 0.03 });
    assert.ok(demo.landed);
    assert.ok(demo.events.some((e) => e.type === 'branchImpact'));
    assert.ok(demo.events.some((e) => e.type === 'trunkImpact'));
    const original = asset.rooted.position.clone(),
      mixer = new THREE.AnimationMixer(asset.model);
    mixer.clipAction(demo.clip).setLoop(THREE.LoopOnce, 1).play();
    mixer.setTime(demo.duration - 0.001);
    asset.model.updateMatrixWorld(true);
    assert.ok(asset.rooted.position.equals(original));
    const hits = demo.events.filter((e) => e.type === 'branchImpact');
    for (const hit of hits)
      assert.ok(asset.groups.get(hit.partId).scale.x < 0.001);
    assert.ok(asset.falling.quaternion.angleTo(new THREE.Quaternion()) > 0.8);
    const again = createBreakableTree(tree, { cut: 0.03 }),
      noBreak = simulateChop(again, { cut: 0.03, breakBranches: false });
    assert.ok(noBreak.landed);
    assert.equal(
      noBreak.events.filter((e) => e.type === 'branchImpact').length,
      0,
    );
    mixer.stopAllAction();
    mixer.uncacheRoot(asset.model);
    disposeBreakable(asset);
    disposeBreakable(again);
  }
});
