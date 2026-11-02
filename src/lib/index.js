export { Tree } from './tree';
export { Trellis } from './trellis';
export { TreePreset } from './presets/index';
export { Billboard, TreeType } from './enums';

export { createRootGeometry, conformRoots, rootTerrain, rootDefaults } from './traits/roots.js';
export { createBreakableTree, simulateChop, cutLocation, mainStem, disposeBreakable, destructionDefaults } from './traits/fracture.js';
