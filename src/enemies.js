// 敵：感染者（ゾンビ）・感染犬・追跡者「ポーター」・回収課の隊員
// どれも同じ形のオブジェクトを返す：x, z, yaw, hp, state、update(dt)、active()（撃てる相手か）、hit(dx, dz)
import * as THREE from 'three';
import { boxMesh, ps1Material } from './ps1.js';
import { makeHumanoid, makeGun, zeroPose, dampPose, applyPose, POSE_KEYS } from './actors.js';
import { playerPose, zombieWalkPose } from './anim.js';
import { makeDog, dogZero, dogPose, dampDog, applyDog } from './dog.js';
import { sfx } from './audio.js';
import { W, PLAYER_R, angleDiff, approach, collide, pushApart, blobShadow, lineBlocked } from './world.js';

export const COLORS = {
  staff: { top: '#6e7c8c', sleeve: '#6e7c8c', collar: '#4a5664', pants: '#2c2e36', boots: '#1e1c1a', skin: '#8a917a', skinTone: '#767c66', hair: '#3a2e22', torn: true },
  worker: { top: '#9a9480', sleeve: '#9a9480', pants: '#3e4654', boots: '#2a2622', skin: '#8e957c', skinTone: '#7a806a', hair: '#2a2a22', torn: true, forearmSleeve: false },
  driver: { top: '#3a4e3a', sleeve: '#3a4e3a', collar: '#2a3a2a', pants: '#3a3a40', boots: '#221e1a', skin: '#86907a', skinTone: '#6e7660', hair: '#4a3a28', torn: true },
  guard: { top: '#2e3440', sleeve: '#2e3440', collar: '#1e222a', pants: '#24282e', boots: '#141414', skin: '#8a9078', skinTone: '#727862', hair: '#1a1a1a', torn: true, forearmSleeve: true },
  frozen: { top: '#8aa0b0', sleeve: '#8aa0b0', collar: '#6a8090', pants: '#4a5664', boots: '#2a2e34', skin: '#a8b8c0', skinTone: '#8ea0aa', hair: '#d8e4ec', torn: true },
  porter: { top: '#5a6258', sleeve: '#5a6258', collar: '#3a4038', pants: '#4a5048', boots: '#1a1a18', skin: '#b8b0a4', skinTone: '#a09080', hair: '#7a6a60', torn: true, forearmSleeve: false,
    extra: [[[-0.2, 0.12, -0.24], [0.2, 0.55, -0.12], '#3a3e3a'], [[-0.13, 0.5, -0.22], [0.13, 0.6, -0.14], '#8a1a10'], [[-0.21, 0.28, 0.1], [0.21, 0.33, 0.17], '#2a2a2a'], [[-0.21, 0.42, 0.1], [0.21, 0.47, 0.17], '#2a2a2a']] },
  soldier: { top: '#26282c', sleeve: '#26282c', vest: '#3a3c34', collar: '#1a1c20', pants: '#2a2c30', boots: '#121212', skin: '#c49a7a', hair: '#141414', lips: '#8a5a48',
    extra: [[[-0.18, 0.12, 0.1], [0.18, 0.42, 0.17], '#3a3c34'], [[-0.16, 0.25, -0.2], [0.16, 0.5, -0.11], '#2e3028']] },
};

// ---------------------------------------------------------------- 感染者
const LYING = { ...zeroPose(), armLz: 0.5, armRz: -0.9, headRy: 0.6, kneeL: 0.3, legLx: -0.2 };
const DEAD = { ...zeroPose(), armLz: 0.7, armRz: -0.5, headRy: -0.5, kneeR: 0.5, legRx: -0.3 };

function humanoidBody(colors, scale = 1) {
  const tilt = new THREE.Group(), root = new THREE.Group(), model = makeHumanoid(colors);
  tilt.add(model.root); root.add(tilt);
  root.scale.setScalar(scale);
  const shadow = blobShadow(0.7 * scale);
  W.scene.add(root, shadow);
  return { model, tilt, root, shadow, pose: zeroPose(), target: zeroPose() };
}

export function makeZombie(spec) {
  const z = {
    kind: 'zombie', id: spec.id, x: spec.x, z: spec.z, y: 0, yaw: spec.yaw ?? 0, hp: spec.hp ?? 4, state: spec.state ?? 'walk',
    t: 0, phase: Math.random() * 6, groan: 2 + Math.random() * 3, stagger: 0, headJerk: 0, bit: false,
    speed: spec.speed ?? 1, wake: spec.wake ?? 4.5, climb: spec.climb, onDeath: spec.onDeath, radius: 0.3,
    ...humanoidBody(COLORS[spec.colors] || spec.colors || COLORS.worker),
  };
  z.active = () => z.state === 'walk' || z.state === 'grab' || z.state === 'stagger';
  z.hit = (dx, dz, dmg = 1) => {
    W.fxs.bloodSpray(new THREE.Vector3(z.x - dx * 0.1, 1.3, z.z - dz * 0.1), dx, dz);
    z.headJerk = Math.min(1.6, dmg);
    z.hp -= dmg;
    if (z.hp <= 0) { z.state = 'dying'; z.t = 0; }
    else { z.state = 'stagger'; z.stagger = 0.45 + 0.15 * Math.min(3, dmg); const k = 0.18 * Math.min(3, Math.max(0.5, dmg)); z.x += dx * k; z.z += dz * k; collide(z, 0.3); }
  };
  z.update = (dt) => updateZombie(z, dt);
  z.examine = () => z.state === 'dormant' || z.state === 'dead';
  return z;
}

