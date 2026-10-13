// 第1章：物流センターの管理事務所（試作版 ROOM 01）
import * as THREE from 'three';
import { addQuad, boxMesh, buildGeometry, newBuilder, ps1Material, textures, rand } from '../ps1.js';
import { hqMat, tex, LAYER_LIVE, LAYER_STATIC, LAYER_BAKE_ONLY } from './kit.js';

const ROOM = { x0: -6, x1: 6, z0: -4, z1: 4, h: 3.2 };

// 固定カメラ。上から順に判定し、今のカメラだけ判定を広げてチラつきを防ぐ
const CAMS = [
  { name: 'door', pos: [2.2, 1.5, -1.3], look: [5.2, 0.9, 2.6], fov: 58, test: (x, z, m) => (x > 3.0 - m && z > 1.2 - m) || (x > 2.2 - m && z > 2.2 - m) },
  { name: 'window', pos: [1.6, 1.55, 1.6], look: [-0.1, 1.05, -4], fov: 56, test: (x, z, m) => x > -1.5 - m && x < 2.2 + m && z < -1.3 + m },
  { name: 'start', pos: [-1.3, 1.75, 3.75], look: [-5.0, 0.9, 0.8], fov: 56, test: (x, z, m) => (x < -2.1 + m && z > -0.6 - m) || (x < -1.5 + m && z > 2.6 - m) },
  { name: 'typewriter', pos: [-0.9, 2.1, 0.7], look: [-4.3, 0.8, -3.3], fov: 50, test: (x, z, m) => x < -1.5 + m && z < -0.6 + m },
  { name: 'center', pos: [-2.7, 1.55, -2.5], look: [2.0, 0.7, 2.6], fov: 56, test: (x, z, m) => x < 2.2 + m },
  { name: 'sofa', assist: true, pos: [1.6, 1.9, 0.2], look: [-4.6, 0.6, 3.4], fov: 54, test: () => false },
  { name: 'east', pos: [1.0, 2.2, 2.7], look: [4.7, 0.7, -1.7], fov: 52, test: () => true },
];

