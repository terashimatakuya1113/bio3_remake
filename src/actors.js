// 箱を組み合わせたローポリ人型。肩・肘・股・膝に関節があり、角度だけで動かす
import * as THREE from 'three';
import { addBox, buildGeometry, newBuilder, ps1Material } from './ps1.js';

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

function part(boxes, mat) {
  const b = newBuilder();
  for (const [min, max, color] of boxes) addBox(b, min, max, 10, 10, hex(color), false);
  return new THREE.Mesh(buildGeometry(b), mat);
}

export const HIP_HEIGHT = 0.9;

export function makeHumanoid(c) {
  const mat = ps1Material();
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = HIP_HEIGHT;
  root.add(hips);
  hips.add(part([[[-0.18, -0.08, -0.11], [0.18, 0.04, 0.11], c.pants]], mat));

  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(part([
    [[-0.19, 0.0, -0.11], [0.19, 0.3, 0.11], c.top],
    [[-0.21, 0.3, -0.12], [0.21, 0.55, 0.12], c.top],
    [[-0.2, -0.04, -0.115], [0.2, 0.04, 0.115], c.belt],
    ...(c.extra || []),
  ], mat));

  const head = new THREE.Group();
  head.position.y = 0.58;
  torso.add(head);
  head.add(part([
    [[-0.05, -0.03, -0.05], [0.05, 0.06, 0.05], c.skin],
    [[-0.11, 0.05, -0.11], [0.11, 0.29, 0.11], c.skin],
    [[-0.12, 0.2, -0.13], [0.12, 0.32, 0.1], c.hair],
    [[-0.12, 0.08, -0.13], [0.12, 0.22, -0.06], c.hair],
    [[-0.07, 0.16, 0.105], [-0.03, 0.19, 0.115], '#1a1410'],
    [[0.03, 0.16, 0.105], [0.07, 0.19, 0.115], '#1a1410'],
  ], mat));

  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.27, 0.5, 0);
    torso.add(shoulder);
    shoulder.add(part([[[-0.06, -0.3, -0.06], [0.06, 0.04, 0.06], c.sleeve]], mat));
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);
    elbow.add(part([
      [[-0.05, -0.24, -0.05], [0.05, 0.01, 0.05], c.forearm || c.skin],
      [[-0.045, -0.32, -0.04], [0.045, -0.23, 0.05], c.skin],
    ], mat));
    return [shoulder, elbow];
  };
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0, 0);
    hips.add(hip);
    hip.add(part([[[-0.08, -0.44, -0.08], [0.08, 0.0, 0.08], c.pants]], mat));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(part([
      [[-0.07, -0.36, -0.07], [0.07, 0.01, 0.07], c.pants],
      [[-0.08, -0.46, -0.09], [0.08, -0.33, 0.08], c.boots],
      [[-0.075, -0.46, 0.08], [0.075, -0.38, 0.17], c.boots],
    ], mat));
    return [hip, knee];
  };

  const [armL, elbowL] = arm(1);
  const [armR, elbowR] = arm(-1);
  const [legL, kneeL] = leg(1);
  const [legR, kneeR] = leg(-1);
  const parts = { hips, torso, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR };
  return { root, parts, mat };
}

export function makeGun() {
  return part([
    [[-0.02, -0.02, 0.0], [0.02, 0.03, 0.2], '#222428'],
    [[-0.018, -0.12, 0.0], [0.018, 0.0, 0.05], '#2a2a2a'],
  ], ps1Material());
}

// ---- ポーズ：関節角の集合。毎フレーム目標ポーズを作り、なめらかに追従させる ----

export const POSE_KEYS = [
  'hipsX', 'hipsY', 'hipsRx', 'hipsRy', 'hipsRz',
  'torsoRx', 'torsoRy', 'torsoRz', 'headRx', 'headRy', 'headRz',
  'armLx', 'armLy', 'armLz', 'armRx', 'armRy', 'armRz', 'elbowL', 'elbowR',
  'legLx', 'legLz', 'legRx', 'legRz', 'kneeL', 'kneeR',
];

export function zeroPose() {
  const p = {};
  for (const k of POSE_KEYS) p[k] = 0;
  return p;
}

export function dampPose(cur, target, dt, rate) {
  const k = 1 - Math.exp(-rate * dt);
  for (const key of POSE_KEYS) cur[key] += (target[key] - cur[key]) * k;
}

export function applyPose(P, p) {
  P.hips.position.set(p.hipsX, HIP_HEIGHT + p.hipsY, 0);
  P.hips.rotation.set(p.hipsRx, p.hipsRy, p.hipsRz);
  P.torso.rotation.set(p.torsoRx, p.torsoRy, p.torsoRz);
  P.head.rotation.set(p.headRx, p.headRy, p.headRz);
  P.armL.rotation.set(p.armLx, p.armLy, p.armLz);
  P.armR.rotation.set(p.armRx, p.armRy, p.armRz);
  P.elbowL.rotation.set(p.elbowL, 0, 0);
  P.elbowR.rotation.set(p.elbowR, 0, 0);
  P.legL.rotation.set(p.legLx, 0, p.legLz);
  P.legR.rotation.set(p.legRx, 0, p.legRz);
  P.kneeL.rotation.set(p.kneeL, 0, 0);
  P.kneeR.rotation.set(p.kneeR, 0, 0);
}
