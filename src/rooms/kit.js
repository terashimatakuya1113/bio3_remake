// 部屋づくりの道具箱：背景用メッシュの配置・当たり判定・調べられる場所・照明をまとめる
// 部屋そのものは高品質マテリアルで「背景」として事前レンダリングする（レイヤー1）。
// 実行時は奥行きだけを描き、キャラクターや拾えるアイテムだけを PS1 風に重ねる（レイヤー0）。
import * as THREE from 'three';
import { addQuad, boxMesh, buildGeometry, newBuilder, ps1Material } from '../ps1.js';
import { makeHQTextures, hqMat } from '../hq.js';
import { makeHQTextures2 } from '../hq2.js';

export const LAYER_LIVE = 0, LAYER_STATIC = 1, LAYER_BAKE_ONLY = 2;

// テクスチャの生成は重いので、全部屋で 1 回だけ作って使い回す
let TEX = null;
export function tex() {
  if (!TEX) TEX = { ...makeHQTextures(), ...makeHQTextures2() };
  return TEX;
}

export { hqMat };

export function createKit(bounds) {
  const scene = new THREE.Scene();
  const T = tex();
  const colliders = []; // [x0, z0, x1, z1]
  const interactables = [];
  const live = [];   // キャラクターの頂点ライティングに使う照明
  const lights = []; // 背景を焼くための照明

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
  // 横倒しの円柱（配管・丸太など）。axis は 'x' か 'z'
  const pipe = (x, y, z, r, len, axis, mat, seg = 10) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    if (axis === 'x') m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    return add(m);
  };
  const solid = (x0, z0, x1, z1) => colliders.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  const solidBox = (min, max, mat, s) => { solid(min[0], min[2], max[0], max[2]); return box(min, max, mat, s); };

  // 床に貼る絵（影も奥行きも要らないので背景だけ）
  const decal = (x, z, w, d, mat, rot = 0, y = 0.006) => {
    const b = newBuilder();
    addQuad(b, [-w / 2, 0, d / 2], [1, 0, 0], [0, 0, -1], w, d, [0, 1, 0], [w, d], 1);
    const m = new THREE.Mesh(buildGeometry(b), mat);
    m.position.set(x, y, z); m.rotation.y = rot;
    add(m, LAYER_BAKE_ONLY).castShadow = false;
    return m;
  };
  const wallDecal = (o, u, v, ul, vl, n, mat) => { const m = quad(o, u, v, ul, vl, n, mat, [ul, vl], LAYER_BAKE_ONLY); m.castShadow = false; return m; };

  // 壁：内向きの 4 面（outdoor の部屋では使わない）
  const walls = (mat, h, texW = 6.4, opts = {}) => {
    const { x0, x1, z0, z1 } = bounds;
    const b = newBuilder();
    if (!opts.skipN) addQuad(b, [x0, 0, z0], [1, 0, 0], [0, 1, 0], x1 - x0, h, [0, 0, 1], [texW, h], 1);
    if (!opts.skipS) addQuad(b, [x1, 0, z1], [-1, 0, 0], [0, 1, 0], x1 - x0, h, [0, 0, -1], [texW, h], 1, [1, 1, 1], [0.37, 0]);
    if (!opts.skipW) addQuad(b, [x0, 0, z1], [0, 0, -1], [0, 1, 0], z1 - z0, h, [1, 0, 0], [texW, h], 1, [1, 1, 1], [0.61, 0]);
    if (!opts.skipE) addQuad(b, [x1, 0, z0], [0, 0, 1], [0, 1, 0], z1 - z0, h, [-1, 0, 0], [texW, h], 1, [1, 1, 1], [0.13, 0]);
    const m = add(new THREE.Mesh(buildGeometry(b), mat));
    return m;
  };
  const floor = (mat, s = 1.2, y = 0) => {
    const { x0, x1, z0, z1 } = bounds;
    return quad([x0, y, z1], [1, 0, 0], [0, 0, -1], x1 - x0, z1 - z0, [0, 1, 0], mat, s);
  };
  const ceiling = (mat, h, s = 1.2) => {
    const { x0, x1, z0, z1 } = bounds;
    return quad([x0, h, z0], [1, 0, 0], [0, 0, 1], x1 - x0, z1 - z0, [0, -1, 0], mat, s);
  };

  // 照明：背景用の光源を置き、必要ならキャラクター用の照明としても登録する
  const point = (pos, color, intensity, { shadow = false, live: L = null, size = 512 } = {}) => {
    const l = new THREE.PointLight(color, intensity, 0, 2);
    l.position.set(...pos);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(size, size); l.shadow.bias = -0.003; l.shadow.radius = 4; }
    scene.add(l); lights.push(l);
    if (L) live.push({ pos: [...pos], color: L.color, range: L.range });
    return l;
  };
  const spot = (pos, target, color, intensity, angle, { penumbra = 0.6, shadow = true, live: L = null, size = 1024 } = {}) => {
    const l = new THREE.SpotLight(color, intensity, 0, angle, penumbra, 2);
    l.position.set(...pos); l.target.position.set(...target);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(size, size); l.shadow.bias = -0.002; }
    scene.add(l, l.target); lights.push(l);
    if (L) live.push({ pos: [...pos], color: L.color, range: L.range });
    return l;
  };
  const hemi = (sky, ground, i) => { const l = new THREE.HemisphereLight(sky, ground, i); scene.add(l); lights.push(l); return l; };

  // 調べられる場所
  const look = (id, x, z, r = 0.7) => { interactables.push({ id, x, z, r }); };

  // 実行時に描く小物（拾うと消えるもの）
  const liveBox = (min, max, tint, emissive = 0.3) => add(boxMesh(min, max, ps1Material({ tint, emissive }), 10, 1), LAYER_LIVE);

  function finish(extra = {}) {
    for (const l of lights) { l.layers.enableAll(); l.userData.base = l.intensity; }
    return { scene, colliders, interactables, liveLights: live, bounds, ...extra };
  }

  return { scene, T, add, box, quad, cyl, pipe, solid, solidBox, decal, wallDecal, walls, floor, ceiling, point, spot, hemi, look, liveBox, finish, colliders, interactables, live, lights };
}

// 雨：カメラから見える範囲に細い線を降らせる（実行時のレイヤーで描く）
export function makeRain(scene, area, count = 900, color = 0x8a9ab8) {
  const { x0, x1, z0, z1, h = 6 } = area;
  const pos = new Float32Array(count * 6);
  const drops = [];
  for (let i = 0; i < count; i++) drops.push({ x: x0 + Math.random() * (x1 - x0), y: Math.random() * h, z: z0 + Math.random() * (z1 - z0), v: 9 + Math.random() * 4 });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 }));
  m.frustumCulled = false;
  m.layers.set(LAYER_LIVE);
  scene.add(m);
  return {
    mesh: m,
    update(dt) {
      for (let i = 0; i < count; i++) {
        const d = drops[i];
        d.y -= d.v * dt; d.x -= dt * 1.2;
        if (d.y < 0) { d.y += h; d.x = x0 + Math.random() * (x1 - x0); d.z = z0 + Math.random() * (z1 - z0); }
        const k = i * 6;
        pos[k] = d.x; pos[k + 1] = d.y; pos[k + 2] = d.z;
        pos[k + 3] = d.x + 0.03; pos[k + 4] = d.y + 0.24; pos[k + 5] = d.z;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}
