import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePlant,
  generateCreature,
  plantPresets,
  creaturePresets,
  disposeModel,
} from '../src/app/lab/generators.js';
import { newRecipe, validateRecipe, fields } from '../src/app/lab/recipes.js';
import * as THREE from 'three';
function fingerprint(model) {
  const a = [];
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (o.isMesh)
      a.push(
        [...o.geometry.attributes.position.array],
        o.matrixWorld.toArray(),
      );
  });
  return JSON.stringify(a);
}
for (const [name, generate, presets] of [
  ['plant', generatePlant, plantPresets],
  ['creature', generateCreature, creaturePresets],
]) {
  test(`${name} presets produce finite, deterministic geometry and respond to seed`, () => {
    for (const p of Object.values(presets)) {
      const a = generate(p),
        b = generate(p),
        c = generate({ ...p, seed: p.seed + 1 });
      assert.equal(fingerprint(a), fingerprint(b));
      assert.notEqual(fingerprint(a), fingerprint(c));
      const box = new THREE.Box3().setFromObject(a);
      assert.ok(!box.isEmpty());
      a.traverse((o) => {
        if (o.isMesh)
          assert.ok(
            [...o.geometry.attributes.position.array].every(Number.isFinite),
          );
      });
      [a, b, c].forEach(disposeModel);
    }
  });
  test(`${name} parameter extremes remain finite`, () => {
    for (const endpoint of [1, 2]) {
      const p = { ...Object.values(presets)[0] };
      for (const [k, range] of Object.entries(fields[name]))
        p[k] = range[endpoint];
      const a = generate(p);
      assert.ok(!new THREE.Box3().setFromObject(a).isEmpty());
      a.traverse((o) => {
        if (o.isMesh)
          assert.ok(
            [...o.geometry.attributes.position.array].every(Number.isFinite),
          );
      });
      disposeModel(a);
    }
  });
}
test('recipes roundtrip and reject malformed, unbounded and unsupported data', () => {
  for (const mode of ['tree', 'plant', 'creature']) {
    const r = newRecipe(mode);
    assert.deepEqual(validateRecipe(JSON.parse(JSON.stringify(r))), r);
  }
  for (const data of [
    null,
    {},
    { version: 1, mode: '__proto__', preset: 'x' },
    {
      ...newRecipe('plant'),
      parameters: { ...newRecipe('plant').parameters, stems: 100000 },
    },
    {
      ...newRecipe('creature'),
      parameters: { ...newRecipe('creature').parameters, detail: 2.5 },
    },
  ])
    assert.throws(() => validateRecipe(data));
});
