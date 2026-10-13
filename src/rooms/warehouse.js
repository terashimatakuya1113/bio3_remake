// 第2章：倉庫棟
// 背の高い棚が 2 列。東の奥に、内側から破られた「特別便」のコンテナ
import * as THREE from 'three';
import { boxMesh, ps1Material } from '../ps1.js';
import { createKit, hqMat, LAYER_LIVE } from './kit.js';
import { signTex } from '../hq2.js';

const B = { x0: -8, x1: 8, z0: -6, z1: 6 };
const H = 6.5;

const CAMS = [
  { name: 'aisle', pos: [2.4, 2.9, -3.7], look: [-7.5, 0.9, -3.7], fov: 58, test: (x, z, m) => z < -2.4 + m && x < 1.6 + m },
  { name: 'ne', pos: [3.0, 4.8, 2.8], look: [3.1, 0.2, -5.6], fov: 56, test: (x, z, m) => x > 1.6 - m && z < -1.0 + m },
  { name: 'rackSouth', pos: [2.2, 3.4, 1.2], look: [-7.5, 0.6, -0.6], fov: 58, test: (x, z, m) => x < 0.6 + m && z < 0.4 + m },
  { name: 'south', pos: [1.6, 4.4, -0.4], look: [3.6, 0.3, 5.6], fov: 62, test: () => false },
  { name: 'drop', pos: [5.2, 1.4, 3.8], look: [0.6, 2.6, -1.2], fov: 62, event: true, test: () => false },
  { name: 'entrance', pos: [0.6, 3.8, -1.0], look: [-4.2, 0.3, 6.0], fov: 62, test: (x, z, m) => x < 0.6 + m },
  { name: 'container', pos: [-1.2, 3.9, 5.0], look: [6.4, 0.6, -1.6], fov: 58, test: () => true },
];