function updateZombie(z, dt) {
  const player = W.player;
  const { tilt: zTilt, target: zTarget, pose: zPose } = z;
  const t = performance.now() / 1000;
  z.t += dt;
  zTilt.position.set(0, 0, 0);
  zTilt.rotation.set(0, 0, 0);
  let rate = 10;
  z.y = 0;
  if (z.state === 'hidden') {
    Object.assign(zPose, zeroPose());
  } else if (z.state === 'climb') {
    // 窓枠を乗り越えて、床へずり落ちる
    const c = z.climb;
    const k = Math.min(1, z.t / 2.2);
    z.x = c.x; z.z = c.z0 + (c.z1 - c.z0) * k;
    z.y = c.y * (1 - THREE.MathUtils.smoothstep(k, 0.45, 1));
    zTilt.rotation.x = 1.0 * Math.sin(Math.PI * Math.min(1, k * 1.1));
    for (const key of POSE_KEYS) zTarget[key] = 0;
    zTarget.armLx = -1.6; zTarget.armRx = -1.3; zTarget.elbowL = -0.3;
    zTarget.legLx = -1.2 * (1 - k); zTarget.legRx = -0.4 * (1 - k); zTarget.kneeL = 1.4 * (1 - k); zTarget.kneeR = 1.0 * (1 - k);
    zTarget.headRx = 0.4; zTarget.headRz = 0.3;
    rate = 8;
    if (k >= 1) { z.state = 'walk'; z.t = 0; }
  } else if (z.state === 'dormant' || z.state === 'feign') {
    zTilt.rotation.x = -Math.PI / 2;
    zTilt.position.y = 0.12;
    Object.assign(zTarget, LYING);
    Object.assign(zPose, LYING);
    // 死んだふり：近づくと起き上がる
    if (z.state === 'feign' && Math.hypot(player.x - z.x, player.z - z.z) < 2.0 && W.state === 'play') { z.state = 'rising'; z.t = 0; sfx.groan(); }
  } else if (z.state === 'idle') {
    // 立ち尽くして揺れている。近づくとこちらに気づく
    zombieWalkPose({ phase: 0 }, t, zTarget);
    zTarget.armLx = -0.2; zTarget.armRx = -0.1; zTarget.headRx = 0.6; zTarget.headRz = 0.3 + 0.1 * Math.sin(t * 0.7);
    zTarget.torsoRx = 0.3;
    if (Math.hypot(player.x - z.x, player.z - z.z) < z.wake && W.state === 'play') { z.state = 'walk'; z.t = 0; sfx.groan(); }
  } else if (z.state === 'eating') {
    // しゃがみ込んで何かを食べている
    for (const key of POSE_KEYS) zTarget[key] = 0;
    zTarget.hipsY = -0.45; zTarget.kneeL = 1.9; zTarget.kneeR = 1.7; zTarget.legLx = -1.2; zTarget.legRx = -0.9;
    zTarget.torsoRx = 0.7; zTarget.headRx = 0.5 + 0.15 * Math.sin(t * 7); zTarget.armLx = -0.9; zTarget.armRx = -1.1; zTarget.elbowL = -0.9; zTarget.elbowR = -1.0;
    if (Math.hypot(player.x - z.x, player.z - z.z) < z.wake && W.state === 'play') { z.state = 'rising'; z.t = 1.2; sfx.groan(); }
  } else if (z.state === 'rising') {
    // 上体を起こす → 膝をついて → 立ち上がる
    const k = Math.min(1, z.t / 2.6);
    const e = k * k * (3 - 2 * k);
    zTilt.rotation.x = -Math.PI / 2 * (1 - e);
    zTilt.position.y = 0.12 * (1 - e);
    for (const key of POSE_KEYS) zTarget[key] = 0;
    const crouch = Math.sin(Math.PI * e);
    zTarget.kneeL = 1.3 * crouch; zTarget.kneeR = 0.9 * crouch;
    zTarget.legLx = -0.9 * crouch; zTarget.legRx = -0.4 * crouch;
    zTarget.hipsY = -0.25 * crouch;
    zTarget.torsoRx = 0.5 * crouch;
    zTarget.armLx = -1.3 * e; zTarget.armRx = -1.1 * e; zTarget.elbowL = -0.4; zTarget.elbowR = -0.6;
    zTarget.headRz = 0.4 * e; zTarget.headRx = 0.5 * (1 - e) + 0.2;
    rate = 6;
    if (k >= 1) { z.state = 'walk'; z.t = 0; }
  } else if (z.state === 'walk') {
    const dx = player.x - z.x, dz = player.z - z.z;
    const want = Math.atan2(dx, dz);
    const d = angleDiff(want, z.yaw);
    z.yaw += Math.max(-1.3 * dt, Math.min(1.3 * dt, d));
    // 引きずる足に合わせて速さが波打つ
    z.phase += dt * 3.0 * z.speed;
    const sp = (0.32 + 0.3 * Math.max(0, Math.cos(z.phase))) * z.speed;
    z.x += Math.sin(z.yaw) * sp * dt;
    z.z += Math.cos(z.yaw) * sp * dt;
    for (const o of W.enemies) if (o !== z && o.active()) pushApart(z, o, 0.5);
    collide(z, 0.3);
    zombieWalkPose(z, t, zTarget);
    z.groan -= dt;
    if (z.groan <= 0) { sfx.groan(); z.groan = 3 + Math.random() * 3; }
    const dist = Math.hypot(dx, dz);
    if (dist < 0.75 && Math.abs(d) < 0.7 && player.hurt <= 0 && player.held <= 0 && W.state === 'play') {
      z.state = 'grab'; z.t = 0;
      player.held = 1.1;
      player.yaw = Math.atan2(-dx, -dz);
      player.aiming = false;
      player.quick = 0; player.quickW = 0;
    }
  } else if (z.state === 'grab') {
    zombieWalkPose(z, t, zTarget);
    zTarget.armLx = -1.5; zTarget.armRx = -1.45; zTarget.elbowL = -0.7; zTarget.elbowR = -0.8;
    zTarget.torsoRx = 0.3; zTarget.headRx = 0.5 + Math.sin(z.t * 20) * 0.1; zTarget.headRz = 0.1;
    zTarget.legLx = -0.15; zTarget.legRx = 0.2; zTarget.kneeL = 0.25;
    if (z.t > 0.45 && !z.bit) {
      z.bit = true;
      sfx.bite();
      player.health -= 20;
      W.hurtFx();
    }
    if (z.t > 1.1) {
      z.bit = false;
      z.state = 'walk'; z.t = 0;
      player.held = 0;
      player.hurt = 1.4;
      const dx = player.x - z.x, dz = player.z - z.z, d = Math.hypot(dx, dz) || 1;
      player.x += (dx / d) * 0.7; player.z += (dz / d) * 0.7;
      collide(player, PLAYER_R);
      if (player.health <= 0) W.die();
    }
  } else if (z.state === 'stagger') {
    z.stagger -= dt;
    zombieWalkPose(z, t, zTarget);
    zTarget.torsoRx = -0.35; zTarget.headRx = -0.45;
    zTarget.armLx = -0.8; zTarget.armRx = -0.6;
    zTarget.kneeL = 0.35; zTarget.legRx = 0.25;
    rate = 18;
    if (z.stagger <= 0) { z.state = 'walk'; z.t = 0; }
  } else if (z.state === 'dying') {
    const k = Math.min(1, z.t / 0.9);
    // 膝から崩れてから仰向けに倒れる
    const kneel = Math.min(1, k * 2);
    zTilt.rotation.x = -Math.PI / 2 * Math.max(0, (k - 0.35) / 0.65) ** 2;
    zTilt.position.y = 0.12 * k;
    for (const key of POSE_KEYS) zTarget[key] = DEAD[key] * k;
    zTarget.kneeL += 1.1 * kneel * (1 - k); zTarget.kneeR += 0.9 * kneel * (1 - k);
    zTarget.hipsY = -0.3 * kneel * (1 - k);
    rate = 14;
    if (k >= 1) {
      z.state = 'dead';
      W.fxs.startPool(z.x - Math.sin(z.yaw) * 0.8, z.z - Math.cos(z.yaw) * 0.8);
      z.onDeath?.(z);
    }
  } else if (z.state === 'dead') {
    zTilt.rotation.x = -Math.PI / 2;
    zTilt.position.y = 0.12;
    Object.assign(zTarget, DEAD);
  }
  dampPose(zPose, zTarget, dt, rate);
  if (z.headJerk > 0) {
    // 被弾で頭と上体がのけぞる（目標ポーズには入れず、一瞬だけずらして戻す）
    zPose.headRx -= z.headJerk * 0.9; zPose.torsoRx -= z.headJerk * 0.3; zPose.headRz += z.headJerk * 0.3;
    z.headJerk = 0;
  }
  applyPose(z.model.parts, zPose);
  z.root.visible = z.state !== 'hidden';
  z.root.position.set(z.x, z.y, z.z);
  z.root.rotation.y = z.yaw;
  const lying = z.state === 'dormant' || z.state === 'feign' || z.state === 'dead';
  z.shadow.visible = z.root.visible && !lying && z.state !== 'climb';
  z.shadow.position.x = z.x; z.shadow.position.z = z.z;
}

