// 第1〜4章の拠点：荷さばき場（屋外）
// 西＝管理事務所、北＝倉庫棟、東＝冷蔵倉庫、南＝守衛室（無線室）と金網の門。中央に「最終便」のトラック
import * as THREE from 'three';
import { boxMesh, ps1Material } from '../ps1.js';
import { createKit, hqMat, makeRain, LAYER_LIVE } from './kit.js';
import { signTex } from '../hq2.js';

const B = { x0: -10, x1: 10, z0: -7, z1: 7 };

const CAMS = [
  { name: 'officeDoor', pos: [-3.6, 3.4, 6.4], look: [-9.6, 0.6, 0.6], fov: 58, test: (x, z, m) => x < -5.2 + m && z > -1.5 - m },
  { name: 'warehouse', pos: [1.6, 3.0, 0.8], look: [-4.6, 0.8, -6.8], fov: 60, test: (x, z, m) => x < 1.5 + m && z < -1.5 + m },
  { name: 'shutter', pos: [-1.6, 3.8, 0.4], look: [5.0, 0.5, -6.2], fov: 60, test: (x, z, m) => x > 1.4 - m && z < -3.2 + m },
  { name: 'cold', pos: [2.0, 3.4, -0.4], look: [9.8, 0.8, -3.4], fov: 60, test: (x, z, m) => x > 1.5 - m && z < 0.8 + m },
  { name: 'guard', pos: [-3.2, 3.7, 1.0], look: [-5.2, 0.7, 7.0], fov: 64, test: (x, z, m) => x < 0.5 + m && z > 3.4 - m },
  { name: 'fence', pos: [-1.6, 3.2, 5.2], look: [9.0, 0.5, 4.6], fov: 58, test: (x, z, m) => x > 0.5 - m && z > 3.7 - m },
  // 運転席の前（東の端）：南東の隅から北西を見下ろす
  { name: 'cab', pos: [9.4, 3.6, 6.2], look: [5.6, 0.5, -0.6], fov: 58, test: (x, z, m) => x > 6.95 - m && z > 0.0 - m && z < 3.9 + m },
  // トラックの北側と運転席の前：東の端から、トラックの脇を西へ見通す
  { name: 'truckSide', pos: [9.3, 3.6, -1.6], look: [-1.5, 0.5, 1.8], fov: 56, test: (x, z, m) => x > 0.2 - m && x < 7.2 + m && z > 0.8 - m && z < 1.4 + m },
  { name: 'truck', pos: [-6.4, 3.6, -2.6], look: [5.0, 0.4, 4.8], fov: 62, test: () => true },
];

