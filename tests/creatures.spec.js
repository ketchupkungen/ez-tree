import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import validator from 'gltf-validator';

test('five anatomies have skinned rigs and portable, playable locomotion GLBs', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 60000 });
  await page.locator('[data-mode=creature]').click();
  const reports = [];
  for (const [species, locomotion] of [
    ['Wolf', 'Walk'],
    ['Elk', 'Walk'],
    ['Snake', 'Slither'],
    ['Lizard', 'Walk'],
    ['Fish', 'Swim'],
  ]) {
    await page
      .getByRole('combobox', { name: 'Preset', exact: true })
      .selectOption(species);
    await expect(page.locator('#organism-status')).toContainText(
      `Idle + ${locomotion}`,
    );
    await page
      .getByRole('combobox', { name: 'Animation', exact: true })
      .selectOption('Rest');
    await page.getByRole('button', { name: 'Fit View', exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`${species.toLowerCase()}.png`),
    });
    await page
      .getByRole('combobox', { name: 'Animation', exact: true })
      .selectOption(locomotion);
    await page.getByRole('switch', { name: 'Show Rig', exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`${species.toLowerCase()}-rig.png`),
    });
    await page.getByRole('switch', { name: 'Show Rig', exact: true }).click();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const pending = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Export GLB (Full Detail)', exact: true })
      .click();
    const download = await pending,
      file = await fs.readFile(await download.path());
    await download.saveAs(testInfo.outputPath(`${species.toLowerCase()}.glb`));
    const validation = await validator.validateBytes(new Uint8Array(file), {
      maxIssues: 100,
    });
    reports.push({
      species,
      errors: validation.issues.numErrors,
      warnings: validation.issues.numWarnings,
      messages: validation.issues.messages,
    });
    expect(
      validation.issues.numErrors,
      JSON.stringify(validation.issues.messages),
    ).toBe(0);
    expect(
      validation.issues.numWarnings,
      JSON.stringify(validation.issues.messages),
    ).toBe(0);
    const gltf = await new GLTFLoader().parseAsync(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
      '',
    );
    expect(gltf.animations.map((c) => c.name)).toEqual(['Idle', locomotion]);
    const meshes = [];
    gltf.scene.traverse((o) => {
      if (o.isSkinnedMesh) meshes.push(o);
    });
    expect(meshes.length).toBe(1);
    const mesh = meshes[0];
    expect(mesh.skeleton.bones.length).toBeGreaterThan(6);
    gltf.scene.updateMatrixWorld(true);
    mesh.skeleton.update();
    const indices = Array.from({ length: 50 }, (_, i) =>
      Math.floor((i / 50) * mesh.geometry.attributes.position.count),
    );
    const bindPositions = indices.map((i) =>
      mesh.getVertexPosition(i, new THREE.Vector3()).clone(),
    );
    for (let k = 0; k < indices.length; k++)
      expect(
        bindPositions[k].distanceTo(
          new THREE.Vector3().fromBufferAttribute(
            mesh.geometry.attributes.position,
            indices[k],
          ),
        ),
      ).toBeLessThan(0.0001);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const clip = gltf.animations.find((c) => c.name === locomotion);
    mixer.clipAction(clip).play();
    mixer.setTime(clip.duration * 0.29);
    gltf.scene.updateMatrixWorld(true);
    mesh.skeleton.update();
    const moved = indices.map((i, k) =>
      mesh
        .getVertexPosition(i, new THREE.Vector3())
        .distanceTo(bindPositions[k]),
    );
    expect(Math.max(...moved)).toBeGreaterThan(0.02);
    expect(moved.every(Number.isFinite)).toBe(true);
    mixer.stopAllAction();
    await page.locator('[data-tab=parameters]').click();
  }
  await fs.writeFile(
    testInfo.outputPath('glb-validation.json'),
    JSON.stringify(reports, null, 2),
  );
  expect(errors).toEqual([]);
});