// ---------------------------------------------------------------- 感染犬
export function makeDogEnemy(spec) {
  const model = makeDog();
  const shadow = blobShadow();
  W.scene.add(model.root, shadow);
  const d = {
    kind: 'dog', id: spec.id, x: spec.x, y: spec.y ?? 0, z: spec.z, yaw: spec.yaw ?? 0, state: spec.state ?? 'run', t: 0, hp: spec.hp ?? 3,
    phase: 0, speed: 0, bit: false, growl: 1, attackT: 0, wanderT: 0, wx: spec.x, wz: spec.z, lungeV: 0, win: spec.win, onCrash: spec.onCrash, onDeath: spec.onDeath, low: true, radius: 0.3,
    model, shadow, poseCur: dogZero(), poseTarget: dogZero(),
  };
  d.root = model.root;
  d.active = () => ['land', 'roam', 'run', 'stalk', 'lunge', 'bite', 'recover', 'stagger'].includes(d.state);
  d.hit = (dx, dz, dmg = 1) => {
    W.fxs.bloodSpray(new THREE.Vector3(d.x - dx * 0.1, 0.55, d.z - dz * 0.1), dx, dz);
    sfx.yelp();
    d.hp -= dmg;
    if (d.hp <= 0) { d.state = 'dying'; d.t = 0; }
    else { d.state = 'stagger'; d.t = 0; d.x += dx * 0.3; d.z += dz * 0.3; collide(d, 0.3); }
  };
  d.update = (dt) => updateDog(d, dt);
  d.examine = () => false;
  return d;
}

