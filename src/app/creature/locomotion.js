import * as THREE from 'three';
import { clamp } from './surface.js';

function rotationTrack(name, times, angles, axis) {
  const values = [],
    direction = new THREE.Vector3(...axis);
  for (const angle of angles) {
    const q = new THREE.Quaternion().setFromAxisAngle(direction, angle);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

// Sampled two-link IK produces editable, portable bone tracks, not render-only motion.
export function createClips(rig, p) {
  const frames = 49,
    times = [],
    duration =
      (p.species === 'elk' ? 1.5 : p.species === 'lizard' ? 1.8 : 1.2) /
      p.gaitSpeed;
  for (let i = 0; i < frames; i++) times.push((i / (frames - 1)) * duration);
  const phaseAt = (i) => (i / (frames - 1)) * Math.PI * 2;
  const tracks = [],
    rootPositions = [];
  const bob = (i) =>
    rig.legs.length ? (Math.cos(phaseAt(i) * 2) - 1) * 0.012 * p.sway : 0;
  for (let i = 0; i < frames; i++) rootPositions.push(0, bob(i), 0);
  tracks.push(
    new THREE.VectorKeyframeTrack('Root.position', times, rootPositions),
  );

  for (const leg of rig.legs) {
    const upper = [],
      lower = [],
      foot = [];
    const l1 = Math.hypot(leg.knee.x - leg.hip.x, leg.knee.y - leg.hip.y),
      l2 = Math.hypot(leg.foot.x - leg.knee.x, leg.foot.y - leg.knee.y);
    const rest1 = Math.atan2(leg.knee.y - leg.hip.y, leg.knee.x - leg.hip.x),
      rest2 = Math.atan2(leg.foot.y - leg.knee.y, leg.foot.x - leg.knee.x);
    const preferred =
      Math.sign(
        Math.sin(
          rest1 - Math.atan2(leg.foot.y - leg.hip.y, leg.foot.x - leg.hip.x),
        ),
      ) || 1;
    for (let i = 0; i < frames; i++) {
      const cycle = (((i / (frames - 1) + leg.phase) % 1) + 1) % 1,
        stance = 0.64,
        swing = (cycle - stance) / (1 - stance);
      const stride =
        (p.species === 'lizard' ? 0.32 : 0.58) * p.stride * p.legLength;
      const x =
        leg.foot.x +
        stride * (cycle < stance ? 0.5 - cycle / stance : -0.5 + swing);
      const y =
        leg.foot.y +
        (cycle < stance ? 0 : Math.sin(Math.PI * swing) * 0.22 * p.stride);
      const dx = x - leg.hip.x,
        dy = y - leg.hip.y - bob(i),
        d = clamp(
          Math.hypot(dx, dy),
          Math.abs(l1 - l2) + 0.001,
          l1 + l2 - 0.002,
        );
      const angle1 =
        Math.atan2(dy, dx) +
        preferred *
          Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
      const angle2 = Math.atan2(
        dy - l1 * Math.sin(angle1),
        dx - l1 * Math.cos(angle1),
      );
      const a = angle1 - rest1,
        b = angle2 - rest2 - a;
      upper.push(a);
      lower.push(b);
      foot.push(-a - b);
    }
    tracks.push(
      rotationTrack(leg.upperName, times, upper, [0, 0, 1]),
      rotationTrack(leg.lowerName, times, lower, [0, 0, 1]),
      rotationTrack(leg.footName, times, foot, [0, 0, 1]),
    );
  }

  if (rig.axial.length) {
    rig.axial.forEach((name, index) => {
      const angles = [];
      for (let i = 0; i < frames; i++) {
        const wave = (j) =>
          Math.sin(phaseAt(i) - j * (p.species === 'snake' ? 0.7 : 0.6)) *
          (p.species === 'snake' ? 0.42 : 0.08 + j * 0.055) *
          p.sway;
        angles.push(index === 0 ? wave(0) : wave(index) - wave(index - 1));
      }
      tracks.push(rotationTrack(name, times, angles, [0, 1, 0]));
    });
  }
  rig.tail.forEach((name, index) =>
    tracks.push(
      rotationTrack(
        name,
        times,
        times.map(
          (_, i) => Math.sin(phaseAt(i) - index * 0.65) * 0.065 * p.sway,
        ),
        [0, 1, 0],
      ),
    ),
  );
  if (rig.headName && rig.legs.length)
    tracks.push(
      rotationTrack(
        rig.headName,
        times,
        times.map((_, i) => Math.sin(phaseAt(i)) * 0.025 * p.sway),
        [0, 0, 1],
      ),
    );
  const name =
    p.species === 'snake' ? 'Slither' : p.species === 'fish' ? 'Swim' : 'Walk';
  const locomotion = new THREE.AnimationClip(name, duration, tracks);

  const idleTimes = Array.from({ length: 33 }, (_, i) => (i / 32) * 3.5),
    idlePositions = [];
  idleTimes.forEach((_, i) =>
    idlePositions.push(
      0,
      Math.sin((i / 32) * Math.PI * 2) * (p.species === 'fish' ? 0.04 : 0.009),
      0,
    ),
  );
  const idleTracks = [
    new THREE.VectorKeyframeTrack('Root.position', idleTimes, idlePositions),
  ];
  if (rig.headName)
    idleTracks.push(
      rotationTrack(
        rig.headName,
        idleTimes,
        idleTimes.map((_, i) => Math.sin((i / 32) * Math.PI * 2) * 0.025),
        [0, 1, 0],
      ),
    );
  return [new THREE.AnimationClip('Idle', 3.5, idleTracks), locomotion];
}
