import * as THREE from 'three';
import { RES_W, RES_H, lighting, ps1Material, boxMesh } from './ps1.js';
import { buildDoorScene } from './doorscene.js';
import { makeHumanoid, zeroPose, dampPose, applyPose } from './actors.js';
import { WEAPONS, AMMO_FOR, makeWeaponMesh, addWeaponPickups } from './weapons.js';
import { playerPose, strideLength, WALK_SPEED, RUN_SPEED, BACK_SPEED } from './anim.js';
import { initAudio, sfx, setRain, setTension } from './audio.js';
import { TEXT, FILES } from './text.js';
import { createBackdrop } from './bake.js';
import { createFx } from './fx.js';
import { createMenu, ITEMS } from './menu.js';
import { createItemView } from './itemview.js';
import { W, PLAYER_R, angleDiff, approach, smooth, collide, pushApart, blobShadow } from './world.js';
import { makeEnemy } from './enemies.js';
import { makeNpc } from './npcs.js';
import { ROOMS } from './rooms/index.js';
import { dressRoom } from './rooms/dress.js';
import { pickCam } from './camsel.js';
import { STORY } from './story.js';

// ---------------------------------------------------------------- 描画の準備
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(RES_W, RES_H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;
const backdrop = createBackdrop(renderer);
const doorFx = buildDoorScene();

const camera = new THREE.PerspectiveCamera(50, RES_W / RES_H, 0.1, 60);
const doorCam = new THREE.PerspectiveCamera(50, RES_W / RES_H, 0.05, 30);

// ---------------------------------------------------------------- 部屋
// 一度入った部屋は作った背景ごと取っておく
const built = {};
const baking = {};
// 部屋を組み立て、背景を焼く準備だけしておく（扉の演出中に 1 カメラずつ焼き進める）
function prepareRoom(id) {
  if (built[id] || baking[id]) return baking[id];
  const room = ROOMS[id]();
  addWeaponPickups(room);
  dressRoom(room);
  return (baking[id] = { room, job: backdrop.bakeRoomSteps(room, room.cams, camera) });
}
function bakeStep(id) {
  const b = baking[id];
  if (b && b.job.step()) { built[id] = { room: b.room, bgs: b.job.out, fx: createFx(b.room.scene) }; delete baking[id]; }
}
function getRoom(id) {
  if (!built[id]) {
    prepareRoom(id);
    while (!built[id]) bakeStep(id);
  }
  return built[id];
}
let room = null, backgrounds = null;

let camIndex = -1;
const fx = { lit: 1, bolt: 0, flash: 0 };
let camLocked = false;
let camForce = -1;  // イベント中だけ使う固定カメラ
let camCustom = null;
function setCamera(c) {
  camera.position.set(...c.pos);
  camera.fov = c.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(...c.look);
}
function updateCamera(force = false) {
  if (camLocked) return;
  const CAMS = room.cams;
  let next = pickCam(CAMS, player.x, player.z, camIndex, room.occluders);
  if (camForce >= 0) next = camForce;
  if (next !== camIndex || force) {
    camIndex = next;
    setCamera(CAMS[next]);
  }
}

// ---------------------------------------------------------------- 主人公
const PLAYER_COLORS = { build: 'slim', hairStyle: 'bob', lashes: true, stripe: '#9c9c88', patch: '#2a5ab0', top: '#3a4a66', sleeve: '#3a4a66', vest: '#23262a', collar: '#2a3448', pants: '#4a4a44', boots: '#1e1c1a', skin: '#d0a07c', hair: '#3a2416', lips: '#9a5a48',
  extra: [[[-0.07, 0.06, 0.11], [0.07, 0.2, 0.14], '#2a2c2e'], [[-0.17, 0.3, -0.16], [0.17, 0.52, -0.1], '#2e3428']] };
const pModel = makeHumanoid(PLAYER_COLORS);
// 手に持つ武器：武器ごとのモデルを用意して、装備中のものだけ見せる
const gun = new THREE.Group();
gun.position.set(0, -0.29, 0.03);
gun.rotation.x = Math.PI / 2;
pModel.parts.elbowR.add(gun);
const weaponMeshes = {};
for (const id of Object.keys(WEAPONS)) { weaponMeshes[id] = makeWeaponMesh(id); gun.add(weaponMeshes[id]); }
const flashMesh = boxMesh([-0.04, -0.04, -0.04], [0.04, 0.04, 0.04], ps1Material({ tint: 0xffdd88, emissive: 1 }), 1, 1);
flashMesh.position.set(0, 0, 0.26);
gun.add(flashMesh);
pModel.root.userData.head = pModel.parts.head;
pModel.root.rotation.order = 'YXZ';
const pShadow = blobShadow();
const menu = createMenu(document.getElementById('menu'));
const itemView = createItemView();

// ---------------------------------------------------------------- 状態
// S：部屋をまたいで残る進行状況（死んだら部屋に入ったときの S に戻す）
const QUICK_TIME = 0.3;
let S, checkpoint, player, lightningTimer, flicker, flashT, hurtFlash, condT, doorT, pendingDoor, endReady, lastTime, shakeT = 0;
const timers = [];

function newPlayer() {
  return { x: 0, z: 0, yaw: 0, phase: 0, speed: 0, turnVel: 0, turnPhase: 0, aiming: false,
    quick: 0, quickFrom: 0, health: 100, weapon: 'handgun', loaded: { handgun: 10, shotgun: 0, magnum: 0 }, inv: [{ id: 'knife' }, { id: 'handgun' }], hurt: 0, held: 0, fireCd: 0, recoil: 0,
    aimW: 0, turnW: 0, limpW: 0, quickW: 0, heldW: 0, deadW: 0, idleT: 0, look: 0, lookTarget: 0, lookT: 0, knock: null };
}

function newGame() {
  S = { flags: {}, picked: [], killed: [], files: [], room: 'office', spawn: [-4.4, 2.2, Math.PI * 0.6] };
  W.flags = S.flags;
  player = newPlayer();
  W.player = player;
  loadRoom(S.room, S.spawn);
}

// 部屋を読み込み、主人公を spawn = [x, z, 向き] に置く
function loadRoom(id, spawn) {
  for (const e of W.enemies) { e.root.removeFromParent(); e.shadow?.removeFromParent(); }
  for (const n of W.npcs) n.remove();
  W.enemies = []; W.npcs = [];
  timers.length = 0;
  const entry = getRoom(id);
  room = entry.room; backgrounds = entry.bgs;
  W.room = room; W.scene = room.scene; W.fxs = entry.fx;
  entry.fx.reset();
  room.scene.add(pModel.root, pShadow);
  S.room = id; S.spawn = spawn;
  Object.assign(player, { x: spawn[0], z: spawn[1], yaw: spawn[2], speed: 0, turnVel: 0, quick: 0, quickW: 0, held: 0, heldW: 0, hurt: 0, aiming: false, aimW: 0, deadW: 0, knock: null });
  for (const p of room.pickups || []) p.mesh.visible = !S.picked.includes(p.id);
  const story = STORY[id] || {};
  for (const spec of story.enemies?.(G) || []) {
    const dead = S.killed.includes(spec.id);
    if (dead && spec.type === 'porter') continue;
    const e = makeEnemy({ ...spec, state: dead ? 'dead' : spec.state });
    const onDeath = e.onDeath;
    e.onDeath = (x) => { if (!S.killed.includes(x.id)) S.killed.push(x.id); onDeath?.(x); };
    W.enemies.push(e);
  }
  camForce = -1; camCustom = null; camIndex = -1; camLocked = false;
  lightningTimer = 4; flicker = { t: 3, off: 0 };
  const env = room.env || {};
  setRain(env.rain ?? 0.3);
  setTension(env.tension ?? 1);
  lighting.uFogNear.value = env.fog?.[0] ?? 7;
  lighting.uFogFar.value = env.fog?.[1] ?? 16;
  // この部屋に入った時点の状態を、やられたときのやり直し地点にする
  checkpoint = JSON.parse(JSON.stringify({ S, p: { health: player.health, weapon: player.weapon, loaded: player.loaded, inv: player.inv } }));
  W.state = cutDepth > 0 ? 'event' : 'play';
  updatePlayerPose();
  for (const e of W.enemies) e.update(0);
  updateCamera(true);
  story.enter?.(G);
}

function restoreCheckpoint() {
  const c = JSON.parse(JSON.stringify(checkpoint));
  S = c.S; W.flags = S.flags;
  player = newPlayer();
  W.player = player;
  Object.assign(player, c.p);
  ui.dead.hidden = true;
  ui.fade.style.opacity = 1;
  loadRoom(S.room, S.spawn);
  fadeTo(0, 0.6);
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

// ブラウン管テレビの映り：にじみ（わずかなぼけと色の膨らみ）と走査線。V で切り替え、選んだ状態は覚えておく
const screenEl = document.getElementById('screen');
let crt = true;
try { crt = localStorage.getItem('crt') !== '0'; } catch { /* 保存できない環境では既定のまま */ }
function applyCrt() {
  screenEl.classList.toggle('crt', crt);
  const u = screenEl.clientWidth / 320; // 元の 1 ドットが画面上で何 px か
  screenEl.style.filter = crt ? `blur(${(u * 0.32).toFixed(2)}px) saturate(1.12) contrast(1.06)` : '';
}
addEventListener('resize', applyCrt);
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyV' || e.repeat) return;
  crt = !crt;
  try { localStorage.setItem('crt', crt ? '1' : '0'); } catch { /* 無視 */ }
  applyCrt();
});
applyCrt();
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
  if (['title', 'dead', 'ending'].includes(W.state)) press('action');
});

