// テクスチャを貼った多角柱で組んだローポリ人型。肩・肘・股・膝に関節があり、角度だけで動かす
import * as THREE from 'three';
import { addBox, buildGeometry, makeTexture, newBuilder, ps1Material } from './ps1.js';

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

function part(boxes, mat) {
  const b = newBuilder();
  for (const [min, max, color] of boxes) addBox(b, min, max, 10, 10, hex(color), false);
  return new THREE.Mesh(buildGeometry(b), mat);
}

export const HIP_HEIGHT = 0.9;

// ---- キャラクター用の小さなテクスチャ（PS1 らしく 64px、陰影は描き込み） ----
function shade(g, s, base, { folds = 6, noise = 18, seed = 1 } = {}) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  // 体の側面（u=0.25/0.75 付近）と背中を少し暗く
  const grd = g.createLinearGradient(0, 0, s, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.28)'); grd.addColorStop(0.3, 'rgba(0,0,0,0.05)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.06)'); grd.addColorStop(0.7, 'rgba(0,0,0,0.05)'); grd.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  let k = seed * 9301;
  const r = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
  for (let i = 0; i < folds; i++) {
    const x = r() * s, y = r() * s;
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 14, y + 6 + r() * 10); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 1 + (r() - 0.5) * 14, y + 6 + r() * 10); g.stroke();
  }
  const img = g.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * noise;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function blood(g, s, n, seed) {
  let k = seed * 7919;
  const r = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${90 + r() * 40},${8 + r() * 10},6,${0.55 + r() * 0.35})`;
    const x = s * (0.3 + r() * 0.4), y = r() * s, w = 3 + r() * 9;
    g.beginPath(); g.ellipse(x, y, w, w * (0.6 + r()), r() * 3, 0, 7); g.fill();
    g.fillRect(x - 1, y, 2, 6 + r() * 12);
  }
}

function makeSkinTextures(c) {
  const tex = {};
  tex.torso = makeTexture(64, (g, s) => {
    shade(g, s, c.top, { folds: 8, seed: 2 });
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(s * 0.49, 0, 1, s);           // 前立て
    g.fillStyle = c.collar || 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, s, 4);     // 襟
    if (c.vest) {
      g.fillStyle = c.vest; g.fillRect(s * 0.3, 6, s * 0.15, s - 10); g.fillRect(s * 0.55, 6, s * 0.15, s - 10);
      g.fillRect(0, 6, s * 0.12, s - 10); g.fillRect(s * 0.88, 6, s * 0.12, s - 10);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(s * 0.32, 18, s * 0.11, 8); g.fillRect(s * 0.57, 18, s * 0.11, 8);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(s * 0.32, 26, s * 0.11, 1); g.fillRect(s * 0.57, 26, s * 0.11, 1);
    } else {
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(s * 0.34, 14, 9, 10); g.fillRect(s * 0.56, 14, 9, 10);
    }
    if (c.torn) {
      g.fillStyle = c.skinTone; g.beginPath(); g.ellipse(s * 0.6, s * 0.55, 6, 9, 0.4, 0, 7); g.fill();
      g.beginPath(); g.ellipse(s * 0.15, s * 0.3, 5, 7, -0.3, 0, 7); g.fill();
      blood(g, s, 9, 3);
    }
  });
  tex.pants = makeTexture(64, (g, s) => {
    shade(g, s, c.pants, { folds: 7, seed: 4 });
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(s * 0.25, 0, 1, s); g.fillRect(s * 0.75, 0, 1, s);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(s * 0.18, s * 0.3, 12, 14);  // 腿のポケット
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(s * 0.18, s * 0.3, 12, 2);
    if (c.torn) blood(g, s, 4, 5);
  });
  tex.sleeve = makeTexture(64, (g, s) => {
    shade(g, s, c.sleeve, { folds: 6, seed: 6 });
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, s - 5, s, 5);
    if (c.torn) blood(g, s, 3, 7);
  });
  tex.skin = makeTexture(32, (g, s) => {
    shade(g, s, c.skin, { folds: 0, noise: 8, seed: 8 });
    if (c.torn) { g.fillStyle = 'rgba(70,40,40,0.5)'; g.fillRect(s * 0.4, s * 0.2, 5, 9); }
  });
  tex.boots = makeTexture(32, (g, s) => {
    shade(g, s, c.boots, { folds: 2, noise: 10, seed: 9 });
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 3, s, 1); g.fillRect(s * 0.45, 0, 2, s * 0.6);
  });
  tex.hair = makeTexture(32, (g, s) => {
    g.fillStyle = c.hair; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.3)' : 'rgba(255,230,200,0.12)'; g.fillRect((i * 7) % s, 0, 1, s); }
  });
  // 顔：球の u=0.5 が正面、v=0 が頭頂
  tex.face = makeTexture(64, (g, s) => {
    g.fillStyle = c.skin; g.fillRect(0, 0, s, s);
    const grd = g.createLinearGradient(0, 0, s, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.3)'); grd.addColorStop(0.5, 'rgba(255,240,220,0.08)'); grd.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    // 髪：上と後ろ
    g.fillStyle = c.hair;
    g.fillRect(0, 0, s, s * 0.3);
    g.fillRect(0, 0, s * 0.22, s * 0.78); g.fillRect(s * 0.78, 0, s * 0.22, s * 0.78);
    g.beginPath(); g.moveTo(s * 0.22, s * 0.3); g.quadraticCurveTo(s * 0.5, s * 0.42, s * 0.78, s * 0.3); g.lineTo(s * 0.78, s * 0.26); g.lineTo(s * 0.22, s * 0.26); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < s; x += 3) g.fillRect(x, 0, 1, s * 0.28);
    // 耳
    g.fillStyle = c.skin; g.fillRect(s * 0.24, s * 0.46, 3, 8); g.fillRect(s * 0.74, s * 0.46, 3, 8);
    // 眉・目・鼻・口
    const eye = c.eye || '#2a1c14';
    g.fillStyle = c.hair; g.fillRect(s * 0.4, s * 0.43, 6, 2); g.fillRect(s * 0.53, s * 0.43, 6, 2);
    if (c.torn) {
      g.fillStyle = 'rgba(40,20,20,0.75)'; g.fillRect(s * 0.39, s * 0.46, 8, 6); g.fillRect(s * 0.53, s * 0.46, 8, 6);
      g.fillStyle = '#d8d0a0'; g.fillRect(s * 0.42, s * 0.48, 2, 2); g.fillRect(s * 0.56, s * 0.48, 2, 2);
      g.fillStyle = '#3a0a08'; g.fillRect(s * 0.44, s * 0.62, 9, 4);
      g.fillStyle = 'rgba(110,10,8,0.8)'; g.fillRect(s * 0.45, s * 0.66, 3, 10); g.fillRect(s * 0.51, s * 0.65, 2, 7);
    } else {
      g.fillStyle = '#e8e0d4'; g.fillRect(s * 0.405, s * 0.475, 6, 3); g.fillRect(s * 0.535, s * 0.475, 6, 3);
      g.fillStyle = eye; g.fillRect(s * 0.42, s * 0.47, 3, 4); g.fillRect(s * 0.55, s * 0.47, 3, 4);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(s * 0.405, s * 0.465, 6, 1); g.fillRect(s * 0.535, s * 0.465, 6, 1);
      g.fillStyle = 'rgba(90,40,20,0.35)'; g.fillRect(s * 0.49, s * 0.5, 2, 7); g.fillRect(s * 0.47, s * 0.57, 5, 1);
      g.fillStyle = c.lips || '#8a4a3a'; g.fillRect(s * 0.45, s * 0.63, 7, 2);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(s * 0.44, s * 0.7, 9, 3);
    }
  });
  return tex;
}

function withColor(geo) {
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return geo;
}

// 上端 y0 から下へ len 伸びる多角柱（正面が u=0.5 になるよう開始角をずらす）
function prism(mat, rTop, rBot, len, seg, y0 = 0, sx = 1, sz = 1) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg, 1, false, -Math.PI, Math.PI * 2);
  g.translate(0, y0 - len / 2, 0);
  g.scale(sx, 1, sz);
  return new THREE.Mesh(withColor(g), mat);
}

export function makeHumanoid(c) {
  const tex = makeSkinTextures(c);
  const mat = {};
  for (const k in tex) mat[k] = ps1Material({ map: tex[k] });
  const plain = ps1Material();

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = HIP_HEIGHT;
  root.add(hips);
  hips.add(prism(mat.pants, 0.16, 0.15, 0.2, 8, 0.07, 1, 0.7));

  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(prism(mat.torso, 0.165, 0.155, 0.3, 8, 0.3, 1, 0.68));
  torso.add(prism(mat.torso, 0.2, 0.17, 0.27, 8, 0.57, 1, 0.62));
  torso.add(prism(mat.boots, 0.168, 0.168, 0.07, 8, 0.04, 1, 0.71)); // ベルト
  if (c.extra) torso.add(part(c.extra, plain));

  const head = new THREE.Group();
  head.position.y = 0.56;
  torso.add(head);
  head.add(prism(mat.skin, 0.05, 0.055, 0.1, 6, 0.08));
  const skull = new THREE.SphereGeometry(0.112, 10, 8, -Math.PI / 2);
  skull.scale(0.95, 1.14, 1.0);
  skull.translate(0, 0.16, 0.005);
  head.add(new THREE.Mesh(withColor(skull), mat.face));
  const hairCap = new THREE.SphereGeometry(0.12, 10, 5, -Math.PI / 2, Math.PI * 2, 0, Math.PI * 0.4);
  hairCap.scale(0.96, 1.16, 1.04);
  hairCap.translate(0, 0.165, -0.008);
  head.add(new THREE.Mesh(withColor(hairCap), mat.hair));

  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.255, 0.5, 0);
    torso.add(shoulder);
    shoulder.add(prism(mat.sleeve, 0.068, 0.052, 0.32, 7, 0.04));
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);
    elbow.add(prism(c.forearmSleeve ? mat.sleeve : mat.skin, 0.05, 0.038, 0.24, 7, 0.01));
    elbow.add(part([[[-0.035, -0.32, -0.03], [0.035, -0.225, 0.045], c.skin]], plain));
    return [shoulder, elbow];
  };
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.09, 0, 0);
    hips.add(hip);
    hip.add(prism(mat.pants, 0.09, 0.068, 0.46, 8, 0.02));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(prism(mat.pants, 0.068, 0.054, 0.3, 7, 0.02));
    knee.add(prism(mat.boots, 0.062, 0.068, 0.16, 7, -0.28));
    knee.add(part([[[-0.065, -0.46, -0.07], [0.065, -0.38, 0.17], c.boots]], plain));
    return [hip, knee];
  };

  const [armL, elbowL] = arm(1);
  const [armR, elbowR] = arm(-1);
  const [legL, kneeL] = leg(1);
  const [legR, kneeR] = leg(-1);
  const parts = { hips, torso, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR };
  return { root, parts, mat: plain };
}

export function makeGun() {
  return part([
    [[-0.02, -0.02, 0.0], [0.02, 0.03, 0.2], '#222428'],
    [[-0.018, -0.12, 0.0], [0.018, 0.0, 0.05], '#2a2a2a'],
  ], ps1Material());
}

// ---- ポーズ：関節角の集合。毎フレーム目標ポーズを作り、なめらかに追従させる ----

export const POSE_KEYS = [
  'hipsX', 'hipsY', 'hipsRx', 'hipsRy', 'hipsRz',
  'torsoRx', 'torsoRy', 'torsoRz', 'headRx', 'headRy', 'headRz',
  'armLx', 'armLy', 'armLz', 'armRx', 'armRy', 'armRz', 'elbowL', 'elbowR',
  'legLx', 'legLz', 'legRx', 'legRz', 'kneeL', 'kneeR',
];

export function zeroPose() {
  const p = {};
  for (const k of POSE_KEYS) p[k] = 0;
  return p;
}

export function dampPose(cur, target, dt, rate) {
  const k = 1 - Math.exp(-rate * dt);
  for (const key of POSE_KEYS) cur[key] += (target[key] - cur[key]) * k;
}

export function applyPose(P, p) {
  P.hips.position.set(p.hipsX, HIP_HEIGHT + p.hipsY, 0);
  P.hips.rotation.set(p.hipsRx, p.hipsRy, p.hipsRz);
  P.torso.rotation.set(p.torsoRx, p.torsoRy, p.torsoRz);
  P.head.rotation.set(p.headRx, p.headRy, p.headRz);
  P.armL.rotation.set(p.armLx, p.armLy, p.armLz);
  P.armR.rotation.set(p.armRx, p.armRy, p.armRz);
  P.elbowL.rotation.set(p.elbowL, 0, 0);
  P.elbowR.rotation.set(p.elbowR, 0, 0);
  P.legL.rotation.set(p.legLx, 0, p.legLz);
  P.legR.rotation.set(p.legRx, 0, p.legRz);
  P.kneeL.rotation.set(p.kneeL, 0, 0);
  P.kneeR.rotation.set(p.kneeR, 0, 0);
}
