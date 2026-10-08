import * as THREE from 'three';
import { RES_W, RES_H, lighting, ps1Material, textures, addQuad, newBuilder, buildGeometry } from './ps1.js';
import { buildRoom, buildDoorScene, ROOM } from './world.js';
import { makeHumanoid, makeGun, resetPose } from './actors.js';
import { initAudio, sfx } from './audio.js';
import { TEXT, MEMO } from './text.js';

// ---------------------------------------------------------------- 描画の準備
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
renderer.setPixelRatio(1);
renderer.setSize(RES_W, RES_H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const room = buildRoom();
const scene = room.scene;
const doorFx = buildDoorScene();

const camera = new THREE.PerspectiveCamera(50, RES_W / RES_H, 0.1, 40);
const doorCam = new THREE.PerspectiveCamera(50, RES_W / RES_H, 0.05, 30);

// 固定カメラ。上から順に判定し、今のカメラだけ判定を広げてチラつきを防ぐ
const CAMS = [
  { name: 'door', pos: [2.6, 1.7, -0.2], look: [5.6, 1.0, 2.6], fov: 56, test: (x, z, m) => x > 4.0 - m && z > 1.2 - m },
  { name: 'west', pos: [1.0, 2.8, 3.7], look: [-4.8, 0.6, -0.6], fov: 52, test: (x, z, m) => x < -1.5 + m },
  { name: 'center', pos: [-5.5, 2.9, -3.5], look: [1.2, 0.4, 1.6], fov: 50, test: (x, z, m) => x < 2.2 + m },
  { name: 'east', pos: [-0.6, 2.8, -3.6], look: [4.6, 0.5, 1.2], fov: 52, test: () => true },
];
let camIndex = -1;
function updateCamera(force = false) {
  let next = CAMS.length - 1;
  for (let i = 0; i < CAMS.length; i++) {
    if (CAMS[i].test(player.x, player.z, i === camIndex ? 0.35 : 0)) { next = i; break; }
  }
  if (next !== camIndex || force) {
    camIndex = next;
    const c = CAMS[next];
    camera.position.set(...c.pos);
    camera.fov = c.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(...c.look);
  }
}

// ---------------------------------------------------------------- 登場人物
const PLAYER_COLORS = { top: '#2d3b57', sleeve: '#2d3b57', belt: '#3a2b1e', pants: '#3b3a38', boots: '#1c1a18', skin: '#d4a07a', hair: '#3a2416',
  extra: [[[-0.2, 0.28, -0.13], [0.2, 0.5, -0.11], '#3a4a3a']] };
const ZOMBIE_COLORS = { top: '#8c8672', sleeve: '#8c8672', belt: '#2a2420', pants: '#3a4250', boots: '#2a2622', skin: '#8e9378', hair: '#2a2a22',
  extra: [[[-0.1, 0.12, 0.11], [0.12, 0.42, 0.125], '#5a1410'], [[-0.2, 0.0, 0.11], [-0.05, 0.12, 0.125], '#4a100c']] };

const pModel = makeHumanoid(PLAYER_COLORS);
scene.add(pModel.root);
const gun = makeGun();
gun.position.set(0, -0.58, 0.03);
gun.rotation.x = Math.PI / 2;
pModel.parts.armR.add(gun);
const flashMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), ps1Material({ tint: 0xffdd88, emissive: 1 }));
flashMesh.position.set(0, 0, 0.26);
gun.add(flashMesh);

const zTilt = new THREE.Group();
const zRoot = new THREE.Group();
const zModel = makeHumanoid(ZOMBIE_COLORS);
zTilt.add(zModel.root);
zRoot.add(zTilt);
scene.add(zRoot);

function blobShadow() {
  const b = newBuilder();
  addQuad(b, [-0.35, 0, 0.35], [1, 0, 0], [0, 0, -1], 0.7, 0.7, [0, 1, 0], 0.7, 1);
  const m = new THREE.Mesh(buildGeometry(b), ps1Material({ map: textures.shadow, opacity: 0.55 }));
  m.position.y = 0.015;
  scene.add(m);
  return m;
}
const pShadow = blobShadow();
const zShadow = blobShadow();

