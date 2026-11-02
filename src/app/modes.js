import * as THREE from 'three';
import {
  generatePlant,
  generateCreature,
  disposeModel,
} from './lab/generators.js';
import { newRecipe } from './lab/recipes.js';

export function createModes(tree, scene, camera, controls) {
  let mode = 'tree',
    specimen,
    mixer,
    helper;
  const recipes = {
      plant: newRecipe('plant'),
      creature: newRecipe('creature'),
    },
    views = {};
  const playback = {
    playing: true,
    clip: 'Walk',
    showRig: false,
    studio: true,
  };
  const original = { background: scene.background, fog: scene.fog };
  const stage = new THREE.Group();
  stage.name = 'CreatureStage';
  stage.visible = false;
  stage.add(new THREE.HemisphereLight('#eef1ef', '#44483e', 2.4));
  const key = new THREE.DirectionalLight('#fff1d9', 3.1);
  key.position.set(12, 26, 18);
  key.castShadow = true;
  Object.assign(key.shadow.camera, {
    left: -30,
    right: 30,
    top: 30,
    bottom: -30,
    far: 100,
  });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  stage.add(key);
  const rim = new THREE.DirectionalLight('#b6cddb', 2);
  rim.position.set(-15, 12, -16);
  stage.add(rim);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(80, 96),
    new THREE.MeshStandardMaterial({ color: '#3a403c', roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.03;
  floor.receiveShadow = true;
  stage.add(floor);
  scene.add(stage);
  function refreshStage() {
    const clean = mode === 'creature' && playback.studio;
    stage.visible = clean;
    if (mode === 'creature' && window.innerWidth > 768) {
      const panelWidth =
        document.getElementById('custom-panel')?.getBoundingClientRect()
          .width ?? 336;
      camera.setViewOffset(
        window.innerWidth,
        window.innerHeight,
        panelWidth * 0.5,
        0,
        window.innerWidth,
        window.innerHeight,
      );
    } else camera.clearViewOffset();
    const environment = scene.children.find((o) => o.ground && o.skybox);
    if (environment) environment.visible = !clean;
    const forest = scene.getObjectByName('Forest');
    if (forest)
      forest.visible =
        !clean && !scene.getObjectByName('EditedForest')?.visible;
    scene.background = clean ? new THREE.Color('#29332f') : original.background;
    scene.fog = clean ? null : original.fog;
    if (helper) helper.visible = mode === 'creature' && playback.showRig;
  }
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
    const distance = size.length() * (mode === 'creature' ? 1.15 : 1.7);
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 2;
    controls.maxDistance = 150;
    controls.target.copy(center);
    camera.position
      .copy(center)
      .add(
        new THREE.Vector3(
          mode === 'creature' ? 0.45 : 1,
          mode === 'creature' && recipes.creature.parameters.species === 'snake'
            ? 1.35
            : 0.27,
          1.5,
        )
          .normalize()
          .multiplyScalar(distance),
      );
    controls.update();
  }
  function setClip(name) {
    playback.clip = name;
    if (!mixer) return;
    mixer.stopAllAction();
    const clip = specimen.animations.find((c) => c.name === name);
    if (clip) mixer.clipAction(clip).reset().play();
    mixer.update(0);
    specimen.updateMatrixWorld(true);
  }
  function regenerate() {
    if (mode === 'tree') return;
    if (mixer) {
      mixer.stopAllAction();
      mixer.uncacheRoot(specimen);
      mixer = null;
    }
    if (helper) {
      scene.remove(helper);
      helper.geometry.dispose();
      helper.material.dispose();
      helper = null;
    }
    if (specimen) {
      scene.remove(specimen);
      disposeModel(specimen);
    }
    specimen = (mode === 'plant' ? generatePlant : generateCreature)(
      recipes[mode].parameters,
    );
    specimen.scale.setScalar(4);
    specimen.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(specimen);
    specimen.position.y = Math.max(0, -box.min.y);
    scene.add(specimen);
    specimen.updateMatrixWorld(true);
    if (mode === 'creature') {
      mixer = new THREE.AnimationMixer(specimen);
      if (
        !specimen.animations.some((c) => c.name === playback.clip) &&
        playback.clip !== 'Rest'
      )
        playback.clip = specimen.userData.locomotion;
      setClip(playback.clip);
      helper = new THREE.SkeletonHelper(specimen);
      helper.material.depthTest = false;
      helper.material.transparent = true;
      helper.material.opacity = 0.8;
      helper.renderOrder = 10;
      scene.add(helper);
    }
    refreshStage();
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
    playback,
    setRecipe(recipe) {
      recipes[recipe.mode] = recipe;
      if (recipe.mode === 'creature')
        playback.clip =
          recipe.parameters.species === 'snake'
            ? 'Slither'
            : recipe.parameters.species === 'fish'
              ? 'Swim'
              : 'Walk';
    },
    regenerate,
    fit,
    setClip,
    refreshStage,
    update(delta) {
      if (mode === 'creature' && mixer) {
        if (playback.playing) mixer.update(Math.min(delta, 0.1));
        specimen.updateMatrixWorld(true);
      }
    },
    prepareExport() {
      if (mode !== 'creature') return { model: this.model, dispose() {} };
      // Export a fresh bind pose so preview time never changes inverse bind matrices.
      const group = generateCreature(recipes.creature.parameters);
      const model = group.children.find((o) => o.isSkinnedMesh),
        root = group.children.find((o) => o.isBone),
        scale = 4;
      // Bake preview units into vertices/joint offsets; a root skinned node has no
      // ignored parent/local transforms in glTF consumers.
      model.geometry.scale(scale, scale, scale);
      model.geometry.translate(
        specimen.position.x,
        specimen.position.y,
        specimen.position.z,
      );
      model.skeleton.bones.forEach((b) => b.position.multiplyScalar(scale));
      root.position.add(specimen.position);
      group.remove(model, root);
      model.add(root);
      model.name = 'Creature';
      model.animations = group.animations;
      model.userData = group.userData;
      for (const clip of model.animations)
        for (const track of clip.tracks)
          if (track.name === 'Root.position') {
            for (let i = 0; i < track.values.length; i += 3) {
              track.values[i] = track.values[i] * scale + specimen.position.x;
              track.values[i + 1] =
                track.values[i + 1] * scale + specimen.position.y;
              track.values[i + 2] =
                track.values[i + 2] * scale + specimen.position.z;
            }
          }
      model.updateMatrixWorld(true);
      model.bind(model.skeleton);
      model.geometry.computeBoundingSphere();
      return { model, dispose: () => disposeModel(model) };
    },
    switchTo(next) {
      if (next === mode) return;
      saveView();
      mode = next;
      tree.visible = mode === 'tree';
      if (mode === 'tree') {
        if (specimen) specimen.visible = false;
        if (helper) helper.visible = false;
      } else regenerate();
      if (views[mode]) restoreView(views[mode]);
      else fit();
      refreshStage();
    },
  };
}
