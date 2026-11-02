import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Tree, TreePreset } from '@dgreenheck/ez-tree';
import { applyTreeTextures } from '../textures.js';
import { generatePlant, generateCreature, disposeModel } from './generators.js';
import { fields, presets, newRecipe, validateRecipe } from './recipes.js';

const $ = (id) => document.getElementById(id);
const labels = { tree: 'Tree / bush', plant: 'Plant', creature: 'Creature' };
const notes = {
  tree: 'Original EZ-Tree geometry, with quick shape controls. Open the original editor for detailed branching, bark, wind and LOD controls.',
  plant:
    'Procedural stems, curved leaves and optional flowers. Set petals to zero for foliage plants.',
  creature:
    'Seeded static creature meshes with symmetric limbs. An initial shape generator; rigging and locomotion are future experiments.',
};
let recipe = newRecipe('tree', 'Ash Medium'),
  model;
const sessions = {};
try {
  const saved = localStorage.getItem('ez-tree-lab-v1');
  if (saved) recipe = validateRecipe(JSON.parse(saved));
} catch {
  /* A stale recipe must not prevent startup. */
}
const host = $('canvas-host');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#25332e');
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 2000);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
} catch {
  $('status').textContent =
    'WebGL is unavailable. Enable hardware acceleration and reload.';
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
host.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight('#dce5d3', '#505b45', 2.5));
const key = new THREE.DirectionalLight('#fff0cc', 4);
key.position.set(12, 25, 12);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0005;
scene.add(key);
scene.add(key.target);
const fill = new THREE.DirectionalLight('#b4d9df', 1.8);
fill.position.set(-10, 8, -10);
scene.add(fill);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1, 96),
  new THREE.MeshStandardMaterial({ color: '#34443a', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.03;
ground.receiveShadow = true;
scene.add(ground);
let grid;
function status(message) {
  $('status').textContent = message;
}
function saveLocal() {
  try {
    localStorage.setItem('ez-tree-lab-v1', JSON.stringify(recipe));
  } catch {
    /* Export still works when storage is unavailable. */
  }
}
function fit() {
  const box = new THREE.Box3().setFromObject(model),
    size = box.getSize(new THREE.Vector3()),
    center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 1),
    fov = THREE.MathUtils.degToRad(camera.fov);
  const distance =
    (radius /
      Math.sin(
        Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * camera.aspect)) / 2,
      )) *
    1.2;
  controls.target.copy(center);
  camera.position
    .copy(center)
    .add(
      new THREE.Vector3(1.1, 0.55, 1.6).normalize().multiplyScalar(distance),
    );
  camera.near = Math.max(0.01, distance / 1000);
  camera.far = distance * 50;
  camera.updateProjectionMatrix();
  controls.minDistance = radius * 0.2;
  controls.maxDistance = distance * 8;
  controls.update();
}
function wireframe() {
  model.traverse((o) => {
    if (o.isMesh) o.material.wireframe = $('wireframe').checked;
  });
}
function regenerate(refit = false) {
  const started = performance.now(),
    p = recipe.parameters;
  let next;
  if (recipe.mode === 'tree') {
    next = new Tree();
    next.options.copy(structuredClone(TreePreset[recipe.preset]));
    next.options.seed = p.seed;
    next.options.leaves.size *= p.leafSize;
    next.options.leaves.count = Math.max(
      1,
      Math.round(next.options.leaves.count * p.density),
    );
    next.options.leaves.tint = new THREE.Color(p.color).getHex();
    next.options.bark.tint = new THREE.Color(p.accent).getHex();
    applyTreeTextures(next);
    next.generate();
    next.scale.set(p.width, p.height, p.width);
  } else
    next = recipe.mode === 'plant' ? generatePlant(p) : generateCreature(p);
  if (model) {
    scene.remove(model);
    disposeModel(model);
  }
  model = next;
  scene.add(model);
  model.updateMatrixWorld(true);
  wireframe();
  const box = new THREE.Box3().setFromObject(model),
    size = box.getSize(new THREE.Vector3()),
    span = Math.max(size.x, size.y, size.z, 1);
  ground.scale.setScalar(span * 1.4);
  if (grid) {
    scene.remove(grid);
    grid.geometry.dispose();
    grid.material.dispose();
  }
  grid = new THREE.GridHelper(span * 4, 32, '#54654e', '#3d4f42');
  grid.position.y = -0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  scene.add(grid);
  key.position.set(span, span * 2, span);
  key.target.position.set(0, size.y * 0.4, 0);
  Object.assign(key.shadow.camera, {
    left: -span,
    right: span,
    top: span,
    bottom: -span,
    near: 0.1,
    far: span * 6,
  });
  key.shadow.camera.updateProjectionMatrix();
  let triangles = 0;
  model.traverse((o) => {
    if (o.isMesh)
      triangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  $('stats').textContent =
    `${Math.round(triangles).toLocaleString()} triangles · ${(performance.now() - started).toFixed(0)} ms · Seed ${p.seed}`;
  $('specimen-name').textContent = recipe.preset;
  if (refit) fit();
  saveLocal();
  status(`${labels[recipe.mode]} ready. Changes generate automatically.`);
}
function renderControls() {
  document
    .querySelectorAll('[data-mode]')
    .forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.mode === recipe.mode),
      ),
    );
  $('mode-heading').textContent = labels[recipe.mode];
  $('mode-note').textContent = notes[recipe.mode];
  $('preset').replaceChildren(
    ...Object.keys(presets[recipe.mode]).map(
      (name) => new Option(name, name, false, name === recipe.preset),
    ),
  );
  $('seed').value = recipe.parameters.seed;
  $('color').value = recipe.parameters.color;
  $('accent').value = recipe.parameters.accent;
  $('parameters').replaceChildren();
  for (const [key, [label, min, max, step]] of Object.entries(
    fields[recipe.mode],
  )) {
    const wrapper = document.createElement('label');
    wrapper.className = 'parameter';
    const caption = document.createElement('span'),
      title = document.createElement('span'),
      output = document.createElement('output');
    title.textContent = label;
    output.textContent = recipe.parameters[key];
    caption.append(title, output);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = recipe.parameters[key];
    slider.setAttribute('aria-label', label);
    slider.addEventListener('input', () => {
      recipe.parameters[key] = Number(slider.value);
      output.textContent = slider.value;
      regenerate();
    });
    wrapper.append(caption, slider);
    $('parameters').append(wrapper);
  }
}
document.querySelectorAll('[data-mode]').forEach((button) =>
  button.addEventListener('click', () => {
    sessions[recipe.mode] = structuredClone(recipe);
    recipe = sessions[button.dataset.mode] ?? newRecipe(button.dataset.mode);
    renderControls();
    regenerate(true);
  }),
);
$('preset').onchange = () => {
  recipe = newRecipe(recipe.mode, $('preset').value);
  renderControls();
  regenerate(true);
};
$('reset').onclick = () => {
  recipe = newRecipe(recipe.mode, recipe.preset);
  renderControls();
  regenerate(true);
};
$('seed').onchange = () => {
  const n = Number($('seed').value);
  if (!$('seed').value || !Number.isInteger(n) || n < 0 || n > 2147483647) {
    $('seed').value = recipe.parameters.seed;
    status('Seed must be an integer from 0 to 2147483647.');
    return;
  }
  recipe.parameters.seed = n;
  regenerate();
};
$('randomize').onclick = () => {
  recipe.parameters.seed =
    crypto.getRandomValues(new Uint32Array(1))[0] % 2147483648;
  $('seed').value = recipe.parameters.seed;
  regenerate();
};
for (const id of ['color', 'accent'])
  $(id).oninput = () => {
    recipe.parameters[id] = $(id).value;
    regenerate();
  };