// ---------------------------------------------------------------- 状態
const PLAYER_R = 0.28;
let state, player, zombie, flags, lightningTimer, flicker, flashT, hurtFlash, condT, doorT, endReady, lastTime;

function resetGame() {
  player = { x: -4.4, z: 2.2, yaw: Math.PI * 0.6, phase: 0, speed: 0, aim: 0, aiming: false, quick: 0,
    health: 100, ammo: 10, hurt: 0, held: 0, fireCd: 0, recoil: 0 };
  zombie = { x: 1.6, z: 0.9, yaw: Math.PI / 2, state: 'dormant', t: 0, hp: 5, phase: 0, groan: 3, stagger: 0 };
  flags = { key: false, ammo: false, usedKey: false };
  room.objects.key.visible = true;
  room.objects.ammo.visible = true;
  lightningTimer = 4;
  flicker = { t: 3, off: 0 };
  flashT = 0; hurtFlash = 0; condT = 0; doorT = 0; endReady = false;
  camIndex = -1;
  ui.hud.hidden = true;
  ui.end.hidden = true;
  ui.dead.hidden = true;
  ui.doc.hidden = true;
  ui.msg.hidden = true;
}

// ---------------------------------------------------------------- 入力
const input = { up: false, down: false, left: false, right: false, run: false, action: false, aim: false };
const pressed = new Set();
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run', KeyZ: 'action', Space: 'action', Enter: 'action', KeyC: 'aim',
};
function press(k) { if (!input[k]) pressed.add(k); input[k] = true; }
function release(k) { input[k] = false; }
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  if (!e.repeat) press(k);
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) release(k); });
addEventListener('blur', () => { for (const k in input) input[k] = false; });

document.querySelectorAll('[data-btn]').forEach((el) => {
  const k = el.dataset.btn;
  const down = (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); el.classList.add('on'); press(k); };
  const up = () => { el.classList.remove('on'); release(k); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
});
document.getElementById('screen').addEventListener('pointerdown', () => {
  if (state === 'title' || state === 'end' || state === 'dead') press('action');
});

// ---------------------------------------------------------------- UI（メッセージ）
const ui = {
  msg: document.getElementById('msg'),
  msgText: document.getElementById('msg-text'),
  choice: document.getElementById('choice'),
  doc: document.getElementById('doc'),
  docTitle: document.getElementById('doc-title'),
  docBody: document.getElementById('doc-body'),
  fade: document.getElementById('fade'),
  title: document.getElementById('title'),
  intro: document.getElementById('intro'),
  hud: document.getElementById('hud'),
  ammo: document.getElementById('ammo'),
  cond: document.getElementById('cond'),
  hurt: document.getElementById('hurt'),
  end: document.getElementById('end'),
  dead: document.getElementById('dead'),
};

let pages = [], pageIdx = 0, typed = 0, choiceSel = 0, onMsgDone = null;
function say(list, done) {
  pages = list; pageIdx = 0; typed = 0; onMsgDone = done || null;
  state = 'message';
  ui.msg.hidden = false;
  showPage();
}
function showPage() {
  const p = pages[pageIdx];
  typed = 0;
  ui.choice.hidden = true;
  choiceSel = 0;
  ui.msgText.textContent = '';
  ui.msg.dataset.kind = typeof p === 'string' ? 'text' : 'choice';
}
function currentText() { const p = pages[pageIdx]; return typeof p === 'string' ? p : p.ask; }
function updateMessage(dt) {
  const text = currentText();
  if (typed < text.length) {
    typed = Math.min(text.length, typed + dt * 32);
    ui.msgText.textContent = text.slice(0, Math.floor(typed));
    if (pressed.has('action')) { typed = text.length; ui.msgText.textContent = text; }
    if (typed >= text.length && typeof pages[pageIdx] !== 'string') renderChoice();
    return;
  }
  const p = pages[pageIdx];
  if (typeof p !== 'string') {
    if (pressed.has('left') || pressed.has('right') || pressed.has('up') || pressed.has('down')) { choiceSel ^= 1; sfx.cursor(); renderChoice(); }
    if (pressed.has('action')) {
      const fn = choiceSel === 0 ? p.yes : p.no;
      closeMessage();
      fn?.();
    }
    return;
  }
  if (pressed.has('action')) {
    pageIdx++;
    if (pageIdx >= pages.length) {
      const done = onMsgDone;
      closeMessage();
      done?.();
    } else showPage();
  }
}
function renderChoice() {
  ui.choice.hidden = false;
  ui.choice.innerHTML = `<span class="${choiceSel === 0 ? 'sel' : ''}">はい</span><span class="${choiceSel === 1 ? 'sel' : ''}">いいえ</span>`;
}
function closeMessage() {
  ui.msg.hidden = true;
  if (state === 'message') state = 'play';
}

