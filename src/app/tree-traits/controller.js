import * as THREE from 'three';
import {
  createRootGeometry,
  conformRoots,
  rootTerrain,
  rootDefaults,
  Trellis,
  createBreakableTree,
  simulateChop,
  cutLocation,
  disposeBreakable,
  destructionDefaults,
} from '@dgreenheck/ez-tree';
import { frozenMaterial } from '../../lib/traits/fracture.js';

export class TreeTraits {
  constructor(tree, scene, environment, camera, controls, forest) {
    Object.assign(this, { tree, scene, environment, camera, controls, forest });
    this.active = true;
    this.lod = 0;
    this.rootLODs = [];
    this.asset = null;
    this.mixer = null;
    this.elapsed = 0;
    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.035, 6, 64),
      new THREE.MeshBasicMaterial({
        color: '#ebbd6d',
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      }),
    );
    this.marker.name = 'CutMarker';
    this.marker.renderOrder = 5;
    this.marker.visible = false;
    scene.add(this.marker);
    this.groundGroup = new THREE.Group();
    this.groundGroup.name = 'RootGroundPreview';
    this.groundGroup.visible = false;
    scene.add(this.groundGroup);
    this.tool = new THREE.Group();
    this.tool.name = 'PreviewAxe';
    this.tool.visible = false;
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 3, 8),
      new THREE.MeshStandardMaterial({ color: '#795132' }),
    );
    handle.position.y = -1.3;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.65, 0.14),
      new THREE.MeshStandardMaterial({
        color: '#949b9c',
        metalness: 0.7,
        roughness: 0.3,
      }),
    );
    blade.position.x = 0.35;
    this.tool.add(handle, blade);
    scene.add(this.tool);
    this.sourceChanged();
  }
  get roots() {
    return (
      this.tree.options.roots ?? (this.tree.options.roots = { ...rootDefaults })
    );
  }
  get destruction() {
    return (
      this.tree.options.destruction ??
      (this.tree.options.destruction = { ...destructionDefaults })
    );
  }
  get displayModel() {
    return this.asset && this.asset.model.visible
      ? this.asset.model
      : this.tree;
  }
  get sampleHeight() {
    return this.roots.enabled
      ? rootTerrain(this.roots, this.tree.options.branch.radius[0])
      : () => 0;
  }

  configureRoots(values) {
    Object.assign(this.roots, values);
    this.sourceChanged();
  }
  configureDestruction(values) {
    Object.assign(this.destruction, values);
    this.reset();
    this.updateMarker();
    this.onChange?.();
  }
  sourceChanged() {
    this.reset();
    this.clearRoots();
    if (this.roots.enabled) {
      const radius = this.tree.options.branch.radius[0];
      for (let i = 0; i < 3; i++) {
        const { geometry, profiles } = createRootGeometry(
          radius,
          this.tree.options.seed,
          this.roots,
          i,
        );
        conformRoots(geometry, this.sampleHeight);
        this.rootLODs.push(geometry);
        if (!i) this.profiles = profiles;
      }
      this.tree.rootRestLODs = this.rootLODs.map((g) => {
        const rest = g.clone();
        rest.attributes.position.copy(rest.attributes.rootRest);
        rest.computeVertexNormals();
        rest.computeBoundingSphere();
        return rest;
      });
      this.rootMesh = new THREE.Mesh(
        this.rootLODs[this.lod],
        this.tree.branchesMesh.material,
      );
      this.rootMesh.name = 'RootSystem';
      this.rootMesh.castShadow = this.rootMesh.receiveShadow = true;
      this.rootMesh.userData = {
        trait: 'terrain-roots',
        version: 1,
        contactWeight: 'TEXCOORD_1.y',
        equation: 'y += weight * (H(world.xz) - H(trunk.xz))',
        source: 'Rune MAP003 RootField015 behavior',
        settings: { ...this.roots },
        trunkRadius: radius,
        bakedTerrain: true,
      };
      this.tree.add(this.rootMesh);
    }
    this.buildGround();
    this.updateMarker();
    this.syncEnvironment();
    this.forest.requestRefresh();
    this.onChange?.();
  }
  clearRoots() {
    if (this.rootMesh) this.tree.remove(this.rootMesh);
    this.rootMesh = null;
    this.rootLODs.forEach((g) => g.dispose());
    this.rootLODs = [];
    this.profiles = null;
    this.tree.rootRestLODs?.forEach((g) => g.dispose());
    this.tree.rootRestLODs = null;
  }
  setLOD(level) {
    this.lod = level;
    if (this.rootMesh) this.rootMesh.geometry = this.rootLODs[level];
  }
  setActive(active) {
    this.active = active;
    if (!active) this.reset();
    this.syncEnvironment();
    this.updateMarker();
  }
  syncEnvironment() {
    const show = this.active && this.roots.enabled;
    this.groundGroup.visible = show;
    if (!this.savedGround)
      this.savedGround = [
        this.environment.ground.visible,
        this.environment.grass.visible,
        this.environment.rocks.visible,
      ];
    [
      this.environment.ground,
      this.environment.grass,
      this.environment.rocks,
    ].forEach((o, i) => (o.visible = show ? false : this.savedGround[i]));
  }
  buildGround() {
    this.groundGroup.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.groundGroup.clear();
    if (!this.roots.enabled) return;
    const extent = Math.max(
        12,
        this.tree.options.branch.radius[0] * this.roots.spread * 2.5,
      ),
      sample = this.sampleHeight,
      geometry = new THREE.PlaneGeometry(extent * 2, extent * 2, 96, 96);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++)
      position.setY(i, sample(position.getX(i), position.getZ(i)) - 0.018);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: '#71654e',
      roughness: 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    this.groundGroup.add(mesh);
    const shape = new THREE.Shape();
    shape.moveTo(-600, -600);
    shape.lineTo(600, -600);
    shape.lineTo(600, 600);
    shape.lineTo(-600, 600);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-extent, -extent);
    hole.lineTo(-extent, extent);
    hole.lineTo(extent, extent);
    hole.lineTo(extent, -extent);
    hole.closePath();
    shape.holes.push(hole);
    const outer = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.018;
    outer.receiveShadow = true;
    this.groundGroup.add(outer);
  }
  updateMarker() {
    this.marker.visible =
      this.active && this.destruction.enabled && !this.asset;
    if (!this.marker.visible) return;
    const cut = cutLocation(this.tree, this.destruction.cut);
    this.marker.position.copy(cut.origin);
    this.marker.quaternion
      .setFromEuler(cut.orientation)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          Math.PI / 2,
        ),
      );
    this.marker.scale.setScalar(cut.radius * 1.08);
  }
  rootExport(level = 0) {
    if (!this.rootMesh) return null;
    const geometry = (
      this.roots.bakeTerrain
        ? this.rootLODs[level]
        : this.tree.rootRestLODs[level]
    ).clone();
    geometry.deleteAttribute('rootRest');
    if (this.tree.branchesMesh.material.normalMap) geometry.computeTangents();
    const mesh = new THREE.Mesh(geometry, this.tree.branchesMesh.material);
    mesh.name = 'RootSystem';
    mesh.userData = {
      ...this.rootMesh.userData,
      bakedTerrain: this.roots.bakeTerrain,
    };
    return mesh;
  }
  prepareIntactExport() {
    const model = new THREE.Group();
    model.name = 'Tree';
    const geometry = this.tree.createGeometry();
    const materials = [
      frozenMaterial(this.tree.branchesMesh.material),
      frozenMaterial(this.tree.leavesMesh.material),
    ];
    for (const [i, key] of ['branches', 'leaves'].entries()) {
      if (geometry[key].attributes.position.count) {
        if (materials[i].normalMap && geometry[key].attributes.uv)
          geometry[key].computeTangents();
        const mesh = new THREE.Mesh(geometry[key], materials[i]);
        mesh.name = key;
        model.add(mesh);
      } else geometry[key].dispose();
    }
    const roots = this.rootExport();
    if (roots) {
      roots.material = materials[0];
      if (materials[0].normalMap) roots.geometry.computeTangents();
      model.add(roots);
    }
    if (
      this.tree.options.trellis.enabled &&
      this.tree.options.trellis.visible
    ) {
      const trellis = new Trellis(this.tree.options.trellis);
      trellis.generate();
      model.add(trellis);
      materials.push(trellis.material);
    }
    model.userData = {
      treeTraits: {
        roots: { ...this.roots },
        destruction: { ...this.destruction },
        rootContact: this.rootMesh
          ? { ...this.rootMesh.userData, bakedTerrain: this.roots.bakeTerrain }
          : null,
      },
    };
    return {
      model,
      dispose() {
        model.traverse((o) => o.geometry?.dispose());
        materials.forEach((m) => m.dispose());
      },
    };
  }
  prepareBreakableExport() {
    const roots = this.rootExport(),
      asset = createBreakableTree(this.tree, this.destruction, { roots });
    roots?.geometry.dispose();
    simulateChop(asset, this.destruction, this.sampleHeight);
    if (this.profiles) asset.manifest.rootProfiles = this.profiles;
    return { ...asset, dispose: () => disposeBreakable(asset) };
  }
  tryChop() {
    this.reset();
    this.destruction.enabled = true;
    const asset = createBreakableTree(this.tree, this.destruction, {
      detail: {
        sectionStride: 2,
        segmentFactor: 0.75,
        leafStride: 2,
        leafScale: 1.3,
      },
      roots: this.rootMesh,
    });
    const result = simulateChop(asset, this.destruction, this.sampleHeight);
    this.asset = asset;
    this.demo = result;
    this.elapsed = 0;
    this.scene.add(asset.model);
    this.tree.visible = false;
    this.marker.visible = false;
    this.mixer = new THREE.AnimationMixer(asset.model);
    const action = this.mixer.clipAction(result.clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    this.mixer.update(0);
    this.backgroundBefore = this.scene.getObjectByName('Forest').visible;
    this.scene.getObjectByName('Forest').visible = false;
    this.editedForestBefore = this.forest.group.visible;
    this.forest.group.visible = false;
    this.fitChop();
    this.onChange?.();
  }
  inspectRoots() {
    const reach = this.tree.options.branch.radius[0] * this.roots.spread;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 200;
    this.controls.target.set(0, this.tree.options.branch.radius[0] * 0.4, 0);
    this.camera.position.set(reach * 1.2, reach * 0.9, reach * 1.4);
    this.controls.update();
  }
  fitChop() {
    const box = new THREE.Box3().setFromObject(this.tree),
      size = box.getSize(new THREE.Vector3()),
      h = Math.max(size.y, size.x),
      heading = THREE.MathUtils.degToRad(this.destruction.direction),
      direction = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading));
    const center = direction.clone().multiplyScalar(h * 0.3);
    center.y = h * 0.3;
    const distance = h * 1.4;
    this.controls.maxDistance = Math.max(150, distance * 2);
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.copy(center);
    const side = new THREE.Vector3(direction.z, 0.4, -direction.x).normalize();
    this.camera.position.copy(center).addScaledVector(side, distance);
    this.controls.update();
  }
  update(delta) {
    if (!this.active || !this.mixer) return;
    this.elapsed = Math.min(
      this.demo.duration,
      this.elapsed + Math.min(delta, 0.1),
    );
    this.mixer.update(Math.min(delta, 0.1));
    this.tool.visible = this.elapsed < 0.65;
    if (this.tool.visible) {
      this.tool.position
        .copy(this.asset.cut.origin)
        .add(new THREE.Vector3(this.asset.cut.radius * 1.3, 0.3, 0));
      this.tool.rotation.z =
        -0.5 + Math.sin((this.elapsed / 0.65) * Math.PI * 6) * 0.85;
    }
    this.onChange?.();
  }
  reset() {
    if (this.mixer && this.asset) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.asset.model);
    }
    this.mixer = null;
    if (this.asset) {
      this.scene.remove(this.asset.model);
      disposeBreakable(this.asset);
      this.asset = null;
      this.tree.visible = this.active;
      if (this.backgroundBefore !== undefined)
        this.scene.getObjectByName('Forest').visible = this.backgroundBefore;
      if (this.editedForestBefore !== undefined)
        this.forest.group.visible = this.editedForestBefore;
    }
    this.tool.visible = false;
    this.updateMarker();
    this.onChange?.();
  }
}