function updateDog(d, dt) {
  const player = W.player;
  const t = performance.now() / 1000;
  d.t += dt;
  let kind = 'growl', rate = 12;
  const dx = player.x - d.x, dz = player.z - d.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  const turn = (r) => { const a = angleDiff(want, d.yaw); d.yaw += Math.max(-r * dt, Math.min(r * dt, a)); return a; };

  if (d.state === 'hidden') {
    d.y = d.win ? d.win.y : 0;
  } else if (d.state === 'crash') {
    // 窓を突き破って、弧を描いて床に降りる
    const WIN = d.win;
    if (d.t < 0) { d.y = WIN.y; }
    else {
      if (!d.broke) { d.broke = true; sfx.glass(); sfx.bark(); d.onCrash?.(d); }
      const k = Math.min(1, d.t / 0.6);
      d.x = WIN.x - 0.1 * k; d.z = WIN.z + 1.9 * k;
      d.y = WIN.y * (1 - k) + 0.55 * Math.sin(Math.PI * k);
      d.yaw = 0;
      kind = k < 0.8 ? 'lunge' : 'growl';
      rate = 16;
      if (k >= 1) { d.state = 'land'; d.t = 0; d.y = 0; sfx.growl(); }
    }
  } else if (d.state === 'sleep') {
    kind = 'dead';
    if (dist < 3.5 && W.state === 'play') { d.state = 'land'; d.t = 0; sfx.growl(); }
  } else if (d.state === 'land') {
    turn(2.5);
    if (d.t > 1.1) toRoam(d, 2);
  } else if (d.state === 'roam' || d.state === 'run') {
    // 部屋の中をうろつく。間合いを取りつつ、ときどき身構えて飛びかかる
    if (d.state === 'run') { d.state = 'roam'; d.attackT = 1; pickWander(d); }
    d.attackT -= dt; d.wanderT -= dt;
    const wx = d.wx - d.x, wz = d.wz - d.z;
    if (d.wanderT <= 0 || Math.hypot(wx, wz) < 0.4) pickWander(d);
    const a = angleDiff(Math.atan2(wx, wz), d.yaw);
    d.yaw += Math.max(-2.6 * dt, Math.min(2.6 * dt, a));
    d.speed = approach(d.speed, Math.abs(a) > 1.0 ? 0.6 : 1.5, 4 * dt);
    d.x += Math.sin(d.yaw) * d.speed * dt;
    d.z += Math.cos(d.yaw) * d.speed * dt;
    d.phase += d.speed * dt * 5;
    kind = d.speed > 0.3 ? 'run' : 'growl'; rate = 14;
    d.growl -= dt;
    if (d.growl <= 0) { sfx.growl(); d.growl = 3 + Math.random() * 3; }
    if (d.attackT <= 0 && W.state === 'play') {
      if (dist < 5) { d.state = 'stalk'; d.t = 0; sfx.growl(); }
      else { d.attackT = 1; pickWander(d, true); }
    }
  } else if (d.state === 'stalk') {
    // 飛びかかる前のため：こちらを向いて低く身構える
    turn(5);
    d.speed = 0;
    if (d.t > 0.9) {
      if (dist < 4.3 && W.state === 'play') {
        d.state = 'lunge'; d.t = 0; d.bit = false; sfx.bark();
        d.lungeV = Math.min(3.8, Math.max(1.2, dist - 0.2)) / 0.55;
      } else { d.state = 'roam'; d.attackT = 1.5; pickWander(d, true); }
    }
  } else if (d.state === 'lunge') {
    const k = Math.min(1, d.t / 0.55);
    d.x += Math.sin(d.yaw) * d.lungeV * dt;
    d.z += Math.cos(d.yaw) * d.lungeV * dt;
    d.y = 0.38 * Math.sin(Math.PI * k);
    kind = 'lunge'; rate = 20;
    if (!d.bit && dist < 0.75 && player.hurt <= 0 && player.held <= 0 && W.state === 'play') {
      d.bit = true; d.state = 'bite'; d.t = 0; d.y = 0;
      sfx.bite();
      player.health -= 18;
      player.held = 0.7;
      player.yaw = Math.atan2(-dx, -dz);
      player.aiming = false; player.quick = 0; player.quickW = 0;
      W.hurtFx();
    } else if (k >= 1) { d.state = 'recover'; d.t = 0; d.y = 0; }
  } else if (d.state === 'bite') {
    // 喉元に食らいついて振り回す
    d.x = player.x - Math.sin(d.yaw) * 0.55; d.z = player.z - Math.cos(d.yaw) * 0.55;
    kind = 'bite'; rate = 20;
    if (d.t > 0.7) {
      d.state = 'recover'; d.t = 0;
      player.held = 0; player.hurt = 1.2;
      if (player.health <= 0) W.die();
    }
  } else if (d.state === 'recover') {
    turn(3);
    d.x -= Math.sin(d.yaw) * 0.9 * dt; d.z -= Math.cos(d.yaw) * 0.9 * dt;
    d.speed = 0;
    if (d.t > 0.8) toRoam(d, 3);
  } else if (d.state === 'stagger') {
    kind = 'hit'; rate = 22;
    if (d.t > 0.45) { d.speed = 0; toRoam(d, 2.5); }
  } else if (d.state === 'dying') {
    kind = d.t < 0.25 ? 'hit' : 'dead'; rate = d.t < 0.25 ? 20 : 9;
    d.y = 0;
    if (d.t > 1.2) { d.state = 'dead'; d.onDeath?.(d); }
  } else if (d.state === 'dead') {
    kind = 'dead';
  }
  if (d.state !== 'crash' && d.state !== 'hidden') {
    if (d.state !== 'bite') for (const z of W.enemies) if (z !== d && z.active()) pushApart(d, z, 0.5);
    collide(d, 0.3);
  }
  dogPose(kind, d.phase, t, d.poseTarget);
  if (d.state === 'hidden' || d.state === 'dead' || d.state === 'sleep') Object.assign(d.poseCur, d.poseTarget);
  dampDog(d.poseCur, d.poseTarget, dt, rate);
  applyDog(d.model, d.poseCur);
  d.model.root.visible = d.state !== 'hidden' && !(d.state === 'crash' && d.t < 0);
  d.model.root.position.set(d.x, d.y, d.z);
  d.model.root.rotation.y = d.yaw;
  d.shadow.visible = d.model.root.visible && d.state !== 'dead' && d.state !== 'sleep' && (!d.win || d.z > d.win.z + 0.4);
  d.shadow.position.x = d.x; d.shadow.position.z = d.z;
  d.shadow.scale.setScalar(1 - Math.min(0.6, d.y));
}

function toRoam(d, wait) {
  d.state = 'roam'; d.t = 0;
  d.attackT = wait + Math.random() * 2.5;
  pickWander(d);
}