$('fit').onclick = fit;
$('rotate').onchange = () => {
  controls.autoRotate = $('rotate').checked;
};
$('wireframe').onchange = wireframe;
function download(blob, suffix) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `${recipe.mode}-${recipe.preset.toLowerCase().replaceAll(' ', '-')}-${recipe.parameters.seed}.${suffix}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('save').onclick = () => {
  download(
    new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' }),
    'json',
  );
  status('Recipe saved. Load it to reproduce this specimen.');
};
$('load').onclick = () => $('import-file').click();
$('import-file').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 100000)
      throw new Error('Recipe files must be smaller than 100 KB.');
    const next = validateRecipe(JSON.parse(await file.text()));
    recipe = next;
    renderControls();
    regenerate(true);
    status('Recipe loaded.');
  } catch (err) {
    status(`Could not load recipe: ${err.message}`);
  } finally {
    e.target.value = '';
  }
};
$('png').onclick = () => {
  renderer.render(scene, camera);
  renderer.domElement.toBlob((blob) => {
    if (blob) {
      download(blob, 'png');
      status('Snapshot saved.');
    }
  }, 'image/png');
};
$('glb').onclick = async () => {
  $('glb').disabled = true;
  status('Preparing GLB…');
  try {
    // Wait for local image textures before the exporter reads their pixels.
    const images = new Set();
    model.traverse((o) => {
      if (o.isMesh)
        for (const value of Object.values(o.material))
          if (value?.isTexture && value.image?.decode) images.add(value.image);
    });
    await Promise.all([...images].map((image) => image.decode()));
    const exportModel = model.clone(true);
    exportModel.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.wireframe = false;
      }
    });
    try {
      const buffer = await new GLTFExporter().parseAsync(exportModel, {
        binary: true,
      });
      download(new Blob([buffer], { type: 'model/gltf-binary' }), 'glb');
      status('GLB saved. Includes the specimen only.');
    } finally {
      exportModel.traverse((o) => {
        if (o.isMesh) o.material.dispose();
      });
    }
  } catch (err) {
    status(`Export failed: ${err.message}`);
  } finally {
    $('glb').disabled = false;
  }
};
function resize() {
  const { width, height } = host.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
resize();
renderControls();
regenerate(true);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