function showDoc() {
  state = 'doc';
  ui.docTitle.textContent = MEMO.title;
  ui.docBody.textContent = MEMO.body;
  ui.doc.hidden = false;
}

// ---------------------------------------------------------------- 調べる
function interact() {
  const fx = player.x + Math.sin(player.yaw) * 0.6;
  const fz = player.z + Math.cos(player.yaw) * 0.6;
  if (Math.hypot(zombie.x - Math.sin(zombie.yaw) * 0.8 - fx, zombie.z - Math.cos(zombie.yaw) * 0.8 - fz) < 0.9
      && (zombie.state === 'dormant' || zombie.state === 'dead')) {
    say(zombie.state === 'dormant' ? TEXT.corpse : TEXT.corpseDead);
    return;
  }
  let best = null, bestD = Infinity;
  for (const it of room.interactables) {
    const d = Math.hypot(it.x - fx, it.z - fz);
    if (d < it.r && d < bestD) { best = it; bestD = d; }
  }
  if (!best) return;
  const id = best.id;
  if (id === 'key' && !flags.key) {
    say([TEXT.keyFound, { ask: '取りますか？', yes: () => {
      flags.key = true; room.objects.key.visible = false; sfx.pickup();
      say(TEXT.keyGot, () => { zombie.state = 'rising'; zombie.t = 0; sfx.groan(); });
    } }]);
  } else if (id === 'ammo' && !flags.ammo) {
    say([TEXT.ammoFound, { ask: '取りますか？', yes: () => {
      flags.ammo = true; room.objects.ammo.visible = false; player.ammo += 15; sfx.pickup();
      say(TEXT.ammoGot);
    } }]);
  } else if (id === 'memo') {
    showDoc();
  } else if (id === 'exitDoor') {
    if (!flags.key) { sfx.locked(); say(TEXT.locked); }
    else if (!flags.usedKey) { flags.usedKey = true; say(TEXT.useKey, startDoor); }
    else startDoor();
  } else if (id === 'key' || id === 'desk') {
    say(TEXT.desk);
  } else if (id === 'ammo' || id === 'cabinet') {
    say(TEXT.cabinet);
  } else {
    say(TEXT[id]);
  }
}

function startDoor() {
  state = 'door';
  doorT = 0;
  sfx.door();
  ui.fade.style.opacity = 1;
}

// ---------------------------------------------------------------- 当たり判定
function collide(o, r) {
  const { x0, x1, z0, z1 } = ROOM;
  o.x = Math.min(x1 - r, Math.max(x0 + r, o.x));
  o.z = Math.min(z1 - r, Math.max(z0 + r, o.z));
  for (const [ax0, az0, ax1, az1] of room.colliders) {
    const cx = Math.max(ax0, Math.min(o.x, ax1));
    const cz = Math.max(az0, Math.min(o.z, az1));
    const dx = o.x - cx, dz = o.z - cz;
    const d = Math.hypot(dx, dz);
    if (d < r) {
      if (d > 1e-5) { o.x = cx + (dx / d) * r; o.z = cz + (dz / d) * r; }
      else { o.x += r; }
    }
  }
}