// うろつく先：部屋の中で、主人公から 2〜5m 離れた場所を選ぶ（near なら少し寄る）
function pickWander(d, near = false) {
  const { x0, x1, z0, z1 } = W.room.bounds;
  const player = W.player;
  for (let i = 0; i < 12; i++) {
    const x = x0 + 0.8 + Math.random() * (x1 - x0 - 1.6), z = z0 + 0.8 + Math.random() * (z1 - z0 - 1.6);
    const pd = Math.hypot(x - player.x, z - player.z);
    if (pd > 2.2 && pd < (near ? 3.8 : 5.5) && Math.hypot(x - d.x, z - d.z) > 1) { d.wx = x; d.wz = z; break; }
  }
  d.wanderT = 2 + Math.random() * 2;
}

// ---------------------------------------------------------------- 追跡者「ポーター」
// 冷却スーツと拘束具を着せられたまま運ばれてきた大男。重い足取りで迫り、ときどき突進して殴りつける
const PORTER_SCALE = 1.42;

export function makePorter(spec) {
  const body = humanoidBody(COLORS.porter, PORTER_SCALE);
  // 拘束具の名残：右手首にちぎれた鎖
  const chain = boxMesh([-0.015, -0.4, -0.015], [0.015, 0, 0.015], ps1Material({ tint: 0x6a6a6a, emissive: 0.1 }), 1, 1);
  chain.position.set(0, -0.26, 0); chain.rotation.z = 0.3;
  body.model.parts.elbowR.add(chain);
  const p = {
    kind: 'porter', id: spec.id, x: spec.x, z: spec.z, y: 0, yaw: spec.yaw ?? 0, hp: spec.hp ?? 12, maxHp: spec.hp ?? 12,
    state: spec.state ?? 'walk', t: 0, phase: 0, speed: 0, cd: 2, hits: 0, struck: false, headJerk: 0, radius: 0.45, big: true,
    final: !!spec.final, downTime: spec.downTime ?? 7, onDown: spec.onDown, onDeath: spec.onDeath, onRise: spec.onRise, onLeave: spec.onLeave,
    dropFrom: spec.dropFrom ?? 4, roarT: 0, stepT: 0, leaveTo: spec.leaveTo,
    ...body,
  };
  p.active = () => ['walk', 'charge', 'punch', 'stagger', 'roar', 'turn'].includes(p.state);
  p.hit = (dx, dz, dmg = 1) => {
    W.fxs.bloodSpray(new THREE.Vector3(p.x - dx * 0.15, 1.9, p.z - dz * 0.15), dx, dz);
    p.headJerk = 0.6;
    p.hp -= dmg; p.hits += dmg >= 3 ? 4 : 1;
    if (p.hp <= 0) {
      p.state = p.final ? 'dying' : 'down'; p.t = 0;
      sfx.porterRoar(0.6);
    } else if (p.hits % 4 === 0 && p.state !== 'punch') {
      p.state = 'stagger'; p.t = 0; p.x += dx * 0.12; p.z += dz * 0.12; collide(p, p.radius);
    }
  };
  p.update = (dt) => updatePorter(p, dt);
  p.examine = () => false;
  return p;
}

