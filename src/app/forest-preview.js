import * as THREE from 'three';

export function forestPositions(rings, spacing, surround) {
  const positions = [];
  const offset = surround ? 0 : -(175 + rings * spacing);
  for (let x = -rings; x <= rings; x++) {
    for (let z = -rings; z <= rings; z++) {
      if (x === 0 && z === 0) continue;
      positions.push(new THREE.Vector3(offset + x * spacing, 0, z * spacing));
    }
  }
  return positions;
}

// Each copy has independent distance switching, but all copies share just six
// geometry buffers and borrow the edited tree's two materials (including wind).
export class ForestPreview {
  constructor(tree, background, scene, camera, controls) {
    Object.assign(this, { tree, background, scene, camera, controls });
    this.settings = { enabled: false, surround: false, spacing: 45, rings: 1 };
    this.active = true;
    this.dirty = true;
    this.group = new THREE.Group();
    this.group.name = 'EditedForest';
    this.group.visible = false;
    scene.add(this.group);
    this.geometries = [];
    this.timer = null;
  }

  setActive(active) {
    this.active = active;
    this.sync();
  }

  configure(values) {
    const next = { ...this.settings, ...values };
    if (
      !Number.isInteger(next.rings) ||
      next.rings < 1 ||
      next.rings > 4 ||
      !Number.isFinite(next.spacing) ||
      next.spacing < 10 ||
      next.spacing > 100
    )
      throw new Error('Invalid forest size or spacing');
    const layoutChanged =
      next.rings !== this.settings.rings ||
      next.spacing !== this.settings.spacing ||
      next.surround !== this.settings.surround;
    this.settings = next;
    if (layoutChanged && !this.dirty) this.layout();
    this.sync();
  }

  sync() {
    const visible = this.active && this.settings.enabled;
    this.background.visible = !visible;
    this.group.visible = visible;
    if (!visible) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (visible && this.dirty) this.rebuild();
    this.onChange?.();
  }

  requestRefresh() {
    this.dirty = true;
    this.onChange?.();
    clearTimeout(this.timer);
    // Dragging a tree slider generates once after a short pause, not once per copy.
    if (this.active && this.settings.enabled) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.rebuild();
        this.onChange?.();
      }, 140);
    }
  }

  rebuild() {
    clearTimeout(this.timer);
    this.timer = null;
    this.group.clear();
    this.geometries.forEach((g) => g.dispose());
    this.geometries = [];
    const height = new THREE.Box3()
      .setFromObject(this.tree)
      .getSize(new THREE.Vector3()).y;
    const distance = Math.max(25, Math.min(75, height * 1.2));
    this.levels = [
      { distance: 0, detail: {} },
      {
        distance,
        detail: {
          sectionStride: 2,
          segmentFactor: 0.65,
          leafStride: 2,
          leafScale: 1.35,
        },
      },
      {
        distance: distance * 2,
        detail: {
          sectionStride: 3,
          segmentFactor: 0.5,
          leafStride: 4,
          leafScale: 1.8,
          billboard: 'single',
        },
      },
    ].map((level) => {
      const geometry = this.tree.createGeometry(level.detail);
      this.geometries.push(geometry.branches, geometry.leaves);
      return { ...level, geometry };
    });
    this.dirty = false;
    this.layout();
  }

  layout() {
    if (!this.levels) return;
    this.group.clear();
    forestPositions(
      this.settings.rings,
      this.settings.spacing,
      this.settings.surround,
    ).forEach((position, index) => {
      const lod = new THREE.LOD();
      lod.autoUpdate = false;
      lod.name = `EditedTree_${index + 1}`;
      lod.position.copy(position);
      lod.quaternion.copy(this.tree.quaternion);
      lod.scale.copy(this.tree.scale);
      this.levels.forEach((level, i) => {
        const pair = new THREE.Group();
        for (const [key, source] of [
          ['branches', this.tree.branchesMesh],
          ['leaves', this.tree.leavesMesh],
        ]) {
          const mesh = new THREE.Mesh(level.geometry[key], source.material);
          mesh.castShadow = i < 2;
          mesh.receiveShadow = true;
          pair.add(mesh);
        }
        lod.addLevel(pair, level.distance, 0.1);
      });
      this.group.add(lod);
    });
    this.group.updateMatrixWorld(true);
    this.updateLODs();
  }

  updateLODs() {
    if (!this.group.visible) return;
    this.camera.updateMatrixWorld();
    this.group.children.forEach((lod) => lod.update(this.camera));
  }

  fit() {
    if (!this.group.visible) return;
    if (this.dirty) {
      this.rebuild();
      this.onChange?.();
    }
    const box = new THREE.Box3()
      .setFromObject(this.group)
      .union(new THREE.Box3().setFromObject(this.tree));
    const center = box.getCenter(new THREE.Vector3()),
      radius = box.getSize(new THREE.Vector3()).length() * 0.5;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const limitingFov = Math.min(
      fov,
      2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect),
    );
    const distance = (radius / Math.sin(limitingFov / 2)) * 1.1;
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    this.controls.maxDistance = Math.max(150, distance * 2);
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.controls.update();
    this.updateLODs();
  }

  dispose() {
    clearTimeout(this.timer);
    this.geometries.forEach((g) => g.dispose());
    this.group.clear();
    this.scene.remove(this.group);
    this.background.visible = true;
  }
}