export function build() {
  const scene = new THREE.Scene();
  const T = tex();
  const colliders = []; // [x0, z0, x1, z1]
  const solid = (x0, z0, x1, z1) => colliders.push([x0, z0, x1, z1]);
  const { x0, x1, z0, z1, h } = ROOM;

  const M = {
    wall: hqMat(T.wall, { rough: 0.92 }),
    floor: hqMat(T.floor, { rough: 0.32 }),
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
  addQuad(walls, [x0, 0, z0], [1, 0, 0], [0, 1, 0], x1 - x0, h, [0, 0, 1], [6.4, h], 1);
  addQuad(walls, [x1, 0, z1], [-1, 0, 0], [0, 1, 0], x1 - x0, h, [0, 0, -1], [6.4, h], 1, [1, 1, 1], [0.37, 0]);
  addQuad(walls, [x0, 0, z1], [0, 0, -1], [0, 1, 0], z1 - z0, h, [1, 0, 0], [6.4, h], 1, [1, 1, 1], [0.61, 0]);
  addQuad(walls, [x1, 0, z0], [0, 0, 1], [0, 1, 0], z1 - z0, h, [-1, 0, 0], [6.4, h], 1, [1, 1, 1], [0.13, 0]);
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

  // ---- 作り込み：汚し・張り紙・小物 ----
  const X = {
    cork: hqMat(T.cork, { rough: 0.95 }),
    hand: hqMat(T.handprint, { rough: 0.3, alpha: true }),
    bullet: hqMat(T.bullet, { rough: 0.9, alpha: true }),
    glassBits: hqMat(T.glass, { rough: 0.05, metal: 0.4, alpha: true }),
    drag: hqMat(T.drag, { rough: 0.25, alpha: true }),
    exit: new THREE.MeshBasicMaterial({ map: T.exitSign }),
    binders: hqMat(T.binders, { rough: 0.7 }),
    ext: hqMat(T.extinguisher, { rough: 0.35, metal: 0.2 }),
    fuse: hqMat(T.fusebox, { rough: 0.5, metal: 0.4 }),
    slat: hqMat(null, { rough: 0.5, metal: 0.2, color: 0xb8b4a4 }),
    cord: hqMat(null, { rough: 0.6, color: 0x1a1a1a }),
    coat: hqMat(T.leather, { rough: 0.8, color: 0x5a5a5a }),
  };
  const wallDecal = (o, u, v, ul, vl, n, mat) => quad(o, u, v, ul, vl, n, mat, [ul, vl], LAYER_BAKE_ONLY).castShadow = false;

  // 西の壁：掲示板とコート掛け
  quad([-5.98, 1.25, 3.05], [0, 0, -1], [0, 1, 0], 1.1, 0.78, [1, 0, 0], X.cork, [1.1, 0.78]);
  box([-6, 1.2, 1.9], [-5.95, 2.08, 1.95], M.woodDark, 1); box([-6, 1.2, 3.05], [-5.95, 2.08, 3.1], M.woodDark, 1);
  cyl(-5.5, 0, 2.3, 0.025, 0.03, 1.75, M.woodDark, 8);
  cyl(-5.5, 0, 2.3, 0.2, 0.22, 0.03, M.woodDark, 10);
  box([-5.62, 1.15, 2.2], [-5.38, 1.68, 2.36], X.coat, 0.5);
  solid(-5.72, 2.08, -5.28, 2.52);

  // 北の壁：電話（受話器が垂れ下がっている）・分電盤・割れたガラス
  box([-2.42, 1.22, -4], [-2.2, 1.5, -3.94], M.beige, 1);
  const handset = box([-0.025, -0.11, -0.025], [0.025, 0.11, 0.025], M.beige, 1);
  handset.position.set(-2.3, 0.62, -3.86); handset.rotation.z = 0.3;
  const cordM = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 4), X.cord);
  cordM.position.set(-2.3, 1.0, -3.9); cordM.rotation.z = 0.1; add(cordM);
  box([5.15, 1.55, -4], [5.6, 2.1, -3.9], X.fuse, [0.45, 0.55]);
  const glassFloor = (x, z, s, r) => {
    const b = newBuilder();
    addQuad(b, [-s / 2, 0, s / 2], [1, 0, 0], [0, 0, -1], s, s, [0, 1, 0], [s, s], 1);
    const m = new THREE.Mesh(buildGeometry(b), X.glassBits);
    m.position.set(x, 0.007, z); m.rotation.y = r;
    add(m, LAYER_BAKE_ONLY).castShadow = false;
  };
  glassFloor(0.5, -3.35, 0.9, 0.3); glassFloor(1.1, -3.0, 0.5, 1.2);

  // 窓のブラインド（半分下りていて、1 枚外れている）
  for (let i = 0; i < 10; i++) {
    const y = 2.27 - i * 0.055;
    const slat = box([-0.97, -0.004, -0.03], [1.57, 0.004, 0.03], X.slat, 1);
    slat.position.set(0, y, -3.9); slat.rotation.x = 0.5;
    if (i === 7) { slat.rotation.set(0.5, 0, 0.35); slat.position.set(0.15, y - 0.25, -3.88); }
  }
  box([-1.0, 2.29, -3.95], [1.6, 2.33, -3.86], X.slat, 1);

  // 書類棚の上のバインダー、机の書類の山とケーブル
  box([2.45, 1.3, -3.98], [2.95, 1.6, -3.7], X.binders, [0.5, 0.3]);
  box([-4.5, 0.77, -3.9], [-4.2, 0.9, -3.5], M.paper, 0.3);
  box([4.2, 0.77, -1.5], [4.5, 0.93, -1.25], M.paper, 0.3);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.8, 4), X.cord);
  cable.position.set(3.2, 0.4, -1.57); add(cable);

  // 東の壁：血の手形・弾痕・非常口の誘導灯・消火器
  wallDecal([5.975, 0.85, 1.05], [0, 0, 1], [0, 1, 0], 0.7, 0.7, [-1, 0, 0], X.hand);
  wallDecal([5.975, 1.55, -2.6], [0, 0, 1], [0, 1, 0], 0.45, 0.45, [-1, 0, 0], X.bullet);
  wallDecal([-1.2, 1.45, 3.975], [-1, 0, 0], [0, 1, 0], 0.4, 0.4, [0, 0, -1], X.bullet);
  const exitSign = box([5.9, 2.42, 2.25], [5.99, 2.62, 2.95], X.exit, [0.7, 0.2]);
  exitSign.castShadow = false;
  cyl(5.83, 0.12, 1.45, 0.075, 0.075, 0.45, X.ext, 10);
  cyl(5.83, 0.57, 1.45, 0.03, 0.04, 0.07, M.black, 6);
  solid(5.65, 1.3, 6, 1.62);

  // 消えたままの予備の蛍光灯
  for (const fx of [-4.0, 4.0]) {
    box([fx - 0.9, 3.1, -0.16], [fx + 0.9, 3.2, 0.16], M.paint, 1);
    box([fx - 0.8, 3.06, -0.05], [fx + 0.8, 3.1, 0.05], M.glass, 1).castShadow = false;
  }

  // 床：引きずった血の跡と点々と続く血痕
  const floorDecal = (x, z, w, d, mat, rot) => {
    const b = newBuilder();
    addQuad(b, [-w / 2, 0, d / 2], [1, 0, 0], [0, 0, -1], w, d, [0, 1, 0], [w, d], 1);
    const m = new THREE.Mesh(buildGeometry(b), mat);
    m.position.set(x, 0.007, z); m.rotation.y = rot;
    add(m, LAYER_BAKE_ONLY).castShadow = false;
  };
  floorDecal(3.0, 1.3, 3.2, 0.8, X.drag, Math.PI - 0.08);
  for (let i = 0; i < 6; i++) floorDecal(-0.2 - i * 0.35, 1.4 + i * 0.25, 0.14, 0.14, M.blood, i);

  // ---- 実行時に描くもの（PS1 風） ----
  const winMat = ps1Material({ map: textures.window, emissive: 0.6, opacity: 0.35 });
  const win = newBuilder();
  addQuad(win, [-1, 1.0, -3.975], [1, 0, 0], [0, 1, 0], 2.6, 1.3, [0, 0, 1], 1.3, 0.65);
  add(new THREE.Mesh(buildGeometry(win), winMat), LAYER_LIVE);
  const key = add(boxMesh([3.95, 0.77, -1.05], [4.12, 0.8, -0.95], ps1Material({ tint: 0xd8b040, emissive: 0.45 }), 10, 1), LAYER_LIVE);
  // 救急箱（拾うと消えるので実行時に描く）
  const herb = new THREE.Group();
  const kitM = ps1Material({ tint: 0xe8e4d8, emissive: 0.2 });
  const crossM = ps1Material({ tint: 0xc01810, emissive: 0.35 });
  herb.add(boxMesh([-0.16, 0, -0.11], [0.16, 0.16, 0.11], kitM, 1, 1));
  herb.add(boxMesh([-0.035, 0.161, -0.09], [0.035, 0.165, 0.09], crossM, 1, 1));
  herb.add(boxMesh([-0.1, 0.161, -0.03], [0.1, 0.165, 0.03], crossM, 1, 1));
  herb.add(boxMesh([-0.05, 0.16, -0.015], [0.05, 0.19, 0.015], ps1Material({ tint: 0x3a3a3a }), 1, 1));
  herb.position.set(-5.65, 0, -0.85); herb.rotation.y = 0.4;
  herb.traverse((m) => m.layers.set(LAYER_LIVE));
  scene.add(herb);
  solid(-5.8, -1.0, -5.5, -0.7);
  const ammo = add(boxMesh([3.15, 1.3, -3.78], [3.45, 1.42, -3.58], ps1Material({ tint: 0x7a6a2a, emissive: 0.15 }), 10, 1), LAYER_LIVE);

  // ---- 事前レンダリング用の照明 ----
  const fluoro = [];
  for (const fx of [-0.55, 0.55]) {
    const l = new THREE.PointLight(0xe8f0ff, 16, 0, 2);
    l.position.set(fx, 2.95, 0);
    scene.add(l); fluoro.push(l);
  }
  const lamp = new THREE.PointLight(0xff9a4a, 5, 0, 2);
  lamp.position.set(-2.95, 1.06, -3.6);
  lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); lamp.shadow.bias = -0.003;
  scene.add(lamp);
  const moon = new THREE.SpotLight(0x6f86b8, 60, 0, 0.42, 0.6, 2);
  moon.position.set(0.3, 3.4, -6.5);
  moon.target.position.set(0.6, 0, -1.2);
  moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.002;
  scene.add(moon, moon.target);
  const hemi = new THREE.HemisphereLight(0x8a94a8, 0x2a2018, 0.1);
  scene.add(hemi);
  const bounce = new THREE.PointLight(0xd8c8a8, 1.0, 0, 2);
  bounce.position.set(0, 0.6, 0.5);
  scene.add(bounce);

  // 壁の照明（暖色のブラケットライト）と天井のダウンライトが部屋の主な明かり
  const live = [
    { pos: [-2.95, 1.06, -3.6], color: [1.0, 0.6, 0.3], range: 4.5 },
    { pos: [0.3, 2.0, -3.4], color: [0.25, 0.32, 0.5], range: 6 },
  ];
  const extra = [];
  const sconceGlass = new THREE.MeshBasicMaterial({ color: 0xd8a868 });
  const sconce = (x, z, nx, nz) => {
    const px = x + nx * 0.12, pz = z + nz * 0.12;
    const plate = box([-0.07, -0.1, -0.015], [0.07, 0.1, 0.015], M.brass, 1);
    plate.position.set(x + nx * 0.015, 2.0, z + nz * 0.015); plate.rotation.y = Math.atan2(nx, nz);
    const shadeM = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.13, 10, 1, true, -Math.PI / 2, Math.PI), sconceGlass);
    shadeM.position.set(x + nx * 0.02, 2.02, z + nz * 0.02); shadeM.rotation.y = Math.atan2(nx, nz) + Math.PI;
    add(shadeM).castShadow = false;
    const l = new THREE.PointLight(0xffb066, 3.2, 0, 2);
    l.position.set(px, 1.98, pz);
    l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.003; l.shadow.radius = 4;
    scene.add(l); extra.push(l);
    live.push({ pos: [px, 1.98, pz], color: [1.0, 0.7, 0.4], range: 4.5 });
  };
  sconce(2.1, -4, 0, 1); sconce(-3.2, 4, 0, -1); sconce(1.6, 4, 0, -1); sconce(-6, -0.6, 1, 0); sconce(6, 0.3, -1, 0);
  const downDisc = new THREE.MeshBasicMaterial({ color: 0xfff0d8 });
  const downlight = (x, z) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12), downDisc);
    ring.position.set(x, 3.19, z); add(ring).castShadow = false;
    const l = new THREE.SpotLight(0xffe2b8, 24, 0, 0.6, 0.85, 2);
    l.position.set(x, 3.12, z); l.target.position.set(x, 0, z);
    l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002;
    scene.add(l, l.target); extra.push(l);
    live.push({ pos: [x, 3.0, z], color: [1.0, 0.88, 0.7], range: 5 });
  };
  downlight(-0.4, 2.6); downlight(3.7, -1.0); downlight(5.0, 2.6); downlight(-4.6, 1.0);

  // ライトはどのレイヤーのカメラからも見えるようにする
  for (const l of [...fluoro, lamp, moon, hemi, bounce, ...extra]) { l.layers.enableAll(); l.userData.base = l.intensity; }

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
    { id: 'file:memo', x: -0.6, z: 2.35, r: 0.8 },
    { id: 'poster', x: 3.0, z: 3.7, r: 0.6 },
    { id: 'boxes', x: 4.9, z: 3.1, r: 0.8 },
    { id: 'key', x: 4.0, z: -0.5, r: 0.6 },
    { id: 'desk', x: 3.4, z: -0.5, r: 0.8 },
    { id: 'chair', x: 4.0, z: 0.4, r: 0.6 },
    { id: 'door:yard', x: 5.9, z: 2.6, r: 0.9 },
    { id: 'westDoor', x: -5.1, z: 0.8, r: 0.9 },
    { id: 'herb', x: -5.4, z: -0.85, r: 0.55 },
  ];

  // 破れた窓の縁に残るガラス（犬が飛び込むまでは隠しておく）
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
    m.visible = false;
    scene.add(m);
    return m;
  })();

  return {
    id: 'office', bounds: ROOM, scene, colliders, interactables, cams: CAMS,
    objects: { key, ammo, memo, winMat, herb, brokenGlass },
    pickups: [
      { id: 'office.key', item: 'key', mesh: key, at: 'key' },
      { id: 'office.ammo', item: 'ammo', count: 15, mesh: ammo, at: 'ammo' },
      { id: 'office.medkit', item: 'herb', mesh: herb, at: 'herb' },
    ],
    doors: { yard: { to: 'yard', spawn: [-9.0, 3.2, Math.PI / 2], lock: 'key', kind: 'wood' } },
    // 蛍光灯あり／なしの 2 枚を焼き、実行時に切れかけの明滅で混ぜる
    bake: {
      variant(on) {
        for (const l of fluoro) l.intensity = l.userData.base * (on ? 1 : 0.03);
        M.tube.color.setScalar(on ? 1 : 0.18);
        bounce.intensity = bounce.userData.base * (on ? 1 : 0.12);
      },
    },
    env: { rain: 1, flicker: true, ambient: [0.1, 0.1, 0.13], ambientLit: [0.25, 0.26, 0.28], lightning: { pos: [0.3, 2.0, -3.2], base: [0.18, 0.24, 0.4], range: 7 } },
    tick(dt, fx) {
      winMat.uniforms.uEmissive.value = 0.6 + fx.bolt * 0.4;
      winMat.uniforms.uUvOffset.value.y += dt * 1.6;
    },
    liveLights: live,
  };
}