// ---------------------------------------------------------------- UI（メッセージ）
const $ = (id) => document.getElementById(id);
const ui = {
  screen: $('screen'), msg: $('msg'), msgText: $('msg-text'), choice: $('choice'),
  doc: $('doc'), docTitle: $('doc-title'), docBody: $('doc-body'), fade: $('fade'), title: $('title'), intro: $('intro'),
  hud: $('hud'), ammo: $('ammo'), wname: $('wname'), cond: $('cond'), hurt: $('hurt'), dead: $('dead'),
  select: $('select'), selPrompt: $('sel-prompt'), selOpts: $('sel-opts'), selBar: $('sel-bar'),
  ending: $('ending'), endTitle: $('end-title'), endBody: $('end-body'), endFoot: $('end-foot'), chapter: $('chapter'),
};

// 話している人物の名前から、口を動かす NPC を探す
const SPEAKERS = { 'エマ': 'emma', 'ホルト': 'holt', 'ヴィクトル': 'victor', '隊員': 'soldier' };
let pages = [], pageIdx = 0, typed = 0, choiceSel = 0, onMsgDone = null;
function say(list, done) {
  pages = Array.isArray(list) ? list : [list]; pageIdx = 0; typed = 0; onMsgDone = done || null;
  W.state = 'message';
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
  const text = currentText();
  const who = Object.keys(SPEAKERS).find((k) => text.startsWith(k));
  if (who) for (const n of W.npcs) if (n.name === SPEAKERS[who]) n.talk = Math.min(4, text.length / 18);
}
function currentText() { const p = pages[pageIdx]; return typeof p === 'string' ? p : p.ask; }
function updateMessage(dt) {
  const text = currentText();
  if (typed < text.length) {
    typed = Math.min(text.length, typed + dt * 55);
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
  if (W.state === 'message') W.state = cutDepth > 0 ? 'event' : 'play';
}

let docDone = null;
function showDoc(id, done) {
  const f = FILES[id];
  if (!S.files.includes(id)) S.files.push(id);
  W.state = 'doc';
  docDone = done || null;
  ui.docTitle.textContent = f.title;
  ui.docBody.textContent = f.body;
  ui.doc.hidden = false;
}

// 緊急選択：時間内に選ばないと、決められたほうになる
let sel = null;
function select(prompt, options, time, def, done) {
  sel = { options, time, left: time, def, cur: 0, done, prev: W.state };
  W.state = 'select';
  ui.select.hidden = false;
  ui.selPrompt.textContent = prompt;
  renderSelect();
  sfx.heartbeat();
}
function renderSelect() {
  ui.selOpts.innerHTML = sel.options.map((o, i) => `<span class="${i === sel.cur ? 'sel' : ''}">${o}</span>`).join('');
}
function updateSelect(dt) {
  sel.left -= dt;
  ui.selBar.style.transform = `scaleX(${Math.max(0, sel.left / sel.time)})`;
  if (Math.floor((sel.left + dt) * 1.4) !== Math.floor(sel.left * 1.4)) sfx.heartbeat();
  if (pressed.has('left') || pressed.has('right') || pressed.has('up') || pressed.has('down')) { sel.cur = (sel.cur + 1) % sel.options.length; sfx.cursor(); renderSelect(); }
  let pick = null;
  if (pressed.has('action')) pick = sel.cur;
  else if (sel.left <= 0) pick = sel.def;
  if (pick != null) {
    ui.select.hidden = true;
    W.state = cutDepth > 0 ? 'event' : 'play';
    const done = sel.done; sel = null;
    sfx.cursor();
    done(pick);
  }
}

// 画面の暗転（opacity を t 秒かけて to へ）
let fadeAnim = null;
function fadeTo(to, t, done) {
  fadeAnim = { from: parseFloat(ui.fade.style.opacity || '0'), to, t, k: 0, done };
}

// ---------------------------------------------------------------- 台本から使う窓口
let cutDepth = 0;
const G = {
  get S() { return S; },
  get flags() { return S.flags; },
  get player() { return player; },
  get room() { return room; },
  get enemies() { return W.enemies; },
  get fx() { return W.fxs; },
  lightning(t) { lightningTimer = t; },
  sfx,
  say: (list) => new Promise((res) => say(list, res)),
  ask: (text) => new Promise((res) => say([{ ask: text, yes: () => res(true), no: () => res(false) }])),
  select: (prompt, options, time = 7, def = options.length - 1) => new Promise((res) => select(prompt, options, time, def, res)),
  doc: (id) => new Promise((res) => showDoc(id, res)),
  wait: (t) => new Promise((res) => timers.push({ t, res })),
  after(t, fn) { timers.push({ t, res: fn }); },
  fade: (to, t = 0.6) => new Promise((res) => fadeTo(to, t, res)),
  // イベント：その間は操作を止める。live なら敵は動き続ける
  async cut(fn, { live = false } = {}) {
    cutDepth++;
    W.cutLive = live;
    if (W.state === 'play') W.state = 'event';
    try { await fn(); } finally {
      cutDepth--;
      if (cutDepth === 0) {
        W.cutLive = false;
        camCustom = null; camForce = -1;
        if (W.state === 'event') { W.state = 'play'; updateCamera(true); }
      }
    }
  },
  cam(name) {
    if (typeof name === 'string') { camForce = room.cams.findIndex((c) => c.name === name); camCustom = null; updateCamera(true); }
    else { camCustom = name; setCamera(name); }
  },
  camAuto() { camForce = -1; camCustom = null; updateCamera(true); },
  has: (id) => player.inv.some((it) => it.id === id),
  give(id, count = 1) { addItem(id, count); },
  take(id) { const i = player.inv.findIndex((it) => it.id === id); if (i >= 0) player.inv.splice(i, 1); },
  spawn(spec) {
    const e = makeEnemy(spec);
    const onDeath = e.onDeath;
    e.onDeath = (x) => { if (!S.killed.includes(x.id)) S.killed.push(x.id); onDeath?.(x); };
    W.enemies.push(e); e.update(0); return e;
  },
  enemy: (id) => W.enemies.find((e) => e.id === id),
  npc(name, spec) {
    let n = W.npcs.find((x) => x.name === name);
    if (!n && spec) { n = makeNpc(name, spec); W.npcs.push(n); n.update(0); }
    return n;
  },
  removeNpc(name) { const i = W.npcs.findIndex((x) => x.name === name); if (i >= 0) { W.npcs[i].remove(); W.npcs.splice(i, 1); } },
  goto(id, spawn, kind = 'wood') { startDoor({ to: id, spawn, kind }); },
  // 扉の演出を挟まずに部屋を移る（暗転中に使う）
  warp(id, spawn) { loadRoom(id, spawn); },
  hurt(n) { player.health -= n; hurtFx(); if (player.health <= 0) die(); },
  shake: (t) => { shakeT = Math.max(shakeT, t); },
  chapter(text) { ui.chapter.textContent = text; ui.chapter.hidden = false; ui.chapter.style.animation = 'none'; void ui.chapter.offsetWidth; ui.chapter.style.animation = ''; setTimeout(() => { ui.chapter.hidden = true; }, 4200); },
  ending(kind) { showEnding(kind); },
  setRain, setTension,
  pickupVisible(id, v) { const p = room.pickups?.find((x) => x.id === id); if (p) p.mesh.visible = v; },
};
W.shake = G.shake;
window.__G = G;

// ---------------------------------------------------------------- 調べる
function interact() {
  const fx = player.x + Math.sin(player.yaw) * 0.6;
  const fz = player.z + Math.cos(player.yaw) * 0.6;
  const story = STORY[room.id] || {};
  // 話しかける
  for (const n of W.npcs) {
    if (Math.hypot(n.x - fx, n.z - fz) < 0.8 && story.talk) { story.talk(G, n.name); return; }
  }
  // 倒れている体
  for (const e of W.enemies) {
    if (!e.examine()) continue;
    const bx = e.x - Math.sin(e.yaw) * 0.8, bz = e.z - Math.cos(e.yaw) * 0.8;
    if (Math.hypot(bx - fx, bz - fz) < 0.9 || Math.hypot(e.x - fx, e.z - fz) < 0.7) {
      if (story.examine?.(G, e)) return;
      say(e.state === 'dead' ? TEXT.common.corpseDead : TEXT.common.corpse);
      return;
    }
  }
  let best = null, bestD = Infinity;
  for (const it of room.interactables) {
    const d = Math.hypot(it.x - fx, it.z - fz);
    if (d < it.r && d < bestD) { best = it; bestD = d; }
  }
  if (!best) return;
  const id = best.id;
  if (story.interact?.(G, id)) return;
  const pk = (room.pickups || []).find((p) => p.at === id && !S.picked.includes(p.id));
  if (pk) { pickup(pk); return; }
  if (id.startsWith('door:')) { tryDoor(id.slice(5)); return; }
  if (id.startsWith('file:')) { showDoc(id.slice(5)); return; }
  const text = TEXT[room.id]?.[id] || TEXT.common[id];
  if (text) say(text);
}

// 拾う確認のあいだ、画面を暗転させてアイテムを回して見せる（原作の拾得画面の作法）
let showcase = null;
function pickup(pk) {
  const def = ITEMS[pk.item];
  const found = pk.found || TEXT.found[pk.item] || `「${def.name}」がある。`;
  showcase = pk.item;
  say([found, { ask: '取りますか？', no: () => { showcase = null; }, yes: () => {
    const stack = def.stack && player.inv.some((it) => it.id === pk.item);
    if (!stack && player.inv.length >= 8) { showcase = null; say(TEXT.common.full); return; }
    S.picked.push(pk.id);
    pk.mesh.visible = false;
    sfx.pickup();
    addItem(pk.item, pk.count || 1);
    const got = `「${def.name}」を手に入れた。${pk.count > 1 ? `（${pk.count}${AMMO_FOR[pk.item] ? '発' : '個'}）` : ''}`;
    say([got], () => { showcase = null; STORY[room.id]?.onPickup?.(G, pk); });
  } }]);
}

function tryDoor(name) {
  const door = room.doors[name];
  const story = STORY[room.id] || {};
  if (story.door?.(G, name, door)) return;
  if (!door) return;
  const unlockedFlag = `unlocked.${room.id}.${name}`;
  if (door.lock && !S.flags[unlockedFlag]) {
    if (door.lock.startsWith('flag:')) {
      if (!S.flags[door.lock.slice(5)]) { sfx.locked(); say(door.lockedText || TEXT.common.locked); return; }
      startDoor(door); return;
    }
    if (!G.has(door.lock)) { sfx.locked(); say(door.lockedText || TEXT.common.locked); return; }
    S.flags[unlockedFlag] = true;
    say([`「${ITEMS[door.lock].name}」を使った。`], () => startDoor(door));
    return;
  }
  startDoor(door);
}

function addItem(id, count = 1) {
  const have = player.inv.find((it) => it.id === id);
  if (have && ITEMS[id].stack) have.count += count;
  else player.inv.push({ id, count });
}

// ステータス画面で「使う」を選んだとき。戻り値は画面下に出す一言
function useItem(it) {
  const p = player;
  if (WEAPONS[it.id]) {
    if (p.weapon === it.id) return `${ITEMS[it.id].name}を装備している。`;
    p.weapon = it.id;
    sfx.reload();
    return `${ITEMS[it.id].name}を装備した。`;
  }
  const w = AMMO_FOR[it.id];
  if (w) {
    if (!p.inv.some((x) => x.id === w)) return `${ITEMS[w].name}を持っていない。`;
    const need = WEAPONS[w].cap - p.loaded[w];
    if (need <= 0) return 'これ以上は装填できない。';
    const take = Math.min(need, it.count);
    p.loaded[w] += take; it.count -= take;
    if (it.count <= 0) p.inv.splice(p.inv.indexOf(it), 1);
    sfx.reload();
    return `${ITEMS[w].name}に装填した。`;
  }
  if (it.id === 'herb') {
    if (p.health >= 100) return '今は使う必要がない。';
    p.health = Math.min(100, p.health + 55);
    p.inv.splice(p.inv.indexOf(it), 1);
    sfx.heal();
    return '傷の手当てをした。体力が回復した。';
  }
  if (it.id === 'photo') return '…ダニー。必ず、生きて帰る。';
  return 'ここでは使えない。';
}

function tabText(tab) {
  if (tab === 'FILE') {
    if (!S.files.length) return 'ファイルはまだ一冊もない。';
    return '読んだファイル：\n' + S.files.map((f) => `・${FILES[f].title}`).join('\n');
  }
  if (tab === 'MAP') return S.flags.map ? TEXT.map[room.id] : TEXT.map.none;
  if (tab === 'RADIO') return TEXT.radioTab(S);
  return '';
}

function startDoor(door) {
  W.state = 'door';
  doorT = 0;
  pendingDoor = door;
  doorFx.setKind(door.kind || 'wood');
  sfx.door();
  ui.fade.style.opacity = 1;
  ui.hud.hidden = true;
}

// ---------------------------------------------------------------- プレイヤー
const pTarget = zeroPose();
const pPose = zeroPose();
const targets = () => W.enemies.filter((e) => e.active());

function updatePlayer(dt) {
  const p = player;
  const t = performance.now() / 1000;
  p.fireCd -= dt; p.recoil = Math.max(0, p.recoil - dt * 6); p.hurt -= dt;

  if (p.knock) {
    // 殴り飛ばされる
    p.knock.t -= dt;
    p.x += p.knock.x * dt; p.z += p.knock.z * dt;
    collide(p, PLAYER_R);
    p.heldW = smooth(p.heldW, 1, 14, dt);
    p.aimW = smooth(p.aimW, 0, 14, dt);
    if (p.knock.t <= 0) p.knock = null;
    animatePlayer(dt, t);
    return;
  }
  if (p.held > 0) {
    // 掴まれている
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
    // クイックターン：0.3 秒で 180°、出だしと終わりをゆるめる
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
      p.yaw += Math.max(-14 * dt, Math.min(14 * dt, a));
      p.turnVel = 0;
    } else targetTurn = turnDir * 2.6;
    // 上下：構えたまま上・下を入れると銃口を上げ下げする。入れていなければ狙った相手の高さに合わせる
    const L = p.lock;
    const pitchIn = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const down = pitchIn > 0 ? 0.9 : pitchIn < 0 ? -0.75
      : L && L.low ? Math.min(1, 1.6 / Math.max(0.8, Math.hypot(L.x - p.x, L.z - p.z))) : L && L.big ? -0.25 : 0;
    p.aimPitch = pitchIn;
    p.aimDown = smooth(p.aimDown || 0, down, 14, dt);
    if (pressed.has('action') && p.fireCd <= 0) fire();
  } else {
    if (input.down && pressed.has('run')) { p.quick = QUICK_TIME; p.quickFrom = p.yaw; p.speed = 0; sfx.step(true); }
    const running = input.run && input.up;
    targetTurn = turnDir * (running ? 3.5 : 3.3);
    if (input.up) targetSpeed = (running ? RUN_SPEED : WALK_SPEED) * limp;
    else if (input.down) targetSpeed = -BACK_SPEED * limp;
    if (pressed.has('action')) interact();
  }

  // 加速・減速と旋回の立ち上がり。止まるときのほうが速い
  const speeding = Math.abs(targetSpeed) > Math.abs(p.speed) && Math.sign(targetSpeed) !== -Math.sign(p.speed);
  p.speed = approach(p.speed, targetSpeed, (speeding ? 16 : 20) * dt);
  p.turnVel = approach(p.turnVel, targetTurn, (targetTurn === 0 ? 48 : 36) * dt);
  p.yaw += p.turnVel * dt;

  p.x += Math.sin(p.yaw) * p.speed * dt;
  p.z += Math.cos(p.yaw) * p.speed * dt;
  const bx = p.x, bz = p.z;
  collide(p, PLAYER_R);
  for (const e of targets()) pushApart(p, e, e.big ? 0.7 : e.low ? 0.5 : 0.55);
  for (const n of W.npcs) pushApart(p, n, 0.5);
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
  p.aimW = smooth(p.aimW, p.aiming ? 1 : 0, 26, dt);
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
  const wd = WEAPONS[p.weapon];
  ui.wname.textContent = wd.name;
  ui.ammo.textContent = wd.melee ? '' : String(p.loaded[p.weapon]).padStart(2, '0');
}

