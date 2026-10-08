// ROOM 01：町外れの管理事務所
// 部屋そのものは高品質マテリアルで「背景」として事前レンダリングする（レイヤー1）。
// 実行時は奥行きだけを描き、キャラクターや拾えるアイテムだけを PS1 風に重ねる（レイヤー0）。
import * as THREE from 'three';
import { addBox, addQuad, boxMesh, buildGeometry, newBuilder, ps1Material, textures } from './ps1.js';
import { makeHQTextures, hqMat } from './hq.js';

export const ROOM = { x0: -6, x1: 6, z0: -4, z1: 4, h: 3.2 };
export const LAYER_LIVE = 0, LAYER_STATIC = 1, LAYER_BAKE_ONLY = 2;

export function buildRoom() {
  const scene = new THREE.Scene();
  const T = makeHQTextures();
  const colliders = []; // [x0, z0, x1, z1]
  const solid = (x0, z0, x1, z1) => colliders.push([x0, z0, x1, z1]);
  const { x0, x1, z0, z1, h } = ROOM;

  const M = {
    wall: hqMat(T.wall, { rough: 0.92 }),
    floor: hqMat(T.floor, { rough: 0.5 }),
    ceil: hqMat(T.ceiling, { rough: 0.95 }),
    wood: hqMat(T.wood, { rough: 0.55 }),
    woodDark: hqMat(T.woodDark, { rough: 0.5 }),
    cabinet: hqMat(T.cabinet, { rough: 0.5, metal: 0.25 }),
    door: hqMat(T.door, { rough: 0.6 }),
    leather: hqMat(T.leather, { rough: 0.45 }),
    books: hqMat(T.books, { rough: 0.85 }),
    paper: hqMat(T.paper, { rough: 0.9 }),
    cardboard: hqMat(T.cardboard, { rough: 0.95 }),
    metal: hqMat(T.metal, { rough: 0.4, metal: 0.6 }),
    paint: hqMat(T.metal, { rough: 0.6, metal: 0.1, color: 0xd8d0b8 }),
    poster: hqMat(T.poster, { rough: 0.9 }),
    calendar: hqMat(T.calendar, { rough: 0.9 }),
    clock: hqMat(T.clock, { rough: 0.4 }),
    screen: hqMat(T.screen, { rough: 0.15, metal: 0.2 }),
    beige: hqMat(null, { rough: 0.6, color: 0xb8ae94 }),
    black: hqMat(null, { rough: 0.5, color: 0x161616 }),
    brass: hqMat(null, { rough: 0.3, metal: 0.8, color: 0xb08a40 }),
    terracotta: hqMat(null, { rough: 0.9, color: 0x8a4a2a }),
    twig: hqMat(null, { rough: 0.9, color: 0x3a2a1a }),
    glass: hqMat(null, { rough: 0.08, metal: 0.3, color: 0x0c121c, emissive: 0x04070c }),
    blood: hqMat(T.blood, { rough: 0.2, alpha: true }),
    papers: hqMat(T.papers, { rough: 0.9, alpha: true }),
    shade: new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffd8a0 }),
    tube: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const add = (mesh, layer = LAYER_STATIC) => {
    mesh.layers.set(layer);
    mesh.castShadow = layer !== LAYER_LIVE;
    mesh.receiveShadow = layer !== LAYER_LIVE;
    scene.add(mesh);
    return mesh;
  };
  const box = (min, max, mat, s = 1, layer) => add(boxMesh(min, max, mat, s, 4), layer);
  const quad = (o, u, v, ul, vl, n, mat, s, layer = LAYER_STATIC) => {
    const b = newBuilder();
    addQuad(b, o, u, v, ul, vl, n, s, 4);
    return add(new THREE.Mesh(buildGeometry(b), mat), layer);
  };
  const cyl = (x, y, z, rt, rb, hh, mat, seg = 12, open = false) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hh, seg, 1, open), mat);
    m.position.set(x, y + hh / 2, z);
    return add(m);
  };

  // ---- 床・天井・壁 ----
  quad([x0, 0, z1], [1, 0, 0], [0, 0, -1], x1 - x0, z1 - z0, [0, 1, 0], M.floor, 1.2);
  quad([x0, h, z0], [1, 0, 0], [0, 0, 1], x1 - x0, z1 - z0, [0, -1, 0], M.ceil, 1.2);
  const walls = newBuilder();
  addQuad(walls, [x0, 0, z0], [1, 0, 0], [0, 1, 0], x1 - x0, h, [0, 0, 1], h, 1);
  addQuad(walls, [x1, 0, z1], [-1, 0, 0], [0, 1, 0], x1 - x0, h, [0, 0, -1], h, 1);
  addQuad(walls, [x0, 0, z1], [0, 0, -1], [0, 1, 0], z1 - z0, h, [1, 0, 0], h, 1);
  addQuad(walls, [x1, 0, z0], [0, 0, 1], [0, 1, 0], z1 - z0, h, [-1, 0, 0], h, 1);
  const wallMesh = add(new THREE.Mesh(buildGeometry(walls), M.wall));
  wallMesh.castShadow = false; // 窓の外の月明かりを通すため

  // 天井の配管
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 12, 8), M.metal);
  pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 3.02, -3.86); add(pipe);
  const pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 12, 8), M.metal);
  pipe2.rotation.z = Math.PI / 2; pipe2.position.set(0, 2.92, -3.9); add(pipe2);
  cyl(5.86, 0, -3.86, 0.045, 0.045, 3.2, M.metal, 8);
  box([-2.0, 3.12, 1.6], [-1.4, 3.2, 2.2], M.paint, 1); // 換気口

  // 蛍光灯
  box([-1.0, 3.1, -0.16], [1.0, 3.2, 0.16], M.paint, 1);
  const tube = box([-0.9, 3.05, -0.05], [0.9, 3.1, 0.05], M.tube, 1);
  tube.castShadow = false;

  // ---- 北西：タイプライターの机・椅子・スタンド ----
  box([-4.6, 0.72, -4], [-2.6, 0.77, -3.15], M.wood, 1);
  box([-4.55, 0, -3.95], [-4.05, 0.72, -3.2], M.wood, 1);
  box([-2.68, 0, -3.95], [-2.62, 0.72, -3.2], M.wood, 1);
  box([-4.05, 0.3, -3.95], [-2.68, 0.72, -3.9], M.wood, 1);
  for (let i = 0; i < 3; i++) box([-4.5, 0.06 + i * 0.22, -3.21], [-4.1, 0.24 + i * 0.22, -3.19], M.woodDark, 0.4);
  solid(-4.6, -4, -2.6, -3.15);
  box([-4.05, 0.77, -3.75], [-3.45, 0.88, -3.35], M.black, 1);
  box([-4.0, 0.88, -3.7], [-3.5, 0.92, -3.45], M.black, 1);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 10), M.black);
  roller.rotation.z = Math.PI / 2; roller.position.set(-3.75, 0.95, -3.7); add(roller);
  box([-3.9, 0.93, -3.73], [-3.6, 1.15, -3.72], M.paper, 0.3);
  cyl(-2.95, 0.77, -3.65, 0.08, 0.09, 0.03, M.shade);
  cyl(-2.95, 0.8, -3.65, 0.012, 0.012, 0.33, M.metal, 6);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 0.15, 14, 1, true), M.shade);
  shade.position.set(-2.95, 1.17, -3.62); add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.bulb);
  bulb.position.set(-2.95, 1.13, -3.62); add(bulb).castShadow = false;
  // 椅子
  box([-3.75, 0.42, -3.0], [-3.25, 0.47, -2.5], M.woodDark, 0.5);
  box([-3.75, 0.47, -2.5], [-3.25, 0.98, -2.45], M.woodDark, 0.5);
  for (const [lx, lz] of [[-3.73, -2.98], [-3.31, -2.98], [-3.73, -2.52], [-3.31, -2.52]]) box([lx, 0, lz], [lx + 0.04, 0.42, lz + 0.04], M.woodDark, 0.5);
  solid(-3.78, -3.02, -3.22, -2.42);

  // カレンダー
  quad([-2.0, 1.4, -3.99], [1, 0, 0], [0, 1, 0], 0.4, 0.42, [0, 0, 1], M.calendar, [0.4, 0.42]);

  // ---- 北：窓とラジエーター ----
  quad([-1.0, 1.0, -3.985], [1, 0, 0], [0, 1, 0], 2.6, 1.3, [0, 0, 1], M.glass, 1.3);
  box([-1.15, 0.9, -4], [1.75, 0.97, -3.8], M.woodDark, 1);
  box([-1.1, 2.3, -4], [1.7, 2.4, -3.9], M.woodDark, 1);
  box([-1.1, 1.0, -4], [-1.0, 2.3, -3.9], M.woodDark, 1);
  box([1.6, 1.0, -4], [1.7, 2.3, -3.9], M.woodDark, 1);
  box([0.27, 1.0, -4], [0.33, 2.3, -3.93], M.woodDark, 1);
  box([-1.0, 1.62, -4], [1.6, 1.67, -3.93], M.woodDark, 1);
  for (let i = 0; i < 14; i++) box([-0.5 + i * 0.115, 0.12, -3.97], [-0.43 + i * 0.115, 0.8, -3.84], M.paint, 0.3);
  box([-0.52, 0.12, -3.94], [1.12, 0.18, -3.87], M.paint, 0.3);
  solid(-0.55, -4, 1.15, -3.8);

  // ---- 北東：書類棚・ごみ箱 ----
  box([2.4, 0, -4], [3.0, 1.3, -3.4], M.cabinet, [0.6, 1.3]);
  box([3.02, 0, -4], [3.62, 1.3, -3.4], M.cabinet, [0.6, 1.3]);
  solid(2.4, -4, 3.62, -3.4);
  cyl(1.95, 0, -3.62, 0.17, 0.15, 0.42, M.metal, 14, true).material = M.metal;
  const crumple = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), M.paper);
  crumple.position.set(1.95, 0.42, -3.6); add(crumple);
  solid(1.75, -3.85, 2.15, -3.4);

  // ---- 西：本棚・塞がれた扉 ----
  box([-6, 0, -3.6], [-5.62, 2.1, -1.6], M.wood, 1);
  quad([-5.6, 0.08, -1.66], [0, 0, -1], [0, 1, 0], 1.88, 1.94, [1, 0, 0], M.books, [1.88, 1.94]);
  box([-5.62, 2.1, -3.65], [-5.55, 2.16, -1.55], M.wood, 1);
  box([-5.62, 0, -1.66], [-5.56, 2.1, -1.6], M.wood, 1);
  box([-5.62, 0, -3.6], [-5.56, 2.1, -3.54], M.wood, 1);
  solid(-6, -3.6, -5.55, -1.6);

  quad([-5.985, 0, 1.4], [0, 0, -1], [0, 1, 0], 1.2, 2.2, [1, 0, 0], M.door, [1.2, 2.2]);
  box([-6, 0, 0.1], [-5.92, 2.3, 0.2], M.woodDark, 1);
  box([-6, 0, 1.4], [-5.92, 2.3, 1.5], M.woodDark, 1);
  box([-6, 2.2, 0.1], [-5.92, 2.3, 1.5], M.woodDark, 1);
  box([-5.9, 0, 0.12], [-5.25, 0.62, 0.98], M.wood, 0.6);
  box([-5.85, 0.62, 0.3], [-5.35, 1.08, 0.82], M.cardboard, [0.5, 0.46]);
  box([-5.88, 0, 1.0], [-5.4, 0.45, 1.45], M.cardboard, [0.48, 0.45]);
  solid(-6, 0.1, -5.25, 1.5);

  // 南西：枯れた鉢植え
  cyl(-5.4, 0, 3.4, 0.2, 0.15, 0.38, M.terracotta, 12);
  for (let i = 0; i < 6; i++) {
    const t = box([-0.012, 0, -0.012], [0.012, 0.5 + (i % 3) * 0.12, 0.012], M.twig, 1);
    t.position.set(-5.4, 0.36, 3.4); t.rotation.set((i % 2 ? 1 : -1) * (0.2 + i * 0.05), i * 1.1, 0.25);
  }
  solid(-5.62, 3.18, -5.18, 3.62);

  // ---- 南：ソファ・ローテーブル ----
  box([-1.8, 0, 3.2], [0.8, 0.4, 3.95], M.leather, 0.8);
  box([-1.75, 0.4, 3.24], [-0.53, 0.52, 3.74], M.leather, 0.8);
  box([-0.47, 0.4, 3.24], [0.75, 0.52, 3.74], M.leather, 0.8);
  box([-1.8, 0.4, 3.72], [0.8, 0.98, 3.95], M.leather, 0.8);
  box([-2.0, 0, 3.2], [-1.8, 0.68, 3.95], M.leather, 0.8);
  box([0.8, 0, 3.2], [1.0, 0.68, 3.95], M.leather, 0.8);
  solid(-2.0, 3.2, 1.0, 4);
  box([-1.2, 0.38, 2.0], [0.2, 0.42, 2.7], M.woodDark, 1);
  for (const [lx, lz] of [[-1.15, 2.05], [0.11, 2.05], [-1.15, 2.61], [0.11, 2.61]]) box([lx, 0, lz], [lx + 0.04, 0.38, lz + 0.04], M.woodDark, 0.5);
  solid(-1.2, 2.0, 0.2, 2.7);
  const memo = box([-0.75, 0.42, 2.25], [-0.45, 0.425, 2.45], M.paper, [0.3, 0.2]);
  memo.rotation.y = 0.3;
  cyl(-0.05, 0.42, 2.35, 0.09, 0.07, 0.03, M.glass, 12);
  cyl(-1.0, 0.42, 2.2, 0.04, 0.035, 0.09, M.beige, 10);

  // 南の壁の張り紙
  quad([3.4, 1.3, 3.99], [-1, 0, 0], [0, 1, 0], 0.8, 1.1, [0, 0, -1], M.poster, [0.8, 1.1]);

  // ---- 東：事務机・パソコン・電話 ----
  box([2.8, 0.72, -1.6], [4.6, 0.77, -0.6], M.wood, 1);
  box([4.1, 0, -1.55], [4.55, 0.72, -0.65], M.wood, 1);
  box([2.82, 0, -1.55], [2.88, 0.72, -0.65], M.wood, 1);
  box([2.88, 0.3, -1.55], [4.1, 0.72, -1.5], M.wood, 1);
  for (let i = 0; i < 3; i++) box([4.15, 0.06 + i * 0.22, -0.65], [4.5, 0.24 + i * 0.22, -0.63], M.woodDark, 0.4);
  solid(2.8, -1.6, 4.6, -0.6);
  box([3.0, 0.77, -1.55], [3.45, 1.15, -1.12], M.beige, 1);
  box([3.06, 0.82, -1.12], [3.39, 1.1, -1.11], M.screen, [0.33, 0.28]);
  box([3.05, 0.77, -1.05], [3.5, 0.79, -0.88], M.beige, 1);
  box([3.65, 0.77, -1.5], [3.85, 0.84, -1.3], M.black, 1);
  box([3.55, 0.77, -1.25], [3.85, 0.775, -1.0], M.paper, [0.3, 0.25]);
  cyl(4.35, 0.77, -1.35, 0.04, 0.04, 0.1, M.beige, 10);
  // 倒れた椅子
  const chair = new THREE.Group();
  const cs = boxMesh([-0.25, 0, -0.25], [0.25, 0.05, 0.25], M.woodDark, 0.5, 4);
  const cb = boxMesh([-0.25, 0.05, 0.2], [0.25, 0.55, 0.25], M.woodDark, 0.5, 4);
  chair.add(cs, cb);
  for (const [lx, lz] of [[-0.23, -0.23], [0.19, -0.23], [-0.23, 0.19], [0.19, 0.19]]) chair.add(boxMesh([lx, -0.42, lz], [lx + 0.04, 0, lz + 0.04], M.woodDark, 0.5, 4));
  chair.rotation.set(Math.PI / 2, 0.7, 0, 'YXZ');
  chair.position.set(4.0, 0.25, 0.2);
  chair.traverse((m) => { if (m.isMesh) { m.layers.set(LAYER_STATIC); m.castShadow = m.receiveShadow = true; } });
  scene.add(chair);

  // 東の壁：時計・スイッチ・出口の扉
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), M.clock);
  clock.position.set(5.985, 2.35, -1.1); clock.rotation.y = -Math.PI / 2; add(clock);
  box([5.96, 1.15, 1.6], [6.0, 1.27, 1.68], M.beige, 1);
  quad([5.985, 0, 2.0], [0, 0, 1], [0, 1, 0], 1.2, 2.2, [-1, 0, 0], M.door, [1.2, 2.2]);
  box([5.92, 0, 1.9], [6, 2.3, 2.0], M.woodDark, 1);
  box([5.92, 0, 3.2], [6, 2.3, 3.3], M.woodDark, 1);
  box([5.92, 2.2, 1.9], [6, 2.3, 3.3], M.woodDark, 1);
  box([5.9, 0.98, 2.12], [5.97, 1.02, 2.28], M.brass, 1);

  // 南東：段ボールの山
  box([4.9, 0, 3.3], [5.95, 0.55, 3.95], M.cardboard, [0.65, 0.55]);
  box([5.1, 0.55, 3.4], [5.8, 0.95, 3.9], M.cardboard, [0.7, 0.4]);
  box([4.35, 0, 3.45], [4.85, 0.4, 3.95], M.cardboard, [0.5, 0.4]);
  solid(4.35, 3.3, 6, 4);

  // 血だまり・散らばった書類（影も奥行きも要らないので背景だけ）
  const decal = (x, z, w, d, mat, rot = 0, y = 0.006) => {
    const b = newBuilder();
    addQuad(b, [-w / 2, 0, d / 2], [1, 0, 0], [0, 0, -1], w, d, [0, 1, 0], [w, d], 1);
    const m = new THREE.Mesh(buildGeometry(b), mat);
    m.position.set(x, y, z); m.rotation.y = rot;
    add(m, LAYER_BAKE_ONLY).castShadow = false;
  };
  decal(0.8, 0.9, 1.9, 1.5, M.blood, 0.4);
  decal(4.9, 1.6, 1.0, 1.0, M.blood, 1.1);
  decal(3.6, 1.1, 0.7, 0.5, M.blood, 2.0);
  decal(-2.4, 0.6, 0.32, 0.32, M.papers, 0.6, 0.008);
  decal(0.9, -1.6, 0.32, 0.32, M.papers, -0.4, 0.008);
  decal(2.0, -2.4, 0.32, 0.32, M.papers, 1.4, 0.008);
  decal(3.3, 0.3, 0.32, 0.32, M.papers, 0.2, 0.008);

  // ---- 実行時に描くもの（PS1 風） ----
  const winMat = ps1Material({ map: textures.window, emissive: 0.6, opacity: 0.35 });
  const win = newBuilder();
  addQuad(win, [-1, 1.0, -3.975], [1, 0, 0], [0, 1, 0], 2.6, 1.3, [0, 0, 1], 1.3, 0.65);
  add(new THREE.Mesh(buildGeometry(win), winMat), LAYER_LIVE);
  const key = add(boxMesh([3.95, 0.77, -1.05], [4.12, 0.8, -0.95], ps1Material({ tint: 0xd8b040, emissive: 0.45 }), 10, 1), LAYER_LIVE);
  const ammo = add(boxMesh([3.15, 1.3, -3.78], [3.45, 1.42, -3.58], ps1Material({ tint: 0x7a6a2a, emissive: 0.15 }), 10, 1), LAYER_LIVE);

  // ---- 事前レンダリング用の照明 ----
  const fluoro = [];
  for (const fx of [-0.55, 0.55]) {
    const l = new THREE.PointLight(0xfff2dc, 30, 0, 2);
    l.position.set(fx, 2.95, 0);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.002; l.shadow.radius = 3;
    scene.add(l); fluoro.push(l);
  }
  const lamp = new THREE.PointLight(0xff9a4a, 7, 0, 2);
  lamp.position.set(-2.95, 1.06, -3.6);
  lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); lamp.shadow.bias = -0.003;
  scene.add(lamp);
  const moon = new THREE.SpotLight(0x6f86b8, 110, 0, 0.42, 0.6, 2);
  moon.position.set(0.3, 3.4, -6.5);
  moon.target.position.set(0.6, 0, -1.2);
  moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.002;
  scene.add(moon, moon.target);
  const hemi = new THREE.HemisphereLight(0x8a94a8, 0x2a2018, 0.35);
  scene.add(hemi);
  const bounce = new THREE.PointLight(0xd8c8a8, 2.5, 0, 2);
  bounce.position.set(0, 0.6, 0.5);
  scene.add(bounce);

  // ライトはどのレイヤーのカメラからも見えるようにする
  for (const l of [...fluoro, lamp, moon, hemi, bounce]) { l.layers.enableAll(); l.userData.base = l.intensity; }

  // 調べられる場所
  const interactables = [
    { id: 'typewriter', x: -3.6, z: -3.0, r: 0.9 },
    { id: 'lamp', x: -2.9, z: -3.1, r: 0.5 },
    { id: 'calendar', x: -1.8, z: -3.6, r: 0.5 },
    { id: 'window', x: 0.3, z: -3.6, r: 1.4 },
    { id: 'trash', x: 1.95, z: -3.3, r: 0.45 },
    { id: 'ammo', x: 3.3, z: -3.3, r: 0.6 },
    { id: 'cabinet', x: 2.7, z: -3.3, r: 0.6 },
    { id: 'bookshelf', x: -5.5, z: -2.6, r: 1.1 },
    { id: 'plant', x: -5.3, z: 3.1, r: 0.6 },
    { id: 'sofa', x: -0.5, z: 3.2, r: 1.2 },
    { id: 'memo', x: -0.6, z: 2.35, r: 0.8 },
    { id: 'poster', x: 3.0, z: 3.7, r: 0.6 },
    { id: 'boxes', x: 4.9, z: 3.1, r: 0.8 },
    { id: 'key', x: 4.0, z: -0.5, r: 0.6 },
    { id: 'desk', x: 3.4, z: -0.5, r: 0.8 },
    { id: 'chair', x: 4.0, z: 0.4, r: 0.6 },
    { id: 'exitDoor', x: 5.9, z: 2.6, r: 0.9 },
    { id: 'westDoor', x: -5.1, z: 0.8, r: 0.9 },
  ];

  return {
    scene, colliders, interactables,
    objects: { key, ammo, memo, winMat },
    bake: { fluoro, tube: M.tube, lamp, moon, hemi, bounce },
  };
}

