import * as THREE from 'three';
import { RES_W, RES_H, lighting, ps1Material, textures, addQuad, newBuilder, buildGeometry, boxMesh, rand } from './ps1.js';
import { buildRoom, buildDoorScene, ROOM } from './world.js';
import { makeHumanoid, makeGun, zeroPose, dampPose, applyPose, POSE_KEYS } from './actors.js';
import { playerPose, zombieWalkPose, strideLength, WALK_SPEED, RUN_SPEED, BACK_SPEED } from './anim.js';
import { initAudio, sfx, setRain } from './audio.js';
import { makeDog, dogZero, dogPose, dampDog, applyDog } from './dog.js';
import { TEXT, MEMO } from './text.js';
import { createBackdrop } from './bake.js';
import { createFx } from './fx.js';
import { createMenu, ITEMS } from './menu.js';
import { createItemView } from './itemview.js';

// ---------------------------------------------------------------- 描画の準備
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
renderer.setPixelRatio(1);
renderer.setSize(RES_W, RES_H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
const backdrop = createBackdrop(renderer);

const room = buildRoom();
const scene = room.scene;
const doorFx = buildDoorScene();

const camera = new THREE.PerspectiveCamera(50, RES_W / RES_H, 0.1, 40);
const doorCam = new THREE.PerspectiveCamera(50, RES_W / RES_H, 0.05, 30);

// 固定カメラ。上から順に判定し、今のカメラだけ判定を広げてチラつきを防ぐ
const CAMS = [
  { name: 'door', pos: [2.2, 1.5, -1.3], look: [5.2, 0.9, 2.6], fov: 58, test: (x, z, m) => (x > 3.0 - m && z > 1.2 - m) || (x > 2.2 - m && z > 2.2 - m) },
  { name: 'window', pos: [1.6, 1.55, 1.6], look: [-0.1, 1.05, -4], fov: 56, test: (x, z, m) => x > -1.5 - m && x < 2.2 + m && z < -1.3 + m },
  { name: 'start', pos: [-1.3, 1.75, 3.75], look: [-5.0, 0.9, 0.8], fov: 56, test: (x, z, m) => (x < -2.1 + m && z > -0.6 - m) || (x < -1.5 + m && z > 2.6 - m) },
  { name: 'typewriter', pos: [-0.9, 2.1, 0.7], look: [-4.3, 0.8, -3.3], fov: 50, test: (x, z, m) => x < -1.5 + m && z < -0.6 + m },
  { name: 'center', pos: [-2.7, 1.55, -2.5], look: [2.0, 0.7, 2.6], fov: 56, test: (x, z, m) => x < 2.2 + m },
  { name: 'east', pos: [1.0, 2.2, 2.7], look: [4.7, 0.7, -1.7], fov: 52, test: () => true },
];
let camIndex = -1;
const fx = { lit: 1, bolt: 0, flash: 0 };
let camLocked = false;
let camForce = -1;  // イベント中だけ使う固定カメラ
function updateCamera(force = false) {
  if (camLocked) return;
  let next = CAMS.length - 1;
  for (let i = 0; i < CAMS.length; i++) {
    if (CAMS[i].test(player.x, player.z, i === camIndex ? 0.35 : 0)) { next = i; break; }
  }
  if (camForce >= 0) next = camForce;
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
const PLAYER_COLORS = { top: '#3a4a66', sleeve: '#3a4a66', vest: '#23262a', collar: '#2a3448', pants: '#4a4a44', boots: '#1e1c1a', skin: '#d0a07c', hair: '#3a2416', lips: '#9a5a48',
  extra: [[[-0.07, 0.06, 0.11], [0.07, 0.2, 0.14], '#2a2c2e'], [[-0.17, 0.3, -0.16], [0.17, 0.52, -0.1], '#2e3428']] };
const STAFF_COLORS = { top: '#6e7c8c', sleeve: '#6e7c8c', collar: '#4a5664', pants: '#2c2e36', boots: '#1e1c1a', skin: '#8a917a', skinTone: '#767c66', hair: '#3a2e22', torn: true };
const ZOMBIE_COLORS = { top: '#9a9480', sleeve: '#9a9480', pants: '#3e4654', boots: '#2a2622', skin: '#8e957c', skinTone: '#7a806a', hair: '#2a2a22', torn: true, forearmSleeve: false };

const pModel = makeHumanoid(PLAYER_COLORS);
scene.add(pModel.root);
const gun = makeGun();
gun.position.set(0, -0.29, 0.03);
gun.rotation.x = Math.PI / 2;
pModel.parts.elbowR.add(gun);
const flashMesh = boxMesh([-0.04, -0.04, -0.04], [0.04, 0.04, 0.04], ps1Material({ tint: 0xffdd88, emissive: 1 }), 1, 1);
flashMesh.position.set(0, 0, 0.26);
gun.add(flashMesh);

// ゾンビ：init は resetGame のたびに戻す初期状態
function makeZombie(colors, init) {
  const tilt = new THREE.Group(), root = new THREE.Group(), model = makeHumanoid(colors);
  tilt.add(model.root); root.add(tilt); scene.add(root);
  return { model, tilt, root, pose: zeroPose(), target: zeroPose(), shadow: blobShadow(), init };
}
// マイク：机の横で倒れている男。鍵を取ると起き上がる
const mike = makeZombie(ZOMBIE_COLORS, { x: 1.6, z: 0.9, yaw: Math.PI / 2, state: 'dormant', hp: 5 });
// 職員：犬が破った窓から、あとで這い込んでくる
const staff = makeZombie(STAFF_COLORS, { x: 0.3, z: -4.2, yaw: 0, state: 'hidden', hp: 4 });
const zombies = [mike, staff];

const dogModel = makeDog();
scene.add(dogModel.root);
const dogPoseCur = dogZero(), dogPoseTarget = dogZero();
const dogShadow = blobShadow();

// 破れた窓の縁に残るガラス
const brokenGlass = (() => {
  const pos = [], tri = (a, b, c) => { for (const q of [a, b, c]) pos.push(q[0], q[1], -3.965); };
  const X0 = -1, X1 = 1.6, Y0 = 1.0, Y1 = 2.3;
  for (let x = X0; x < X1 - 0.01; x += 0.2) {
    tri([x, Y0], [x + 0.2, Y0], [x + 0.05 + rand() * 0.1, Y0 + 0.06 + rand() * 0.3]);
    tri([x, Y1], [x + 0.06 + rand() * 0.1, Y1 - 0.05 - rand() * 0.25], [x + 0.2, Y1]);
  }
  for (let y = Y0; y < Y1 - 0.01; y += 0.2) {
    tri([X0, y], [X0 + 0.05 + rand() * 0.3, y + 0.05 + rand() * 0.1], [X0, y + 0.2]);
    tri([X1, y], [X1, y + 0.2], [X1 - 0.05 - rand() * 0.3, y + 0.05 + rand() * 0.1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3));
  const m = new THREE.Mesh(g, ps1Material({ tint: 0x9ab4d0, emissive: 0.5, opacity: 0.7, side: THREE.DoubleSide }));
  scene.add(m);
  return m;
})();

function blobShadow() {
  const b = newBuilder();
  addQuad(b, [-0.35, 0, 0.35], [1, 0, 0], [0, 0, -1], 0.7, 0.7, [0, 1, 0], 0.7, 1);
  const m = new THREE.Mesh(buildGeometry(b), ps1Material({ map: textures.shadow, opacity: 0.55 }));
  m.position.y = 0.015;
  scene.add(m);
  return m;
}
const fxs = createFx(scene);
const menu = createMenu(document.getElementById('menu'));
const itemView = createItemView();
pModel.root.userData.head = pModel.parts.head;
const pShadow = blobShadow();

// ---------------------------------------------------------------- 状態
const PLAYER_R = 0.28;
const QUICK_TIME = 0.4;
let state, player, dog, evT, flags, lightningTimer, flicker, flashT, hurtFlash, condT, doorT, endReady, lastTime;

function resetGame() {
  player = { x: -4.4, z: 2.2, yaw: Math.PI * 0.6, phase: 0, speed: 0, turnVel: 0, turnPhase: 0, aiming: false,
    quick: 0, quickFrom: 0, health: 100, ammo: 10, inv: [{ id: 'handgun' }], hurt: 0, held: 0, fireCd: 0, recoil: 0,
    aimW: 0, turnW: 0, limpW: 0, quickW: 0, heldW: 0, deadW: 0, idleT: 0, look: 0, lookTarget: 0, lookT: 0 };
  for (const z of zombies) Object.assign(z, { t: 0, phase: 0, groan: 3, stagger: 0, headJerk: 0, bit: false, y: 0 }, z.init);
  dog = { x: 0.3, y: 1.35, z: -4.3, yaw: 0, state: 'hidden', t: 0, hp: 3, phase: 0, speed: 0, cd: 0, bit: false, growl: 0 };
  brokenGlass.visible = false;
  camForce = -1; evT = 0;
  setRain(1);
  flags = { key: false, ammo: false, usedKey: false, herb: false, dog: false, staffT: 0 };
  room.objects.key.visible = true;
  room.objects.herb.visible = true;
  fxs.reset();
  menu.close();
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
const input = { up: false, down: false, left: false, right: false, run: false, action: false, aim: false, menu: false };
const pressed = new Set();
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run', KeyZ: 'action', Space: 'action', Enter: 'action', KeyC: 'aim', KeyI: 'menu', Tab: 'menu', KeyM: 'menu',
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
  if (Math.hypot(mike.x - Math.sin(mike.yaw) * 0.8 - fx, mike.z - Math.cos(mike.yaw) * 0.8 - fz) < 0.9
      && (mike.state === 'dormant' || mike.state === 'dead')) {
    say(mike.state === 'dormant' ? TEXT.corpse : TEXT.corpseDead);
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
      flags.key = true; room.objects.key.visible = false; sfx.pickup(); addItem('key');
      say(TEXT.keyGot, () => { mike.state = 'rising'; mike.t = 0; sfx.groan(); flags.staffT = 5; });
    } }]);
  } else if (id === 'ammo' && !flags.ammo) {
    say([TEXT.ammoFound, { ask: '取りますか？', yes: () => {
      flags.ammo = true; room.objects.ammo.visible = false; addItem('ammo', 15); sfx.pickup();
      say(TEXT.ammoGot);
    } }]);
  } else if (id === 'herb' && !flags.herb) {
    say([TEXT.herbFound, { ask: '取りますか？', yes: () => {
      if (player.inv.length >= 8) { say(TEXT.full); return; }
      flags.herb = true; room.objects.herb.visible = false; addItem('herb'); sfx.pickup();
      say(TEXT.herbGot);
    } }]);
  } else if (id === 'herb') {
    say(TEXT.herbGone);
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

function addItem(id, count = 1) {
  const have = player.inv.find((it) => it.id === id);
  if (have && ITEMS[id].stack) have.count += count;
  else player.inv.push({ id, count });
}

// ステータス画面で「使う」を選んだとき。戻り値は画面下に出す一言
function useItem(it) {
  const p = player;
  if (it.id === 'ammo') {
    const need = 15 - p.ammo;
    if (need <= 0) return 'これ以上は装填できない。';
    const take = Math.min(need, it.count);
    p.ammo += take; it.count -= take;
    if (it.count <= 0) p.inv.splice(p.inv.indexOf(it), 1);
    sfx.reload();
    return 'ハンドガンに装填した。';
  }
  if (it.id === 'herb') {
    if (p.health >= 100) return '今は使う必要がない。';
    p.health = Math.min(100, p.health + 45);
    p.inv.splice(p.inv.indexOf(it), 1);
    sfx.heal();
    return '体力が回復した。';
  }
  return 'ここでは使えない。';
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

const zombieActive = (z) => z.state === 'walk' || z.state === 'grab' || z.state === 'stagger';
const dogActive = () => ['land', 'run', 'lunge', 'bite', 'recover', 'stagger'].includes(dog.state);
// 撃てる・ぶつかる相手の一覧
function targets() {
  const list = zombies.filter(zombieActive);
  if (dogActive()) list.push(dog);
  return list;
}
const angleDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// ---------------------------------------------------------------- プレイヤー
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const smooth = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
const pTarget = zeroPose();
const pPose = zeroPose();

function updatePlayer(dt) {
  const p = player;
  const t = performance.now() / 1000;
  p.fireCd -= dt; p.recoil = Math.max(0, p.recoil - dt * 6); p.hurt -= dt;

  if (p.held > 0) {
    // ゾンビに掴まれている
    p.held -= dt;
    p.speed = 0; p.turnVel = 0;
    p.heldW = smooth(p.heldW, 1, 14, dt);
    p.aimW = smooth(p.aimW, 0, 14, dt);
    animatePlayer(dt, t);
    return;
  }
  p.heldW = smooth(p.heldW, 0, 8, dt);

  p.aiming = input.aim && p.quick <= 0;
  const limp = p.health < 33 ? 0.62 : 1;
  const turnDir = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  let targetSpeed = 0, targetTurn = 0;

  if (p.quick > 0) {
    // クイックターン：0.4 秒で 180°、出だしと終わりをゆるめる
    p.quick = Math.max(0, p.quick - dt);
    const k = 1 - p.quick / QUICK_TIME;
    p.yaw = p.quickFrom + Math.PI * k * k * (3 - 2 * k);
    p.quickW = k;
    if (p.quick === 0) p.quickW = 0;
  } else if (p.aiming) {
    // オートエイム：構えた瞬間にいちばん近い敵へ向き直り、構えている間は追い続ける
    // 左右を入れたらその構えの間は手動に切り替える
    if (turnDir !== 0) { p.manual = true; p.lock = null; }
    if (!p.manual && (!p.wasAiming || !p.lock || !targets().includes(p.lock))) p.lock = pickTarget(p);
    if (p.lock) {
      const a = angleDiff(Math.atan2(p.lock.x - p.x, p.lock.z - p.z), p.yaw);
      p.yaw += Math.max(-9 * dt, Math.min(9 * dt, a));
      p.turnVel = 0;
    } else targetTurn = turnDir * 1.7;
    const down = p.lock === dog ? Math.min(1, 1.6 / Math.max(0.8, Math.hypot(dog.x - p.x, dog.z - p.z))) : 0;
    p.aimDown = smooth(p.aimDown || 0, down, 10, dt);
    if (pressed.has('action') && p.fireCd <= 0) fire();
  } else {
    if (input.down && pressed.has('run')) { p.quick = QUICK_TIME; p.quickFrom = p.yaw; p.speed = 0; sfx.step(true); }
    const running = input.run && input.up;
    targetTurn = turnDir * (running ? 2.7 : 2.5);
    if (input.up) targetSpeed = (running ? RUN_SPEED : WALK_SPEED) * limp;
    else if (input.down) targetSpeed = -BACK_SPEED * limp;
    if (pressed.has('action')) interact();
  }

  // 加速・減速と旋回の立ち上がり。止まるときのほうが速い
  const speeding = Math.abs(targetSpeed) > Math.abs(p.speed) && Math.sign(targetSpeed) !== -Math.sign(p.speed);
  p.speed = approach(p.speed, targetSpeed, (speeding ? 7.5 : 11) * dt);
  p.turnVel = approach(p.turnVel, targetTurn, (targetTurn === 0 ? 24 : 16) * dt);
  p.yaw += p.turnVel * dt;

  p.x += Math.sin(p.yaw) * p.speed * dt;
  p.z += Math.cos(p.yaw) * p.speed * dt;
  const bx = p.x, bz = p.z;
  collide(p, PLAYER_R);
  for (const e of targets()) pushApart(p, e, e === dog ? 0.5 : 0.55);
  // 壁に正面からぶつかったら足踏みを止める
  const blocked = Math.hypot(p.x - bx, p.z - bz) / Math.max(1e-4, Math.abs(p.speed) * dt);
  if (blocked > 0.85 && Math.abs(p.speed) > 0.2) p.speed = approach(p.speed, 0, 14 * dt);

  // 歩行の位相は「進んだ距離 ÷ 歩幅」で進め、足が床を滑らないようにする
  const prev = p.phase;
  p.phase += (p.speed * dt * Math.PI * 2) / strideLength(p.speed);
  const contact = (ph) => Math.floor((ph - Math.PI / 2) / Math.PI);
  if (Math.abs(p.speed) > 0.4 && contact(prev) !== contact(p.phase)) sfx.step(p.speed > 2);

  const turningInPlace = Math.abs(p.turnVel) > 0.3 && Math.abs(p.speed) < 0.5;
  p.turnW = smooth(p.turnW, turningInPlace ? 1 : 0, 10, dt);
  const prevT = p.turnPhase;
  if (p.turnW > 0.05) p.turnPhase += Math.abs(p.turnVel) * dt * 2.6;
  if (turningInPlace && Math.floor(prevT / Math.PI) !== Math.floor(p.turnPhase / Math.PI)) sfx.step(false);

  if (!p.aiming) { p.lock = null; p.manual = false; }
  p.wasAiming = p.aiming;
  p.aimW = smooth(p.aimW, p.aiming ? 1 : 0, 16, dt);
  p.limpW = smooth(p.limpW, p.health < 33 ? 1 : 0, 3, dt);

  // しばらく立ち止まっていると、周りを見回す
  const idle = Math.abs(p.speed) < 0.05 && Math.abs(p.turnVel) < 0.05 && !p.aiming;
  p.idleT = idle ? p.idleT + dt : 0;
  if (p.idleT > 2.5) {
    p.lookT -= dt;
    if (p.lookT <= 0) { p.lookTarget = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.2; p.lookT = 2 + Math.random() * 3; }
  } else { p.lookTarget = 0; p.lookT = 0.5; }
  p.look = smooth(p.look, p.lookTarget, 3, dt);

  animatePlayer(dt, t);
  ui.hud.hidden = !p.aiming;
  ui.ammo.textContent = String(p.ammo).padStart(2, '0');
}

// 会話中・死亡時など、操作を受け付けないあいだも体は自然に止まる
function settlePlayer(dt) {
  const p = player;
  p.speed = approach(p.speed, 0, 11 * dt);
  p.turnVel = approach(p.turnVel, 0, 24 * dt);
  p.phase += (p.speed * dt * Math.PI * 2) / strideLength(p.speed);
  p.aimW = smooth(p.aimW, 0, 14, dt);
  p.turnW = smooth(p.turnW, 0, 10, dt);
  p.heldW = smooth(p.heldW, 0, 8, dt);
  p.quickW = 0;
  if (state === 'dead') p.deadW = smooth(p.deadW, 1, 4, dt);
  animatePlayer(dt, performance.now() / 1000);
  ui.hud.hidden = true;
}

function animatePlayer(dt, t) {
  playerPose(player, t, pTarget);
  dampPose(pPose, pTarget, dt, 22);
  applyPose(pModel.parts, pPose);
  gun.visible = player.aimW > 0.6;
  flashMesh.visible = flashT > 0;
}


// 正面寄りで近い敵を選ぶ（真横・背後の敵は向きのずれぶん遠い扱い）
function pickTarget(p) {
  let best = null, bestScore = Infinity;
  for (const e of targets()) {
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
    const a = Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw));
    if (d > 10 || a > 2.0) continue;
    const score = d + a * 1.2;
    if (score < bestScore) { best = e; bestScore = score; }
  }
  return best;
}

