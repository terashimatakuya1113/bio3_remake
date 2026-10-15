// 登場人物：エマ・所長ホルト・回収課のヴィクトル。台本（story.js）から立たせたり歩かせたりする
import * as THREE from 'three';
import { makeHumanoid, makeGun, zeroPose, dampPose, applyPose, POSE_KEYS } from './actors.js';
import { playerPose, WALK_SPEED } from './anim.js';
import { W, angleDiff, approach, collide, blobShadow } from './world.js';

export const NPC_COLORS = {
  emma: { build: 'slim', hairStyle: 'long', lashes: true, top: '#8a2e2e', sleeve: '#8a2e2e', collar: '#e8e0d0', pants: '#3a4a6a', boots: '#e0dcd0', skin: '#e0b090', hair: '#a8743a', lips: '#b06058', eye: '#3a5a6a' },
  holt: { beard: '#8a8a84', top: '#c8c4b4', sleeve: '#c8c4b4', collar: '#7a2a24', pants: '#4a4640', boots: '#2a1e16', skin: '#c89a78', hair: '#8a8a84', lips: '#8a5a48',
    extra: [[[-0.02, 0.2, 0.135], [0.02, 0.5, 0.15], '#7a2a24']] },
  victor: { top: '#1e2024', sleeve: '#1e2024', vest: '#2e3028', collar: '#0e1012', pants: '#22242a', boots: '#0e0e0e', skin: '#d0a888', hair: '#c8c0b0', lips: '#8a5a48', eye: '#4a6a8a',
    extra: [[[-0.18, 0.12, 0.1], [0.18, 0.42, 0.17], '#2e3028']] },
  danny: { top: '#3a4a66', sleeve: '#3a4a66', vest: '#23262a', collar: '#2a3448', pants: '#4a4a44', boots: '#1e1c1a', skin: '#b08060', hair: '#1a1410' },
};

// 決まった姿勢（座り込み・横たわり・ひざまずき・手を挙げる）
const POSES = {
  sit: { hipsY: -0.62, legLx: -1.45, legRx: -1.35, kneeL: 1.2, kneeR: 1.4, torsoRx: 0.15, headRx: 0.25, armLx: -0.4, armRx: -0.5, elbowL: -1.0, elbowR: -0.9 },
  hug: { hipsY: -0.62, legLx: -1.5, legRx: -1.5, kneeL: 2.3, kneeR: 2.3, torsoRx: 0.45, headRx: 0.5, armLx: -1.0, armRx: -1.0, elbowL: -1.4, elbowR: -1.4, armLz: -0.3, armRz: 0.3 },
  kneel: { hipsY: -0.42, legLx: -1.4, kneeL: 1.6, legRx: 0.3, kneeR: 1.9, torsoRx: 0.15, headRx: 0.1, armLx: -0.3, armRx: -0.3, elbowL: -0.4, elbowR: -0.4 },
  hands: { armLx: -0.3, armRx: -0.3, armLz: 2.4, armRz: -2.4, elbowL: -1.2, elbowR: -1.2, headRx: 0.1 },
  wounded: { hipsY: -0.62, legLx: -1.45, legRx: -1.2, kneeL: 1.1, kneeR: 0.4, torsoRx: -0.1, torsoRz: 0.15, headRx: 0.35, headRz: 0.3, armLx: -0.7, armLz: -0.4, elbowL: -1.6, armRx: 0.1, armRz: -0.2 },
  aim: {},
};