// 会話中・死亡時など、操作を受け付けないあいだも体は自然に止まる
function settlePlayer(dt) {
  const p = player;
  p.speed = approach(p.speed, 0, 11 * dt);
  p.turnVel = approach(p.turnVel, 0, 24 * dt);
  p.phase += (p.speed * dt * Math.PI * 2) / strideLength(p.speed);
  p.aimW = smooth(p.aimW, p.forceAim ? 1 : 0, 14, dt);
  p.turnW = smooth(p.turnW, 0, 10, dt);
  p.heldW = smooth(p.heldW, 0, 8, dt);
  p.quickW = 0;
  if (W.state === 'dead') p.deadW = smooth(p.deadW, 1, 4, dt);
  animatePlayer(dt, performance.now() / 1000);
  ui.hud.hidden = true;
}

function animatePlayer(dt, t) {
  playerPose(player, t, pTarget);
  dampPose(pPose, pTarget, dt, 30);
  applyPose(pModel.parts, pPose);
  gun.visible = player.aimW > 0.6;
  for (const id in weaponMeshes) weaponMeshes[id].visible = id === player.weapon;
  flashMesh.visible = flashT > 0;
}

// 正面寄りで近い敵を選ぶ（真横・背後の敵は向きのずれぶん遠い扱い）
function pickTarget(p) {
  let best = null, bestScore = Infinity;
  for (const e of targets()) {
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
    const a = Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw));
    if (d > 12 || a > 2.0) continue;
    const score = d + a * 1.2;
    if (score < bestScore) { best = e; bestScore = score; }
  }
  return best;
}

