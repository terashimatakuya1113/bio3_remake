// 第4章後半：正門の検問所（屋外）
// 北の金網の門から入る。東西に走る道路、遮断機と詰所、回収課の黒いバン。東へ進むと貨物ヤード
import * as THREE from 'three';
import { boxMesh, ps1Material } from '../ps1.js';
import { createKit, hqMat, makeRain, LAYER_LIVE } from './kit.js';
import { signTex } from '../hq2.js';

const B = { x0: -10, x1: 10, z0: -6, z1: 6 };

const CAMS = [
  { name: 'gate', pos: [1.8, 3.4, 2.6], look: [-6.0, 0.6, -5.6], fov: 60, test: (x, z, m) => x < -1.0 + m && z < -1.6 + m },
  { name: 'van', pos: [3.2, 3.0, -3.6], look: [-6.4, 0.6, 3.6], fov: 60, test: (x, z, m) => x < -1.0 + m },
  { name: 'booth', pos: [-2.6, 3.2, 4.8], look: [6.0, 0.6, -4.0], fov: 60, test: (x, z, m) => x < 5.2 + m && z < 0.6 + m },
  { name: 'road', pos: [-3.4, 3.6, -3.4], look: [9.6, 0.6, 3.6], fov: 58, test: () => true },
  { name: 'standoff', pos: [4.2, 1.7, -2.4], look: [-3.2, 1.0, 1.8], fov: 54, test: () => false },
];