function pushApart(a, b, minD) {
  const dx = a.x - b.x, dz = a.z - b.z;
  const d = Math.hypot(dx, dz);
  if (d < minD && d > 1e-5) { a.x = b.x + (dx / d) * minD; a.z = b.z + (dz / d) * minD; collide(a, PLAYER_R); }
}

function fire() {
  const p = player;
  p.fireCd = 0.42;
  if (p.ammo <= 0) {
    // 予備の弾があれば自動で装填する（原作と同じ）
    const reserve = p.inv.find((it) => it.id === 'ammo');
    if (reserve) { useItem(reserve); p.fireCd = 1.0; return; }
    sfx.empty(); return;
  }
  p.ammo--;
  p.recoil = 1;
  flashT = 0.06;
  flashMesh.rotation.z = Math.random() * 3;
  flashMesh.scale.setScalar(1.2 + Math.random() * 1.2);
  sfx.gun();
  const gp = new THREE.Vector3();
  gun.getWorldPosition(gp);
  fxs.ejectShell(gp, p.yaw);
  // 構えた向きの細い扇形に入っている、いちばん近い相手に当たる
  let hit = null, hd = 9;
  for (const e of targets()) {
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
    if (d < hd && Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) < (e === dog ? 0.42 : 0.35)) { hit = e; hd = d; }
  }
  if (!hit) return;
  const dx = (hit.x - p.x) / hd, dz = (hit.z - p.z) / hd;
  hit.hp--;
  sfx.hit();
  if (hit === dog) {
    fxs.bloodSpray(new THREE.Vector3(dog.x - dx * 0.1, 0.55, dog.z - dz * 0.1), dx, dz);
    sfx.yelp();
    if (dog.hp <= 0) { dog.state = 'dying'; dog.t = 0; }
    else { dog.state = 'stagger'; dog.t = 0; dog.x += dx * 0.3; dog.z += dz * 0.3; collide(dog, 0.3); }
    return;
  }
  const z = hit;
  fxs.bloodSpray(new THREE.Vector3(z.x - dx * 0.1, 1.3, z.z - dz * 0.1), dx, dz);
  z.headJerk = 1;
  if (z.hp <= 0) {
    z.state = 'dying'; z.t = 0;
  } else {
    z.state = 'stagger'; z.stagger = 0.55;
    z.x += dx * 0.18; z.z += dz * 0.18;
    collide(z, 0.3);
  }
}