function fire() {
  const p = player;
  const w = WEAPONS[p.weapon];
  p.fireCd = w.cd;
  if (w.melee) {
    // ナイフ：目の前を切りつける
    p.recoil = 1;
    sfx.knife();
    let hit = null, hd = w.range;
    for (const e of targets()) {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) - (e.big ? 0.4 : 0);
      if (d < hd && Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) < w.cone) { hit = e; hd = d; }
    }
    if (hit) { const d = Math.hypot(hit.x - p.x, hit.z - p.z) || 1; sfx.stab(); hit.hit((hit.x - p.x) / d, (hit.z - p.z) / d, w.dmg); }
    return;
  }
  if (p.loaded[p.weapon] <= 0) {
    // 予備の弾があれば自動で装填する。弾が尽きたらナイフに持ち替える
    const reserve = p.inv.find((it) => it.id === w.ammo);
    if (reserve) { useItem(reserve); p.fireCd = 1.0; return; }
    sfx.empty();
    if (p.inv.some((it) => it.id === 'knife')) p.weapon = 'knife';
    return;
  }
  p.loaded[p.weapon]--;
  p.recoil = w.recoil;
  flashT = p.weapon === 'handgun' ? 0.06 : 0.09;
  flashMesh.position.z = w.flash;
  flashMesh.rotation.z = Math.random() * 3;
  flashMesh.scale.setScalar((1.2 + Math.random() * 1.2) * (p.weapon === 'handgun' ? 1 : 1.8));
  sfx[p.weapon === 'handgun' ? 'gun' : p.weapon]();
  if (p.weapon !== 'handgun') shakeT = Math.max(shakeT, 0.18);
  const gp = new THREE.Vector3();
  gun.getWorldPosition(gp);
  if (p.weapon !== 'magnum') W.fxs.ejectShell(gp, p.yaw);
  // 構えた向きの扇形に入っている相手に当たる。ふつうはいちばん近い 1 体、散弾と貫通は全員
  const inCone = [];
  // 銃口を上げていると低い相手（犬など）には当たらない。上げて撃つと頭に当たり、効きが強い
  const up = (p.aimDown || 0) < -0.35, low = (p.aimDown || 0) > 0.35;
  for (const e of targets()) {
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
    if (up && e.low && d > 0.9) continue;
    const cone = w.cone + (e.low ? 0.07 : e.big ? 0.1 : 0);
    if (d < w.range && Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) < cone) inCone.push({ e, d });
  }
  if (!inCone.length) return;
  inCone.sort((a, b) => a.d - b.d);
  const hits = w.pellets || w.pierce ? inCone : inCone.slice(0, 1);
  sfx.hit();
  for (const { e, d } of hits) {
    // 散弾は離れるほど弱くなる
    let dmg = w.pellets ? w.dmg * Math.max(0.3, 1 - Math.max(0, d - 2) / 6) : w.dmg;
    if (up && !e.low) dmg *= 1.5;
    else if (low && !e.low) dmg *= 0.8;
    e.hit((e.x - p.x) / d, (e.z - p.z) / d, dmg);
  }
}