const zombieActive = () => zombie.state === 'walk' || zombie.state === 'grab' || zombie.state === 'stagger';
const angleDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// ---------------------------------------------------------------- プレイヤー
function updatePlayer(dt) {
  const p = player;
  const P = pModel.parts;
  p.fireCd -= dt; p.recoil = Math.max(0, p.recoil - dt * 5); p.hurt -= dt;

  if (p.held > 0) {
    // ゾンビに掴まれている
    p.held -= dt;
    animateHeld(P, p);
    return;
  }

  p.aiming = input.aim && p.quick <= 0;
  const limp = p.health < 33 ? 0.65 : 1;
  let move = 0;

  if (p.quick > 0) {
    const step = Math.min(p.quick, dt);
    p.yaw += (Math.PI / 0.35) * step;
    p.quick -= dt;
  } else if (p.aiming) {
    const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    p.yaw += turn * 1.6 * dt;
    if (pressed.has('action') && p.fireCd <= 0) fire();
  } else {
    if (input.down && pressed.has('run')) { p.quick = 0.35; }
    const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    p.yaw += turn * (input.run && input.up ? 2.9 : 2.5) * dt;
    if (input.up) move = (input.run ? 3.0 : 1.4) * limp;
    else if (input.down) move = -0.9 * limp;
    if (pressed.has('action')) interact();
  }

  p.x += Math.sin(p.yaw) * move * dt;
  p.z += Math.cos(p.yaw) * move * dt;
  collide(p, PLAYER_R);
  if (zombieActive()) pushApart(p, zombie, 0.55);
  p.speed = move;

  // 歩行アニメ
  const prev = p.phase;
  p.phase += move * dt * (input.run && move > 2 ? 3.4 : 4.6);
  if (move !== 0 && Math.floor(prev / Math.PI) !== Math.floor(p.phase / Math.PI)) sfx.step(move > 2);
  p.aim += ((p.aiming ? 1 : 0) - p.aim) * Math.min(1, dt * 14);

  resetPose(P);
  const running = move > 2;
  const amp = move === 0 ? 0 : running ? 0.85 : 0.5;
  const s = Math.sin(p.phase);
  P.legL.rotation.x = s * amp;
  P.legR.rotation.x = -s * amp;
  P.armL.rotation.x = -s * amp * 0.8;
  P.armR.rotation.x = s * amp * 0.8;
  P.hips.position.y = 0.9 + (move ? Math.abs(Math.cos(p.phase)) * 0.03 : Math.sin(performance.now() / 700) * 0.006);
  P.torso.rotation.x = running ? 0.18 : 0;
  if (limp < 1 && move) { P.torso.rotation.z = Math.sin(p.phase) * 0.08; P.torso.rotation.x = 0.15; }
  P.head.rotation.x = limp < 1 ? 0.2 : 0;

  // 構え
  if (p.aim > 0.01) {
    const a = p.aim;
    P.armR.rotation.x = THREE.MathUtils.lerp(P.armR.rotation.x, -Math.PI / 2 - p.recoil * 0.5, a);
    P.armL.rotation.x = THREE.MathUtils.lerp(P.armL.rotation.x, -1.35, a);
    P.armL.rotation.z = -0.45 * a;
    P.armR.rotation.z = 0.08 * a;
    P.torso.rotation.y = 0.1 * a;
  }
  gun.visible = p.aim > 0.5;
  flashMesh.visible = flashT > 0;
  ui.hud.hidden = !p.aiming;
  ui.ammo.textContent = String(p.ammo).padStart(2, '0');
}

function animateHeld(P, p) {
  resetPose(P);
  const t = performance.now() / 90;
  P.torso.rotation.x = -0.25;
  P.torso.rotation.z = Math.sin(t) * 0.12;
  P.armL.rotation.x = -1.2; P.armR.rotation.x = -1.0;
  P.head.rotation.x = -0.3;
  gun.visible = false;
  flashMesh.visible = false;
  ui.hud.hidden = true;
}

function pushApart(a, b, minD) {
  const dx = a.x - b.x, dz = a.z - b.z;
  const d = Math.hypot(dx, dz);
  if (d < minD && d > 1e-5) { a.x = b.x + (dx / d) * minD; a.z = b.z + (dz / d) * minD; collide(a, PLAYER_R); }
}