// ---------------------------------------------------------------- ゾンビ
const zTarget = zeroPose();
const zPose = zeroPose();
const LYING = { ...zeroPose(), armLz: 0.5, armRz: -0.9, headRy: 0.6, kneeL: 0.3, legLx: -0.2 };
const DEAD = { ...zeroPose(), armLz: 0.7, armRz: -0.5, headRy: -0.5, kneeR: 0.5, legRx: -0.3 };

function updateZombie(z, dt) {
  const zTilt = z.tilt, zTarget = z.target, zPose = z.pose;
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
    const k = Math.min(1, z.t / 2.2);
    z.x = 0.3; z.z = -4.2 + 0.95 * k;
    z.y = 0.95 * (1 - THREE.MathUtils.smoothstep(k, 0.45, 1));
    zTilt.rotation.x = 1.0 * Math.sin(Math.PI * Math.min(1, k * 1.1));
    for (const key of POSE_KEYS) zTarget[key] = 0;
    zTarget.armLx = -1.6; zTarget.armRx = -1.3; zTarget.elbowL = -0.3;
    zTarget.legLx = -1.2 * (1 - k); zTarget.legRx = -0.4 * (1 - k); zTarget.kneeL = 1.4 * (1 - k); zTarget.kneeR = 1.0 * (1 - k);
    zTarget.headRx = 0.4; zTarget.headRz = 0.3;
    rate = 8;
    if (k >= 1) { z.state = 'walk'; z.t = 0; }
  } else if (z.state === 'dormant') {
    zTilt.rotation.x = -Math.PI / 2;
    zTilt.position.y = 0.12;
    Object.assign(zTarget, LYING);
    Object.assign(zPose, LYING);
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
    z.phase += dt * 3.0;
    const sp = 0.32 + 0.3 * Math.max(0, Math.cos(z.phase));
    z.x += Math.sin(z.yaw) * sp * dt;
    z.z += Math.cos(z.yaw) * sp * dt;
    for (const o of zombies) if (o !== z && zombieActive(o)) pushApart(z, o, 0.5);
    collide(z, 0.3);
    zombieWalkPose(z, t, zTarget);
    z.groan -= dt;
    if (z.groan <= 0) { sfx.groan(); z.groan = 3 + Math.random() * 3; }
    const dist = Math.hypot(dx, dz);
    if (dist < 0.75 && Math.abs(d) < 0.7 && player.hurt <= 0 && player.held <= 0 && state === 'play') {
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
    if (k >= 1) { z.state = 'dead'; fxs.startPool(z.x - Math.sin(z.yaw) * 0.8, z.z - Math.cos(z.yaw) * 0.8); }
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
  z.shadow.visible = !(z.state === 'dormant' || z.state === 'dead' || z.state === 'hidden' || z.z < -3.9);
  z.shadow.position.x = z.x; z.shadow.position.z = z.z;
}


// ---------------------------------------------------------------- 感染犬
const WIN = { x: 0.3, y: 1.35, z: -4.3 };

function updateDog(dt) {
  const d = dog;
  const t = performance.now() / 1000;
  d.t += dt;
  let kind = 'growl', rate = 12;
  const dx = player.x - d.x, dz = player.z - d.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  const turn = (r) => { const a = angleDiff(want, d.yaw); d.yaw += Math.max(-r * dt, Math.min(r * dt, a)); return a; };

  if (d.state === 'hidden') {
    d.y = WIN.y;
  } else if (d.state === 'crash') {
    // 窓を突き破って、弧を描いて床に降りる
    if (d.t < 0) { d.y = WIN.y; }
    else {
      if (!d.broke) {
        d.broke = true;
        sfx.glass(); sfx.bark();
        brokenGlass.visible = true;
        fxs.glassBurst(0.3, 1.65, -3.9, 2.4, 1.1);
        setRain(2.2);
      }
      const k = Math.min(1, d.t / 0.6);
      d.x = WIN.x - 0.1 * k; d.z = WIN.z + 1.9 * k;
      d.y = WIN.y * (1 - k) + 0.55 * Math.sin(Math.PI * k);
      d.yaw = 0;
      kind = k < 0.8 ? 'lunge' : 'growl';
      rate = 16;
      if (k >= 1) { d.state = 'land'; d.t = 0; d.y = 0; sfx.growl(); }
    }
  } else if (d.state === 'land') {
    turn(2.5);
    if (d.t > 1.1) { d.state = 'run'; d.t = 0; }
  } else if (d.state === 'run') {
    const a = turn(3.6);
    d.cd -= dt;
    d.speed = approach(d.speed, Math.abs(a) > 1.2 ? 1.6 : 3.3, 6 * dt);
    d.x += Math.sin(d.yaw) * d.speed * dt;
    d.z += Math.cos(d.yaw) * d.speed * dt;
    d.phase += d.speed * dt * 4.2;
    kind = 'run'; rate = 18;
    d.growl -= dt;
    if (d.growl <= 0) { sfx.growl(); d.growl = 2.5 + Math.random() * 2; }
    if (dist < 2.1 && Math.abs(a) < 0.35 && d.cd <= 0 && state === 'play') { d.state = 'lunge'; d.t = 0; d.bit = false; sfx.bark(); }
  } else if (d.state === 'lunge') {
    const k = Math.min(1, d.t / 0.5);
    const sp = 5.2 * (1 - k * 0.5);
    d.x += Math.sin(d.yaw) * sp * dt;
    d.z += Math.cos(d.yaw) * sp * dt;
    d.y = 0.38 * Math.sin(Math.PI * k);
    kind = 'lunge'; rate = 20;
    if (!d.bit && dist < 0.75 && player.hurt <= 0 && player.held <= 0 && state === 'play') {
      d.bit = true; d.state = 'bite'; d.t = 0; d.y = 0;
      sfx.bite();
      player.health -= 18;
      player.held = 0.7;
      player.yaw = Math.atan2(-dx, -dz);
      player.aiming = false; player.quick = 0; player.quickW = 0;
      hurtFlash = 0.35; condT = 2.5;
    } else if (k >= 1) { d.state = 'recover'; d.t = 0; d.y = 0; d.cd = 0.6; }
  } else if (d.state === 'bite') {
    // 喉元に食らいついて振り回す
    d.x = player.x - Math.sin(d.yaw) * 0.55; d.z = player.z - Math.cos(d.yaw) * 0.55;
    kind = 'bite'; rate = 20;
    if (d.t > 0.7) {
      d.state = 'recover'; d.t = 0; d.cd = 1.2;
      player.held = 0; player.hurt = 1.2;
      if (player.health <= 0) die();
    }
  } else if (d.state === 'recover') {
    turn(3);
    d.x -= Math.sin(d.yaw) * 0.9 * dt; d.z -= Math.cos(d.yaw) * 0.9 * dt;
    d.speed = 0;
    if (d.t > 0.8) { d.state = 'run'; d.t = 0; }
  } else if (d.state === 'stagger') {
    kind = 'hit'; rate = 22;
    if (d.t > 0.45) { d.state = 'run'; d.t = 0; d.speed = 0; d.cd = 0.3; }
  } else if (d.state === 'dying') {
    kind = d.t < 0.25 ? 'hit' : 'dead'; rate = d.t < 0.25 ? 20 : 9;
    d.y = 0;
    if (d.t > 1.2) { d.state = 'dead'; }
  } else if (d.state === 'dead') {
    kind = 'dead';
  }
  if (d.state !== 'crash' && d.state !== 'hidden') {
    if (d.state !== 'bite') for (const z of zombies) if (zombieActive(z)) pushApart(d, z, 0.5);
    collide(d, 0.3);
  }
  dogPose(kind, d.phase, t, dogPoseTarget);
  if (d.state === 'hidden' || d.state === 'dead') Object.assign(dogPoseCur, dogPoseTarget);
  dampDog(dogPoseCur, dogPoseTarget, dt, rate);
  applyDog(dogModel, dogPoseCur);
  dogModel.root.visible = d.state !== 'hidden' && !(d.state === 'crash' && d.t < 0);
  dogModel.root.position.set(d.x, d.y, d.z);
  dogModel.root.rotation.y = d.yaw;
  dogShadow.visible = dogModel.root.visible && d.state !== 'dead' && d.z > -3.9;
  dogShadow.position.x = d.x; dogShadow.position.z = d.z;
  dogShadow.scale.setScalar(1 - Math.min(0.6, d.y));
}

// 部屋の中の出来事：犬が窓を破る、あとから職員のゾンビが這い込む
function updateEvents(dt) {
  if (!flags.dog && player.x > -2.3) {
    flags.dog = true;
    state = 'event'; evT = 2.3;
    camForce = CAMS.findIndex((c) => c.name === 'window');
    updateCamera(true);
    lightningTimer = 0.62;
    dog.state = 'crash'; dog.t = -0.45; dog.broke = false;
  }
  if (flags.staffT > 0) {
    flags.staffT -= dt;
    if (flags.staffT <= 0) { staff.state = 'climb'; staff.t = 0; sfx.groan(); }
  }
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
  // 切れかけの蛍光灯：ふだんは消えていて、ときどき瞬く
  flicker.t -= dt;
  if (flicker.t <= 0) { flicker.off = 0.15 + Math.random() * 0.35; flicker.t = 4 + Math.random() * 7; }
  let fl = 0;
  if (flicker.off > 0) { flicker.off -= dt; fl = Math.random() < 0.45 ? 0.9 : 0; }
  fx.lit = fl;
  // キャラクターの頂点ライティングには、近くて明るい背景の照明を 2 つ選んで使う
  const near = room.liveLights.map((L) => {
    const d = Math.hypot(L.pos[0] - player.x, L.pos[2] - player.z);
    return { L, score: 1 / (0.5 + d * d) };
  }).sort((a, b) => b.score - a.score);
  for (let i = 0; i < 2; i++) {
    const L = near[i].L;
    setLight(i, L.pos[0], L.pos[1], L.pos[2], L.color[0] * 1.3, L.color[1] * 1.3, L.color[2] * 1.3, L.range);
  }
  lighting.uAmbient.value.setRGB(0.1 + 0.25 * fl, 0.1 + 0.26 * fl, 0.13 + 0.28 * fl);

  // 稲光
  lightningTimer -= dt;
  let bolt = 0;
  if (lightningTimer < 0.25 && lightningTimer > 0) bolt = (lightningTimer > 0.17 || (lightningTimer < 0.1 && lightningTimer > 0.04)) ? 1 : 0;
  if (lightningTimer <= 0) { lightningTimer = 9 + Math.random() * 12; sfx.thunder(0.6 + Math.random() * 0.8); }
  setLight(2, 0.3, 2.0, -3.2, 0.18 + bolt * 1.6, 0.24 + bolt * 1.7, 0.4 + bolt * 2.0, 7 + bolt * 5);
  fx.bolt = bolt;
  room.objects.winMat.uniforms.uEmissive.value = 0.6 + bolt * 0.4;
  room.objects.winMat.uniforms.uUvOffset.value.y += dt * 1.6;

  // 銃口の光
  flashT -= dt;
  if (flashT > 0) {
    const w = new THREE.Vector3();
    gun.getWorldPosition(w);
    setLight(3, w.x, w.y, w.z, 2.2, 1.6, 0.8, 6);
  } else setLight(3, 0, 0, 0, 0, 0, 0, 1);
  fx.flash = flashT > 0 ? 1 : 0;
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
    if (pressed.has('menu') && player.held <= 0) {
      state = 'menu';
      menu.open(player.inv, player, useItem);
      sfx.cursor();
    } else { updatePlayer(dt); if (state === 'play') updateEvents(dt); }
  } else if (state === 'event') {
    evT -= dt;
    settlePlayer(dt);
    if (evT <= 0) { state = 'play'; camForce = -1; updateCamera(true); }
  } else if (state === 'menu') {
    if (menu.update(dt, pressed, sfx)) { menu.close(); state = 'play'; }
    settlePlayer(0);
  } else if (state === 'message') {
    updateMessage(dt);
    settlePlayer(dt);
  } else if (state === 'doc') {
    if (pressed.has('action')) { ui.doc.hidden = true; state = 'play'; }
    settlePlayer(dt);
  } else if (state === 'door') {
    doorT += dt;
    if (doorT > 0.35) ui.fade.style.opacity = Math.max(0, 1 - (doorT - 0.35) / 0.4);
    if (doorT > 3.6) ui.fade.style.opacity = Math.min(1, (doorT - 3.6) / 0.5);
    if (doorT > 4.3) { state = 'end'; ui.end.hidden = false; endReady = false; setTimeout(() => { endReady = true; }, 600); }
  } else if (state === 'end' || state === 'dead') {
    if (state === 'dead') settlePlayer(dt);
    if (endReady && pressed.has('action')) {
      resetGame();
      state = 'intro'; introT = 0; ui.intro.hidden = false; ui.fade.style.opacity = 1;
    }
  }

  if (state !== 'door' && state !== 'end') {
    // 会話中やステータス画面では敵も止まる（原作同様）
    const frozen = state === 'title' || state === 'intro' || state === 'menu' || state === 'message' || state === 'doc';
    for (const z of zombies) updateZombie(z, frozen ? 0 : dt);
    updateDog(frozen ? 0 : dt);
    if (!frozen) fxs.update(dt);
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
    renderer.shadowMap.needsUpdate = true;
    backdrop.renderHQ(doorFx.scene, doorCam, null, 0.9, true);
  } else if (state === 'menu') {
    const v = menu.view();
    itemView.render(renderer, lastDt, v.id, v.inspect, pModel.root);
  } else {
    backdrop.renderFrame(scene, camera, backgrounds[camIndex], fx);
  }
}