// 扉が開く演出用の小さなシーン（こちらは毎フレーム高品質で描く）
export function buildDoorScene() {
  const scene = new THREE.Scene();
  const T = makeHQTextures();
  const frameMat = hqMat(T.woodDark, { rough: 0.5 });
  const b = newBuilder();
  addBox(b, [-0.75, 0, -0.1], [-0.6, 2.35, 0.12], 1, 1);
  addBox(b, [0.6, 0, -0.1], [0.75, 2.35, 0.12], 1, 1);
  addBox(b, [-0.75, 2.2, -0.1], [0.75, 2.35, 0.12], 1, 1);
  scene.add(new THREE.Mesh(buildGeometry(b), frameMat));
  const wall = newBuilder();
  addQuad(wall, [-4, 0, 0.1], [1, 0, 0], [0, 1, 0], 3.25, 3.2, [0, 0, 1], 3.2, 0.8);
  addQuad(wall, [0.75, 0, 0.1], [1, 0, 0], [0, 1, 0], 3.25, 3.2, [0, 0, 1], 3.2, 0.8, [1, 1, 1], [0.75 / 3.2 + 1.5 / 3.2, 0]);
  addQuad(wall, [-0.75, 2.35, 0.1], [1, 0, 0], [0, 1, 0], 1.5, 0.85, [0, 0, 1], 3.2, 0.8, [1, 1, 1], [0, 2.35 / 3.2]);
  scene.add(new THREE.Mesh(buildGeometry(wall), hqMat(T.wall, { rough: 0.9 })));
  const hinge = new THREE.Group();
  hinge.position.set(-0.6, 0, 0);
  const door = newBuilder();
  addBox(door, [0, 0, -0.04], [1.2, 2.2, 0.04], [1.2, 2.2], 0.4);
  const doorMesh = new THREE.Mesh(buildGeometry(door), hqMat(T.door, { rough: 0.6 }));
  doorMesh.castShadow = true;
  hinge.add(doorMesh);
  hinge.add(boxMesh([1.0, 1.0, 0.04], [1.12, 1.05, 0.1], hqMat(null, { rough: 0.3, metal: 0.8, color: 0xb08a40 }), 10, 1));
  scene.add(hinge);
  const floor = newBuilder();
  addQuad(floor, [-4, 0, 6], [1, 0, 0], [0, 0, -1], 8, 12, [0, 1, 0], 1.2, 1);
  const fl = new THREE.Mesh(buildGeometry(floor), hqMat(T.floor, { rough: 0.5 }));
  fl.receiveShadow = true;
  scene.add(fl);
  const light = new THREE.PointLight(0xffe0b0, 30, 0, 2);
  light.position.set(0.3, 2.6, 2.2);
  light.castShadow = true; light.shadow.mapSize.set(512, 512);
  scene.add(light);
  // 扉の向こうはほとんど真っ暗
  const beyond = new THREE.PointLight(0x5070a0, 3, 0, 2);
  beyond.position.set(0, 1.5, -3);
  scene.add(beyond);
  scene.add(new THREE.HemisphereLight(0x606878, 0x201810, 0.5));
  return { scene, hinge };
}