export function build() {
  const K = createKit(B);
  const { T, box, quad, cyl, pipe, solid, solidBox, decal, wallDecal, walls, floor, ceiling, point, spot, hemi, look, add } = K;
  const sign = (key, opts) => hqMat(signTex(key, opts), { rough: 0.7 });
  const M = {
    concrete: hqMat(T.concrete, { rough: 0.55 }),
    corr: hqMat(T.corrugated, { rough: 0.55, metal: 0.3, color: 0xb8bcc0 }),
    roof: hqMat(T.metal, { rough: 0.8, metal: 0.2, color: 0x2a2c30 }),
    orange: hqMat(T.metal, { rough: 0.5, metal: 0.3, color: 0xc86a1a }),
    blue: hqMat(T.metal, { rough: 0.5, metal: 0.3, color: 0x1e4a8a }),
    deck: hqMat(T.wood, { rough: 0.8, color: 0xc8b8a0 }),
    pallet: hqMat(T.wood, { rough: 0.8 }),
    cardboard: hqMat(T.cardboard, { rough: 0.9 }),
    wrap: hqMat(T.cardboard, { rough: 0.3, metal: 0.1, color: 0xd8d8d8 }),
    crate: hqMat(T.crate, { rough: 0.8 }),
    container: hqMat(T.container, { rough: 0.45, metal: 0.5 }),
    steel: hqMat(T.metal, { rough: 0.45, metal: 0.55, color: 0x8a9298 }),
    dark: hqMat(T.metal, { rough: 0.5, metal: 0.4, color: 0x3a3e42 }),
    black: hqMat(null, { rough: 0.6, color: 0x121212 }),
    yellow: hqMat(T.metal, { rough: 0.5, metal: 0.2, color: 0xd8a818 }),
    hazard: hqMat(T.hazard, { rough: 0.6 }),
    frost: hqMat(T.frost, { rough: 0.1, alpha: true }),
    blood: hqMat(T.blood, { rough: 0.2, alpha: true }),
    drag: hqMat(T.drag, { rough: 0.25, alpha: true }),
    hand: hqMat(T.handprint, { rough: 0.3, alpha: true }),
    papers: hqMat(T.papers, { rough: 0.9, alpha: true }),
    wood: hqMat(T.wood, { rough: 0.6 }),
    vend: hqMat(null, { rough: 0.4, metal: 0.3, color: 0x8a1a18 }),
    vendGlow: new THREE.MeshBasicMaterial({ color: 0x9ab0c0 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xe8f0ff }),
    red: new THREE.MeshBasicMaterial({ color: 0xff3020 }),
    paint: hqMat(null, { rough: 0.6, color: 0xc8c4b0 }),
  };

  floor(M.concrete, 2);
  walls(M.corr, H, 4);
  ceiling(M.roof, H, 3);
  // 屋根のトラス
  for (let x = -6; x <= 6; x += 4) {
    box([x - 0.08, H - 0.6, -6], [x + 0.08, H - 0.4, 6], M.dark, 1);
    for (let z = -5; z <= 5; z += 2.5) { const d = boxMesh([-0.03, -0.3, -1.3], [0.03, 0.3, 1.3], M.dark, 1, 1); d.position.set(x, H - 0.5, z); d.rotation.x = 0.4; add(d); }
  }
  pipe(0, H - 0.3, -5.6, 0.08, 16, 'x', M.steel);
  pipe(0, H - 0.5, 5.6, 0.12, 16, 'x', M.dark);
  // 床の白線と黄色い通路線
  decal(-3.0, -3.7, 10.6, 0.08, M.paint, 0, 0.006);
  decal(-3.0, -0.9, 10.6, 0.08, M.paint, 0, 0.006);
  decal(-3.0, 4.0, 1.4, 1.0, M.hazard, 0, 0.007);

  // ---- 南の壁：入口と通用口 ----
  const door = (x, label) => {
    quad([x + 0.6, 0, 5.98], [-1, 0, 0], [0, 1, 0], 1.2, 2.2, [0, 0, -1], M.steel, [1.2, 2.2]);
    box([x - 0.7, 0, 5.9], [x - 0.6, 2.3, 6], M.dark, 1); box([x + 0.6, 0, 5.9], [x + 0.7, 2.3, 6], M.dark, 1); box([x - 0.7, 2.2, 5.9], [x + 0.7, 2.3, 6], M.dark, 1);
    box([x - 0.45, 1.0, 5.88], [x - 0.25, 1.06, 5.98], M.steel, 1);
    if (label) quad([x + 0.5, 2.4, 5.97], [-1, 0, 0], [0, 1, 0], 1.0, 0.3, [0, 0, -1], label, [1, 0.3]);
  };
  door(-3, sign('whExit', { w: 256, h: 80, bg: '#1e8a3a', fg: '#f0fff0', lines: [['出口　荷さばき場', 0.6]] }));
  door(5.5, null);
  // 通用口のかんぬき
  box([4.85, 1.2, 5.84], [6.15, 1.3, 5.92], M.steel, 1);
  box([5.6, 2.35, 5.88], [5.9, 2.5, 6], M.dark, 1);
  box([5.62, 2.37, 5.86], [5.88, 2.45, 5.88], M.red, 1).castShadow = false;

  // ---- 棚（2 列） ----
  const rack = (z0, z1) => {
    const x0 = -7.6, x1 = 1.5;
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 3) {
      for (const z of [z0, z1 - 0.1]) box([x - 0.05, 0, z], [x + 0.05, 5.0, z + 0.1], M.orange, 1);
      for (let y = 0.6; y < 5; y += 1.8) box([x - 0.03, y, z0 + 0.1], [x + 0.03, y + 0.05, z1 - 0.1], M.orange, 1);
    }
    for (const y of [1.55, 3.3, 5.0]) {
      for (const z of [z0, z1 - 0.12]) box([x0, y - 0.14, z], [x1, y, z + 0.12], M.blue, 1);
      box([x0, y, z0 + 0.05], [x1, y + 0.03, z1 - 0.05], M.deck, 1);
    }
    solid(x0 - 0.1, z0, x1 + 0.1, z1);
    // 積荷：パレットの上の段ボールと木箱
    const span = (x1 - x0) / 3;
    let k = 0;
    for (const y of [0, 1.58, 3.33]) {
      for (let i = 0; i < 3; i++) {
        k++;
        if ((k * 7) % 5 === 0) continue;
        const cx = x0 + span * (i + 0.5), w = span * 0.36;
        box([cx - w - 0.1, y, z0 + 0.15], [cx + w + 0.1, y + 0.14, z1 - 0.15], M.pallet, 1);
        const kind = (k * 13) % 3;
        if (kind === 0) box([cx - w, y + 0.14, z0 + 0.2], [cx + w, y + 1.15, z1 - 0.2], M.wrap, [1, 1]);
        else if (kind === 1) { box([cx - w, y + 0.14, z0 + 0.2], [cx, y + 0.84, z1 - 0.2], M.cardboard, [0.7, 0.7]); box([cx, y + 0.14, z0 + 0.25], [cx + w, y + 1.0, z1 - 0.25], M.cardboard, [0.86, 0.86]); }
        else box([cx - w * 0.8, y + 0.14, z0 + 0.25], [cx + w * 0.8, y + 1.05, z1 - 0.25], M.crate, [0.9, 0.9]);
      }
    }
  };
  rack(-6, -5);
  rack(-2.4, -1.4);
  quad([-7.55, 4.4, -1.38], [1, 0, 0], [0, 1, 0], 1.2, 0.5, [0, 0, 1], sign('rackB', { w: 256, h: 110, bg: '#d8b018', fg: '#141414', lines: [['B-2', 0.75]], dirt: 0.3 }), [1.2, 0.5]);
  quad([-7.55, 4.4, -4.98], [1, 0, 0], [0, 1, 0], 1.2, 0.5, [0, 0, 1], sign('rackA', { w: 256, h: 110, bg: '#d8b018', fg: '#141414', lines: [['B-1', 0.75]], dirt: 0.3 }), [1.2, 0.5]);
  // 棚の上段から落ちた段ボール
  box([0.2, 0, -0.9], [0.9, 0.5, -0.4], M.cardboard, 0.5).rotation.y = 0.4;
  solid(0.1, -1.0, 1.0, -0.3);
  decal(-1.2, -0.4, 0.32, 0.32, M.papers, 0.6, 0.008);

  // ---- 東：特別便のコンテナ ----
  const cx0 = 5.4, cx1 = 8.0, cz0 = -5.9, cz1 = 0;
  box([cx0, 0.15, cz0], [cx1, 2.75, cz1], M.container, [3, 2.6]);
  box([cx0 - 0.05, 0, cz0], [cx1, 0.15, cz1 + 0.05], M.dark, 1);
  // 冷却ユニット（北側）
  box([cx0 + 0.2, 2.75, cz0 + 0.2], [cx1 - 0.2, 3.25, cz0 + 1.4], M.steel, 1);
  // 中は暗い。内側から破られた扉
  quad([cx0 + 0.1, 0.16, cz1 - 0.02], [1, 0, 0], [0, 1, 0], cx1 - cx0 - 0.2, 2.5, [0, 0, 1], M.black, 1);
  const cdoor = boxMesh([0, 0, -0.04], [1.3, 2.55, 0.04], M.container, [1.3, 2.55], 4);
  cdoor.position.set(cx0, 0.18, cz1); cdoor.rotation.y = -2.2; add(cdoor);
  // もう片方は引きちぎられて床に倒れている
  const fallen = boxMesh([0, 0, -0.04], [1.3, 2.55, 0.04], M.container, [1.3, 2.55], 4);
  fallen.position.set(cx1 - 0.6, 0.08, cz1 + 2.6); fallen.rotation.set(-Math.PI / 2, 0.35, 0); add(fallen);
  solid(cx1 - 1.9, cz1 + 0.6, cx1, cz1 + 2.8);
  solid(cx0 - 0.1, cz0, 8, cz1);
  solid(cx0 - 1.1, cz1 - 0.2, cx0 + 0.1, cz1 + 1.2);
  // 内側から叩かれてできた膨らみと、引きちぎられた拘束具
  box([cx0 + 1.1, 1.4, cz1 - 0.05], [cx0 + 1.5, 1.8, cz1 + 0.05], M.steel, 1);
  for (let i = 0; i < 3; i++) { const c = boxMesh([-0.02, -0.5, -0.02], [0.02, 0.5, 0.02], M.dark, 1, 1); c.position.set(cx0 + 0.6 + i * 0.5, 0.25, cz1 + 0.5 + i * 0.3); c.rotation.set(Math.PI / 2, 0, 0.5 * i); add(c); }
  quad([cx1 - 0.1, 2.3, cz1 + 0.01], [-1, 0, 0], [0, 1, 0], 2.3, 0.3, [0, 0, 1], sign('bio', { w: 512, h: 64, bg: '#d8b018', fg: '#141414', lines: [['⚠ 生物試料　開封厳禁　VPX-0928', 0.7]], dirt: 0.4 }), [2.3, 0.3]);
  decal(6.7, 1.6, 3.2, 2.6, M.frost, 0.3, 0.007);
  decal(5.6, 0.9, 1.6, 1.2, M.blood, 0.8);
  decal(4.2, 1.6, 2.6, 0.7, M.drag, 2.8);
  wallDecal([7.98, 0.6, 3.4], [0, 0, -1], [0, 1, 0], 0.8, 0.8, [-1, 0, 0], M.hand);
  // 作業台と書類ばさみ
  solidBox([6.6, 0, 3.0], [7.9, 0.85, 3.9], M.wood, 1);
  box([6.65, 0.85, 3.05], [7.85, 0.9, 3.85], M.dark, 1);
  box([7.0, 0.9, 3.25], [7.35, 0.92, 3.6], hqMat(T.paper, { rough: 0.9 }), [0.3, 0.3]);
  box([7.1, 0.92, 3.26], [7.25, 0.95, 3.3], M.steel, 1);

  // ---- 中央：フォークリフト ----
  const fl = new THREE.Group();
  const fb = (a, b, m) => fl.add(boxMesh(a, b, m, 1, 2));
  fb([-0.6, 0.25, -1.0], [0.6, 1.2, 0.8], M.yellow);
  fb([-0.55, 1.2, -0.9], [0.55, 1.3, 0.3], M.dark);
  for (const x of [-0.55, 0.5]) fb([x, 1.2, -0.9], [x + 0.05, 2.3, -0.85], M.dark);
  for (const x of [-0.55, 0.5]) fb([x, 1.2, 0.25], [x + 0.05, 2.3, 0.3], M.dark);
  fb([-0.6, 2.3, -0.9], [0.6, 2.36, 0.3], M.dark);
  fb([-0.45, 0.05, -1.25], [0.45, 2.6, -1.05], M.dark);
  fb([-0.4, 0.05, -2.35], [-0.25, 0.1, -1.05], M.steel); fb([0.25, 0.05, -2.35], [0.4, 0.1, -1.05], M.steel);
  fb([-0.3, 1.25, 0.1], [0.3, 1.35, 0.6], M.black);
  for (const [x, z] of [[-0.62, -0.6], [0.62, -0.6], [-0.62, 0.5], [0.62, 0.5]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), M.black); w.rotation.z = Math.PI / 2; w.position.set(x, 0.28, z); fl.add(w); }
  fl.position.set(-2.4, 0, 2.6); fl.rotation.y = 0.9;
  fl.traverse((m) => { if (m.isMesh) { m.layers.set(1); m.castShadow = m.receiveShadow = true; } });
  K.scene.add(fl);
  solid(-3.4, 1.5, -1.2, 3.6);

  // ---- 南西：休憩所 ----
  solidBox([-6.9, 0, 3.6], [-5.5, 0.75, 4.6], M.wood, 1);
  box([-6.95, 0.72, 3.55], [-5.45, 0.78, 4.65], M.dark, 1);
  box([-6.6, 0.78, 3.85], [-6.2, 0.8, 4.2], hqMat(T.paper, { rough: 0.9 }), [0.3, 0.3]);
  cyl(-5.8, 0.78, 4.3, 0.045, 0.04, 0.11, M.paint, 10);
  for (const [x, z, r] of [[-6.2, 3.1, 0.2], [-5.0, 4.1, 1.7]]) {
    const ch = new THREE.Group();
    ch.add(boxMesh([-0.22, 0.42, -0.22], [0.22, 0.46, 0.22], M.blue, 1, 1));
    ch.add(boxMesh([-0.22, 0.46, 0.18], [0.22, 0.9, 0.22], M.blue, 1, 1));
    for (const [lx, lz] of [[-0.2, -0.2], [0.17, -0.2], [-0.2, 0.17], [0.17, 0.17]]) ch.add(boxMesh([lx, 0, lz], [lx + 0.03, 0.42, lz + 0.03], M.steel, 1, 1));
    ch.position.set(x, 0, z); ch.rotation.y = r;
    ch.traverse((m) => { if (m.isMesh) { m.layers.set(1); m.castShadow = m.receiveShadow = true; } });
    K.scene.add(ch);
  }
  solidBox([-7.95, 0, 1.0], [-7.15, 1.85, 1.9], M.vend, 1);
  box([-7.16, 0.9, 1.1], [-7.14, 1.7, 1.8], M.vendGlow, 1).castShadow = false;
  box([-7.95, 1.85, 1.0], [-7.15, 1.95, 1.9], M.dark, 1);
  // 消火器と避難経路図
  cyl(-7.85, 0.1, 2.6, 0.075, 0.075, 0.45, hqMat(T.extinguisher, { rough: 0.35 }), 10);
  quad([-7.98, 1.3, 3.5], [0, 0, -1], [0, 1, 0], 0.6, 0.45, [1, 0, 0], sign('evac', { w: 256, h: 192, bg: '#f0ece0', fg: '#1e8a3a', lines: [['避難経路図', 0.25], ['現在地 ●', 0.2, '#b01810']] }), [0.6, 0.45]);

  // ---- 照明（天井の水銀灯。いくつかは切れている） ----
  const bay = (x, z, on = true) => {
    box([x - 0.3, H - 0.9, z - 0.3], [x + 0.3, H - 0.75, z + 0.3], M.dark, 1);
    cyl(x, H - 0.75, z, 0.02, 0.02, 0.75, M.dark, 6);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 0.3, 14, 1, true), M.dark); shade.position.set(x, H - 1.0, z); add(shade);
    if (!on) return;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.36, 14), M.lamp); disc.rotation.x = Math.PI / 2; disc.position.set(x, H - 1.14, z); add(disc).castShadow = false;
    spot([x, H - 1.2, z], [x, 0, z], 0xd8e4ff, 70, 0.95, { penumbra: 0.8, live: { color: [0.75, 0.82, 1.0], range: 8 } });
  };
  bay(-5, -3.7); bay(-0.5, -3.7, false); bay(-4.5, 1.6); bay(0, 1.4); bay(4.0, 2.0); bay(3.2, -3.6); bay(6.8, -3.0, false);
  point([5.75, 2.2, 5.6], 0xff3020, 2, { live: { color: [0.9, 0.2, 0.1], range: 3 } });
  point([-7.0, 1.2, 1.45], 0x9ab8d0, 1.5);
  hemi(0x404858, 0x181410, 0.25);

  // ---- 実行時に描くもの ----
  const ammo = add(boxMesh([-5.3, 1.58, -1.35], [-5.0, 1.7, -1.15], ps1Material({ tint: 0x7a6a2a, emissive: 0.15 }), 10, 1), LAYER_LIVE);

  // ---- 調べられる場所 ----
  look('door:yard', -3, 5.6, 0.9);
  look('door:yardSide', 5.5, 5.6, 0.9);
  look('rackAmmo', -5.15, -1.0, 0.8);
  look('rackA', -3, -4.8, 1.6);
  look('rackB', -3, -2.6, 1.8);
  look('rackB2', -3, -1.2, 1.8);
  look('container', 6.7, 0.4, 1.4);
  look('containerSide', 5.2, -3, 1.4);
  look('cooler', 6.5, -5.0, 1.2);
  look('file:schedule', 7.2, 3.0, 0.8);
  look('forklift', -2.4, 2.6, 1.4);
  look('file:diary', -6.2, 3.4, 0.8);
  look('vending', -7.0, 1.45, 0.8);
  look('fallenDoor', 6.8, 1.8, 1.0);
  look('boxes', 0.5, -0.2, 0.7);

  return K.finish({
    id: 'warehouse', cams: CAMS,
    pickups: [{ id: 'warehouse.ammo', item: 'ammo', count: 15, mesh: ammo, at: 'rackAmmo', found: '棚の下段に、ハンドガンの弾の箱がある。' }],
    doors: {
      yard: { to: 'yard', spawn: [-3, -6.0, 0], kind: 'metal' },
      yardSide: { to: 'yard', spawn: [7.45, -6.0, 0], kind: 'metal' },
    },
    env: { rain: 0.6, ambient: [0.13, 0.13, 0.16], fog: [9, 20] },
    exposure: 1.25,
  });
}
