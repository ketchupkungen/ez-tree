import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('all modes generate, preserve state and export valid GLBs and recipes', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#stats')).toContainText('triangles');
  for (const [mode, name] of [
    ['tree', 'Tree / bush'],
    ['plant', 'Plant'],
    ['creature', 'Creature'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    const presetNames = await page
      .locator('#preset option')
      .evaluateAll((options) => options.map((o) => o.value));
    for (const preset of presetNames) {
      await page.getByLabel('Starting point').selectOption(preset);
      await expect(page.locator('#specimen-name')).toHaveText(preset);
      await expect(page.locator('#stats')).toContainText('triangles');
    }
    await page.getByLabel('Starting point').selectOption(presetNames[0]);
    await page.getByLabel('Seed', { exact: true }).fill('123');
    await page.getByLabel('Seed', { exact: true }).press('Tab');
    await expect(page.locator('#stats')).toContainText('Seed 123');
    const before = await page.locator('#stats').textContent();
    await page.getByRole('button', { name: '↻ New seed', exact: true }).click();
    await expect(page.locator('#stats')).not.toHaveText(before);
    await page.getByLabel('Seed', { exact: true }).fill('123');
    await page.getByLabel('Seed', { exact: true }).press('Tab');
    for (const control of await page.locator('input[type=range]').all()) {
      await control.fill(await control.getAttribute('max'));
      await control.dispatchEvent('input');
      await expect(page.locator('#stats')).toContainText('triangles');
    }
    await page.getByRole('button', { name: 'Reset this preset' }).click();
    await page.getByRole('button', { name: 'Fit view', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`${mode}.png`) });
    const downloadGLB = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export GLB ↗' }).click();
    const glb = await downloadGLB,
      data = await fs.readFile(await glb.path());
    expect(data.toString('utf8', 0, 4)).toBe('glTF');
    expect(data.readUInt32LE(4)).toBe(2);
    expect(data.readUInt32LE(8)).toBe(data.length);
    const json = JSON.parse(
      data.toString('utf8', 20, 20 + data.readUInt32LE(12)).trim(),
    );
    expect(json.meshes.length).toBeGreaterThan(0);
    expect(
      json.nodes.some((n) => ['Tree', 'Plant', 'Creature'].includes(n.name)),
    ).toBe(true);
    await glb.saveAs(testInfo.outputPath(`${mode}.glb`));
    const downloadRecipe = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Save recipe', exact: true })
      .click();
    const recipeFile = await downloadRecipe,
      recipeData = await fs.readFile(await recipeFile.path());
    const recipe = JSON.parse(recipeData);
    expect(recipe.mode).toBe(mode);
    await page
      .locator('#import-file')
      .setInputFiles({
        name: 'recipe.json',
        mimeType: 'application/json',
        buffer: recipeData,
      });
    await expect(page.locator('#status')).toHaveText('Recipe loaded.');
  }
  const pngDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Snapshot PNG' }).click();
  const png = await pngDownload,
    pngData = await fs.readFile(await png.path());
  expect(pngData.subarray(1, 4).toString()).toBe('PNG');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Creature', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .locator('#import-file')
    .setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":1,"mode":"__proto__"}'),
    });
  await expect(page.locator('#status')).toContainText('Could not load recipe');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('mobile.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('original tree editor remains accessible', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/original.html');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('← Back to Lab', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