export function build() {
  const K = createKit(B);
  const { T, box, quad, cyl, pipe, solid, solidBox, decal, wallDecal, point, spot, hemi, look, add } = K;

  const M = {
    asphalt: hqMat(T.asphalt, { rough: 0.22, metal: 0.1 }),
    block: hqMat(T.block, { rough: 0.9 }),
    corr: hqMat(T.corrugated, { rough: 0.55, metal: 0.35 }),
    panel: hqMat(T.panel, { rough: 0.5, metal: 0.1 }),
    shutter: hqMat(T.shutter, { rough: 0.5, metal: 0.4 }),
    door: hqMat(T.door, { rough: 0.6 }),
    steel: hqMat(T.metal, { rough: 0.45, metal: 0.55, color: 0x8a9298 }),
    dark: hqMat(T.metal, { rough: 0.5, metal: 0.4, color: 0x3a3e42 }),
    black: hqMat(null, { rough: 0.6, color: 0x121212 }),
    tyre: hqMat(null, { rough: 0.85, color: 0x141414 }),
    white: hqMat(T.metal, { rough: 0.4, metal: 0.2, color: 0xd8d6cc }),
    cab: hqMat(T.metal, { rough: 0.35, metal: 0.4, color: 0x2e4a6a }),
    glass: hqMat(null, { rough: 0.05, metal: 0.4, color: 0x0a1018, emissive: 0x020306 }),
    crate: hqMat(T.crate, { rough: 0.8 }),
    wood: hqMat(T.wood, { rough: 0.7 }),
    hazard: hqMat(T.hazard, { rough: 0.6 }),
    chain: hqMat(T.chain, { rough: 0.4, metal: 0.6, alpha: true }),
    pole: hqMat(T.metal, { rough: 0.5, metal: 0.6, color: 0x6a6e70 }),
    yellow: hqMat(null, { rough: 0.6, color: 0xb89a30 }),
    lineM: hqMat(null, { rough: 0.5, color: 0xc8c4b0 }),
    puddle: hqMat(T.puddle, { rough: 0.02, metal: 0.6, alpha: true }),
    blood: hqMat(T.blood, { rough: 0.2, alpha: true }),
    drag: hqMat(T.drag, { rough: 0.25, alpha: true }),
    drum: hqMat(T.metal, { rough: 0.5, metal: 0.3, color: 0x2a4a7a }),
    drumR: hqMat(T.metal, { rough: 0.5, metal: 0.3, color: 0x8a2a1a }),
    green: hqMat(T.metal, { rough: 0.6, metal: 0.3, color: 0x2a4a34 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffe8c0 }),
    sodium: new THREE.MeshBasicMaterial({ color: 0xffb060 }),
    winLit: new THREE.MeshBasicMaterial({ color: 0x8a7a50 }),
  };
  M.chain.side = THREE.DoubleSide;
  const sign = (key, opts) => hqMat(signTex(key, opts), { rough: 0.7 });

  // ---- 地面 ----
  quad([-14, 0, 12], [1, 0, 0], [0, 0, -1], 28, 22, [0, 1, 0], M.asphalt, 4);
  // 白線と駐車枠
  for (let i = 0; i < 5; i++) decal(-6 + i * 2.2, -3.2, 0.1, 2.6, M.lineM, 0, 0.006);
  decal(-3.6, -1.9, 9.0, 0.1, M.lineM, 0, 0.006);
  decal(4.0, -5.4, 4.2, 0.9, M.hazard, 0, 0.007);

  // ---- 西：管理事務所の外壁と扉 ----
  quad([-10, 0, 7], [0, 0, -1], [0, 1, 0], 14, 4.2, [1, 0, 0], M.block, [4, 4]);
  quad([-9.98, 0, 3.8], [0, 0, -1], [0, 1, 0], 1.2, 2.2, [1, 0, 0], M.door, [1.2, 2.2]);
  box([-10, 0, 3.8], [-9.9, 2.3, 3.9], M.dark, 1); box([-10, 0, 2.5], [-9.9, 2.3, 2.6], M.dark, 1); box([-10, 2.2, 2.5], [-9.9, 2.3, 3.9], M.dark, 1);
  box([-10, 2.55, 2.9], [-9.82, 2.75, 3.5], M.dark, 1);
  box([-9.85, 2.58, 3.0], [-9.8, 2.68, 3.4], M.bulb, 1).castShadow = false;
  // 構内図の看板
  quad([-9.97, 1.0, 1.3], [0, 0, -1], [0, 1, 0], 1.4, 1.0, [1, 0, 0], sign('yardmap', { w: 256, h: 192, bg: '#e8e4d4', lines: [['構内案内図', 0.18, '#1a3a6a'], ['北：倉庫棟 B', 0.14], ['東：冷蔵倉庫', 0.14], ['南：守衛室・無線室', 0.14], ['ヴェスパー製薬 北部物流センター', 0.1, '#555', 'normal']], border: '#1a3a6a' }), [1.4, 1.0]);
  box([-10, 0.95, 1.25], [-9.92, 2.05, 1.35], M.dark, 1); box([-10, 0.95, -0.15], [-9.92, 2.05, -0.05], M.dark, 1);
  // 排水管
  cyl(-9.85, 0, -2.5, 0.06, 0.06, 4.2, M.pole, 8);
  // 西の壁際：パレットと木箱
  solidBox([-9.9, 0, -6.9], [-8.3, 0.15, -5.7], M.wood, 1);
  box([-9.8, 0.15, -6.8], [-8.4, 1.15, -5.8], M.crate, [1.4, 1]);
  box([-9.7, 1.15, -6.7], [-8.9, 1.95, -5.9], M.crate, [0.8, 0.8]);
  solidBox([-7.9, 0, -6.9], [-6.9, 0.85, -5.9], M.crate, [1, 0.85]);

  // ---- 北：倉庫棟の外壁 ----
  quad([-14, 0, -7], [1, 0, 0], [0, 1, 0], 28, 6.5, [0, 0, 1], M.corr, [4, 4]);
  box([-14, 6.3, -7.3], [14, 6.6, -6.7], M.dark, 1);
  // 人の出入り口
  quad([-3.6, 0, -6.98], [1, 0, 0], [0, 1, 0], 1.2, 2.2, [0, 0, 1], M.steel, [1.2, 2.2]);
  box([-3.7, 0, -7], [-3.6, 2.3, -6.9], M.dark, 1); box([-2.4, 0, -7], [-2.3, 2.3, -6.9], M.dark, 1); box([-3.7, 2.2, -7], [-2.3, 2.3, -6.9], M.dark, 1);
  box([-2.75, 1.0, -6.98], [-2.55, 1.06, -6.9], M.pole, 1);
  quad([-3.5, 2.45, -6.97], [1, 0, 0], [0, 1, 0], 1.0, 0.36, [0, 0, 1], sign('whB', { w: 256, h: 92, bg: '#1a4a7a', fg: '#f0f0e8', lines: [['倉庫棟 B', 0.6]] }), [1.0, 0.36]);
  box([-3.2, 2.95, -7], [-2.8, 3.15, -6.82], M.dark, 1);
  box([-3.15, 2.95, -6.86], [-2.85, 3.0, -6.8], M.bulb, 1).castShadow = false;
  // シャッターと荷台用の緩衝ゴム
  quad([2, 0, -6.97], [1, 0, 0], [0, 1, 0], 4, 4.2, [0, 0, 1], M.shutter, [4, 4.2]);
  box([1.8, 0, -7], [2.0, 4.4, -6.85], M.hazard, [0.2, 1]); box([6.0, 0, -7], [6.2, 4.4, -6.85], M.hazard, [0.2, 1]);
  box([1.8, 4.2, -7], [6.2, 4.6, -6.75], M.dark, 1);
  for (const x of [2.4, 5.4]) box([x, 0.6, -7], [x + 0.25, 1.1, -6.75], M.black, 1);
  quad([2.6, 4.7, -6.97], [1, 0, 0], [0, 1, 0], 2.8, 0.5, [0, 0, 1], sign('vesperWall', { w: 512, h: 92, bg: '#e8e4d8', fg: '#1a3a6a', lines: [['VESPER  LOGISTICS', 0.62]], dirt: 0.7 }), [2.8, 0.5]);
  // 横の通用口（倉庫の中からしか開かない）
  quad([6.9, 0, -6.98], [1, 0, 0], [0, 1, 0], 1.1, 2.15, [0, 0, 1], M.steel, [1.1, 2.15]);
  box([6.8, 0, -7], [6.9, 2.25, -6.9], M.dark, 1); box([8.0, 0, -7], [8.1, 2.25, -6.9], M.dark, 1); box([6.8, 2.15, -7], [8.1, 2.25, -6.9], M.dark, 1);

  // ---- 東：冷蔵倉庫の外壁 ----
  quad([10, 0, -7], [0, 0, 1], [0, 1, 0], 14, 4.6, [-1, 0, 0], M.panel, [4, 4.6]);
  box([9.7, 4.5, -7], [10, 4.8, 7], M.dark, 1);
  quad([9.98, 0, -2.6], [0, 0, 1], [0, 1, 0], 1.2, 2.2, [-1, 0, 0], M.steel, [1.2, 2.2]);
  box([9.9, 0, -2.7], [10, 2.3, -2.6], M.dark, 1); box([9.9, 0, -1.4], [10, 2.3, -1.3], M.dark, 1); box([9.9, 2.2, -2.7], [10, 2.3, -1.3], M.dark, 1);
  // カードリーダー
  box([9.88, 1.15, -1.15], [10, 1.45, -0.95], M.black, 1);
  box([9.87, 1.38, -1.1], [9.88, 1.41, -1.0], new THREE.MeshBasicMaterial({ color: 0xff2a1a }), 1).castShadow = false;
  quad([9.97, 2.45, -2.5], [0, 0, 1], [0, 1, 0], 1.0, 0.5, [-1, 0, 0], sign('coldSign', { w: 256, h: 128, bg: '#f0f0f0', fg: '#1a1a1a', lines: [['冷蔵倉庫', 0.38, '#1a4a8a'], ['関係者以外立入禁止', 0.2, '#b01810']], border: '#b01810' }), [1.0, 0.5]);
  box([9.7, 3.0, -2.2], [10, 3.2, -1.8], M.dark, 1);
  box([9.75, 2.96, -2.15], [9.8, 3.0, -1.85], M.bulb, 1).castShadow = false;
  // 室外機（冷凍機）
  for (const z of [2.0, 3.6]) {
    solidBox([8.6, 0, z], [9.95, 1.3, z + 1.4], M.white, 1);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), M.black);
    fan.rotation.z = Math.PI / 2; fan.position.set(8.59, 0.68, z + 0.7); add(fan);
  }
  pipe(9.3, 1.6, 3.2, 0.06, 3, 'z', M.pole);
  // ドラム缶
  for (const [x, z, m] of [[8.9, 5.6, M.drum], [8.3, 6.2, M.drumR], [9.3, 6.4, M.drum]]) cyl(x, 0, z, 0.3, 0.3, 0.9, m, 14);
  solid(7.9, 5.2, 9.7, 6.9);

  // ---- 南：守衛室（無線室）と金網の門 ----
  quad([-1, 0, 7], [-1, 0, 0], [0, 1, 0], 9, 3.4, [0, 0, -1], M.block, [4, 4]);
  quad([-1, 0, 7], [0, 0, 1], [0, 1, 0], 3, 3.4, [1, 0, 0], M.block, [4, 4]);
  box([-10, 3.3, 6.6], [-0.8, 3.6, 7.2], M.dark, 1);
  quad([-4.4, 0, 6.98], [-1, 0, 0], [0, 1, 0], 1.2, 2.2, [0, 0, -1], M.steel, [1.2, 2.2]);
  box([-5.7, 0, 6.9], [-5.6, 2.3, 7], M.dark, 1); box([-4.4, 0, 6.9], [-4.3, 2.3, 7], M.dark, 1); box([-5.7, 2.2, 6.9], [-4.3, 2.3, 7], M.dark, 1);
  quad([-4.5, 2.4, 6.97], [-1, 0, 0], [0, 1, 0], 1.0, 0.36, [0, 0, -1], sign('guardSign', { w: 256, h: 92, bg: '#e8e4d8', lines: [['守衛室・無線室', 0.5]] }), [1.0, 0.36]);
  box([-5.2, 2.9, 6.8], [-4.8, 3.1, 7], M.dark, 1);
  box([-5.15, 2.86, 6.82], [-4.85, 2.9, 6.88], M.bulb, 1).castShadow = false;
  // 明かりのついた窓（ブラインド越し）
  quad([-1.8, 1.1, 6.98], [-1, 0, 0], [0, 1, 0], 1.6, 1.0, [0, 0, -1], M.winLit, [1.6, 1]);
  for (let i = 0; i < 8; i++) box([-3.45, 1.12 + i * 0.12, 6.94], [-1.75, 1.15 + i * 0.12, 6.97], M.dark, 1);
  box([-3.5, 1.0, 6.9], [-1.7, 1.1, 7], M.dark, 1);
  // ごみコンテナ
  solidBox([-9.6, 0, 5.4], [-7.6, 1.3, 6.8], M.green, 1);
  box([-9.7, 1.3, 5.3], [-7.5, 1.38, 6.9], M.green, 1);
  // 金網のフェンスと門
  const fence = (x0, x1) => {
    quad([x0, 0, 7], [1, 0, 0], [0, 1, 0], x1 - x0, 3, [0, 0, -1], M.chain, [1.2, 1.2]);
  };
  fence(-1, 4); fence(7, 10);
  for (const x of [-1, 1.5, 4, 7, 10]) cyl(x, 0, 7, 0.05, 0.05, 3.1, M.pole, 8);
  pipe(4.5, 3.0, 7, 0.04, 11, 'x', M.pole);
  // 門（閉まっている）
  quad([4, 0.05, 7.02], [1, 0, 0], [0, 1, 0], 3, 2.4, [0, 0, -1], M.chain, [1.2, 1.2]);
  for (const [a, b] of [[[4.0, 0, 6.97], [4.08, 2.5, 7.06]], [[6.92, 0, 6.97], [7.0, 2.5, 7.06]], [[4.0, 2.42, 6.97], [7.0, 2.5, 7.06]], [[5.46, 0, 6.97], [5.54, 2.5, 7.06]]]) box(a, b, M.pole, 1);
  box([5.35, 1.1, 6.92], [5.65, 1.3, 6.96], M.black, 1);
  // 門の外は暗い道路と林
  quad([-14, 0, 22], [1, 0, 0], [0, 1, 0], 28, 9, [0, 0, -1], hqMat(null, { rough: 1, color: 0x05070a }), 1);

  // ---- 中央：「最終便」のトラック ----
  const tz0 = 1.3, tz1 = 3.7;
  // 荷台
  box([-1.5, 0.95, tz0], [4.0, 3.45, tz1], M.white, 1);
  box([-1.55, 0.85, tz0 - 0.05], [4.0, 0.98, tz1 + 0.05], M.dark, 1);
  for (const z of [tz0 - 0.01, tz1 + 0.01]) quad(z === tz0 - 0.01 ? [-0.4, 1.4, z] : [3.4, 1.4, z], z === tz0 - 0.01 ? [1, 0, 0] : [-1, 0, 0], [0, 1, 0], 3.4, 1.0, z === tz0 - 0.01 ? [0, 0, -1] : [0, 0, 1],
    sign('vesperTruck', { w: 512, h: 150, bg: '#d8d6cc', fg: '#1a3a6a', lines: [['VESPER', 0.55], ['Pharmaceuticals', 0.25, '#4a5a6a', 'normal']], dirt: 0.6 }), [3.4, 1.0]);
  // 開いたままの後ろの扉
  const rear = (z, r) => { const d = boxMesh([0, 0, -0.03], [1.2, 2.45, 0.03], M.white, 1, 4); d.position.set(-1.5, 0.98, z); d.rotation.y = r; add(d); };
  rear(tz0, Math.PI * 0.62); rear(tz1, -Math.PI * 0.62);
  box([-1.52, 0.98, tz0 + 0.05], [-1.45, 3.4, tz0 + 0.12], M.dark, 1);
  // 荷台の中は空っぽで、霜と血の跡
  quad([-1.48, 0.99, tz1 - 0.02], [1, 0, 0], [0, 0, -1], 5.4, tz1 - tz0 - 0.04, [0, 1, 0], hqMat(T.plate, { rough: 0.4, metal: 0.5 }), 1);
  // 運転席
  box([4.05, 0.6, tz0 + 0.1], [6.3, 2.85, tz1 - 0.1], M.cab, 1);
  box([6.3, 0.6, tz0 + 0.15], [6.9, 1.55, tz1 - 0.15], M.cab, 1);
  quad([6.31, 1.7, tz1 - 0.2], [0, 0, -1], [0, 1, 0], tz1 - tz0 - 0.4, 0.95, [1, 0, 0], M.glass, 1);
  quad([4.6, 1.75, tz0 + 0.09], [1, 0, 0], [0, 1, 0], 1.4, 0.8, [0, 0, -1], M.glass, 1);
  box([6.85, 0.55, tz0 + 0.1], [6.95, 0.8, tz1 - 0.1], M.pole, 1);
  for (const z of [tz0 + 0.3, tz1 - 0.5]) box([6.9, 0.95, z], [6.94, 1.15, z + 0.2], hqMat(null, { color: 0x8a8a7a, emissive: 0x111108 }), 1);
  // 運転席の扉（開いている）
  const cd = boxMesh([0, 0, -0.03], [1.1, 1.6, 0.03], M.cab, 1, 4); cd.position.set(4.6, 0.9, tz0 + 0.1); cd.rotation.y = 0.9; add(cd);
  // 車輪
  for (const x of [-0.4, 2.9, 5.6]) for (const z of [tz0 + 0.2, tz1 - 0.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 14), M.tyre); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, z); add(w); }
  solid(-1.55, tz0, 6.95, tz1);
  // カメラ選びで、トラックの陰に主人公が隠れるカメラを避けるための形
  const occluders = [[-1.55, tz0, 4.0, tz1, 3.45], [4.0, tz0 + 0.1, 6.3, tz1 - 0.1, 2.85]];
  // 荷台の後ろ：運転手の血の跡
  decal(-2.6, 2.4, 2.2, 1.6, M.blood, 0.4);
  decal(-4.4, 1.7, 2.6, 0.7, M.drag, 0.3);

  // ---- 街灯 ----
  const lamp = (x, z) => {
    cyl(x, 0, z, 0.09, 0.12, 6.0, M.pole, 8);
    box([x - 0.08, 5.9, z - 0.08], [x + 0.9, 6.0, z + 0.08], M.pole, 1);
    box([x + 0.5, 5.8, z - 0.18], [x + 1.1, 5.95, z + 0.18], M.dark, 1);
    box([x + 0.55, 5.78, z - 0.14], [x + 1.05, 5.8, z + 0.14], M.sodium, 1).castShadow = false;
    solid(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
    spot([x + 0.8, 5.7, z], [x + 0.8, 0, z], 0xff9a48, 160, 0.95, { penumbra: 0.7, live: { color: [1.0, 0.62, 0.3], range: 9 } });
  };
  lamp(-6.6, -3.2); lamp(6.4, -5.8); lamp(-2.2, 5.2); lamp(8.6, 0.6);

  // ---- 照明 ----
  point([-9.5, 2.55, 3.2], 0xffe6c0, 9, { shadow: true, live: { color: [1, 0.9, 0.75], range: 5 } });
  point([-3, 2.85, -6.5], 0xd8e4ff, 9, { shadow: true, live: { color: [0.8, 0.85, 1], range: 5 } });
  point([9.5, 2.85, -2], 0xc8e8ff, 9, { shadow: true, live: { color: [0.75, 0.9, 1], range: 5 } });
  point([-5, 2.75, 6.5], 0xffe0b0, 8, { shadow: true, live: { color: [1, 0.85, 0.65], range: 5 } });
  point([-2.6, 1.6, 6.4], 0xffd890, 2.5);
  // 月明かりと空
  const moon = new THREE.DirectionalLight(0x5a6e98, 0.55);
  moon.position.set(-8, 14, 10); moon.target.position.set(0, 0, 0);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 40 });
  moon.shadow.bias = -0.0015;
  K.scene.add(moon, moon.target); K.lights.push(moon);
  hemi(0x3a4a66, 0x0c0c10, 0.35);

  // ---- 実行時に描くもの ----
  const ammo = add(boxMesh([4.95, 0.62, 1.05], [5.25, 0.74, 1.25], ps1Material({ tint: 0x7a6a2a, emissive: 0.15 }), 10, 1), LAYER_LIVE);
  const medkit = new THREE.Group();
  medkit.add(boxMesh([-0.16, 0, -0.11], [0.16, 0.16, 0.11], ps1Material({ tint: 0xe8e4d8, emissive: 0.2 }), 1, 1));
  medkit.add(boxMesh([-0.035, 0.161, -0.09], [0.035, 0.165, 0.09], ps1Material({ tint: 0xc01810, emissive: 0.35 }), 1, 1));
  medkit.add(boxMesh([-0.1, 0.161, -0.03], [0.1, 0.165, 0.03], ps1Material({ tint: 0xc01810, emissive: 0.35 }), 1, 1));
  medkit.position.set(-7.4, 0.85, -6.4);
  medkit.traverse((m) => m.layers.set(LAYER_LIVE));
  K.scene.add(medkit);
  const rain = makeRain(K.scene, { x0: -10, x1: 10, z0: -7, z1: 7, h: 7 }, 1400);

  // ---- 調べられる場所 ----
  look('door:office', -9.6, 3.2, 0.9);
  look('mapboard', -9.6, 0.6, 0.9);
  look('door:warehouse', -3, -6.6, 0.9);
  look('shutter', 4, -6.6, 1.6);
  look('door:warehouseSide', 7.45, -6.6, 0.8);
  look('door:cold', 9.6, -2, 0.9);
  look('condenser', 8.4, 3.4, 1.4);
  look('drums', 8.6, 5.6, 0.9);
  look('door:radio', -5, 6.6, 0.9);
  look('guardWindow', -2.6, 6.6, 1.0);
  look('door:gate', 5.5, 6.6, 1.6);
  look('fence', 1.5, 6.7, 1.6);
  look('dumpster', -8.6, 5.1, 1.2);
  look('cab', 4.9, 1.0, 0.8);
  look('cargo', -2.0, 2.5, 1.0);
  look('truck', 1.5, 1.0, 1.6);
  look('truckS', 1.5, 4.0, 1.6);
  look('crates', -8.4, -5.5, 1.3);
  look('medkitCrate', -7.4, -5.6, 0.7);

  return K.finish({
    id: 'yard', cams: CAMS, occluders,
    pickups: [
      { id: 'yard.ammo', item: 'ammo', count: 15, mesh: ammo, at: 'cab', found: '運転席の足元に、ハンドガンの弾が落ちている。' },
      { id: 'yard.medkit', item: 'herb', mesh: medkit, at: 'medkitCrate', found: '木箱の上に、応急パックが置いてある。' },
    ],
    doors: {
      office: { to: 'office', spawn: [5.1, 2.6, -Math.PI / 2], kind: 'wood' },
      warehouse: { to: 'warehouse', spawn: [-3, 5.3, Math.PI], kind: 'metal' },
      warehouseSide: { to: 'warehouse', spawn: [5.5, 5.3, Math.PI], kind: 'metal', lock: 'flag:sideOpen', lockedText: ['倉庫の通用口だ。', '内側からかんぬきが掛かっている。'] },
      cold: { to: 'cold', spawn: [-5.1, 0, Math.PI / 2], kind: 'metal', lock: 'card', lockedText: ['冷蔵倉庫の扉だ。', 'カードリーダーの赤いランプが光っている。\nカードキーがないと開かない。'] },
      gate: { to: 'checkpoint', spawn: [-4, -5.0, 0], kind: 'gate', lock: 'flag:gateOpen', lockedText: ['正門へ続く金網の門だ。', '南京錠がかかっている。'] },
      radio: { to: 'radio', spawn: [-1, -2.1, 0], kind: 'metal', lock: 'radioKey', lockedText: ['守衛室の扉だ。', '鍵がかかっている。\n中から、かすかに無線のノイズが聞こえる。'] },
    },
    objects: { rain },
    env: { rain: 1.8, ambient: [0.12, 0.12, 0.16], lightning: { pos: [0, 9, 0], base: [0.08, 0.1, 0.16], range: 26, boost: 1.4, bg: 0.6 }, fog: [10, 26] },
    exposure: 1.4,
    tick(dt) { rain.update(dt); },
  });
}
