import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('source panel switches modes, preserves controls and exports the active specimen', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 60000 });
  await expect(page.locator('.panel-title')).toHaveText('EZ Tree');
  await expect(page.locator('#generator-mode')).toHaveAttribute('max', '2');
  const treeSeed = page.getByRole('slider', { name: 'Seed', exact: true });
  await treeSeed.fill('789');
  const treeCount = await page.locator('[data-stat=triangles]').textContent();
  await page.screenshot({ path: testInfo.outputPath('tree.png') });
  for (const [mode, index, parameter, value] of [
    ['plant', '1', 'Stem height', '5'],
    ['creature', '2', 'Head size', '1.2'],
  ]) {
    await page
      .getByRole('slider', { name: 'Generator mode', exact: true })
      .fill(index);
    await expect(page.locator(`[data-mode=${mode}]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('#tree-parameters')).toBeHidden();
    await expect(page.locator('.lod-switcher')).toBeHidden();
    const names = await page
      .getByRole('combobox', { name: 'Preset', exact: true })
      .locator('option')
      .allTextContents();
    for (const name of names) {
      await page
        .getByRole('combobox', { name: 'Preset', exact: true })
        .selectOption({ label: name });
      await expect(page.locator('[data-stat=triangles]')).not.toHaveText('0');
    }
    await page
      .getByRole('combobox', { name: 'Preset', exact: true })
      .selectOption({ label: names[0] });
    await page
      .getByRole('slider', { name: parameter, exact: true })
      .fill(value);
    await page.screenshot({ path: testInfo.outputPath(`${mode}.png`) });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Export LODs (ZIP)', exact: true }),
    ).toBeHidden();
    const dl = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Export GLB (Full Detail)', exact: true })
      .click();
    const glb = await dl,
      data = await fs.readFile(await glb.path());
    expect(data.toString('utf8', 0, 4)).toBe('glTF');
    const json = JSON.parse(
      data.toString('utf8', 20, 20 + data.readUInt32LE(12)).trim(),
    );
    expect(
      json.nodes.some(
        (n) => n.name === (mode === 'plant' ? 'Plant' : 'Creature'),
      ),
    ).toBe(true);
    expect(json.nodes.some((n) => n.name === 'Tree')).toBe(false);
    const save = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Save Preset', exact: true })
      .click();
    const saved = await save,
      buffer = await fs.readFile(await saved.path());
    const recipe = JSON.parse(buffer);
    expect(recipe.mode).toBe(mode);
    expect(recipe.parameters[mode === 'plant' ? 'height' : 'headSize']).toBe(
      Number(value),
    );
    const pngEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
    const png = await pngEvent;
    expect(
      (await fs.readFile(await png.path())).subarray(1, 4).toString(),
    ).toBe('PNG');
    await page.locator('#fileInput').setInputFiles({
      name: 'recipe.json',
      mimeType: 'application/json',
      buffer,
    });
    await page.locator('[data-tab=parameters]').click();
    await expect(
      page.getByRole('slider', { name: parameter, exact: true }),
    ).toHaveValue(value);
  }
  await page.locator('[data-mode=plant]').click();
  await expect(
    page.getByRole('slider', { name: 'Stem height', exact: true }),
  ).toHaveValue('5');
  await page.locator('[data-mode=tree]').click();
  await expect(
    page.getByRole('slider', { name: 'Seed', exact: true }),
  ).toHaveValue('789');
  await expect(page.locator('[data-stat=triangles]')).toHaveText(treeCount);
  await expect(page.locator('.lod-switcher')).toBeVisible();
  await page.getByRole('button', { name: 'LOD1', exact: true }).click();
  await expect(page.locator('[data-stat=triangles]')).not.toHaveText(treeCount);
  await page.getByRole('button', { name: 'Full', exact: true }).click();
  await expect(page.locator('[data-stat=triangles]')).toHaveText(treeCount);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const treeDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Preset', exact: true }).click();
  const treeFile = await treeDownload,
    treeBuffer = await fs.readFile(await treeFile.path());
  await page.locator('#fileInput').setInputFiles({
    name: 'tree.json',
    mimeType: 'application/json',
    buffer: treeBuffer,
  });
  await page.locator('[data-tab=parameters]').click();
  await expect(
    page.getByRole('slider', { name: 'Seed', exact: true }),
  ).toHaveValue('789');
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    (await page.locator('#custom-panel').getAttribute('class')).includes(
      'collapsed',
    )
  )
    await page.locator('.panel-header').click();
  await expect(page.locator('#generator-mode')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile.png') });
  expect(errors).toEqual([]);
});

test('existing original.html URL opens the same source-based interface', async ({
  page,
}) => {
  await page.goto('/original.html');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 60000 });
  await expect(page.locator('#custom-panel')).toBeVisible();
  await expect(page.locator('#generator-mode')).toBeVisible();
});

test('environment previews the edited tree as a background or small LOD forest', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 60000 });
  await page
    .locator('.section-header')
    .filter({ hasText: 'Environment' })
    .click();
  const status = page.locator('#forest-preview-status');
  await expect(status).toContainText('Standard background');
  await expect(
    page.getByRole('slider', { name: 'Tree Spacing', exact: true }),
  ).toHaveValue('45');
  await expect(
    page.getByRole('slider', { name: 'Forest Size', exact: true }),
  ).toHaveValue('1');
  await expect(
    page.getByRole('slider', { name: 'Forest Size', exact: true }),
  ).toBeDisabled();
  await page.getByRole('switch', { name: 'Edited Trees', exact: true }).click();
  await expect(status).toContainText('8 copies');
  await expect(status).toContainText('background');
  await page
    .getByRole('switch', { name: 'Surround Tree', exact: true })
    .click();
  await expect(status).toContainText('surrounding cluster');
  await page
    .getByRole('slider', { name: 'Tree Spacing', exact: true })
    .fill('35');
  await page.getByRole('button', { name: 'Fit Forest', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('small-forest.png') });
  await page
    .getByRole('slider', { name: 'Forest Size', exact: true })
    .fill('4');
  await expect(status).toContainText('80 copies');
  await page.getByRole('button', { name: 'Fit Forest', exact: true }).click();
  await page
    .getByRole('slider', { name: 'Forest Size', exact: true })
    .fill('1');
  await page.getByRole('slider', { name: 'Seed', exact: true }).fill('1234');
  await page
    .getByRole('combobox', { name: 'Preset', exact: true })
    .selectOption('Pine Small');
  await expect(status).not.toContainText('Updating copies');
  await page.getByRole('button', { name: 'Fit Forest', exact: true }).click();
  await page.locator('[data-mode=plant]').click();
  await expect(page.locator('#forest-preview-controls')).toBeHidden();
  await page.locator('[data-mode=tree]').click();
  await expect(page.locator('#forest-preview-controls')).toBeVisible();
  await expect(
    page.getByRole('switch', { name: 'Edited Trees', exact: true }),
  ).toBeChecked();
  await page.getByRole('switch', { name: 'Edited Trees', exact: true }).click();
  await expect(status).toContainText('Standard background');
  expect(errors).toEqual([]);
});
