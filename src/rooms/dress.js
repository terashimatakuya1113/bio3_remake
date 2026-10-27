// 部屋の「汚し」：床のごみ・紙くず・汚れ・壁際にたまった埃・缶や瓶などを、部屋の種類に合わせて散らす
// 原作のプリレンダ背景が持っていた密度（隅の埃、床に散らばる物）を、すべての部屋に足すための仕上げ
// すべて背景としてだけ焼く（当たり判定には影響しない）
import * as THREE from 'three';
import { addQuad, buildGeometry, newBuilder } from '../ps1.js';
import { canvasTex, pixels, fbm, smooth, sat, mix, mul } from '../hq.js';
import { tex, hqMat, LAYER_STATIC, LAYER_BAKE_ONLY } from './kit.js';

const THEMES = {
  office: { indoor: true, papers: 1.4, glass: 0.4, leaves: 0, puddles: 0, cans: 0.3, card: 0.3, chunks: 0.3, grime: 1 },
  radio: { indoor: true, papers: 1.2, glass: 0.3, leaves: 0, puddles: 0, cans: 0.4, card: 0.2, chunks: 0.2, grime: 1 },
  warehouse: { indoor: true, papers: 0.8, glass: 0.2, leaves: 0, puddles: 0.2, cans: 0.5, card: 1.2, chunks: 0.6, grime: 1.2, tires: 1 },
  cold: { indoor: true, papers: 0.4, glass: 0.3, leaves: 0, puddles: 0.8, cans: 0.2, card: 0.5, chunks: 0.2, grime: 0.7, frost: 1 },
  yard: { indoor: false, papers: 0.7, glass: 0.3, leaves: 1.2, puddles: 1.2, cans: 1, card: 0.6, chunks: 1, grime: 1, tires: 1 },
  checkpoint: { indoor: false, papers: 0.6, glass: 0.5, leaves: 1.4, puddles: 1.2, cans: 0.8, card: 0.3, chunks: 1.2, grime: 1, tires: 1 },
  freight: { indoor: false, papers: 0.5, glass: 0.3, leaves: 1, puddles: 1.4, cans: 0.8, card: 0.5, chunks: 1.2, grime: 1, tires: 0.6 },
};

function rng(str) {
  let k = 7;
  for (const ch of str) k = (k * 31 + ch.charCodeAt(0)) % 2147483647;
  return () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
}