let introT = 0;
let lastDt = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - (lastTime ?? now)) / 1000);
  lastTime = now;
  lastDt = dt;
  update(dt);
  pressed.clear();
  render();
  requestAnimationFrame(frame);
}

const backgrounds = backdrop.bakeRoom(room, CAMS, camera);
resetGame();
state = 'title';
for (const z of zombies) updateZombie(z, 0);
updateDog(0);
updateLights(0);
updatePlayerPose();
updateCamera(true);
requestAnimationFrame(frame);

function updatePlayerPose() {
  pModel.root.position.set(player.x, 0, player.z);
  pModel.root.rotation.y = player.yaw;
  pShadow.position.x = player.x; pShadow.position.z = player.z;
  pModel.root.rotation.order = 'YXZ';
  playerPose(player, 0, pPose);
  applyPose(pModel.parts, pPose);
  gun.visible = false;
  flashMesh.visible = false;
}

// テスト・デバッグ用の窓口
window.__game = { get state() { return state; }, camName: () => CAMS[camIndex]?.name, lookFrom: (pos, look, fov = 40) => { camLocked = !!pos; if (!pos) return; camera.position.set(...pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(...look); }, player: () => player, zombie: () => mike, enemies: () => ({ mike, staff, dog }), flags: () => flags, press, release, input, setCam: (i) => { camIndex = i; const c = CAMS[i]; camera.position.set(...c.pos); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.lookAt(...c.look); } };
