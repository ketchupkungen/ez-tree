import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  creaturePresets,
  generateCreature,
} from '../src/app/creature/creatures.js';
import { disposeModel } from '../src/app/lab/generators.js';
import { fields, newRecipe, validateRecipe } from '../src/app/lab/recipes.js';

test('all five species have finite normalized skinning, named bone tracks and looped deforming locomotion', () => {
  for (const [name, p] of Object.entries(creaturePresets)) {
    const g = generateCreature(p),
      mesh = g.children.find((o) => o.isSkinnedMesh),
      bones = mesh.skeleton.bones;
    assert.ok(bones.length >= 8, name);
    assert.equal(new Set(bones.map((b) => b.name)).size, bones.length);
    const weights = mesh.geometry.attributes.skinWeight,
      indices = mesh.geometry.attributes.skinIndex;
    for (let i = 0; i < weights.count; i++) {
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        const w = weights.array[i * 4 + j],
          index = indices.array[i * 4 + j];
        assert.ok(Number.isFinite(w) && w >= 0);
        assert.ok(index < bones.length);
        if (w === 0) assert.equal(index, 0);
        sum += w;
      }
      assert.ok(Math.abs(sum - 1) < 1e-6);
    }
    const clip = g.animations[1];
    assert.equal(
      clip.name,
      p.species === 'snake'
        ? 'Slither'
        : p.species === 'fish'
          ? 'Swim'
          : 'Walk',
    );
    const names = new Set(bones.map((b) => b.name));
    for (const animation of g.animations)
      for (const track of animation.tracks) {
        assert.ok(names.has(track.name.split('.')[0]));
        assert.ok([...track.values].every(Number.isFinite));
        const n = track.getValueSize();
        for (let i = 0; i < n; i++)
          assert.ok(
            Math.abs(
              track.values[i] - track.values[track.values.length - n + i],
            ) < 1e-5,
          );
      }
    const sample = Array.from({ length: 100 }, (_, i) =>
      Math.floor((i / 100) * weights.count),
    );
    g.updateMatrixWorld(true);
    const rest = sample.map((i) =>
        mesh.getVertexPosition(i, new THREE.Vector3()).clone(),
      ),
      mixer = new THREE.AnimationMixer(g);
    mixer.clipAction(clip).play();
    let moved = 0;
    for (const phase of [0.1, 0.35, 0.7, 0.95]) {
      mixer.setTime(phase * clip.duration);
      g.updateMatrixWorld(true);
      sample.forEach((i, k) => {
        const point = mesh.getVertexPosition(i, new THREE.Vector3());
        assert.ok(point.toArray().every(Number.isFinite));
        moved = Math.max(moved, point.distanceTo(rest[k]));
        assert.ok(point.distanceTo(rest[k]) < 20);
      });
    }
    assert.ok(moved > 0.02, name);
    mixer.stopAllAction();
    mixer.uncacheRoot(g);
    disposeModel(g);
  }
});

test('species proportion extremes stay within the mesh budget and cycle speed is baked into clips', () => {
  for (const p of Object.values(creaturePresets))
    for (const endpoint of [1, 2]) {
      const parameters = { ...p };
      for (const [key, range] of Object.entries(fields.creature))
        parameters[key] = range[endpoint];
      const g = generateCreature(parameters);
      assert.ok(
        g.children.find((o) => o.isSkinnedMesh).geometry.attributes.position
          .count > 100,
      );
      disposeModel(g);
    }
  const p = creaturePresets.Wolf,
    a = generateCreature(p),
    b = generateCreature({ ...p, gaitSpeed: 2 });
  assert.equal(a.animations[1].duration, b.animations[1].duration * 2);
  disposeModel(a);
  disposeModel(b);
});

test('creature version 2 recipes roundtrip and legacy placeholders migrate to recognized species', () => {
  for (const name of Object.keys(creaturePresets)) {
    const r = newRecipe('creature', name);
    assert.equal(r.version, 2);
    assert.deepEqual(validateRecipe(JSON.parse(JSON.stringify(r))), r);
  }
  const migrated = validateRecipe({
    version: 1,
    mode: 'creature',
    preset: 'Mossback',
    parameters: { seed: 3, color: '#112233', accent: '#aabbcc' },
  });
  assert.equal(migrated.preset, 'Wolf');
  assert.equal(migrated.parameters.seed, 3);
  const bad = newRecipe('creature');
  bad.parameters.species = 'fish';
  assert.throws(() => validateRecipe(bad));
});