function fire() {
  const p = player;
  p.fireCd = 0.42;
  if (p.ammo <= 0) { sfx.empty(); return; }
  p.ammo--;
  p.recoil = 1;
  flashT = 0.06;
  sfx.gun();
  if (!zombieActive()) return;
  const dx = zombie.x - p.x, dz = zombie.z - p.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 9 && Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) < 0.35) {
    zombie.hp--;
    sfx.hit();
    if (zombie.hp <= 0) {
      zombie.state = 'dying'; zombie.t = 0;
    } else {
      zombie.state = 'stagger'; zombie.stagger = 0.55;
      zombie.x += (dx / dist) * 0.18; zombie.z += (dz / dist) * 0.18;
      collide(zombie, 0.3);
    }
  }
}

// ---------------------------------------------------------------- ゾンビ
function updateZombie(dt) {
  const z = zombie;
  const P = zModel.parts;
  z.t += dt;
  resetPose(P);
  zTilt.position.set(0, 0, 0);
  zTilt.rotation.set(0, 0, 0);

  if (z.state === 'dormant') {
    zTilt.rotation.x = -Math.PI / 2;
    zTilt.position.y = 0.12;
    P.armL.rotation.z = 0.5; P.armR.rotation.z = -0.9; P.head.rotation.y = 0.6;
  } else if (z.state === 'rising') {
    const k = Math.min(1, z.t / 2.4);
    const e = k * k * (3 - 2 * k);
    zTilt.rotation.x = -Math.PI / 2 * (1 - e);
    zTilt.position.y = 0.12 * (1 - e);
    P.armL.rotation.x = -1.3 * e; P.armR.rotation.x = -1.3 * e;
    P.head.rotation.y = 0.6 * (1 - e);
    P.head.rotation.z = 0.4 * e;
    if (k >= 1) { z.state = 'walk'; z.t = 0; }
  } else if (z.state === 'walk') {
    const dx = player.x - z.x, dz = player.z - z.z;
    const want = Math.atan2(dx, dz);
    const d = angleDiff(want, z.yaw);
    z.yaw += Math.max(-1.4 * dt, Math.min(1.4 * dt, d));
    const sp = 0.5;
    z.x += Math.sin(z.yaw) * sp * dt;
    z.z += Math.cos(z.yaw) * sp * dt;
    collide(z, 0.3);
    z.phase += dt * 3.2;
    const s = Math.sin(z.phase);
    P.legL.rotation.x = s * 0.35; P.legR.rotation.x = -s * 0.35;
    P.armL.rotation.x = -1.35 + s * 0.1; P.armR.rotation.x = -1.3 - s * 0.1;
    P.torso.rotation.z = s * 0.08;
    P.head.rotation.z = 0.35; P.head.rotation.x = 0.2;
    z.groan -= dt;
    if (z.groan <= 0) { sfx.groan(); z.groan = 3 + Math.random() * 3; }
    const dist = Math.hypot(dx, dz);
    if (dist < 0.75 && Math.abs(d) < 0.7 && player.hurt <= 0 && state === 'play') {
      z.state = 'grab'; z.t = 0;
      player.held = 1.1;
      player.yaw = Math.atan2(-dx, -dz);
      player.aiming = false;
    }
  } else if (z.state === 'grab') {
    P.armL.rotation.x = -1.5; P.armR.rotation.x = -1.5;
    P.torso.rotation.x = 0.25; P.head.rotation.x = 0.4 + Math.sin(z.t * 20) * 0.1;
    if (z.t > 0.45 && !z.bit) {
      z.bit = true;
      sfx.bite();
      player.health -= 28;
      hurtFlash = 0.35; condT = 2.5;
    }
    if (z.t > 1.1) {
      z.bit = false;
      z.state = 'walk'; z.t = 0;
      player.held = 0;
      player.hurt = 1.4;
      const dx = player.x - z.x, dz = player.z - z.z, d = Math.hypot(dx, dz) || 1;
      player.x += (dx / d) * 0.7; player.z += (dz / d) * 0.7;
      collide(player, PLAYER_R);
      if (player.health <= 0) die();
    }
  } else if (z.state === 'stagger') {
    z.stagger -= dt;
    P.torso.rotation.x = -0.35; P.head.rotation.x = -0.4;
    P.armL.rotation.x = -0.9; P.armR.rotation.x = -0.7;
    if (z.stagger <= 0) { z.state = 'walk'; z.t = 0; }
  } else if (z.state === 'dying') {
    const k = Math.min(1, z.t / 0.8);
    zTilt.rotation.x = -Math.PI / 2 * k * k;
    zTilt.position.y = 0.12 * k;
    P.armL.rotation.x = -1.3 * (1 - k); P.armR.rotation.x = -1.3 * (1 - k);
    if (k >= 1) z.state = 'dead';
  } else if (z.state === 'dead') {
    zTilt.rotation.x = -Math.PI / 2;
    zTilt.position.y = 0.12;
    P.armL.rotation.z = 0.7; P.armR.rotation.z = -0.5; P.head.rotation.y = -0.5;
  }
  zRoot.position.set(z.x, 0, z.z);
  zRoot.rotation.y = z.yaw;
  zShadow.visible = !(z.state === 'dormant' || z.state === 'dead');
  zShadow.position.x = z.x; zShadow.position.z = z.z;
}