function hurtFx() { hurtFlash = 0.35; condT = 2.5; }
W.hurtFx = hurtFx;

function die() {
  if (W.state === 'dead') return;
  W.state = 'dead';
  cutDepth = 0;
  ui.msg.hidden = true; ui.select.hidden = true;
  setTimeout(() => { ui.dead.hidden = false; endReady = true; }, 900);
  ui.fade.style.opacity = 0.75;
}
W.die = die;

// ---------------------------------------------------------------- 照明
function setLight(i, x, y, z, r, g, b, range) {
  lighting.uLightPos.value[i].set(x, y, z);
  lighting.uLightColor.value[i].setRGB(r, g, b);
  lighting.uLightRange.value[i] = range;
}

function updateLights(dt) {
  const env = room.env || {};
  // 切れかけの蛍光灯：ふだんは消えていて、ときどき瞬く
  let fl = 1;
  if (env.flicker) {
    flicker.t -= dt;
    if (flicker.t <= 0) { flicker.off = 0.15 + Math.random() * 0.35; flicker.t = 4 + Math.random() * 7; }
    // 'on' はふだん点いていて、ときどき瞬いて暗くなる
    const on = env.flicker === 'on';
    fl = on ? 1 : 0;
    if (flicker.off > 0) { flicker.off -= dt; fl = Math.random() < 0.45 ? 0.9 : on ? 0.15 : 0; }
  }
  fx.lit = fl;
  // キャラクターの頂点ライティングには、近くて明るい背景の照明を選んで使う
  const near = room.liveLights.map((L) => {
    const d = Math.hypot(L.pos[0] - player.x, L.pos[2] - player.z);
    return { L, score: 1 / (0.5 + d * d) };
  }).sort((a, b) => b.score - a.score);
  const slots = env.lightning ? 2 : 3;
  for (let i = 0; i < slots; i++) {
    const L = near[i]?.L;
    if (L) setLight(i, L.pos[0], L.pos[1], L.pos[2], L.color[0] * 1.3, L.color[1] * 1.3, L.color[2] * 1.3, L.range);
    else setLight(i, 0, 0, 0, 0, 0, 0, 1);
  }
  const amb = env.ambient || [0.16, 0.16, 0.2], lit = env.ambientLit || [0, 0, 0];
  const k = env.flicker ? fl : 0;
  lighting.uAmbient.value.setRGB(amb[0] + lit[0] * k, amb[1] + lit[1] * k, amb[2] + lit[2] * k);

  // 稲光
  let bolt = 0;
  if (env.lightning) {
    lightningTimer -= dt;
    if (lightningTimer < 0.25 && lightningTimer > 0) bolt = (lightningTimer > 0.17 || (lightningTimer < 0.1 && lightningTimer > 0.04)) ? 1 : 0;
    if (lightningTimer <= 0) { lightningTimer = 9 + Math.random() * 12; sfx.thunder(0.6 + Math.random() * 0.8); }
    const L = env.lightning, b = L.base, s = L.boost || 1;
    setLight(2, ...L.pos, b[0] + bolt * 1.6 * s, b[1] + bolt * 1.7 * s, b[2] + bolt * 2.0 * s, L.range + bolt * 5);
  }
  fx.bolt = bolt * (env.lightning?.bg ?? 1);
  room.tick?.(dt, fx);

  // 銃口の光
  flashT -= dt;
  if (flashT > 0) {
    const w = new THREE.Vector3();
    gun.getWorldPosition(w);
    setLight(3, w.x, w.y, w.z, 2.2, 1.6, 0.8, 6);
  } else setLight(3, 0, 0, 0, 0, 0, 0, 1);
  fx.flash = flashT > 0 ? 1 : 0;
}