export function makeNpc(name, spec = {}) {
  const tilt = new THREE.Group(), root = new THREE.Group();
  const model = makeHumanoid(NPC_COLORS[name] || NPC_COLORS.emma);
  tilt.add(model.root); root.add(tilt);
  if (spec.scale) root.scale.setScalar(spec.scale);
  const shadow = blobShadow();
  W.scene.add(root, shadow);
  const n = {
    name, x: spec.x ?? 0, z: spec.z ?? 0, yaw: spec.yaw ?? 0, pose: spec.pose ?? 'stand', speed: 0, phase: 0, look: 0,
    to: null, talk: 0, aimW: 0, gun: null, model, root, tilt, shadow, cur: zeroPose(), target: zeroPose(), lying: false,
  };
  if (spec.gun) {
    const g = makeGun();
    g.position.set(0, -0.29, 0.03); g.rotation.x = Math.PI / 2;
    model.parts.elbowR.add(g);
    n.gun = g;
  }
  n.walkTo = (x, z, done) => { n.to = { x, z, done }; n.pose = 'stand'; };
  n.face = (x, z) => { n.faceTo = Math.atan2(x - n.x, z - n.z); };
  n.update = (dt) => updateNpc(n, dt);
  n.remove = () => { root.removeFromParent(); shadow.removeFromParent(); };
  return n;
}

function updateNpc(n, dt) {
  const o = n.target;
  const t = performance.now() / 1000 + n.name.length;
  n.tilt.rotation.set(0, 0, 0); n.tilt.position.set(0, 0, 0);
  if (n.to) {
    const dx = n.to.x - n.x, dz = n.to.z - n.z, d = Math.hypot(dx, dz);
    const a = angleDiff(Math.atan2(dx, dz), n.yaw);
    n.yaw += Math.max(-4 * dt, Math.min(4 * dt, a));
    n.speed = approach(n.speed, d > 0.2 ? (n.run ? 2.8 : WALK_SPEED) * (Math.abs(a) > 1 ? 0.3 : 1) : 0, 6 * dt);
    if (d < 0.15) { n.speed = 0; const done = n.to.done; n.to = null; done?.(); }
  } else {
    n.speed = approach(n.speed, 0, 8 * dt);
    if (n.faceTo != null) {
      const a = angleDiff(n.faceTo, n.yaw);
      n.yaw += Math.max(-3 * dt, Math.min(3 * dt, a));
      if (Math.abs(a) < 0.02) n.faceTo = null;
    }
  }
  n.x += Math.sin(n.yaw) * n.speed * dt;
  n.z += Math.cos(n.yaw) * n.speed * dt;
  if (n.speed > 0.01) collide(n, 0.25);
  n.phase += (n.speed * dt * Math.PI * 2) / 1.5;
  n.aimW = approach(n.aimW, n.pose === 'aim' ? 1 : 0, dt * 4);
  const fake = { speed: n.speed, phase: n.phase, turnW: 0, turnVel: 0, aimW: n.aimW, look: n.look, limpW: n.limp ? 1 : 0, quickW: 0, heldW: 0, deadW: 0, recoil: 0 };
  playerPose(fake, t, o);
  if (POSES[n.pose] && n.pose !== 'aim') {
    for (const k of POSE_KEYS) o[k] = 0;
    Object.assign(o, POSES[n.pose]);
    o.torsoRx += 0.02 * Math.sin(t * 1.9);
  }
  // 話している間は身ぶりをつける
  if (n.talk > 0) {
    n.talk -= dt;
    o.headRx += 0.06 * Math.sin(t * 6); o.headRy += 0.08 * Math.sin(t * 2.3);
    if (n.pose === 'stand') { o.armRx -= 0.35 + 0.15 * Math.sin(t * 3); o.elbowR -= 0.8; }
  }
  if (n.pose === 'lie') {
    n.tilt.rotation.x = -Math.PI / 2; n.tilt.position.y = 0.12;
    for (const k of POSE_KEYS) o[k] = 0;
    o.armLz = 0.5; o.armRz = -0.3; o.headRy = 0.5; o.kneeL = 0.4;
  }
  dampPose(n.cur, o, dt, 10);
  applyPose(n.model.parts, n.cur);
  n.root.position.set(n.x, 0, n.z);
  n.root.rotation.y = n.yaw;
  n.shadow.visible = n.root.visible && n.pose !== 'lie';
  n.shadow.position.x = n.x; n.shadow.position.z = n.z;
  if (n.gun) n.gun.visible = n.aimW > 0.3 || n.pose === 'aim';
}
