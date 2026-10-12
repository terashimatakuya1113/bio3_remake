// 第4章：守衛室・無線室
// 狭い部屋。東の壁に大きな無線機、南に監視モニター、西にロッカー。北の扉から荷さばき場へ出る
import * as THREE from 'three';
import { boxMesh, ps1Material } from '../ps1.js';
import { createKit, hqMat, LAYER_LIVE } from './kit.js';
import { signTex } from '../hq2.js';

const B = { x0: -3.2, x1: 3.2, z0: -2.6, z1: 2.6 };
const H = 2.7;

const CAMS = [
  { name: 'door', pos: [2.7, 2.35, 2.2], look: [-2.2, 0.7, -2.0], fov: 60, test: (x, z, m) => z < -0.4 + m && x < 0.6 + m },
  { name: 'radio', pos: [-2.7, 2.3, -2.1], look: [2.4, 0.8, 1.4], fov: 60, test: (x, z, m) => x > -0.2 - m },
  { name: 'lockers', pos: [2.6, 2.3, -2.2], look: [-2.6, 0.7, 1.8], fov: 60, test: () => true },
];

export function build() {
  const K = createKit(B);
  const { T, box, quad, cyl, solid, solidBox, decal, walls, floor, ceiling, point, spot, hemi, look, add } = K;
  const sign = (key, opts) => hqMat(signTex(key, opts), { rough: 0.7 });
  const M = {
    wall: hqMat(T.wall, { rough: 0.85 }),
    floor: hqMat(T.floor, { rough: 0.5 }),
    ceil: hqMat(T.ceiling, { rough: 0.9 }),
    steel: hqMat(T.metal, { rough: 0.45, metal: 0.55, color: 0x8a9298 }),
    dark: hqMat(T.metal, { rough: 0.5, metal: 0.4, color: 0x3a3e42 }),
    desk: hqMat(T.metal, { rough: 0.5, metal: 0.3, color: 0x6a7068 }),
    top: hqMat(T.woodDark, { rough: 0.6 }),
    radio: hqMat(T.radio, { rough: 0.5, metal: 0.3 }),
    screen: hqMat(T.screen, { rough: 0.2, emissive: 0x18301e }),
    locker: hqMat(T.locker, { rough: 0.5, metal: 0.4 }),
    paper: hqMat(T.papers, { rough: 0.9 }),
    cork: hqMat(T.cork, { rough: 0.9 }),
    black: hqMat(null, { rough: 0.6, color: 0x141414 }),
    blind: hqMat(null, { rough: 0.6, color: 0xb8b2a0 }),
    night: new THREE.MeshBasicMaterial({ color: 0x0c1018 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffe8c0 }),
    red: new THREE.MeshBasicMaterial({ color: 0xff3020 }),
    green: new THREE.MeshBasicMaterial({ color: 0x40ff60 }),
    chair: hqMat(T.leather, { rough: 0.6 }),
    telex: hqMat(null, { rough: 0.5, color: 0xc8c0a8 }),
    blood: hqMat(T.blood, { rough: 0.2, alpha: true }),
  };

  floor(M.floor, 1.2);
  walls(M.wall, H, 4);
  ceiling(M.ceil, H, 2);
  box([-3.2, 0, -2.6], [3.2, 0.1, -2.55], M.dark, 1);

  // ---- 北：扉と窓（荷さばき場が見える） ----
  quad([-1.6, 0, -2.58], [1, 0, 0], [0, 1, 0], 1.2, 2.15, [0, 0, 1], M.steel, [1.2, 2.15]);
  box([-1.7, 0, -2.6], [-1.6, 2.25, -2.5], M.dark, 1); box([-0.4, 0, -2.6], [-0.3, 2.25, -2.5], M.dark, 1); box([-1.7, 2.15, -2.6], [-0.3, 2.25, -2.5], M.dark, 1);
  box([-0.6, 0.95, -2.57], [-0.45, 1.05, -2.5], M.steel, 1);
  quad([0.4, 1.0, -2.59], [1, 0, 0], [0, 1, 0], 2.2, 1.0, [0, 0, 1], M.night, 1);
  for (let i = 0; i < 9; i++) box([0.4, 1.02 + i * 0.11, -2.56], [2.6, 1.05 + i * 0.11, -2.52], M.blind, 1);
  box([0.35, 0.95, -2.6], [2.65, 1.0, -2.45], M.dark, 1);

  // ---- 東：無線機の机 ----
  solidBox([2.2, 0, -1.6], [3.2, 0.78, 1.6], M.desk, 1);
  box([2.15, 0.76, -1.65], [3.2, 0.8, 1.65], M.top, 1);
  box([2.75, 0.8, -1.2], [3.15, 1.35, 0.4], M.radio, [0.4, 0.55]);
  box([2.8, 1.35, -1.1], [3.15, 1.75, 0.3], M.radio, [0.35, 0.4]);
  for (let i = 0; i < 5; i++) box([2.74, 1.1, -1.0 + i * 0.25], [2.75, 1.14, -0.9 + i * 0.25], i % 2 ? M.green : M.red, 1).castShadow = false;
  // マイク
  cyl(2.45, 0.8, -0.3, 0.06, 0.08, 0.04, M.black, 8);
  cyl(2.45, 0.84, -0.3, 0.012, 0.012, 0.22, M.steel, 6);
  box([2.41, 1.05, -0.34], [2.49, 1.13, -0.26], M.black, 1);
  // テレックス
  box([2.35, 0.8, 0.6], [3.1, 1.05, 1.5], M.telex, 1);
  box([2.6, 1.05, 0.75], [2.95, 1.3, 0.78], M.paper, 1);
  quad([3.18, 1.9, -1.4], [0, 0, 1], [0, 1, 0], 1.4, 0.6, [-1, 0, 0], M.cork, 1);
  quad([3.17, 2.0, -1.3], [0, 0, 1], [0, 1, 0], 0.5, 0.4, [-1, 0, 0], M.paper, 1);
  quad([3.17, 1.95, -0.6], [0, 0, 1], [0, 1, 0], 0.4, 0.45, [-1, 0, 0], M.paper, 1);
  // 椅子
  const chair = (x, z, r) => {
    const g = new THREE.Group();
    g.add(boxMesh([-0.24, 0.42, -0.24], [0.24, 0.5, 0.24], M.chair, 1, 1));
    g.add(boxMesh([-0.24, 0.5, 0.2], [0.24, 1.0, 0.26], M.chair, 1, 1));
    g.add(boxMesh([-0.03, 0, -0.03], [0.03, 0.42, 0.03], M.steel, 1, 1));
    g.position.set(x, 0, z); g.rotation.y = r;
    g.traverse((m) => { m.castShadow = true; m.receiveShadow = true; });
    add(g);
  };
  chair(1.75, -0.4, -Math.PI / 2 + 0.2);

  // ---- 南：監視モニターの棚 ----
  solidBox([-1.4, 0, 2.0], [1.8, 0.8, 2.6], M.desk, 1);
  box([-1.45, 0.78, 1.95], [1.85, 0.82, 2.6], M.top, 1);
  for (let i = 0; i < 4; i++) {
    const x = -1.3 + i * 0.78;
    box([x, 0.82, 2.15], [x + 0.7, 1.4, 2.55], M.dark, 1);
    quad([x + 0.05, 0.87, 2.14], [1, 0, 0], [0, 1, 0], 0.6, 0.48, [0, 0, -1], M.screen, [0.6, 0.48]);
    box([x, 1.45, 2.15], [x + 0.7, 2.03, 2.55], M.dark, 1);
    quad([x + 0.05, 1.5, 2.14], [1, 0, 0], [0, 1, 0], 0.6, 0.48, [0, 0, -1], M.screen, [0.6, 0.48]);
  }
  chair(0.2, 1.4, Math.PI);
  quad([-1.2, 2.2, 2.58], [1, 0, 0], [0, 1, 0], 2.6, 0.32, [0, 0, -1], sign('monitor', { w: 512, h: 64, bg: '#1a1a1a', fg: '#d0d0c0', lines: [['構内監視　CAM 1 〜 8', 0.6]] }), [2.6, 0.32]);

  // ---- 西：ロッカーと鍵箱 ----
  for (let i = 0; i < 3; i++) box([-3.2, 0, -1.2 + i * 0.62], [-2.7, 1.9, -0.6 + i * 0.62], M.locker, [0.6, 1.9]);
  solid(-3.2, -1.2, -2.7, 0.66);
  box([-3.18, 1.2, 1.2], [-3.08, 1.7, 1.8], M.dark, 1);
  for (let i = 0; i < 4; i++) box([-3.09, 1.55 - (i % 2) * 0.2, 1.3 + i * 0.12], [-3.06, 1.6 - (i % 2) * 0.2, 1.33 + i * 0.12], M.steel, 1);
  // 床のマット・血の跡
  decal(-1.0, -1.8, 1.4, 0.9, hqMat(null, { rough: 1, color: 0x2a2a26 }), 0);
  decal(0.6, 0.6, 1.2, 1.0, M.blood, 1.1);

  // ---- 照明：天井灯ひとつと、モニターの明かり ----
  box([-0.6, H - 0.06, -0.3], [0.6, H, 0.3], M.steel, 1);
  box([-0.55, H - 0.08, -0.25], [0.55, H - 0.06, 0.25], M.bulb, 1).castShadow = false;
  point([0, H - 0.3, 0], 0xffe6c4, 7, { shadow: true, size: 1024, live: { color: [1, 0.9, 0.75], range: 4.5 } });
  point([0.2, 1.3, 1.8], 0x60ff90, 1.4, { live: { color: [0.3, 0.8, 0.45], range: 2.5 } });
  point([2.5, 1.5, -0.4], 0xff9060, 0.6);
  hemi(0x48506a, 0x181410, 0.3);

  // ---- 実行時に描くもの ----
  const ammo = add(boxMesh([-3.1, 1.9, -0.5], [-2.8, 2.02, -0.3], ps1Material({ tint: 0x7a6a2a, emissive: 0.15 }), 10, 1), LAYER_LIVE);
  const medkit = new THREE.Group();
  medkit.add(boxMesh([-0.16, 0, -0.11], [0.16, 0.16, 0.11], ps1Material({ tint: 0xe8e4d8, emissive: 0.2 }), 1, 1));
  medkit.add(boxMesh([-0.035, 0.161, -0.09], [0.035, 0.165, 0.09], ps1Material({ tint: 0xc01810, emissive: 0.35 }), 1, 1));
  medkit.add(boxMesh([-0.1, 0.161, -0.03], [0.1, 0.165, 0.03], ps1Material({ tint: 0xc01810, emissive: 0.35 }), 1, 1));
  medkit.position.set(1.4, 0.82, 2.3);
  medkit.traverse((m) => m.layers.set(LAYER_LIVE));
  K.scene.add(medkit);
  const tape = add(boxMesh([2.3, 0.8, -1.5], [2.42, 0.82, -1.42], ps1Material({ tint: 0x2a2a2a, emissive: 0.2 }), 1, 1), LAYER_LIVE);

  look('door:yard', -1.0, -2.2, 0.9);
  look('radioSet', 2.4, -0.4, 1.0);
  look('file:telex', 2.4, 1.1, 0.7);
  look('file:tape', 2.3, -1.45, 0.6);
  look('board', 2.6, -1.0, 0.6);
  look('monitors', 0.2, 1.8, 1.4);
  look('lockers', -2.6, -0.3, 1.0);
  look('lockerAmmo', -2.6, -0.4, 0.6);
  look('keybox', -2.8, 1.5, 0.6);
  look('window', 1.5, -2.2, 1.0);

  return K.finish({
    id: 'radio', cams: CAMS,
    objects: { tape },
    pickups: [
      { id: 'radio.ammo', item: 'ammo', count: 15, mesh: ammo, at: 'lockerAmmo', found: 'ロッカーの上に、ハンドガンの弾の箱がある。' },
      { id: 'radio.medkit', item: 'herb', mesh: medkit, at: 'monitors', found: 'モニターの脇に、応急パックが置いてある。' },
    ],
    doors: {
      yard: { to: 'yard', spawn: [-5, 5.9, Math.PI], kind: 'metal' },
    },
    env: { rain: 0.5, ambient: [0.12, 0.12, 0.14], fog: [7, 14] },
    exposure: 1.15,
  });
}