function updatePorter(p, dt) {
  const player = W.player;
  const o = p.target;
  const t = performance.now() / 1000;
  p.t += dt;
  p.tilt.position.set(0, 0, 0);
  p.tilt.rotation.set(0, 0, 0);
  let rate = 9;
  p.y = 0;
  const dx = player.x - p.x, dz = player.z - p.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  const turn = (r) => { const a = angleDiff(want, p.yaw); p.yaw += Math.max(-r * dt, Math.min(r * dt, a)); return a; };
  const stride = (sp) => {
    const fake = { speed: sp, phase: p.phase, turnW: 0, turnVel: 0, aimW: 0, look: 0, limpW: 0, quickW: 0, heldW: 0, deadW: 0, recoil: 0 };
    playerPose(fake, t, o);
    // 重さを出すため、肩を落として前かがみに
    o.torsoRx += 0.22; o.headRx += 0.1; o.armLz += 0.15; o.armRz -= 0.15; o.elbowL -= 0.2; o.elbowR -= 0.2;
    o.hipsY -= 0.03;
  };
  const step = (sp) => {
    p.x += Math.sin(p.yaw) * sp * dt; p.z += Math.cos(p.yaw) * sp * dt;
    const prev = p.phase;
    p.phase += sp * dt * Math.PI * 2 / 1.6;
    if (Math.floor(prev / Math.PI) !== Math.floor(p.phase / Math.PI)) sfx.heavyStep();
  };
  const roarPose = () => {
    for (const k of POSE_KEYS) o[k] = 0;
    o.torsoRx = -0.25; o.headRx = -0.6; o.armLz = 0.9; o.armRz = -0.9; o.armLx = -0.4; o.armRx = -0.4; o.elbowL = -0.9; o.elbowR = -0.9;
    o.legLx = -0.2; o.legRx = 0.2; o.kneeL = 0.2; o.kneeR = 0.2; o.hipsY = -0.05;
  };

  if (p.state === 'hidden') {
    for (const k of POSE_KEYS) o[k] = 0;
  } else if (p.state === 'drop') {
    // 高い棚の上から飛び降りてくる
    const k = Math.min(1, p.t / 0.55);
    p.y = p.dropFrom * (1 - k * k);
    for (const key of POSE_KEYS) o[key] = 0;
    o.kneeL = 0.6; o.kneeR = 0.6; o.legLx = -0.5; o.legRx = -0.3; o.armLz = 0.6; o.armRz = -0.6;
    rate = 14;
    if (k >= 1) { p.state = 'land'; p.t = 0; sfx.heavyLand(); W.shake?.(0.5); }
  } else if (p.state === 'land') {
    for (const key of POSE_KEYS) o[key] = 0;
    const k = Math.min(1, p.t / 0.8);
    const c = 1 - k;
    o.hipsY = -0.45 * c; o.kneeL = 1.8 * c; o.kneeR = 1.6 * c; o.legLx = -1.1 * c; o.legRx = -0.7 * c; o.torsoRx = 0.6 * c;
    o.armRx = -0.3 * c; o.armRz = -0.4 * c; o.elbowR = -0.2;
    rate = 12;
    if (k >= 1) { p.state = 'roar'; p.t = 0; }
  } else if (p.state === 'enter') {
    // 扉から入ってくる：数歩まっすぐ歩いてから吠える
    stride(1.0); step(1.0);
    if (p.t > 1.3) { p.state = 'roar'; p.t = 0; }
  } else if (p.state === 'roar') {
    turn(1.5);
    roarPose();
    if (p.t < 0.05 && !p.roared) { p.roared = true; sfx.porterRoar(1); }
    if (p.t > 1.6) { p.state = 'walk'; p.t = 0; p.roared = false; p.cd = 1.5; }
  } else if (p.state === 'goto') {
    // 台本で決めた場所まで大股で歩き、着いたら立ち止まる
    const g = p.dest;
    const a = angleDiff(Math.atan2(g[0] - p.x, g[1] - p.z), p.yaw);
    p.yaw += Math.max(-2.6 * dt, Math.min(2.6 * dt, a));
    step(1.7); stride(1.7);
    if (Math.hypot(g[0] - p.x, g[1] - p.z) < 0.35 || p.t > 6) { p.state = 'idleScript'; p.t = 0; const f = p.onArrive; p.onArrive = null; f?.(p); }
  } else if (p.state === 'idleScript') {
    // 台本で動かすときの立ち姿
    stride(0);
    turn(1.2);
  } else if (p.state === 'walk') {
    const a = turn(1.7);
    p.cd -= dt;
    p.speed = approach(p.speed, Math.abs(a) > 1.0 ? 0.4 : 1.05, 3 * dt);
    step(p.speed);
    stride(p.speed);
    if (dist < 1.35 && Math.abs(a) < 0.5) { p.state = 'punch'; p.t = 0; p.struck = false; }
    else if (dist > 3.2 && dist < 8 && p.cd <= 0 && Math.abs(a) < 0.3 && W.state === 'play') {
      p.state = 'charge'; p.t = 0; sfx.porterRoar(0.5);
    }
  } else if (p.state === 'charge') {
    // 前のめりの突進。曲がるのは苦手
    const a = turn(0.8);
    p.speed = approach(p.speed, 3.4, 8 * dt);
    step(p.speed);
    stride(Math.min(3.1, p.speed));
    o.torsoRx += 0.2;
    if (dist < 1.4 && Math.abs(a) < 0.7) { p.state = 'punch'; p.t = 0.2; p.struck = false; }
    else if (p.t > 1.6 || Math.abs(a) > 1.2) { p.state = 'walk'; p.t = 0; p.cd = 3 + Math.random() * 2; }
    collide(p, p.radius);
  } else if (p.state === 'punch') {
    // 右腕を振りかぶって、横殴りに叩きつける
    turn(p.t < 0.45 ? 2.2 : 0);
    p.speed = approach(p.speed, 0, 6 * dt);
    step(p.speed);
    stride(0);
    const wind = Math.min(1, p.t / 0.5), swing = THREE.MathUtils.smoothstep(p.t, 0.5, 0.68);
    o.armRx = -0.6 * wind + 1.2 * swing - 1.3 * swing; o.armRz = -1.2 * wind + 0.9 * swing; o.armRy = 0.6 * wind - 1.2 * swing;
    o.elbowR = -1.3 * wind + 1.0 * swing; o.torsoRy = 0.5 * wind - 0.9 * swing; o.torsoRx += 0.1;
    rate = 18;
    if (!p.struck && p.t > 0.58) {
      p.struck = true;
      sfx.swing();
      const a = Math.abs(angleDiff(want, p.yaw));
      if (dist < 1.7 && a < 0.9 && player.hurt <= 0 && W.state === 'play') {
        sfx.punch();
        player.health -= 32;
        player.hurt = 1.6;
        player.aiming = false; player.quick = 0; player.quickW = 0;
        player.knock = { x: Math.sin(p.yaw) * 4.5, z: Math.cos(p.yaw) * 4.5, t: 0.35 };
        W.hurtFx();
        W.shake?.(0.35);
        if (player.health <= 0) W.die();
      }
    }
    if (p.t > 1.25) { p.state = 'walk'; p.t = 0; p.cd = 1.5 + Math.random(); }
  } else if (p.state === 'stagger') {
    stride(0);
    o.torsoRx = -0.3; o.headRx = -0.5; o.armLx = -0.5; o.armRx = -0.4; o.kneeL = 0.3;
    rate = 14;
    if (p.t > 0.6) { p.state = 'walk'; p.t = 0; }
  } else if (p.state === 'down') {
    // 片膝をつき、しばらく動かない
    for (const k of POSE_KEYS) o[k] = 0;
    o.hipsY = -0.42; o.kneeL = 1.6; o.legLx = -1.4; o.kneeR = 1.9; o.legRx = 0.35;
    o.torsoRx = 0.65; o.headRx = 0.5; o.armLx = -0.4; o.armRx = 0.2; o.elbowL = -0.6; o.armRz = -0.2;
    o.torsoRx += 0.04 * Math.sin(t * 2.2);
    rate = 6;
    if (p.t > 0.8 && !p.downed) { p.downed = true; p.onDown?.(p); }
    if (p.t > p.downTime) {
      p.downed = false;
      if (p.leaveTo) { p.state = 'leave'; p.t = 0; }
      else { p.hp = Math.ceil(p.maxHp * 0.6); p.state = 'roar'; p.t = 0; p.onRise?.(p); }
    }
  } else if (p.state === 'leave') {
    // 立ち去る：出口へ向かって歩き、見えなくなる
    const ld = p.leaveTo;
    const a = angleDiff(Math.atan2(ld[0] - p.x, ld[1] - p.z), p.yaw);
    p.yaw += Math.max(-2 * dt, Math.min(2 * dt, a));
    step(1.4); stride(1.4);
    if (Math.hypot(ld[0] - p.x, ld[1] - p.z) < 0.6 || p.t > 8) { p.state = 'gone'; p.onLeave?.(p); }
  } else if (p.state === 'dying') {
    // 前のめりに倒れる
    const k = Math.min(1, p.t / 1.4);
    for (const key of POSE_KEYS) o[key] = 0;
    const kneel = Math.min(1, k * 2.2);
    o.hipsY = -0.42 * kneel; o.kneeL = 1.6 * kneel; o.kneeR = 1.7 * kneel; o.legLx = -0.4 * kneel; o.legRx = -0.3 * kneel;
    p.tilt.rotation.x = Math.PI / 2 * Math.max(0, (k - 0.45) / 0.55) ** 2;
    p.tilt.position.y = 0.05 * k;
    o.armLx = -1.2 * k; o.armRx = -1.4 * k; o.headRx = 0.4;
    rate = 10;
    if (k >= 1) { p.state = 'dead'; sfx.heavyLand(); W.fxs.startPool(p.x + Math.sin(p.yaw) * 1.2, p.z + Math.cos(p.yaw) * 1.2); p.onDeath?.(p); }
  } else if (p.state === 'dead') {
    for (const key of POSE_KEYS) o[key] = 0;
    p.tilt.rotation.x = Math.PI / 2; p.tilt.position.y = 0.05;
    o.armLx = -1.2; o.armRx = -1.4; o.headRx = 0.4;
  } else if (p.state === 'crushed') {
    for (const key of POSE_KEYS) o[key] = 0;
    p.tilt.rotation.x = Math.PI / 2; p.tilt.position.y = 0.05;
    o.armLx = -2.6; o.armRx = -2.2; o.armLz = 0.4; o.headRx = -0.3;
  }
  if (['walk', 'charge', 'punch', 'stagger', 'leave', 'goto'].includes(p.state)) {
    for (const e of W.enemies) if (e !== p && e.active()) pushApart(e, p, 0.7);
    collide(p, p.radius);
    // プレイヤーを押しのける
    const pd = Math.hypot(player.x - p.x, player.z - p.z);
    if (pd < 0.7 && pd > 1e-4) { player.x = p.x + (player.x - p.x) / pd * 0.7; player.z = p.z + (player.z - p.z) / pd * 0.7; collide(player, PLAYER_R); }
  }
  dampPose(p.pose, o, dt, rate);
  if (p.headJerk > 0) { p.pose.headRx -= p.headJerk * 0.6; p.pose.torsoRx -= p.headJerk * 0.15; p.headJerk = 0; }
  applyPose(p.model.parts, p.pose);
  p.root.visible = p.state !== 'hidden' && p.state !== 'gone';
  p.root.position.set(p.x, p.y, p.z);
  p.root.rotation.y = p.yaw;
  p.shadow.visible = p.root.visible && p.state !== 'dead' && p.state !== 'crushed';
  p.shadow.position.x = p.x; p.shadow.position.z = p.z;
  p.shadow.scale.setScalar(Math.max(0.3, 1 - p.y * 0.15));
}