// ---------------------------------------------------------------- 汚し用のテクスチャ（一度だけ作る）
let DT = null;
function dressTextures() {
  if (DT) return DT;
  const T = {};
  // 柔らかい汚れのしみ（透過）
  T.grime = canvasTex(256, (g, S) => pixels(g, S, S, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const n = fbm(u * 5, v * 5, 5, 5, 301);
    const a = smooth(1.0, 0.2, d + (n - 0.5) * 0.9) * (0.35 + 0.65 * fbm(u * 18, v * 18, 18, 3, 303));
    const c = mix([0.1, 0.085, 0.06], [0.2, 0.16, 0.1], fbm(u * 9, v * 9, 9, 3, 305));
    return [...c, sat(a * 0.85)];
  }), { repeat: false });
  // 壁際にたまった埃（横長の帯。下端ほど濃い）
  T.edge = canvasTex(512, (g, W, H) => pixels(g, W, H, (u, v) => {
    const n = fbm(u * 24, v * 2, 24, 4, 311);
    const a = smooth(0.0, 1.0, v + (n - 0.5) * 0.5) * (0.4 + 0.6 * fbm(u * 60, v * 6, 60, 2, 313)); // 下端（uv の v=0、壁際）ほど濃い
    return [0.07, 0.06, 0.045, sat(a * 1.15)];
  }), { h: 64 });
  // 壁の下の方の汚れ（下から上へ薄く）
  T.wallGrime = canvasTex(512, (g, W, H) => pixels(g, W, H, (u, v) => {
    const n = fbm(u * 16, v * 3, 16, 4, 321);
    const splash = smooth(0.55, 0.85, fbm(u * 40, v * 8, 40, 3, 323)) * smooth(0.3, 1, v);
    const a = smooth(0.15, 1.0, v + (n - 0.5) * 0.45) * 0.9 + splash * 0.3;
    return [0.08, 0.065, 0.045, sat(a)];
  }), { h: 128 });
  // 新聞紙（くしゃくしゃの陰影つき）
  T.news = canvasTex(128, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.save(); g.translate(S / 2, S / 2); g.rotate(0.15);
    g.fillStyle = '#c8c4b4'; g.beginPath(); g.moveTo(-50, -40); g.lineTo(46, -46); g.lineTo(52, 38); g.lineTo(-44, 44); g.closePath(); g.fill();
    g.fillStyle = '#2a2a28'; g.fillRect(-42, -38, 80, 8);
    g.fillStyle = 'rgba(40,40,40,0.55)';
    for (let col = 0; col < 4; col++) for (let y = -26; y < 36; y += 3) g.fillRect(-42 + col * 21, y, 17 - ((y * 7 + col * 13) % 5), 1.2);
    g.fillStyle = 'rgba(60,60,60,0.6)'; g.fillRect(-20, -24, 26, 18);
    g.restore();
    pixels(g, S, S, (u, v, c) => {
      const f = fbm(u * 6, v * 6, 6, 3, 331);
      return [...mul(c, 0.7 + 0.5 * f), 1];
    });
    // pixels で塗りつぶされた透過を戻す
    const img = g.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) if (img.data[i] + img.data[i + 1] + img.data[i + 2] < 12) img.data[i + 3] = 0;
    g.putImageData(img, 0, 0);
  }, { repeat: false });
  // 紙切れ（数枚）
  T.sheet = canvasTex(64, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#d8d2c0'; g.beginPath(); g.moveTo(8, 6); g.lineTo(54, 10); g.lineTo(50, 58); g.lineTo(5, 52); g.closePath(); g.fill();
    g.fillStyle = 'rgba(70,66,60,0.7)'; for (let y = 16; y < 50; y += 4) g.fillRect(12, y, 28 + (y % 3) * 4, 1);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(54, 10); g.lineTo(44, 12); g.lineTo(50, 22); g.closePath(); g.fill();
    g.fillStyle = 'rgba(90,70,40,0.2)'; g.beginPath(); g.arc(30, 40, 9, 0, 7); g.fill();
  }, { repeat: false });
  // 落ち葉
  T.leaves = canvasTex(128, (g, S) => {
    g.clearRect(0, 0, S, S);
    let k = 17; const r = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
    for (let i = 0; i < 26; i++) {
      const x = 14 + r() * 100, y = 14 + r() * 100, s = 4 + r() * 6, a = r() * 6.3;
      const c = [[92, 62, 28], [70, 52, 26], [110, 80, 34], [58, 48, 30], [84, 46, 22]][Math.floor(r() * 5)];
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.beginPath(); g.ellipse(0, 0, s, s * 0.5, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
      g.restore();
    }
  }, { repeat: false });
  // ひび割れ
  T.crack = canvasTex(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    let k = 29; const r = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
    const branch = (x, y, a, len, w) => {
      g.strokeStyle = 'rgba(14,12,10,0.85)'; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < len; i++) {
        a += (r() - 0.5) * 0.8; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y);
        if (r() < 0.12 && w > 0.8) { g.stroke(); branch(x, y, a + (r() < 0.5 ? 0.9 : -0.9), len / 2, w * 0.6); g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    };
    branch(20, S / 2, 0, 38, 2.2);
  }, { repeat: false });
  // 油じみ
  T.oil = canvasTex(128, (g, S) => pixels(g, S, S, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const n = fbm(u * 4, v * 4, 4, 4, 341);
    const a = smooth(1.0, 0.6, d + (n - 0.5) * 0.6);
    const ring = smooth(0.08, 0.0, Math.abs(d + (n - 0.5) * 0.6 - 0.8));
    return [0.04 + ring * 0.08, 0.04 + ring * 0.06, 0.05 + ring * 0.1, sat(a * 0.8 + ring * 0.3)];
  }), { repeat: false });
  // 水たまり（縁ほど薄い）
  T.wet = canvasTex(256, (g, S) => pixels(g, S, S, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const n = fbm(u * 3, v * 3, 3, 5, 351);
    const a = smooth(0.95, 0.75, d + (n - 0.5) * 0.7);
    return [0.05, 0.055, 0.065, a * 0.55];
  }), { repeat: false });
  // タイヤ痕
  T.tire = canvasTex(256, (g, W, H) => pixels(g, W, H, (u, v) => {
    const tread = (Math.floor(u * 64) % 2) * 0.3 + 0.7;
    const band = smooth(0.0, 0.15, v) * smooth(1.0, 0.85, v);
    const a = band * tread * (0.35 + 0.5 * fbm(u * 8, v, 8, 3, 361)) * smooth(0, 0.15, u) * smooth(1, 0.7, u);
    return [0.05, 0.05, 0.05, sat(a)];
  }), { h: 32 });
  // 霜（冷蔵倉庫）
  T.frostPatch = canvasTex(128, (g, S) => pixels(g, S, S, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const n = fbm(u * 8, v * 8, 8, 5, 371);
    const a = smooth(1.0, 0.3, d + (n - 0.5) * 0.8) * (0.4 + 0.6 * fbm(u * 30, v * 30, 30, 2, 373));
    return [0.8, 0.86, 0.9, sat(a * 0.45)];
  }), { repeat: false });
  // 包み紙・菓子袋
  T.wrapper = canvasTex(64, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#a8261c'; g.beginPath(); g.moveTo(14, 20); g.lineTo(46, 14); g.lineTo(52, 40); g.lineTo(20, 48); g.closePath(); g.fill();
    g.fillStyle = '#e8d040'; g.fillRect(24, 26, 16, 6);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(18, 22, 3, 20);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(46, 14); g.lineTo(52, 40); g.lineTo(44, 36); g.closePath(); g.fill();
  }, { repeat: false });
  DT = T;
  return T;
}

