import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Tree } from '../build/ez-tree.es.js';
import { ForestPreview, forestPositions } from '../src/app/forest-preview.js';
function setup() {
  const tree = new Tree();
  tree.loadPreset('Ash Small');
  const scene = new THREE.Scene(),
    background = new THREE.Group(),
    camera = new THREE.PerspectiveCamera(60, 1.4, 0.1, 2000);
  scene.add(tree, background);
  camera.position.set(100, 20, 0);
  const controls = {
    target: new THREE.Vector3(0, 20, 0),
    update() {},
    maxDistance: 150,
  };
  return {
    tree,
    background,
    camera,
    controls,
    preview: new ForestPreview(tree, background, scene, camera, controls),
  };
}
function triangles(pair) {
  return ['branches', 'leaves'].reduce(
    (n, k) => n + pair[k].index.count / 3,
    0,
  );
}
test('forest layout is bounded, evenly spaced and leaves the hero position empty', () => {
  for (const rings of [1, 4]) {
    const p = forestPositions(rings, 45, true);
    assert.equal(p.length, (2 * rings + 1) ** 2 - 1);
    assert.ok(p.every((v) => v.length() > 0));
    assert.equal(new Set(p.map((v) => v.toArray().join(','))).size, p.length);
  }
  assert.equal(forestPositions(1, 45, false).length, 8);
  assert.ok(forestPositions(4, 100, false).every((p) => p.x <= -175));
});
test('copies share six geometry buffers, match the source and select lower LODs at distance', () => {
  const { tree, preview, camera, background } = setup();
  preview.configure({ enabled: true, surround: true });
  assert.equal(background.visible, false);
  assert.equal(preview.group.children.length, 8);
  assert.equal(preview.geometries.length, 6);
  const [a, b] = preview.group.children;
  assert.equal(
    a.levels[0].object.children[0].geometry,
    b.levels[0].object.children[0].geometry,
  );
  assert.equal(
    a.levels[0].object.children[1].material,
    tree.leavesMesh.material,
  );
  assert.deepEqual(
    a.levels[0].object.children[0].geometry.attributes.position.array,
    tree.branchesMesh.geometry.attributes.position.array,
  );
  const counts = preview.levels.map((l) => triangles(l.geometry));
  assert.ok(counts[0] > counts[1] && counts[1] > counts[2]);
  camera.position.copy(a.position);
  preview.updateLODs();
  assert.equal(a.getCurrentLevel(), 0);
  camera.position.set(1500, 100, 0);
  preview.updateLODs();
  assert.equal(a.getCurrentLevel(), 2);
  preview.configure({ rings: 4, spacing: 25 });
  assert.equal(preview.group.children.length, 80);
  assert.equal(preview.geometries.length, 6);
  assert.equal(preview.geometries[0], a.levels[0].object.children[0].geometry);
  preview.dispose();
});
test('updates are debounced, old buffers disposed, borrowed materials retained and original forest restored', async () => {
  const { tree, preview, background, controls } = setup();
  preview.configure({ enabled: true, surround: true });
  let disposed = 0,
    materialDisposed = 0;
  preview.geometries.forEach((g) =>
    g.addEventListener('dispose', () => disposed++),
  );
  tree.leavesMesh.material.addEventListener(
    'dispose',
    () => materialDisposed++,
  );
  tree.options.seed++;
  tree.generate();
  const disposedByTree = materialDisposed;
  preview.requestRefresh();
  preview.requestRefresh();
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(disposed, 6);
  assert.equal(materialDisposed, disposedByTree);
  assert.equal(preview.dirty, false);
  assert.equal(
    preview.group.children[0].levels[0].object.children[1].material,
    tree.leavesMesh.material,
  );
  preview.fit();
  assert.ok(controls.maxDistance > 150);
  preview.setActive(false);
  assert.equal(background.visible, true);
  assert.equal(preview.group.visible, false);
  preview.setActive(true);
  assert.equal(preview.group.visible, true);
  preview.configure({ enabled: false });
  assert.equal(background.visible, true);
  assert.equal(preview.group.visible, false);
  assert.throws(() => preview.configure({ rings: 100 }));
  assert.throws(() => preview.configure({ spacing: NaN }));
  preview.dispose();
  assert.equal(materialDisposed, disposedByTree);
});