// ---------------------------------------------------------------- 回収課の隊員
export function makeSoldier(spec) {
  const body = humanoidBody(COLORS.soldier);
  const gun = makeGun();
  gun.scale.set(1.3, 1.3, 1.9);
  gun.position.set(0, -0.29, 0.03); gun.rotation.x = Math.PI / 2;
  body.model.parts.elbowR.add(gun);
  const flash = boxMesh([-0.05, -0.05, -0.05], [0.05, 0.05, 0.05], ps1Material({ tint: 0xffdd88, emissive: 1 }), 1, 1);
  flash.position.set(0, 0, 0.3); flash.visible = false;
  gun.add(flash);
  // ヘルメット
  const helmet = boxMesh([-0.125, 0.2, -0.13], [0.125, 0.31, 0.12], ps1Material({ tint: 0x2a2c26 }), 1, 1);
  body.model.parts.head.add(helmet);
  const s = {
    kind: 'soldier', id: spec.id, x: spec.x, z: spec.z, y: 0, yaw: spec.yaw ?? 0, hp: spec.hp ?? 5, state: spec.state ?? 'guard',
    t: 0, cd: 1 + Math.random() * 1.5, aimW: 0, recoil: 0, phase: 0, speed: 0, headJerk: 0, flashT: 0, radius: 0.3,
    accuracy: spec.accuracy ?? 0.5, onDeath: spec.onDeath, gun, flash,
    ...body,
  };
  s.active = () => ['guard', 'aim', 'stagger', 'hunt'].includes(s.state);
  s.hit = (dx, dz, dmg = 1) => {
    W.fxs.bloodSpray(new THREE.Vector3(s.x - dx * 0.1, 1.3, s.z - dz * 0.1), dx, dz);
    s.headJerk = 1;
    s.hp -= dmg;
    sfx.grunt();
    if (s.hp <= 0) { s.state = 'dying'; s.t = 0; }
    else { s.state = 'stagger'; s.t = 0; s.x += dx * 0.12; s.z += dz * 0.12; collide(s, 0.3); }
  };
  s.update = (dt) => updateSoldier(s, dt);
  s.examine = () => s.state === 'dead';
  return s;
}