function die() {
  state = 'dead';
  setTimeout(() => { ui.dead.hidden = false; endReady = true; }, 900);
  ui.fade.style.opacity = 0.75;
}

// ---------------------------------------------------------------- 照明
function setLight(i, x, y, z, r, g, b, range) {
  lighting.uLightPos.value[i].set(x, y, z);
  lighting.uLightColor.value[i].setRGB(r, g, b);
  lighting.uLightRange.value[i] = range;
}

function updateLights(dt) {
  // 蛍光灯の明滅
  flicker.t -= dt;
  if (flicker.t <= 0) { flicker.off = 0.05 + Math.random() * 0.12; flicker.t = 1.5 + Math.random() * 5; }
  let fl = 1;
  if (flicker.off > 0) { flicker.off -= dt; fl = Math.random() < 0.5 ? 0.15 : 0.6; }
  room.objects.fluoro.material.uniforms.uTint.value.setScalar(0.3 + 0.7 * fl);
  setLight(0, 0, 2.9, 0, 0.95 * fl, 0.92 * fl, 0.8 * fl, 9.5);
  setLight(1, -3.0, 1.15, -3.45, 1.0, 0.55, 0.22, 4.2);

  // 稲光
  lightningTimer -= dt;
  let bolt = 0;
  if (lightningTimer < 0.25 && lightningTimer > 0) bolt = (lightningTimer > 0.17 || (lightningTimer < 0.1 && lightningTimer > 0.04)) ? 1 : 0;
  if (lightningTimer <= 0) { lightningTimer = 9 + Math.random() * 12; sfx.thunder(0.6 + Math.random() * 0.8); }
  setLight(2, 0.3, 2.0, -3.2, 0.18 + bolt * 1.6, 0.24 + bolt * 1.7, 0.4 + bolt * 2.0, 7 + bolt * 5);
  room.objects.winMat.uniforms.uEmissive.value = 0.35 + bolt * 0.65;
  room.objects.winMat.uniforms.uUvOffset.value.y += dt * 1.6;

  // 銃口の光
  flashT -= dt;
  if (flashT > 0) {
    const w = new THREE.Vector3();
    gun.getWorldPosition(w);
    setLight(3, w.x, w.y, w.z, 2.2, 1.6, 0.8, 6);
  } else setLight(3, 0, 0, 0, 0, 0, 0, 1);
}

function doorLights() {
  setLight(0, 0, 2.6, 2.4, 0.9, 0.82, 0.6, 7);
  setLight(1, 0, 0, 0, 0, 0, 0, 1);
  setLight(2, 0, 0, 0, 0, 0, 0, 1);
  setLight(3, 0, 0, 0, 0, 0, 0, 1);
}

