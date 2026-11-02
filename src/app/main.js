import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { setupUI } from './ui';
import { createScene } from './scene';
import { createModes } from './modes.js';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('app')

  // User needs to interact with the page before audio will play
  container.addEventListener('click', toggleAudio);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 2;
  container.appendChild(renderer.domElement);

  const { scene, environment, tree, camera, controls, forestPreview } = await createScene(renderer);

  const composer = new EffectComposer(renderer);

  composer.addPass(new RenderPass(scene, camera));

  const smaaPass = new SMAAPass(
    container.clientWidth * renderer.getPixelRatio(),
    container.clientHeight * renderer.getPixelRatio());
  composer.addPass(smaaPass);

  composer.addPass(new OutputPass());

  const clock = new THREE.Clock();
  function animate() {
    // Update time for wind sway shaders
    const delta = clock.getDelta();
    const t = clock.elapsedTime;
    modes.update(delta);
    renderer.toneMappingExposure = modes.mode === 'creature' && modes.playback.studio ? 1 : 2;
    tree.update(t);
    const background = scene.getObjectByName('Forest');
    if (background.visible) background.children.forEach((o) => o.update(t));
    forestPreview.updateLODs();
    environment.update(t);

    controls.update();
    composer.render();
    requestAnimationFrame(animate);
  }

  function resize() {
    renderer.setSize(container.clientWidth, container.clientHeight);
    smaaPass.setSize(container.clientWidth, container.clientHeight);
    composer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    modes.refreshStage();
  }

  window.addEventListener('resize', resize);

  const modes = createModes(tree, scene, camera, controls);
  setupUI(tree, environment, renderer, scene, camera, controls, 'Ash Medium', modes, forestPreview);
  animate();
  resize();

  document.getElementById('audio-status').style.display = 'block';
});

window.toggleAudio = function () {
  document.getElementById('app').removeEventListener('click', toggleAudio);

  if (window.isAudioPlaying) {
    window.isAudioPlaying = false;
    document.getElementById('audio-status').src = "/icons/icon_muted.png";
    document.getElementById('background-audio').pause();
  } else {
    window.isAudioPlaying = true;
    document.getElementById('audio-status').src = "/icons/icon_playing.png";
    document.getElementById('background-audio').play();
  }
}