function updateSoldier(s, dt) {
  const player = W.player;
  const o = s.target;
  const t = performance.now() / 1000;
  s.t += dt;
  s.tilt.position.set(0, 0, 0);
  s.tilt.rotation.set(0, 0, 0);
  let rate = 12;
  s.recoil = Math.max(0, s.recoil - dt * 6);
  s.flashT -= dt;
  const dx = player.x - s.x, dz = player.z - s.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  const turn = (r) => { const a = angleDiff(want, s.yaw); s.yaw += Math.max(-r * dt, Math.min(r * dt, a)); return a; };
  const fake = { speed: s.speed, phase: s.phase, turnW: 0, turnVel: 0, aimW: s.aimW, look: 0, limpW: 0, quickW: 0, heldW: 0, deadW: 0, recoil: s.recoil };

  if (s.state === 'hidden') {
    for (const k of POSE_KEYS) o[k] = 0;
  } else if (s.state === 'aimStill') {
    // 台本用：撃たずに銃を向けたまま立つ
    if (s.faceTo != null) { const a = angleDiff(s.faceTo, s.yaw); s.yaw += Math.max(-3 * dt, Math.min(3 * dt, a)); }
    s.aimW = Math.min(1, s.aimW + dt * 4);
    fake.aimW = s.aimW;
    playerPose(fake, t, o);
  } else if (s.state === 'guard' || s.state === 'still') {
    s.aimW = Math.max(0, s.aimW - dt * 3);
    playerPose(fake, t, o);
    o.armRx = -0.6; o.elbowR = -0.9; o.armLx = -0.7; o.elbowL = -1.1; o.armLz = -0.2;
  } else if (s.state === 'hunt') {
    // 距離を詰めながら、撃てる位置を探す
    const a = turn(2.4);
    s.aimW = Math.max(0, s.aimW - dt * 3);
    s.speed = approach(s.speed, dist > 5 ? 1.4 : 0, 4 * dt);
    s.x += Math.sin(s.yaw) * s.speed * dt; s.z += Math.cos(s.yaw) * s.speed * dt;
    s.phase += s.speed * dt * Math.PI * 2 / 1.4;
    fake.speed = s.speed; fake.phase = s.phase;
    playerPose(fake, t, o);
    o.armRx = -0.6; o.elbowR = -0.9; o.armLx = -0.7; o.elbowL = -1.1;
    s.cd -= dt;
    if (s.cd <= 0 && Math.abs(a) < 0.4 && dist < 11 && !lineBlocked(s.x, s.z, player.x, player.z)) { s.state = 'aim'; s.t = 0; s.speed = 0; }
  } else if (s.state === 'aim') {
    turn(3);
    s.aimW = Math.min(1, s.aimW + dt * 4);
    fake.aimW = s.aimW;
    playerPose(fake, t, o);
    if (s.t > 0.75 && !s.fired) {
      s.fired = true;
      sfx.rifle();
      s.recoil = 1; s.flashT = 0.07;
      const blocked = lineBlocked(s.x, s.z, player.x, player.z);
      const chance = s.accuracy * (dist < 5 ? 1.15 : dist < 9 ? 0.9 : 0.6) * (player.speed > 2 ? 0.6 : 1);
      if (!blocked && Math.random() < chance && W.state === 'play' && player.hurt <= 0) {
        sfx.hit();
        player.health -= 14;
        player.hurt = 0.5;
        W.fxs.bloodSpray(new THREE.Vector3(player.x, 1.3, player.z), dx / Math.max(dist, 1e-3), dz / Math.max(dist, 1e-3));
        W.hurtFx();
        if (player.health <= 0) W.die();
      }
    }
    if (s.t > 1.2) { s.fired = false; s.state = 'hunt'; s.t = 0; s.cd = 1.4 + Math.random() * 1.4; }
  } else if (s.state === 'stagger') {
    s.aimW = Math.max(0, s.aimW - dt * 6);
    fake.aimW = s.aimW;
    playerPose(fake, t, o);
    o.torsoRx = -0.35; o.headRx = -0.45; o.kneeL = 0.35;
    rate = 18;
    if (s.t > 0.5) { s.state = 'hunt'; s.t = 0; s.cd = 0.8; }
  } else if (s.state === 'dying') {
    const k = Math.min(1, s.t / 0.9);
    s.aimW = 0;
    s.tilt.rotation.x = -Math.PI / 2 * Math.max(0, (k - 0.35) / 0.65) ** 2;
    s.tilt.position.y = 0.12 * k;
    for (const key of POSE_KEYS) o[key] = DEAD[key] * k;
    const kneel = Math.min(1, k * 2);
    o.kneeL += 1.1 * kneel * (1 - k); o.kneeR += 0.9 * kneel * (1 - k); o.hipsY = -0.3 * kneel * (1 - k);
    rate = 14;
    if (k >= 1) { s.state = 'dead'; W.fxs.startPool(s.x - Math.sin(s.yaw) * 0.8, s.z - Math.cos(s.yaw) * 0.8); s.onDeath?.(s); }
  } else if (s.state === 'dead') {
    s.tilt.rotation.x = -Math.PI / 2; s.tilt.position.y = 0.12;
    Object.assign(o, DEAD);
  }
  if (s.active()) {
    for (const e of W.enemies) if (e !== s && e.active()) pushApart(s, e, 0.55);
    collide(s, 0.3);
  }
  dampPose(s.pose, o, dt, rate);
  if (s.headJerk > 0) { s.pose.headRx -= s.headJerk * 0.8; s.pose.torsoRx -= s.headJerk * 0.25; s.headJerk = 0; }
  applyPose(s.model.parts, s.pose);
  s.gun.visible = s.state !== 'dead' && s.state !== 'dying' && s.state !== 'hidden';
  s.flash.visible = s.flashT > 0;
  s.root.visible = s.state !== 'hidden';
  s.root.position.set(s.x, 0, s.z);
  s.root.rotation.y = s.yaw;
  s.shadow.visible = s.root.visible && s.state !== 'dead';
  s.shadow.position.x = s.x; s.shadow.position.z = s.z;
}

export function makeEnemy(spec) {
  if (spec.type === 'dog') return makeDogEnemy(spec);
  if (spec.type === 'porter') return makePorter(spec);
  if (spec.type === 'soldier') return makeSoldier(spec);
  return makeZombie(spec);
}
