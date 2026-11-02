import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import validator from 'gltf-validator';

test('terrain-wrapped roots, chopping and breakable game exports', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 60000 });
  await page.locator('#tree-root-controls .section-header').click();
  await page.getByRole('switch', { name: 'Root System', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Root Ground', exact: true })
    .selectOption('Rocky');
  await page
    .getByRole('slider', { name: 'Ground Relief', exact: true })
    .fill('4');
  await page
    .getByRole('button', { name: 'Inspect Roots', exact: true })
    .click();
  await page.screenshot({ path: testInfo.outputPath('terrain-roots.png') });
  await page.locator('#tree-chop-controls .section-header').click();
  await page.getByRole('switch', { name: 'Breakable', exact: true }).click();
  await page
    .getByRole('slider', { name: 'Fall Direction', exact: true })
    .fill('135');
  await page.getByRole('button', { name: 'Try Chopping', exact: true }).click();
  await expect(page.locator('#tree-chop-status')).toContainText('Landed', {
    timeout: 20000,
  });
  await expect(page.locator('#tree-chop-status')).not.toContainText(
    '0 branch impacts',
  );
  await page.screenshot({ path: testInfo.outputPath('chopped-tree.png') });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dataEvent = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export Tree Game Data', exact: true })
    .click();
  const manifestDownload = await dataEvent,
    manifest = JSON.parse(
      await fs.readFile(await manifestDownload.path(), 'utf8'),
    );
  expect(manifest.format).toBe('EZ_TREE_BREAKABLE');
  expect(manifest.demo.landed).toBe(true);
  expect(manifest.demo.branchImpacts).toBeGreaterThan(0);
  expect(manifest.parts.filter((p) => p.mainStem).length).toBeGreaterThan(5);
  expect(manifest.rootContact.contactWeight).toBe('TEXCOORD_1.y');
  await manifestDownload.saveAs(testInfo.outputPath('tree-breakable.json'));
  const glbEvent = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export GLB (Full Detail)', exact: true })
    .click();
  const download = await glbEvent,
    buffer = await fs.readFile(await download.path());
  await download.saveAs(testInfo.outputPath('tree-breakable.glb'));
  const json = JSON.parse(
    buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)).trim(),
  );
  expect(json.animations.map((c) => c.name)).toContain('TryChop');
  expect(json.nodes.some((n) => n.name === 'Stump')).toBe(true);
  expect(json.nodes.some((n) => n.name === 'Roots_Anchored')).toBe(true);
  const validation = await validator.validateBytes(new Uint8Array(buffer), {
    maxIssues: 50,
  });
  await fs.writeFile(
    testInfo.outputPath('validation.json'),
    JSON.stringify(validation.issues, null, 2),
  );
  expect(
    validation.issues.numErrors,
    JSON.stringify(validation.issues.messages),
  ).toBe(0);
  expect(
    validation.issues.numWarnings,
    JSON.stringify(validation.issues.messages),
  ).toBe(0);
  await page.locator('[data-tab=parameters]').click();
  await page.getByRole('button', { name: 'Reset Tree', exact: true }).click();
  await expect(page.locator('#tree-chop-status')).toContainText('Choose a cut');
  await page
    .getByRole('slider', { name: 'Cut Position', exact: true })
    .fill('0.5');
  await page.getByRole('button', { name: 'Try Chopping', exact: true }).click();
  await expect(page.locator('#tree-chop-status')).toContainText('Landed', {
    timeout: 20000,
  });
  await page.screenshot({ path: testInfo.outputPath('middle-snap.png') });
  await page.locator('[data-mode=creature]').click();
  await expect(page.locator('#organism-status')).toContainText('bones');
  await page.locator('[data-mode=tree]').click();
  await expect(page.locator('#tree-chop-status')).toContainText('Choose a cut');
  expect(errors).toEqual([]);
});
