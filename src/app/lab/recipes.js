import { plantPresets, creaturePresets } from './generators.js';
// Shared by controls and recipe validation: label, minimum, maximum, step.
export const fields = {
  tree: {
    height: ['Height multiplier', 0.3, 2, 0.05],
    width: ['Crown spread', 0.3, 2, 0.05],
    leafSize: ['Leaf size', 0.3, 2.5, 0.05],
    density: ['Leaf density', 0.25, 2, 0.05],
  },
  plant: {
    height: ['Stem height', 1, 8, 0.1],
    stems: ['Stem count', 1, 12, 1],
    leaves: ['Leaves per stem', 2, 28, 1],
    leafSize: ['Leaf length', 0.2, 2.5, 0.05],
    petals: ['Petals per flower', 0, 16, 1],
    flowerSize: ['Flower size', 0.2, 1.5, 0.05],
    bend: ['Stem bend', 0, 3, 0.1],
  },
  creature: {
    length: ['Body length', 1.5, 8, 0.1],
    girth: ['Body girth', 0.4, 2, 0.05],
    legPairs: ['Leg pairs', 1, 6, 1],
    legLength: ['Leg length', 0.5, 3.5, 0.1],
    headSize: ['Head size', 0.3, 1.5, 0.05],
    tailLength: ['Tail length', 0, 4, 0.1],
    horns: ['Back horns', 0, 6, 1],
  },
};
export const treeNames = [
  'Ash Small',
  'Ash Medium',
  'Ash Large',
  'Aspen Small',
  'Aspen Medium',
  'Aspen Large',
  'Oak Small',
  'Oak Medium',
  'Oak Large',
  'Pine Small',
  'Pine Medium',
  'Pine Large',
  'Bush 1',
  'Bush 2',
  'Bush 3',
];
export const presets = {
  tree: Object.fromEntries(
    treeNames.map((name) => [
      name,
      {
        seed: 42,
        height: 1,
        width: 1,
        leafSize: 1,
        density: 1,
        color: '#a6b994',
        accent: '#8d7761',
      },
    ]),
  ),
  plant: plantPresets,
  creature: creaturePresets,
};
export function newRecipe(mode, preset = Object.keys(presets[mode])[0]) {
  return { version: 1, mode, preset, parameters: { ...presets[mode][preset] } };
}
export function validateRecipe(data) {
  if (
    !data ||
    data.version !== 1 ||
    !Object.hasOwn(presets, data.mode) ||
    !Object.hasOwn(presets[data.mode], data.preset)
  )
    throw new Error(
      'Choose an EZ-Tree Lab version 1 recipe with a supported mode and preset.',
    );
  const p = data.parameters;
  if (!p || !Number.isInteger(p.seed) || p.seed < 0 || p.seed > 2147483647)
    throw new Error('Seed must be an integer from 0 to 2147483647.');
  const result = newRecipe(data.mode, data.preset);
  result.parameters.seed = p.seed;
  for (const [key, [, min, max, step]] of Object.entries(fields[data.mode])) {
    if (
      !Number.isFinite(p[key]) ||
      p[key] < min ||
      p[key] > max ||
      (step === 1 && !Number.isInteger(p[key]))
    )
      throw new Error(`Invalid ${key}: expected ${min} to ${max}.`);
    result.parameters[key] = p[key];
  }
  for (const key of ['color', 'accent']) {
    if (typeof p[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(p[key]))
      throw new Error(`Invalid ${key} color.`);
    result.parameters[key] = p[key];
  }
  return result;
}