// ---------------------------------------------------------------- ループ
function update(dt) {
  if (state === 'title') {
    if (pressed.has('action')) {
      initAudio();
      ui.title.hidden = true;
      state = 'intro';
      ui.intro.hidden = false;
      introT = 0;
    }
  } else if (state === 'intro') {
    introT += dt;
    ui.intro.style.opacity = introT < 0.8 ? introT / 0.8 : introT < 3.2 ? 1 : Math.max(0, 1 - (introT - 3.2) / 0.8);
    if (introT > 4 || (introT > 0.8 && pressed.has('action'))) {
      ui.intro.hidden = true;
      state = 'play';
      ui.fade.style.opacity = 0;
    }
  } else if (state === 'play') {
    updatePlayer(dt);
  } else if (state === 'message') {
    updateMessage(dt);
  } else if (state === 'doc') {
    if (pressed.has('action')) { ui.doc.hidden = true; state = 'play'; }
  } else if (state === 'door') {
    doorT += dt;
    if (doorT > 0.35) ui.fade.style.opacity = Math.max(0, 1 - (doorT - 0.35) / 0.4);
    if (doorT > 3.6) ui.fade.style.opacity = Math.min(1, (doorT - 3.6) / 0.5);
    if (doorT > 4.3) { state = 'end'; ui.end.hidden = false; endReady = false; setTimeout(() => { endReady = true; }, 600); }
  } else if (state === 'end' || state === 'dead') {
    if (endReady && pressed.has('action')) {
      resetGame();
      state = 'intro'; introT = 0; ui.intro.hidden = false; ui.fade.style.opacity = 1;
    }
  }

  if (state !== 'door' && state !== 'end') {
    if (state !== 'title' && state !== 'intro') updateZombie(dt);
    else updateZombie(0);
    if (state === 'message' || state === 'doc') {
      // 会話中もゾンビは止まる（原作同様）
    }
    updateLights(dt);
    pModel.root.position.set(player.x, 0, player.z);
    pModel.root.rotation.y = player.yaw;
    pShadow.position.x = player.x; pShadow.position.z = player.z;
    updateCamera();
  }

  hurtFlash -= dt;
  ui.hurt.style.opacity = hurtFlash > 0 ? hurtFlash * 1.6 : 0;
  condT -= dt;
  ui.cond.hidden = condT <= 0;
  if (condT > 0) {
    const h = player.health;
    ui.cond.dataset.level = h >= 66 ? 'fine' : h >= 33 ? 'caution' : 'danger';
    ui.cond.textContent = h >= 66 ? 'FINE' : h >= 33 ? 'CAUTION' : 'DANGER';
  }
}

function render() {
  if (state === 'door' || state === 'end') {
    const t = doorT;
    const open = THREE.MathUtils.smoothstep(t, 0.9, 2.6);
    doorFx.hinge.rotation.y = open * 1.75;
    const dolly = THREE.MathUtils.smoothstep(t, 1.6, 3.9);
    doorCam.position.set(0.05, 1.45 - dolly * 0.1, 2.4 - dolly * 3.6);
    doorCam.lookAt(0.05, 1.25, -2);
    doorLights();
    renderer.render(doorFx.scene, doorCam);
  } else {
    renderer.render(scene, camera);
  }
}

let introT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - (lastTime ?? now)) / 1000);
  lastTime = now;
  update(dt);
  pressed.clear();
  render();
  requestAnimationFrame(frame);
}

resetGame();
state = 'title';
updateZombie(0);
updateLights(0);
updatePlayerPose();
updateCamera(true);
requestAnimationFrame(frame);

function updatePlayerPose() {
  pModel.root.position.set(player.x, 0, player.z);
  pModel.root.rotation.y = player.yaw;
  pShadow.position.x = player.x; pShadow.position.z = player.z;
  gun.visible = false;
  flashMesh.visible = false;
}

// テスト・デバッグ用の窓口
window.__game = { get state() { return state; }, player: () => player, zombie: () => zombie, press, release, input, setCam: (i) => { camIndex = i; const c = CAMS[i]; camera.position.set(...c.pos); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.lookAt(...c.look); } };
