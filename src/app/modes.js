import * as THREE from 'three';
import {
  generatePlant,
  generateCreature,
  disposeModel,
} from './lab/generators.js';
import { newRecipe } from './lab/recipes.js';

// Keep the original tree object and camera state intact while experimenting.
export function createModes(tree, scene, camera, controls) {
  let mode = 'tree',
    specimen;
  const recipes = {
    plant: newRecipe('plant'),
    creature: newRecipe('creature'),
  };
  const views = {};
  function saveView() {
    views[mode] = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      minPolar: controls.minPolarAngle,
      maxPolar: controls.maxPolarAngle,
      minDistance: controls.minDistance,
      maxDistance: controls.maxDistance,
    };
  }
  function restoreView(view) {
    camera.position.copy(view.position);
    controls.target.copy(view.target);
    Object.assign(controls, {
      minPolarAngle: view.minPolar,
      maxPolarAngle: view.maxPolar,
      minDistance: view.minDistance,
      maxDistance: view.maxDistance,
    });
    controls.update();
  }
  function fit() {
    if (mode === 'tree') return;
    const box = new THREE.Box3().setFromObject(specimen),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    const distance = size.length() * 1.7;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 2;
    controls.maxDistance = 150;
    controls.target.copy(center);
    camera.position
      .copy(center)
      .add(new THREE.Vector3(1, 0.3, 1.3).normalize().multiplyScalar(distance));
    controls.update();
  }
  function regenerate() {
    if (mode === 'tree') return;
    if (specimen) {
      scene.remove(specimen);
      disposeModel(specimen);
    }
    const recipe = recipes[mode];
    specimen = (mode === 'plant' ? generatePlant : generateCreature)(
      recipe.parameters,
    );
    // Match the scene's tree-sized stage so plants do not disappear in grass.
    specimen.scale.setScalar(4);
    scene.add(specimen);
    specimen.updateMatrixWorld(true);
  }
  return {
    get mode() {
      return mode;
    },
    get recipe() {
      return recipes[mode];
    },
    get model() {
      return mode === 'tree' ? tree : specimen;
    },
    setRecipe(recipe) {
      recipes[recipe.mode] = recipe;
    },
    regenerate,
    fit,
    switchTo(next) {
      if (next === mode) return;
      saveView();
      mode = next;
      tree.visible = mode === 'tree';
      if (mode === 'tree') {
        if (specimen) specimen.visible = false;
      } else regenerate();
      if (views[mode]) restoreView(views[mode]);
      else fit();
    },
  };
}
