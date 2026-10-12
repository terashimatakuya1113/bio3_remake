// 第5章：貨物ヤード（屋外）
// 北に貨物列車、南にコンテナの山と門形クレーン。燃えているドラム缶。東の端の貨車に乗れば脱出できる
import * as THREE from 'three';
import { boxMesh, ps1Material } from '../ps1.js';
import { createKit, hqMat, makeRain, LAYER_LIVE } from './kit.js';
import { signTex } from '../hq2.js';

const B = { x0: -10, x1: 12, z0: -6, z1: 6 };
export const CRANE = { x: 1.6, z: 2.6 };

const CAMS = [
  { name: 'entry', pos: [-2.6, 4.0, -1.4], look: [-9.6, 0.4, 2.6], fov: 60, test: (x, z, m) => x < -4.5 + m },
  { name: 'crane', pos: [-8.8, 3.2, -1.2], look: [3.0, 1.4, 3.4], fov: 58, test: (x, z, m) => x < 3.6 + m },
  { name: 'train', pos: [3.0, 3.8, 2.2], look: [11.0, 0.5, -1.4], fov: 62, test: () => true },
  { name: 'drop', pos: [-5.0, 1.6, 0.6], look: [1.6, 2.6, 2.8], fov: 60, test: () => false },
]

export function build() {
  const K = createKit(B);
  const { T, box, quad, cyl, pipe, solid, solidBox, decal, point, spot, hemi, look, add } = K;
  const sign = (key, opts) => hqMat(signTex(key, opts), { rough: 0.7 });
  const M = {
    gravel: hqMat(T.gravel, { rough: 0.95 }),
    asphalt: hqMat(T.asphalt, { rough: 0.22, metal: 0.1 }),
    rail: hqMat(T.metal, { rough: 0.3, metal: 0.8, color: 0x8a8278 }),
    sleeper: hqMat(T.woodDark, { rough: 0.9 }),
    boxcar: hqMat(T.boxcar, { rough: 0.6, metal: 0.3 }),
    cont: hqMat(T.container, { rough: 0.55, metal: 0.35 }),
    contB: hqMat(T.container, { rough: 0.55, metal: 0.35, color: 0x5a7aa8 }),
    contG: hqMat(T.container, { rough: 0.55, metal: 0.35, color: 0x6a9a6a }),
    crane: hqMat(T.metal, { rough: 0.5, metal: 0.4, color: 0xd8a018 }),
    dark: hqMat(T.metal, { rough: 0.5, metal: 0.4, color: 0x3a3e42 }),
    pole: hqMat(T.metal, { rough: 0.5, metal: 0.6, color: 0x6a6e70 }),
    black: hqMat(null, { rough: 0.6, color: 0x121212 }),
    drum: hqMat(T.metal, { rough: 0.6, metal: 0.3, color: 0x5a3a24 }),
    hazard: hqMat(T.hazard, { rough: 0.6 }),
    sky: hqMat(null, { rough: 1, color: 0x0c1220 }),
    trees: hqMat(null, { rough: 1, color: 0x06080a }),
    loco: hqMat(T.metal, { rough: 0.4, metal: 0.4, color: 0x2a3a5a }),
    sodium: new THREE.MeshBasicMaterial({ color: 0xffb060 }),
    head: new THREE.MeshBasicMaterial({ color: 0xfff4d8 }),
    green: new THREE.MeshBasicMaterial({ color: 0x40ff60 }),
    ember: new THREE.MeshBasicMaterial({ color: 0xff7a20 }),
  };

  // ---- 地面と線路 ----
  quad([-14, 0, 10], [1, 0, 0], [0, 0, -1], 30, 20, [0, 1, 0], M.gravel, 3);
  const track = (z) => {
    for (let x = -13; x < 16; x += 0.7) box([x, 0, z - 0.95], [x + 0.25, 0.08, z + 0.95], M.sleeper, 1);
    for (const dz of [-0.72, 0.72]) box([-14, 0.08, z + dz - 0.04], [16, 0.2, z + dz + 0.04], M.rail, 1);
  };
  track(-3.6);
  // 構内道路
  quad([-14, 0.004, 1.0], [1, 0, 0], [0, 0, -1], 30, 1.6, [0, 1, 0], M.asphalt, 4);

  // ---- 北：貨物列車（貨車 3 両と機関車） ----
  const car = (x0, x1, open) => {
    box([x0, 0.95, -4.95], [x1, 3.6, -2.25], M.boxcar, [x1 - x0, 2.6]);
    box([x0 - 0.1, 0.7, -5.0], [x1 + 0.1, 0.95, -2.2], M.dark, 1);
    box([x0 - 0.05, 3.6, -5.0], [x1 + 0.05, 3.7, -2.2], M.dark, 1);
    for (const x of [x0 + 0.9, x1 - 0.9]) for (const z of [-4.3, -2.9]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 12), M.black); w.rotation.x = Math.PI / 2; w.position.set(x, 0.42, z); add(w); }
    if (open) {
      // 開いた引き戸と、中の暗がり
      const m = (x0 + x1) / 2;
      quad([m - 1.0, 1.0, -2.24], [1, 0, 0], [0, 1, 0], 2.0, 2.4, [0, 0, 1], M.black, 1);
      box([m + 1.0, 0.95, -2.2], [m + 3.0, 3.4, -2.12], M.boxcar, [2, 2.4]);
    } else box([(x0 + x1) / 2 - 1, 0.95, -2.22], [(x0 + x1) / 2 + 1, 3.4, -2.14], M.boxcar, [2, 2.4]);
    solid(x0 - 0.1, -5.0, x1 + 0.1, -2.2);
  };
  car(-13, -6.4, false); car(-6.0, 0.6, false); car(1.0, 7.6, true);
  // 機関車（東の端）
  box([8.0, 0.95, -4.85], [13.5, 3.2, -2.35], M.loco, 1);
  box([11.0, 3.2, -4.85], [13.5, 4.2, -2.35], M.loco, 1);
  box([7.9, 0.7, -5.0], [13.6, 0.95, -2.2], M.dark, 1);
  quad([11.2, 3.4, -2.34], [1, 0, 0], [0, 1, 0], 1.6, 0.6, [0, 0, 1], hqMat(null, { rough: 0.05, metal: 0.4, color: 0x2a2a1a, emissive: 0x2a2010 }), 1);
  quad([8.6, 1.6, -2.34], [1, 0, 0], [0, 1, 0], 2.6, 0.6, [0, 0, 1], sign('loco', { w: 384, h: 96, bg: '#2a3a5a', fg: '#e8d8a0', lines: [['MIDLAND FREIGHT  2071', 0.55]], dirt: 0.7 }), [2.6, 0.6]);
  box([7.8, 1.0, -3.9], [7.9, 1.3, -3.3], M.head, 1).castShadow = false;
  solid(7.9, -5.0, 13.6, -2.2);
  // 貨車の乗り口のステップ
  box([3.6, 0, -2.2], [5.0, 0.5, -1.8], M.dark, 1);
  box([3.6, 0.5, -2.2], [5.0, 0.55, -1.9], M.hazard, [1.4, 0.3]);

  // ---- 南：コンテナの山 ----
  const cont = (x0, y0, z0, x1, z1, m) => box([x0, y0, z0], [x1, y0 + 2.6, z1], m, [x1 - x0, 2.6]);
  cont(-10, 0, 3.4, -4.0, 5.8, M.cont); cont(-9.6, 2.6, 3.5, -3.6, 5.8, M.contB); solid(-10, 3.4, -3.6, 6);
  cont(5.0, 0, 3.6, 11.0, 6.0, M.contG); cont(5.4, 2.6, 3.6, 11.4, 6.0, M.cont); solid(5.0, 3.6, 12, 6);

  // ---- 門形クレーン：線路をまたいで、コンテナを 1 つ吊っている ----
  for (const [x, z] of [[-0.6, -0.4], [3.8, -0.4], [-0.6, 5.6], [3.8, 5.6]]) {
    box([x - 0.25, 0, z - 0.25], [x + 0.25, 6.4, z + 0.25], M.crane, [0.5, 6.4]);
    solid(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  }
  for (const x of [-0.6, 3.8]) box([x - 0.3, 6.4, -0.7], [x + 0.3, 7.0, 5.9], M.crane, 1);
  for (const z of [-0.4, 5.6]) box([-0.9, 6.4, z - 0.3], [4.1, 7.0, z + 0.3], M.crane, 1);
  box([0.8, 6.0, 1.6], [2.4, 6.4, 3.6], M.crane, 1);
  // 操作盤
  solidBox([5.2, 0, 1.9], [5.7, 1.2, 2.5], M.dark, 1);
  box([5.18, 0.9, 2.0], [5.2, 1.1, 2.4], M.green, 1).castShadow = false;
  quad([5.17, 1.25, 1.9], [0, 0, 1], [0, 1, 0], 0.6, 0.25, [-1, 0, 0], sign('craneOp', { w: 256, h: 96, bg: '#d8a018', fg: '#141414', lines: [['クレーン操作', 0.5]] }), [0.6, 0.25]);
  decal(CRANE.x, CRANE.z, 3.0, 2.6, M.hazard, 0, 0.007);

  // ---- 燃えているドラム缶（西） ----
  cyl(-2.6, 0, 4.4, 0.3, 0.3, 0.9, M.drum, 14);
  solid(-2.95, 4.05, -2.25, 4.75);
  box([-2.75, 0.88, 4.25], [-2.45, 0.92, 4.55], M.ember, 1).castShadow = false;
  const fire = point([-2.6, 1.4, 4.4], 0xff7a28, 9, { shadow: true, size: 512, live: { color: [1.0, 0.5, 0.2], range: 5 } });

  // ---- 照明塔と遠景 ----
  const tower = (x, z, tx, tz) => {
    cyl(x, 0, z, 0.12, 0.16, 8.5, M.pole, 8);
    box([x - 0.6, 8.5, z - 0.2], [x + 0.6, 9.0, z + 0.2], M.dark, 1);
    box([x - 0.55, 8.48, z - 0.18], [x + 0.55, 8.5, z + 0.18], M.sodium, 1).castShadow = false;
    solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
    spot([x + 0.45, 8.3, z], [tx, 0, tz], 0xffa860, 260, 0.75, { penumbra: 0.7, size: 2048, live: { color: [1.0, 0.68, 0.38], range: 14 } });
  };
  tower(-6, 2.2, -6, 0.5); tower(9.4, 2.0, 6, -1);
  quad([-14, 0, 7.5], [1, 0, 0], [0, 1, 0], 30, 7, [0, 0, -1], M.trees, 1);
  quad([-14, 0, -7.5], [1, 0, 0], [0, 1, 0], 30, 9, [0, 0, 1], M.sky, 1);
  quad([16, 0, -8], [0, 0, 1], [0, 1, 0], 16, 9, [-1, 0, 0], M.sky, 1);

  const moon = new THREE.DirectionalLight(0x5a6e98, 0.5);
  moon.position.set(-8, 14, 10); moon.target.position.set(0, 0, 0);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 40 });
  moon.shadow.bias = -0.0015;
  K.scene.add(moon, moon.target); K.lights.push(moon);
  hemi(0x3a4a66, 0x0c0c10, 0.35);

  const rain = makeRain(K.scene, { x0: -10, x1: 12, z0: -6, z1: 6, h: 7 }, 1000);

  // ---- 実行時に描くもの：吊られたコンテナ、ワイヤー、炎 ----
  const hung = new THREE.Group();
  const hc = boxMesh([-1.3, -2.4, -0.95], [1.3, 0, 0.95], ps1Material({ tint: 0xb04a2a, emissive: 0.12 }), 2, 1);
  hung.add(hc);
  hung.position.set(CRANE.x, 5.6, CRANE.z);
  hung.traverse((m) => m.layers.set(LAYER_LIVE));
  K.scene.add(hung);
  const wires = new THREE.Group();
  for (const [dx, dz] of [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]]) {
    const w = boxMesh([-0.01, 0, -0.01], [0.01, 1, 0.01], ps1Material({ tint: 0x2a2a2a }), 1, 1);
    w.position.set(CRANE.x + dx * 0.6, 5.6, CRANE.z + dz * 0.6);
    wires.add(w);
  }
  wires.traverse((m) => m.layers.set(LAYER_LIVE));
  K.scene.add(wires);
  const flames = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const f = boxMesh([-0.1, 0, -0.1], [0.1, 0.4, 0.1], ps1Material({ tint: i % 2 ? 0xffb030 : 0xff6010, emissive: 1, opacity: 0.85 }), 1, 1);
    f.position.set(-2.6 + (i - 2) * 0.08, 0.9, 4.4 + ((i * 7) % 3 - 1) * 0.08);
    flames.add(f);
  }
  flames.traverse((m) => m.layers.set(LAYER_LIVE));
  K.scene.add(flames);
  const ammo = add(boxMesh([-8.2, 0.0, 2.9], [-7.9, 0.12, 3.1], ps1Material({ tint: 0x7a6a2a, emissive: 0.15 }), 10, 1), LAYER_LIVE);
  const medkit = new THREE.Group();
  medkit.add(boxMesh([-0.16, 0, -0.11], [0.16, 0.16, 0.11], ps1Material({ tint: 0xe8e4d8, emissive: 0.2 }), 1, 1));
  medkit.add(boxMesh([-0.035, 0.161, -0.09], [0.035, 0.165, 0.09], ps1Material({ tint: 0xc01810, emissive: 0.35 }), 1, 1));
  medkit.add(boxMesh([-0.1, 0.161, -0.03], [0.1, 0.165, 0.03], ps1Material({ tint: 0xc01810, emissive: 0.35 }), 1, 1));
  medkit.position.set(9.0, 0, 3.2);
  medkit.traverse((m) => m.layers.set(LAYER_LIVE));
  K.scene.add(medkit);

  look('door:checkpoint', -9.6, 1.0, 1.0);
  look('crane', 5.0, 2.2, 0.9);
  look('fire', -2.6, 3.8, 1.0);
  look('boxcar', 4.3, -1.6, 1.2);
  look('cars', -3, -1.8, 2.4);
  look('loco', 9.6, -1.8, 1.4);
  look('containers', -6.8, 3.0, 1.6);
  look('containers', 8.0, 3.2, 1.4);
  look('ammoCont', -8.0, 2.6, 0.7);
  look('medCont', 9.0, 2.8, 0.7);
  look('hung', CRANE.x, CRANE.z - 1.4, 1.2);

  let ft = 0;
  return K.finish({
    id: 'freight', cams: CAMS,
    objects: { hung, wires, flames, rain },
    pickups: [
      { id: 'freight.ammo', item: 'ammo', count: 15, mesh: ammo, at: 'ammoCont', found: 'コンテナの陰に、弾薬の箱が落ちている。' },
      { id: 'freight.medkit', item: 'herb', mesh: medkit, at: 'medCont', found: 'コンテナの脇に、応急パックが置いてある。' },
    ],
    doors: {
      checkpoint: { to: 'checkpoint', spawn: [8.8, 2.0, -Math.PI / 2], kind: 'gate' },
    },
    env: { rain: 1.4, ambient: [0.12, 0.12, 0.16], lightning: { pos: [0, 9, 0], base: [0.08, 0.1, 0.16], range: 26, boost: 1.4, bg: 0.6 }, fog: [12, 28], tension: 1.6 },
    exposure: 1.35,
    tick(dt, fx) {
      rain.update(dt);
      ft += dt;
      flames.children.forEach((f, i) => { f.scale.y = 0.7 + 0.6 * Math.abs(Math.sin(ft * (7 + i) + i)); f.rotation.y = ft * (i + 1); });
      fire.intensity = fire.userData.base * (0.8 + 0.3 * Math.sin(ft * 13) * Math.sin(ft * 7.3));
    },
  });
}