// ---------------------------------------------------------------- エンディング
let endLines = [], endT = 0;
function showEnding(kind) {
  const E = TEXT.endings[kind];
  W.state = 'ending';
  endT = 0; endReady = false;
  ui.ending.hidden = false;
  ui.endTitle.textContent = E.title;
  ui.endBody.innerHTML = '';
  endLines = E.body.map((line) => { const p = document.createElement('p'); p.textContent = line; p.style.opacity = 0; ui.endBody.appendChild(p); return p; });
  ui.endFoot.textContent = '';
  setRain(0); setTension(0);
}
function updateEnding(dt) {
  endT += dt;
  ui.endTitle.style.opacity = Math.min(1, endT / 1.5);
  endLines.forEach((p, i) => { p.style.opacity = Math.max(0, Math.min(1, (endT - 2 - i * 2.2) / 1.2)); });
  const done = endT > 2 + endLines.length * 2.2 + 1.5;
  if (done && !endReady) { endReady = true; ui.endFoot.textContent = TEXT.endings.foot; }
  if (pressed.has('action')) {
    if (!done) endT = 2 + endLines.length * 2.2 + 1.5;
    else { ui.ending.hidden = true; toTitle(); }
  }
}

function toTitle() {
  W.state = 'title';
  ui.title.hidden = false;
  ui.fade.style.opacity = 1;
  newGame();
  W.state = 'title';
}