function decalMat(map, { rough = 0.95, metal = 0, color = 0xffffff, cutout = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: metal, color });
  if (cutout) { m.alphaTest = 0.4; }
  else { m.transparent = true; m.depthWrite = false; }
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  return m;
}

// ---------------------------------------------------------------- 本体
export function dressRoom(room) {
  const th = THEMES[room.id];
  if (!th || !room.bounds) return;
  const r = rng(room.id);
  const D = dressTextures();
  const T = tex();
  const { x0, x1, z0, z1 } = room.bounds;
  const scene = room.scene;
  const M = {
    grime: decalMat(D.grime), edge: decalMat(D.edge), wallGrime: decalMat(D.wallGrime, { rough: 1 }),
    news: decalMat(D.news, { cutout: true, rough: 0.9, color: 0xb0aca0 }), sheet: decalMat(D.sheet, { cutout: true, color: 0xaaa69a }), leaves: decalMat(D.leaves, { cutout: true, rough: 0.7 }),
    crack: decalMat(D.crack), oil: decalMat(D.oil, { rough: 0.15 }), wet: decalMat(D.wet, { rough: 0.04, metal: 0.1 }),
    tire: decalMat(D.tire), frost: decalMat(D.frostPatch, { rough: 0.3 }), wrapper: decalMat(D.wrapper, { cutout: true, rough: 0.4 }),
    glass: decalMat(T.glass, { cutout: true, rough: 0.05, metal: 0.3 }),
    can: hqMat(T.metal, { rough: 0.25, metal: 0.8, color: 0xb03028 }), can2: hqMat(T.metal, { rough: 0.25, metal: 0.8, color: 0x8a9aa8 }),
    bottle: new THREE.MeshStandardMaterial({ color: 0x1e4a24, roughness: 0.08, metalness: 0.1 }), bottle2: new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 0.08, metalness: 0.1 }),
    chunk: hqMat(T.concrete, { rough: 0.95, color: 0x9a968c }), brick: hqMat(T.concrete, { rough: 0.9, color: 0x8a4a34 }),
    card: hqMat(T.cardboard, { rough: 0.95 }), plank: hqMat(T.wood, { rough: 0.85 }),
  };

  // 物を置いてはいけない場所：調べられる場所・拾えるアイテム・扉の前
  const keep = [];
  for (const it of room.interactables || []) keep.push([it.x, it.z, (it.r || 0.7) * (it.id.startsWith('door') ? 1.1 : 0.7)]);
  for (const p of room.pickups || []) if (p.mesh) { const w = new THREE.Vector3(); p.mesh.getWorldPosition(w); keep.push([w.x, w.z, 0.5]); }
  const blocked = (x, z, pad = 0) => keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + pad);
  const inSolid = (x, z, pad = 0) => room.colliders.some(([ax0, az0, ax1, az1]) => x > ax0 - pad && x < ax1 + pad && z > az0 - pad && z < az1 + pad);

  // 壁や物の際に寄せた位置を選ぶ（埃やごみは隅にたまる）
  const pickSpot = (edgeBias = 0.6, pad = 0.15) => {
    for (let tries = 0; tries < 40; tries++) {
      let x, z;
      if (r() < edgeBias) {
        if (r() < 0.5 && room.colliders.length) {
          const [ax0, az0, ax1, az1] = room.colliders[Math.floor(r() * room.colliders.length)];
          const side = Math.floor(r() * 4), off = 0.12 + r() * 0.35;
          x = side === 0 ? ax0 - off : side === 1 ? ax1 + off : ax0 + r() * (ax1 - ax0);
          z = side === 2 ? az0 - off : side === 3 ? az1 + off : az0 + r() * (az1 - az0);
        } else {
          const side = Math.floor(r() * 4), off = 0.12 + r() * 0.5;
          x = side === 0 ? x0 + off : side === 1 ? x1 - off : x0 + r() * (x1 - x0);
          z = side === 2 ? z0 + off : side === 3 ? z1 - off : z0 + r() * (z1 - z0);
        }
      } else { x = x0 + 0.3 + r() * (x1 - x0 - 0.6); z = z0 + 0.3 + r() * (z1 - z0 - 0.6); }
      if (x < x0 + 0.08 || x > x1 - 0.08 || z < z0 + 0.08 || z > z1 - 0.08) continue;
      if (inSolid(x, z, pad) || blocked(x, z)) continue;
      return [x, z];
    }
    return null;
  };

  let layerY = 0.004;
  const flat = (x, z, w, d, mat, rot = r() * Math.PI * 2) => {
    const b = newBuilder();
    addQuad(b, [-w / 2, 0, d / 2], [1, 0, 0], [0, 0, -1], w, d, [0, 1, 0], [w, d], 1);
    const m = new THREE.Mesh(buildGeometry(b), mat);
    layerY = layerY > 0.014 ? 0.004 : layerY + 0.0007;
    m.position.set(x, layerY, z); m.rotation.y = rot;
    m.layers.set(LAYER_BAKE_ONLY); m.receiveShadow = true; m.castShadow = false;
    scene.add(m);
    return m;
  };
  const solid3d = (mesh) => { mesh.layers.set(LAYER_STATIC); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh; };
  const area = (x1 - x0) * (z1 - z0);
  const n = (k) => Math.round(area * k * (0.8 + r() * 0.4));

  // 1) 床の際にたまった埃の帯
  const edgeStrip = (ax, az, bx, bz, nx, nz) => {
    const len = Math.hypot(bx - ax, bz - az), w = 0.9 * th.grime;
    for (let s = 0; s < len; s += 2.4) {
      const l = Math.min(2.6, len - s); if (l < 0.3) break;
      const cx = ax + (bx - ax) * (s + l / 2) / len + nx * w / 2, cz = az + (bz - az) * (s + l / 2) / len + nz * w / 2;
      const b = newBuilder();
      // u = 壁に沿う向き、v = 壁から離れる向き（v=0 が壁際で濃い）
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      addQuad(b, [-ux * l / 2 - nx * w / 2, 0, -uz * l / 2 - nz * w / 2], [ux, 0, uz], [nx, 0, nz], l, w, [0, 1, 0], [l * 0.7, w], 1, [1, 1, 1], [r(), 0]);
      // 法線が上向きになるよう面の向きを揃える
      const g = buildGeometry(b);
      if ((ux * nz - uz * nx) > 0) g.index.array.reverse();
      const m = new THREE.Mesh(g, M.edge);
      m.position.set(cx, 0.003, cz); m.layers.set(LAYER_BAKE_ONLY); m.receiveShadow = true;
      scene.add(m);
    }
  };
  edgeStrip(x0, z0, x1, z0, 0, 1); edgeStrip(x1, z1, x0, z1, 0, -1);
  edgeStrip(x0, z1, x0, z0, 1, 0); edgeStrip(x1, z0, x1, z1, -1, 0);
  // 家具や箱の足元にも
  for (const [ax0, az0, ax1, az1] of room.colliders) {
    if ((ax1 - ax0) * (az1 - az0) > 30 || (ax1 - ax0) < 0.2 || (az1 - az0) < 0.2) continue;
    if (r() < 0.7) flat((ax0 + ax1) / 2, (az0 + az1) / 2, (ax1 - ax0) + 0.7, (az1 - az0) + 0.7, M.grime, 0);
  }

  // 2) 壁の下の汚れ（屋内）
  if (th.indoor) {
    const h = 0.85;
    const wall = (o, u, len, nrm) => {
      const b = newBuilder();
      addQuad(b, o, u, [0, 1, 0], len, h, nrm, [len * 0.5, h], 1, [1, 1, 1], [r(), 0]);
      // uv の v=0 が床側で、テクスチャの下端（濃い側）に当たる
      const m = new THREE.Mesh(buildGeometry(b), M.wallGrime); m.layers.set(LAYER_BAKE_ONLY); m.receiveShadow = true; scene.add(m);
    };
    const e = 0.012;
    wall([x0, 0, z0 + e], [1, 0, 0], x1 - x0, [0, 0, 1]);
    wall([x1, 0, z1 - e], [-1, 0, 0], x1 - x0, [0, 0, -1]);
    wall([x0 + e, 0, z1], [0, 0, -1], z1 - z0, [1, 0, 0]);
    wall([x1 - e, 0, z0], [0, 0, 1], z1 - z0, [-1, 0, 0]);
  }

  // 3) 床のしみ・ひび・油・水たまり・タイヤ痕
  for (let i = 0; i < n(0.09 * th.grime); i++) { const p = pickSpot(0.3, 0); if (p) flat(p[0], p[1], 0.8 + r() * 1.6, 0.8 + r() * 1.6, M.grime); }
  for (let i = 0; i < n(0.025); i++) { const p = pickSpot(0.2, 0); if (p) flat(p[0], p[1], 1.2 + r() * 1.4, 1.2 + r() * 1.4, M.crack); }
  if (!th.frost) for (let i = 0; i < n(0.008); i++) { const p = pickSpot(0.4, 0); if (p) flat(p[0], p[1], 0.6 + r() * 0.9, 0.5 + r() * 0.7, M.oil); }
  for (let i = 0; i < n(0.02 * th.puddles); i++) { const p = pickSpot(0.2, 0.1); if (p) flat(p[0], p[1], 0.8 + r() * 1.8, 0.6 + r() * 1.2, M.wet); }
  if (th.tires) for (let i = 0; i < Math.round(2 * th.tires); i++) {
    const p = pickSpot(0, 0); if (!p) continue;
    const a = r() * Math.PI, len = 3 + r() * 3;
    for (const s of [-0.75, 0.75]) flat(p[0] + Math.sin(a) * s, p[1] + Math.cos(a) * s, len, 0.24, M.tire, a);
  }
  if (th.frost) for (let i = 0; i < n(0.05); i++) { const p = pickSpot(0.7, 0); if (p) flat(p[0], p[1], 0.5 + r() * 1.2, 0.5 + r() * 1.2, M.frost); }

  // 4) 紙くず・新聞・落ち葉・ガラス片・包み紙
  for (let i = 0; i < n(0.16 * th.papers); i++) { const p = pickSpot(0.55); if (p) flat(p[0], p[1], 0.22 + r() * 0.12, 0.26 + r() * 0.12, M.sheet); }
  for (let i = 0; i < n(0.05 * th.papers); i++) { const p = pickSpot(0.6); if (p) flat(p[0], p[1], 0.5 + r() * 0.2, 0.5 + r() * 0.2, M.news); }
  for (let i = 0; i < n(0.12 * th.leaves); i++) { const p = pickSpot(0.75, 0.05); if (p) flat(p[0], p[1], 0.5 + r() * 0.7, 0.5 + r() * 0.7, M.leaves); }
  for (let i = 0; i < n(0.03 * th.glass); i++) { const p = pickSpot(0.5); if (p) flat(p[0], p[1], 0.4 + r() * 0.3, 0.4 + r() * 0.3, M.glass); }
  for (let i = 0; i < n(0.04 * th.cans); i++) { const p = pickSpot(0.6); if (p) flat(p[0], p[1], 0.14, 0.14, M.wrapper); }

  // 5) 立体の小物：空き缶・瓶・瓦礫・つぶれた段ボール・板切れ
  const can = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10);
  const bottleG = (() => {
    const g = new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.036, 0.16], [0.03, 0.19], [0.013, 0.22], [0.013, 0.27], [0, 0.27]].map(([a, b]) => new THREE.Vector2(a, b)), 10);
    g.translate(0, -0.135, 0); return g;
  })();
  for (let i = 0; i < n(0.05 * th.cans); i++) {
    const p = pickSpot(0.6); if (!p) continue;
    const m = solid3d(new THREE.Mesh(can, r() < 0.5 ? M.can : M.can2));
    m.rotation.set(Math.PI / 2, 0, r() * Math.PI * 2); m.rotation.order = 'YXZ'; m.rotation.y = r() * 6.3;
    m.position.set(p[0], 0.033, p[1]);
  }
  for (let i = 0; i < n(0.025 * th.cans); i++) {
    const p = pickSpot(0.7); if (!p) continue;
    const m = solid3d(new THREE.Mesh(bottleG, r() < 0.5 ? M.bottle : M.bottle2));
    if (r() < 0.6) { m.rotation.order = 'YXZ'; m.rotation.set(Math.PI / 2, r() * 6.3, 0); m.position.set(p[0], 0.036, p[1]); }
    else m.position.set(p[0], 0.135, p[1]);
  }
  for (let i = 0; i < n(0.07 * th.chunks); i++) {
    const p = pickSpot(0.7); if (!p) continue;
    const s = 0.05 + r() * 0.12;
    const g = new THREE.DodecahedronGeometry(s, 0);
    const pa = g.attributes.position;
    for (let k = 0; k < pa.count; k++) pa.setXYZ(k, pa.getX(k) * (0.7 + r() * 0.6), pa.getY(k) * (0.4 + r() * 0.4), pa.getZ(k) * (0.7 + r() * 0.6));
    g.computeVertexNormals();
    const m = solid3d(new THREE.Mesh(g, r() < 0.3 ? M.brick : M.chunk));
    m.position.set(p[0], s * 0.3, p[1]); m.rotation.y = r() * 6.3;
  }
  for (let i = 0; i < n(0.03 * th.card); i++) {
    const p = pickSpot(0.7, 0.2); if (!p) continue;
    const w = 0.4 + r() * 0.4, d = 0.3 + r() * 0.3;
    const m = solid3d(new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), M.card));
    m.position.set(p[0], 0.008 + r() * 0.01, p[1]); m.rotation.set((r() - 0.5) * 0.06, r() * 6.3, (r() - 0.5) * 0.06);
  }
  for (let i = 0; i < n(0.015 * th.chunks); i++) {
    const p = pickSpot(0.8, 0.25); if (!p) continue;
    const m = solid3d(new THREE.Mesh(new THREE.BoxGeometry(0.9 + r() * 0.6, 0.03, 0.1), M.plank));
    m.position.set(p[0], 0.02, p[1]); m.rotation.set(0, r() * 6.3, (r() - 0.5) * 0.1);
  }
}