export function build() {
  const K = createKit(B);
  const { T, box, quad, cyl, pipe, solid, solidBox, decal, point, spot, hemi, look, add } = K;
  const sign = (key, opts) => hqMat(signTex(key, opts), { rough: 0.7 });
  const M = {
    asphalt: hqMat(T.asphalt, { rough: 0.22, metal: 0.1 }),
    gravel: hqMat(T.gravel, { rough: 0.95 }),
    concrete: hqMat(T.concrete, { rough: 0.85 }),
    block: hqMat(T.block, { rough: 0.9 }),
    chain: hqMat(T.chain, { rough: 0.4, metal: 0.6, alpha: true }),
    pole: hqMat(T.metal, { rough: 0.5, metal: 0.6, color: 0x6a6e70 }),
    dark: hqMat(T.metal, { rough: 0.5, metal: 0.4, color: 0x3a3e42 }),
    black: hqMat(null, { rough: 0.6, color: 0x121212 }),
    van: hqMat(T.metal, { rough: 0.25, metal: 0.5, color: 0x16181c }),
    glass: hqMat(null, { rough: 0.05, metal: 0.4, color: 0x0a1018, emissive: 0x020306 }),
    tyre: hqMat(null, { rough: 0.85, color: 0x141414 }),
    redwhite: hqMat(T.redwhite, { rough: 0.6 }),
    booth: hqMat(T.panel, { rough: 0.5, color: 0xd8d4c4 }),
    sand: hqMat(T.cardboard, { rough: 1, color: 0x8a7a5a }),
    lineM: hqMat(null, { rough: 0.5, color: 0xc8b450 }),
    blood: hqMat(T.blood, { rough: 0.2, alpha: true }),
    drag: hqMat(T.drag, { rough: 0.25, alpha: true }),
    winLit: new THREE.MeshBasicMaterial({ color: 0x7a6a48 }),
    head: new THREE.MeshBasicMaterial({ color: 0xfff4d8 }),
    tail: new THREE.MeshBasicMaterial({ color: 0xff2010 }),
    sodium: new THREE.MeshBasicMaterial({ color: 0xffb060 }),
    flood: new THREE.MeshBasicMaterial({ color: 0xf0f4ff }),
    trees: hqMat(null, { rough: 1, color: 0x06080a }),
    green: hqMat(T.metal, { rough: 0.6, metal: 0.3, color: 0x3a4a30 }),
  };
  M.chain.side = THREE.DoubleSide;

  // ---- 地面：砂利の路肩と、東西に走る道路 ----
  quad([-14, 0, 10], [1, 0, 0], [0, 0, -1], 28, 18, [0, 1, 0], M.gravel, 3);
  quad([-14, 0.005, 4.2], [1, 0, 0], [0, 0, -1], 28, 4.8, [0, 1, 0], M.asphalt, 4);
  for (let i = 0; i < 9; i++) decal(-9 + i * 2.4, 1.8, 1.2, 0.12, M.lineM, 0, 0.008);
  // 構内の舗装（門から道路まで）
  quad([-6, 0.004, -0.6], [1, 0, 0], [0, 0, -1], 4, 5.4, [0, 1, 0], M.concrete, 2);

  // ---- 北：金網のフェンスと門（荷さばき場へ） ----
  const fence = (x0, x1) => quad([x0, 0, -6], [1, 0, 0], [0, 1, 0], x1 - x0, 3, [0, 0, 1], M.chain, [1.2, 1.2]);
  fence(-14, -5.5); fence(-2.5, 14);
  for (let x = -12; x <= 12; x += 2.5) if (x < -5.6 || x > -2.4) cyl(x, 0, -6, 0.05, 0.05, 3.1, M.pole, 8);
  pipe(0, 3.0, -6, 0.04, 28, 'x', M.pole);
  // 開いた門
  for (const [x, r] of [[-5.5, 1.2], [-2.5, -1.2 - Math.PI]]) {
    const g = boxMesh([0, 0, -0.02], [1.5, 2.4, 0.02], M.chain, 1, 4); g.position.set(x, 0.05, -6); g.rotation.y = r; add(g);
  }
  for (const x of [-5.55, -2.45]) cyl(x, 0, -6, 0.08, 0.08, 2.6, M.pole, 8);
  // フェンスの向こうは構内の明かり
  quad([-14, 0, -12], [1, 0, 0], [0, 1, 0], 28, 7, [0, 0, 1], hqMat(null, { rough: 1, color: 0x0a0c10 }), 1);
  quad([-14, 0, -9], [1, 0, 0], [0, 1, 0], 9, 3.4, [0, 0, 1], M.block, [4, 4]);
  quad([-11, 1.1, -8.98], [1, 0, 0], [0, 1, 0], 1.6, 1.0, [0, 0, 1], M.winLit, 1);
  solid(-14, -6.2, -5.6, -5.9); solid(-2.4, -6.2, 14, -5.9);

  // ---- 遮断機と詰所 ----
  solidBox([4.6, 0, -2.8], [6.8, 2.6, -0.8], M.booth, [2, 2.6]);
  box([4.5, 2.6, -2.9], [6.9, 2.8, -0.7], M.dark, 1);
  quad([4.59, 1.1, -1.0], [0, 0, -1], [0, 1, 0], 1.6, 0.9, [-1, 0, 0], M.winLit, 1);
  quad([5.0, 2.0, -0.79], [1, 0, 0], [0, 1, 0], 1.4, 0.4, [0, 0, 1], sign('gateSign', { w: 256, h: 72, bg: '#e8e4d8', fg: '#1a1a1a', lines: [['正門　受付', 0.62]] }), [1.4, 0.4]);
  // 遮断機（上がったまま折れている）
  solidBox([4.2, 0, -0.6], [4.6, 1.0, -0.2], M.dark, 1);
  const arm = boxMesh([0, -0.05, -0.05], [4.2, 0.05, 0.05], M.redwhite, [4.2, 0.1], 4);
  arm.position.set(4.4, 1.0, -0.4); arm.rotation.z = 2.2; arm.rotation.y = -0.15; add(arm);
  const arm2 = boxMesh([0, -0.05, -0.05], [2.0, 0.05, 0.05], M.redwhite, [2, 0.1], 4);
  arm2.position.set(3.0, 0.05, 1.4); arm2.rotation.y = 0.5; add(arm2);
  // 州兵の置き土産：コンクリートの車止めと土のう
  for (const [x, z, r] of [[8.4, 0.2, 0.1], [8.6, 3.6, -0.2]]) { const b = boxMesh([-0.9, 0, -0.3], [0.9, 0.8, 0.3], M.concrete, 1, 4); b.position.set(x, 0, z); b.rotation.y = r; add(b); solid(x - 0.9, z - 0.35, x + 0.9, z + 0.35); }
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) box([-9.4 + i * 0.62, j * 0.3, 4.6 + (j % 2) * 0.1], [-8.84 + i * 0.62, j * 0.3 + 0.3, 5.2 + (j % 2) * 0.1], M.sand, [0.6, 0.3]);
  solid(-9.5, 4.5, -6.3, 5.3);
  quad([7.6, 1.4, 5.2], [1, 0, 0], [0, 1, 0], 2.2, 0.8, [0, 0, -1], sign('closed', { w: 384, h: 140, bg: '#e8d020', fg: '#141414', lines: [['封鎖区域', 0.4], ['これより先　立入禁止　州兵', 0.22]], border: '#141414' }), [2.2, 0.8]);
  cyl(7.7, 0, 5.22, 0.05, 0.05, 2.2, M.pole, 6); cyl(9.7, 0, 5.22, 0.05, 0.05, 2.2, M.pole, 6);

  // ---- 回収課の黒いバン（西） ----
  const vx = -6.8, vz = 2.4;
  box([vx - 2.4, 0.45, vz - 0.95], [vx + 1.6, 2.4, vz + 0.95], M.van, 1);
  box([vx + 1.6, 0.45, vz - 0.95], [vx + 2.5, 1.5, vz + 0.95], M.van, 1);
  quad([vx + 1.62, 1.55, vz + 0.85], [0, 0, -1], [0, 1, 0], 1.7, 0.75, [1, 0, 0], M.glass, 1);
  quad([vx + 0.4, 1.55, vz - 0.96], [1, 0, 0], [0, 1, 0], 1.1, 0.6, [0, 0, -1], M.glass, 1);
  for (const z of [vz - 0.7, vz + 0.55]) box([vx + 2.5, 0.85, z], [vx + 2.55, 1.05, z + 0.15], M.head, 1).castShadow = false;
  for (const z of [vz - 0.8, vz + 0.6]) box([vx - 2.45, 1.2, z], [vx - 2.4, 1.45, z + 0.2], M.tail, 1).castShadow = false;
  for (const x of [vx - 1.6, vx + 1.6]) for (const z of [vz - 0.95, vz + 0.95]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 14), M.tyre); w.rotation.x = Math.PI / 2; w.position.set(x, 0.4, z); add(w); }
  // 開いた横の扉
  const sd = boxMesh([0, 0, -0.03], [1.2, 1.8, 0.03], M.van, 1, 4); sd.position.set(vx - 1.0, 0.5, vz - 0.98); sd.rotation.y = 0.5; add(sd);
  solid(vx - 2.45, vz - 1.0, vx + 2.55, vz + 1.0);
  // ヘッドライトが道路を照らす
  spot([vx + 2.6, 0.95, vz], [vx + 10, 0, vz + 0.4], 0xfff0d0, 60, 0.45, { penumbra: 0.5, live: { color: [1, 0.95, 0.8], range: 9 } });

  // ---- 投光器 ----
  cyl(-1.2, 0, 4.9, 0.06, 0.08, 3.6, M.pole, 6);
  box([-1.5, 3.6, 4.7], [-0.9, 4.0, 5.1], M.dark, 1);
  box([-1.45, 3.62, 4.68], [-0.95, 3.98, 4.7], M.flood, 1).castShadow = false;
  spot([-1.2, 3.8, 4.6], [-1.5, 0, 0.5], 0xe8f0ff, 90, 0.8, { penumbra: 0.6, size: 2048, live: { color: [0.85, 0.9, 1.0], range: 10 } });
  solid(-1.4, 4.7, -1.0, 5.1);
  // 街灯
  const lamp = (x, z) => {
    cyl(x, 0, z, 0.09, 0.12, 6.0, M.pole, 8);
    box([x - 0.08, 5.9, z - 0.08], [x + 0.08, 6.0, z - 0.9], M.pole, 1);
    box([x - 0.18, 5.8, z - 1.1], [x + 0.18, 5.95, z - 0.5], M.dark, 1);
    box([x - 0.14, 5.78, z - 1.05], [x + 0.14, 5.8, z - 0.55], M.sodium, 1).castShadow = false;
    solid(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
    spot([x, 5.7, z - 0.8], [x, 0, z - 0.8], 0xff9a48, 140, 0.95, { penumbra: 0.7, live: { color: [1.0, 0.62, 0.3], range: 9 } });
  };
  lamp(2.4, 5.4);
  point([5.7, 2.4, -0.6], 0xffe0b0, 5, { shadow: true, live: { color: [1, 0.85, 0.65], range: 4 } });

  // 道の南側は暗い林
  quad([-14, 0, 6.6], [1, 0, 0], [0, 1, 0], 28, 6, [0, 0, -1], M.trees, 1);
  for (let i = 0; i < 14; i++) cyl(-13 + i * 2 + (i % 3) * 0.4, 0, 6.8 + (i % 2) * 0.6, 0.12, 0.2, 7, M.trees, 6);
  solid(-14, 5.9, 14, 7);

  // 道の上の惨状：撃たれた職員、血の跡
  decal(-2.0, 2.8, 2.4, 1.6, M.blood, 0.8);
  decal(1.4, 0.4, 2.8, 0.8, M.drag, -0.3);

  // ---- 月明かり ----
  const moon = new THREE.DirectionalLight(0x6a7ea8, 0.9);
  moon.position.set(-8, 14, -10); moon.target.position.set(0, 0, 0);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
  moon.shadow.bias = -0.0015;
  K.scene.add(moon, moon.target); K.lights.push(moon);
  hemi(0x4a5a7a, 0x14141a, 0.7);
  spot([-1.0, 5.5, -2.0], [-6.5, 0, 2.0], 0xd8e4ff, 70, 0.7, { penumbra: 0.7, live: { color: [0.8, 0.85, 1.0], range: 9 } });
  spot([-4.0, 5.0, -2.0], [-4.0, 0, -5.4], 0xffd8a0, 40, 0.7, { penumbra: 0.7, shadow: false });

  const rain = makeRain(K.scene, { x0: -10, x1: 10, z0: -6, z1: 6, h: 6 }, 1100);

  // ---- 実行時に描くもの ----
  const ammo = add(boxMesh([5.0, 0.0, -0.6], [5.3, 0.12, -0.4], ps1Material({ tint: 0x7a6a2a, emissive: 0.15 }), 10, 1), LAYER_LIVE);

  look('door:yard', -4, -5.5, 1.2);
  look('booth', 5.7, -0.5, 1.2);
  look('ammoBooth', 5.15, -0.3, 0.6);
  look('van', -4.2, 2.4, 1.2);
  look('vanSide', -7.6, 1.2, 1.2);
  look('barrier', 8.4, 1.2, 1.4);
  look('closedSign', 8.6, 4.6, 1.2);
  look('door:freight', 9.4, 2.0, 1.4);
  look('sandbags', -7.8, 4.2, 1.2);
  look('flood', -1.2, 4.4, 0.8);

  return K.finish({
    id: 'checkpoint', cams: CAMS,
    pickups: [{ id: 'checkpoint.ammo', item: 'ammo', count: 15, mesh: ammo, at: 'ammoBooth', found: '詰所の前に、弾薬の箱が落ちている。' }],
    doors: {
      yard: { to: 'yard', spawn: [5.5, 5.9, Math.PI], kind: 'gate' },
      freight: { to: 'freight', spawn: [-9.0, 1.0, Math.PI / 2], kind: 'gate', lock: 'flag:checkpointClear', lockedText: ['道の先は、貨物ヤードへ続いている。', '……今は、ここを離れられない。'] },
    },
    objects: { rain },
    env: { rain: 1.8, ambient: [0.12, 0.12, 0.16], lightning: { pos: [0, 9, 0], base: [0.08, 0.1, 0.16], range: 26, boost: 1.4, bg: 0.6 }, fog: [10, 26], tension: 1.6 },
    exposure: 1.8,
    tick(dt) { rain.update(dt); },
  });
}