// ---------------------------------------------------------------- ループ
let introT = 0;
function update(dt) {
  const st = W.state;
  if (st === 'title') {
    if (pressed.has('action')) {
      initAudio();
      ui.title.hidden = true;
      ui.fade.style.opacity = 1;
      W.state = 'intro';
      ui.intro.hidden = false;
      introT = 0;
    }
  } else if (st === 'intro') {
    introT += dt;
    ui.intro.style.opacity = introT < 0.8 ? introT / 0.8 : introT < 4.2 ? 1 : Math.max(0, 1 - (introT - 4.2) / 0.8);
    if (introT > 5 || (introT > 0.8 && pressed.has('action'))) {
      ui.intro.hidden = true;
      W.state = 'play';
      ui.fade.style.opacity = 0;
      STORY.start?.(G);
    }
  } else if (st === 'play') {
    if (pressed.has('menu') && player.held <= 0 && !player.knock) {
      W.state = 'menu';
      menu.open(player.inv, player, useItem, tabText);
      sfx.cursor();
    } else {
      updatePlayer(dt);
      if (W.state === 'play') STORY[room.id]?.tick?.(G, dt);
    }
  } else if (st === 'event') {
    settlePlayer(dt);
  } else if (st === 'menu') {
    if (menu.update(dt, pressed, sfx)) { menu.close(); W.state = 'play'; }
    settlePlayer(0);
  } else if (st === 'message') {
    updateMessage(dt);
    settlePlayer(dt);
  } else if (st === 'select') {
    updateSelect(dt);
    settlePlayer(dt);
  } else if (st === 'doc') {
    if (pressed.has('action')) { ui.doc.hidden = true; W.state = cutDepth > 0 ? 'event' : 'play'; const d = docDone; docDone = null; d?.(); }
    settlePlayer(dt);
  } else if (st === 'door') {
    doorT += dt * 1.3; // 扉の演出は 3 秒あまりで抜ける
    // 真っ暗なうちに部屋を組み立て、開いていく間に背景を 1 枚ずつ焼いておく
    if (pendingDoor && !built[pendingDoor.to]) { if (!baking[pendingDoor.to]) prepareRoom(pendingDoor.to); else bakeStep(pendingDoor.to); }
    if (doorT > 0.35 && doorT < 3.6) ui.fade.style.opacity = Math.max(0, 1 - (doorT - 0.35) / 0.4);
    if (doorT > 3.6) ui.fade.style.opacity = Math.min(1, (doorT - 3.6) / 0.5);
    if (doorT > 4.2) {
      const d = pendingDoor; pendingDoor = null;
      loadRoom(d.to, d.spawn);
      fadeTo(0, 0.35);
    }
  } else if (st === 'dead') {
    settlePlayer(dt);
    if (endReady && pressed.has('action')) { endReady = false; restoreCheckpoint(); }
  } else if (st === 'ending') {
    updateEnding(dt);
  }

  // 台本のタイマー（ステータス画面・会話・選択中は止まる）
  if (W.state === 'play' || W.state === 'event') {
    for (let i = timers.length - 1; i >= 0; i--) {
      timers[i].t -= dt;
      if (timers[i].t <= 0) { const tm = timers.splice(i, 1)[0]; tm.res(); }
    }
  }
  if (fadeAnim) {
    fadeAnim.k += dt / Math.max(0.01, fadeAnim.t);
    const k = Math.min(1, fadeAnim.k);
    ui.fade.style.opacity = fadeAnim.from + (fadeAnim.to - fadeAnim.from) * k;
    if (k >= 1) { const d = fadeAnim.done; fadeAnim = null; d?.(); }
  }

  if (W.state !== 'door' && W.state !== 'ending') {
    // 会話中やステータス画面では敵も止まる（原作同様）
    const frozen = ['title', 'intro', 'menu', 'message', 'doc', 'select'].includes(W.state) || (W.state === 'event' && !W.cutLive);
    for (const e of W.enemies) e.update(frozen ? 0 : dt);
    for (const n of W.npcs) n.update(['menu', 'select', 'title'].includes(W.state) ? 0 : dt);
    if (!frozen) W.fxs.update(dt);
    updateLights(dt);
    pModel.root.position.set(player.x, 0, player.z);
    pModel.root.rotation.y = player.yaw;
    pShadow.position.x = player.x; pShadow.position.z = player.z;
    if (!camCustom) updateCamera();
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
  shakeT -= dt;
  ui.screen.style.transform = shakeT > 0 ? `translate(${(Math.random() - 0.5) * 10 * shakeT}px, ${(Math.random() - 0.5) * 10 * shakeT}px)` : '';
}

function render() {
  if (W.state === 'door') {
    doorFx.animate(doorT, doorCam);
    renderer.shadowMap.needsUpdate = true;
    backdrop.renderHQ(doorFx.scene, doorCam, null, 0.9, true);
  } else if (W.state === 'menu') {
    const v = menu.view();
    itemView.render(renderer, lastDt, v.id, v.inspect, pModel.root);
  } else if (showcase && W.state === 'message') {
    itemView.showcase(renderer, lastDt, showcase);
  } else if (W.state === 'ending') {
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
  } else {
    backdrop.renderFrame(room.scene, camera, backgrounds[camCustom ? camCustom.bg ?? camIndex : camIndex], fx);
  }
}

let lastDt = 0;
const perf = { u: 0, r: 0, n: 0 };
function frame(now) {
  // 描画が遅い端末でもゲームの速さは変えない：長いフレームは細かく刻んで進める
  const dt = Math.min(0.1, (now - (lastTime ?? now)) / 1000);
  lastTime = now;
  lastDt = dt;
  const t0 = performance.now();
  const steps = Math.ceil(dt / (1 / 30)) || 1;
  for (let i = 0; i < steps; i++) { update(dt / steps); pressed.clear(); }
  const t1 = performance.now();
  renderer.info.reset();
  // タイトル画面では部屋だけを背景に見せる
  pModel.root.visible = pShadow.visible = W.state !== 'title';
  render();
  perf.u += t1 - t0; perf.r += performance.now() - t1; perf.n++;
  requestAnimationFrame(frame);
}

function updatePlayerPose() {
  pModel.root.position.set(player.x, 0, player.z);
  pModel.root.rotation.y = player.yaw;
  pShadow.position.x = player.x; pShadow.position.z = player.z;
  playerPose(player, 0, pPose);
  applyPose(pModel.parts, pPose);
  gun.visible = false;
  flashMesh.visible = false;
}

flashT = 0; hurtFlash = 0; condT = 0; doorT = 0; endReady = false;
newGame();
W.state = 'title';
ui.fade.style.opacity = 0; // タイトルの後ろに、薄暗い部屋を見せる
updateLights(0);
updateCamera(true);
requestAnimationFrame(frame);

// テスト・デバッグ用の窓口
window.__game = {
  get state() { return W.state; }, camName: () => room.cams[camIndex]?.name, room: () => room.id,
  lookFrom: (pos, look, fov = 40) => { camLocked = !!pos; if (!pos) return; camera.position.set(...pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(...look); },
  player: () => player, enemies: () => W.enemies, npcs: () => W.npcs, flags: () => S.flags, S: () => S, press, release, input,
  setCam: (i) => { camIndex = i; setCamera(room.cams[i]); },
  // 部屋へ直接移動して、すぐ操作できる状態にする
  warp(id, spawn, flags = {}) {
    ui.title.hidden = true; ui.intro.hidden = true; initAudio();
    Object.assign(S.flags, flags);
    loadRoom(id, spawn || S.spawn);
    ui.fade.style.opacity = 0;
  },
  give: (id, n) => addItem(id, n), useItem, G,
  bake: (id) => getRoom(id),
  perf: () => { const o = { u: perf.u / perf.n, r: perf.r / perf.n }; perf.u = perf.r = perf.n = 0; return o; },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, progs: renderer.info.programs?.length }),
};
