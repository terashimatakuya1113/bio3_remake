// 第3章：冷蔵倉庫
// 白い断熱パネルの前室。北の壁に冷凍室の扉（中にエマが立てこもっている）、中央に LZ-9 の保管ケース
import * as THREE from 'three';
import { boxMesh, ps1Material } from '../ps1.js';
import { createKit, hqMat, LAYER_LIVE } from './kit.js';
import { signTex } from '../hq2.js';

const B = { x0: -6, x1: 6, z0: -4.5, z1: 4.5 };
const H = 3.6;

const CAMS = [
  { name: 'entry', pos: [2.2, 2.9, 3.8], look: [-5.8, 0.6, -0.9], fov: 58, test: (x, z, m) => x < -1.5 + m },
  { name: 'freezer', pos: [-2.4, 2.9, 3.8], look: [2.0, 0.8, -4.5], fov: 58, test: (x, z, m) => z < 0.4 + m },
  { name: 'back', pos: [-1.8, 2.9, -3.9], look: [6.0, 0.6, 2.6], fov: 60, test: () => true },
];

export function build() {
  const K = createKit(B);
  const { T, box, quad, cyl, pipe, solid, solidBox, decal, wallDecal, walls, floor, ceiling, point, spot, hemi, look, add } = K;
  const sign = (key, opts) => hqMat(signTex(key, opts), { rough: 0.7 });
  const M = {
    panel: hqMat(T.panel, { rough: 0.45, metal: 0.05 }),
    plate: hqMat(T.plate, { rough: 0.35, metal: 0.55 }),
    ceil: hqMat(T.panel, { rough: 0.6, color: 0xb8c0c4 }),
    steel: hqMat(T.metal, { rough: 0.3, metal: 0.7, color: 0xa8b0b8 }),
    dark: hqMat(T.metal, { rough: 0.5, metal: 0.4, color: 0x3a3e42 }),
    wire: hqMat(T.metal, { rough: 0.4, metal: 0.6, color: 0x9aa0a4 }),
    cardboard: hqMat(T.cardboard, { rough: 0.9 }),
    whiteBox: hqMat(null, { rough: 0.6, color: 0xd8d8d0 }),
    blueBin: hqMat(null, { rough: 0.5, color: 0x2a5a9a }),
    frost: hqMat(T.frost, { rough: 0.1, alpha: true, color: 0x7a8894 }),
    blood: hqMat(T.blood, { rough: 0.2, alpha: true }),
    strip: hqMat(null, { rough: 0.1, metal: 0.1, color: 0x8ab0b8, alpha: false }),
    black: hqMat(null, { rough: 0.6, color: 0x121212 }),
    tube: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    hazard: hqMat(T.hazard, { rough: 0.6 }),
    yellow: hqMat(null, { rough: 0.5, color: 0xd8b018 }),
    case: hqMat(T.metal, { rough: 0.3, metal: 0.6, color: 0x5a6068 }),
    vial: hqMat(null, { rough: 0.05, metal: 0.2, color: 0x7ad0a0, emissive: 0x0a2a14 }),
  };
  M.strip.transparent = true; M.strip.opacity = 0.45;

  floor(M.plate, 1.2);
  walls(M.panel, H, 4);
  ceiling(M.ceil, H, 2);
  // 床の霜と、排水溝
  decal(-0.5, -2.5, 4.5, 2.5, M.frost, 0.3, 0.007);
  decal(3.5, 3.0, 3.0, 2.0, M.frost, 1.8, 0.007);
  box([-6, 0, -0.5], [6, 0.01, -0.35], M.dark, 1);
  // 天井の冷却ダクトと配管
  box([-5.5, H - 0.5, -3.2], [5.5, H - 0.1, -2.6], M.steel, 1);
  for (let x = -4.5; x <= 4.5; x += 3) box([x - 0.25, H - 0.55, -3.1], [x + 0.25, H - 0.5, -2.7], M.dark, 1);
  pipe(0, H - 0.25, 4.2, 0.07, 12, 'x', M.steel);
  pipe(5.7, H - 0.3, 0, 0.05, 9, 'z', M.steel);

  // ---- 西：荷さばき場への扉とビニールカーテン ----
  quad([-5.98, 0, 0.6], [0, 0, -1], [0, 1, 0], 1.2, 2.2, [1, 0, 0], M.steel, [1.2, 2.2]);
  box([-6, 0, 0.6], [-5.9, 2.3, 0.7], M.dark, 1); box([-6, 0, -0.7], [-5.9, 2.3, -0.6], M.dark, 1); box([-6, 2.2, -0.7], [-5.9, 2.3, 0.7], M.dark, 1);
  for (let i = 0; i < 6; i++) {
    const st = boxMesh([-0.005, 0, -0.1], [0.005, 2.15, 0.1], M.strip, 1, 1);
    st.position.set(-5.82, 0.05, -0.55 + i * 0.22); st.rotation.y = (i % 2 ? 0.08 : -0.06); add(st).castShadow = false;
  }
  box([-5.85, 2.18, -0.65], [-5.78, 2.24, 0.65], M.steel, 1);

  // ---- 北：冷凍室の扉 ----
  box([0.6, 0, -4.5], [3.0, 2.6, -4.38], M.dark, 1);
  quad([0.8, 2.75, -4.37], [1, 0, 0], [0, 1, 0], 2.0, 0.42, [0, 0, 1], sign('freezer', { w: 256, h: 64, bg: '#1a4a8a', fg: '#f0f0f0', lines: [['冷凍室　－20℃', 0.62]] }), [2.0, 0.42]);
  // 扉の横の温度計とインターホン
  box([3.2, 1.3, -4.5], [3.55, 1.7, -4.42], M.whiteBox, 1);
  box([3.25, 1.45, -4.43], [3.5, 1.6, -4.41], new THREE.MeshBasicMaterial({ color: 0xff5030 }), 1).castShadow = false;
  box([0.15, 1.2, -4.5], [0.45, 1.55, -4.42], M.steel, 1);
  decal(1.8, -3.9, 2.4, 0.6, M.hazard, 0, 0.008);

  // ---- 東：裏口 ----
  quad([5.98, 0, 2.0], [0, 0, 1], [0, 1, 0], 1.2, 2.2, [-1, 0, 0], M.steel, [1.2, 2.2]);
  box([5.9, 0, 1.9], [6, 2.3, 2.0], M.dark, 1); box([5.9, 0, 3.2], [6, 2.3, 3.3], M.dark, 1); box([5.9, 2.2, 1.9], [6, 2.3, 3.3], M.dark, 1);
  box([5.88, 1.0, 2.2], [5.95, 1.06, 3.0], M.steel, 1);
  quad([5.97, 2.4, 2.1], [0, 0, 1], [0, 1, 0], 1.0, 0.3, [-1, 0, 0], sign('exitG', { w: 256, h: 80, bg: '#1e8a3a', fg: '#f0fff0', lines: [['非常口', 0.7]] }), [1, 0.3]);
  // 鎖（イベントのあとは外れる）

  // ---- 南：棚 ----
  const shelf = (x0, x1) => {
    for (const x of [x0, x1 - 0.05]) for (const z of [3.5, 4.4]) box([x, 0, z], [x + 0.05, 2.2, z + 0.05], M.wire, 1);
    for (const y of [0.15, 0.85, 1.55, 2.15]) box([x0, y, 3.5], [x1, y + 0.03, 4.45], M.wire, 1);
    solid(x0, 3.45, x1, 4.5);
  };
  shelf(-5.5, -3.0); shelf(-2.6, -0.1); shelf(0.3, 2.8);
  const stock = [[-5.3, 0.18, 'c'], [-4.2, 0.18, 'b'], [-5.2, 0.88, 'w'], [-4.0, 1.58, 'c'], [-2.4, 0.18, 'b'], [-1.3, 0.88, 'c'], [-2.3, 1.58, 'w'], [0.5, 0.18, 'w'], [1.6, 0.88, 'b'], [0.6, 1.58, 'c'], [1.8, 1.58, 'w']];
  for (const [x, y, k] of stock) {
    const m = k === 'c' ? M.cardboard : k === 'b' ? M.blueBin : M.whiteBox;
    box([x, y, 3.6], [x + 0.9, y + (k === 'b' ? 0.4 : 0.55), 4.35], m, [0.6, 0.5]);
  }
  quad([-4.6, 2.6, 4.48], [-1, 0, 0], [0, 1, 0], 1.6, 0.36, [0, 0, -1], sign('cold2', { w: 256, h: 64, bg: '#f0f0f0', fg: '#1a1a1a', lines: [['医薬品　要冷蔵　2〜8℃', 0.55]] }), [1.6, 0.36]);

  // ---- 中央：LZ-9 の保管ケースを載せたステンレス台 ----
  solidBox([2.4, 0, 0.5], [4.5, 0.9, 1.6], M.steel, 1);
  box([2.35, 0.88, 0.45], [4.55, 0.93, 1.65], M.steel, 1);
  box([2.6, 0.93, 0.65], [3.9, 1.18, 1.45], M.case, 1);
  const lid = boxMesh([0, 0, -0.02], [1.3, 0.8, 0.02], M.case, 1, 1);
  lid.position.set(2.6, 1.18, 0.65); lid.rotation.x = -1.2; add(lid);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) cyl(2.75 + i * 0.15, 1.12, 0.8 + j * 0.25, 0.025, 0.025, 0.14, M.vial, 6);
  quad([2.6, 0.96, 1.46], [1, 0, 0], [0, 1, 0], 1.3, 0.2, [0, 0, 1], sign('lz9', { w: 256, h: 40, bg: '#d8b018', fg: '#141414', lines: [['LZ-9 ／ VESPER', 0.75]], dirt: 0.2 }), [1.3, 0.2]);
  // 台車とパレット
  solidBox([-3.6, 0, -3.9], [-2.2, 0.14, -2.6], hqMat(T.wood, { rough: 0.8 }), 1);
  box([-3.5, 0.14, -3.8], [-2.3, 1.1, -2.7], hqMat(T.cardboard, { rough: 0.3, metal: 0.1, color: 0xd8d8d8 }), [1, 1]);
  solidBox([4.3, 0, -3.9], [5.6, 1.0, -2.8], hqMat(T.crate, { rough: 0.8 }), [1.3, 1]);
  decal(-0.6, 1.4, 1.6, 1.2, M.blood, 0.5);

  // ---- 照明：冷たい蛍光灯 ----
  const tubes = [];
  for (const [x, z] of [[-3.5, -1.2], [0, -1.2], [3.5, -1.2], [-3.5, 2.2], [0, 2.2], [3.5, 2.2]]) {
    box([x - 0.75, H - 0.1, z - 0.12], [x + 0.75, H, z + 0.12], M.steel, 1);
    tubes.push(box([x - 0.7, H - 0.14, z - 0.04], [x + 0.7, H - 0.1, z + 0.04], M.tube, 1));
  }
  for (const t of tubes) t.castShadow = false;
  const fl = [];
  for (const [x, z] of [[-2.5, 0.5], [2.5, 0.5]]) fl.push(point([x, H - 0.3, z], 0xe0f0ff, 14, { shadow: true, size: 512 }));
  const keyL = spot([1.8, H - 0.2, -2.0], [1.8, 0, -3.6], 0xd8ecff, 14, 0.9, { penumbra: 0.8 });
  hemi(0x8ab0c8, 0x202830, 0.35);
  point([5.6, 2.4, 2.6], 0x40ff60, 0.6);
  K.live.push({ pos: [-3, 3.2, 0.5], color: [0.75, 0.85, 1.0], range: 6 }, { pos: [3, 3.2, 0.5], color: [0.75, 0.85, 1.0], range: 6 }, { pos: [1.8, 3.2, -2.5], color: [0.7, 0.8, 0.95], range: 5 });

  // ---- 実行時に描くもの ----
  const freezerDoor = add(boxMesh([0.75, 0, -4.38], [2.85, 2.5, -4.3], ps1Material({ tint: 0xa8b0b8, emissive: 0.1 }), 1, 1), LAYER_LIVE);
  const handle = add(boxMesh([2.5, 1.0, -4.3], [2.6, 1.5, -4.24], ps1Material({ tint: 0x303030 }), 1, 1), LAYER_LIVE);
  const chain = add(boxMesh([5.86, 0.9, 2.05], [5.9, 1.2, 3.15], ps1Material({ tint: 0x707070, emissive: 0.1 }), 1, 1), LAYER_LIVE);
  // 割れたアンプルと薬液（イベントのあと）
  const spill = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const g = boxMesh([-0.04, 0, -0.02], [0.04, 0.01, 0.02], ps1Material({ tint: 0x9ae0b8, emissive: 0.4, opacity: 0.8 }), 1, 1);
    g.position.set(2.2 + Math.random() * 1.6, 0.01, 1.7 + Math.random() * 0.8); g.rotation.y = Math.random() * 3;
    spill.add(g);
  }
  const pool = boxMesh([-0.6, 0, -0.4], [0.6, 0.005, 0.4], ps1Material({ tint: 0x5ab080, emissive: 0.3, opacity: 0.55 }), 1, 1);
  pool.position.set(3.0, 0.008, 2.1); spill.add(pool);
  spill.traverse((m) => m.layers.set(LAYER_LIVE));
  spill.visible = false;
  K.scene.add(spill);
  const medkit = new THREE.Group();
  medkit.add(boxMesh([-0.16, 0, -0.11], [0.16, 0.16, 0.11], ps1Material({ tint: 0xe8e4d8, emissive: 0.2 }), 1, 1));
  medkit.add(boxMesh([-0.035, 0.161, -0.09], [0.035, 0.165, 0.09], ps1Material({ tint: 0xc01810, emissive: 0.35 }), 1, 1));
  medkit.add(boxMesh([-0.1, 0.161, -0.03], [0.1, 0.165, 0.03], ps1Material({ tint: 0xc01810, emissive: 0.35 }), 1, 1));
  medkit.position.set(-1.0, 0.88, 3.9);
  medkit.traverse((m) => m.layers.set(LAYER_LIVE));
  K.scene.add(medkit);
  const ammo = add(boxMesh([4.6, 1.0, -3.5], [4.9, 1.12, -3.3], ps1Material({ tint: 0x7a6a2a, emissive: 0.15 }), 10, 1), LAYER_LIVE);

  look('door:yard', -5.6, 0, 0.9);
  look('freezer', 1.8, -4.0, 1.2);
  look('thermo', 3.4, -4.1, 0.6);
  look('door:back', 5.6, 2.6, 0.9);
  look('lzcase', 3.4, 0.2, 1.0);
  look('lzcase', 3.4, 1.9, 1.0);
  look('shelfMed', -1.0, 3.2, 0.8);
  look('shelves', -4.2, 3.2, 1.2);
  look('shelves', 1.5, 3.2, 1.2);
  look('ammoCrate', 4.9, -2.6, 0.8);
  look('pallet', -2.9, -2.5, 0.9);
  look('blood', -0.6, 1.4, 0.8);

  return K.finish({
    id: 'cold', cams: CAMS,
    objects: { freezerDoor, handle, chain, spill },
    pickups: [
      { id: 'cold.medkit', item: 'herb', mesh: medkit, at: 'shelfMed', found: '棚に、応急パックが置いてある。' },
      { id: 'cold.ammo', item: 'ammo', count: 10, mesh: ammo, at: 'ammoCrate', found: '木箱の上に、ハンドガンの弾がある。' },
    ],
    doors: {
      yard: { to: 'yard', spawn: [9.0, -2, -Math.PI / 2], kind: 'metal' },
      back: { to: 'yard', spawn: [7.8, 0.9, -Math.PI / 2], kind: 'metal', lock: 'flag:backOpen', lockedText: ['非常口だ。', 'ノブに鎖が巻きつけてある。\n内側から誰かが封じたらしい。'] },
    },
    bake: {
      variant(on) {
        for (const l of fl) l.intensity = l.userData.base * (on ? 1 : 0.05);
        keyL.intensity = keyL.userData.base * (on ? 1 : 0.3);
        for (const t of tubes) t.material.color.setScalar(on ? 1 : 0.2);
      },
    },
    env: { rain: 0.3, flicker: 'on', ambient: [0.1, 0.12, 0.15], ambientLit: [0.14, 0.16, 0.2], fog: [8, 16] },
    exposure: 1.05,
  });
}
