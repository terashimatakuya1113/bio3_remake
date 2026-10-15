// テクスチャを貼った多角柱で組んだローポリ人型。肩・肘・股・膝に関節があり、角度だけで動かす
// 後期の PS1 作品にならい、128px のテクスチャに陰影を描き込み、頂点カラーに接触陰影を焼き込む
import * as THREE from 'three';
import { addBox, buildGeometry, makeTexture, newBuilder, ps1Material } from './ps1.js';

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

function part(boxes, mat) {
  const b = newBuilder();
  for (const [min, max, color] of boxes) addBox(b, min, max, 10, 10, hex(color), false);
  return new THREE.Mesh(buildGeometry(b), mat);
}

export const HIP_HEIGHT = 0.9;
const TS = 128; // キャラクターのテクスチャの大きさ

function rng(seed) {
  let k = (seed * 9301 + 49297) % 233280 || 1;
  return () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
}

// 布地：地の色に、側面の陰り・上からの光・織り目・しわ・縫い目を描き込む
function shade(g, s, base, { folds = 10, noise = 14, seed = 1, weave = true, top = 0.1 } = {}) {
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  // 体の側面（u=0.25/0.75 付近）と背中を暗く、正面をわずかに明るく
  const grd = g.createLinearGradient(0, 0, s, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.38)'); grd.addColorStop(0.22, 'rgba(0,0,0,0.12)');
  grd.addColorStop(0.5, 'rgba(255,245,230,0.10)'); grd.addColorStop(0.78, 'rgba(0,0,0,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  // 上から当たる光
  const vg = g.createLinearGradient(0, 0, 0, s);
  vg.addColorStop(0, `rgba(255,250,240,${top})`); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = vg; g.fillRect(0, 0, s, s);
  // しわ：暗い溝と、その脇のハイライト
  for (let i = 0; i < folds; i++) {
    const x = r() * s, y = r() * s, dx = (r() - 0.5) * s * 0.25, len = s * (0.08 + r() * 0.16);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.30)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx * 0.5 + 3, y + len * 0.5, x + dx, y + len); g.stroke();
    g.strokeStyle = 'rgba(255,250,235,0.12)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + 2, y + 1); g.quadraticCurveTo(x + dx * 0.5 + 5, y + len * 0.5, x + dx + 2, y + len); g.stroke();
  }
  const img = g.getImageData(0, 0, s, s), d = img.data;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const i = (y * s + x) * 4;
    // 綾織りの細かな斜め目
    const w = weave ? (((x + y) & 3) === 0 ? -6 : ((x + y) & 3) === 2 ? 4 : 0) : 0;
    const n = (r() - 0.5) * noise + w;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// 縫い目（点線）
function seam(g, x0, y0, x1, y1, a = 0.35) {
  g.save(); g.setLineDash([2, 2]); g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = `rgba(255,250,230,${a * 0.4})`; g.beginPath(); g.moveTo(x0 + 1, y0 + 1); g.lineTo(x1 + 1, y1 + 1); g.stroke();
  g.restore();
}

// 浮き出た四角（ポケット・パッチ）
function patch(g, x, y, w, h, fill = 'rgba(0,0,0,0.12)') {
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,250,235,0.14)'; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + h - 1, w, 1.5); g.fillRect(x + w - 1, y, 1.5, h);
}

function blood(g, s, n, seed) {
  const r = rng(seed * 7);
  for (let i = 0; i < n; i++) {
    const x = s * (0.3 + r() * 0.4), y = r() * s, w = (3 + r() * 9) * s / 64;
    g.fillStyle = `rgba(${70 + r() * 30},${6 + r() * 8},5,${0.4 + r() * 0.3})`;
    g.beginPath(); g.ellipse(x, y, w * 1.3, w * (0.8 + r()), r() * 3, 0, 7); g.fill();
    g.fillStyle = `rgba(${100 + r() * 40},${8 + r() * 10},6,${0.6 + r() * 0.35})`;
    g.beginPath(); g.ellipse(x, y, w, w * (0.6 + r()), r() * 3, 0, 7); g.fill();
    g.fillRect(x - 1, y, 2, (6 + r() * 12) * s / 64);
    g.fillStyle = 'rgba(30,2,2,0.5)'; g.beginPath(); g.ellipse(x + w * 0.2, y + w * 0.1, w * 0.4, w * 0.3, 0, 0, 7); g.fill();
  }
}

// 肌：頬の赤み・血色の濃淡（感染者は青白くまだらに）
function skinPaint(g, s, c, seed) {
  const r = rng(seed);
  g.fillStyle = c.skin; g.fillRect(0, 0, s, s);
  const grd = g.createLinearGradient(0, 0, s, 0);
  grd.addColorStop(0, 'rgba(60,20,10,0.32)'); grd.addColorStop(0.5, 'rgba(255,235,215,0.10)'); grd.addColorStop(1, 'rgba(60,20,10,0.32)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  for (let i = 0; i < (c.torn ? 18 : 6); i++) {
    g.fillStyle = c.torn ? `rgba(${60 + r() * 40},${50 + r() * 30},${70 + r() * 30},0.18)` : 'rgba(180,80,60,0.06)';
    g.beginPath(); g.ellipse(r() * s, r() * s, 4 + r() * 10, 3 + r() * 8, r() * 3, 0, 7); g.fill();
  }
  if (c.torn) {
    // 浮き出た血管
    g.strokeStyle = 'rgba(60,40,80,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      let x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 12; y += 4 + r() * 6; g.lineTo(x, y); }
      g.stroke();
    }
  }
  const img = g.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}

function makeSkinTextures(c) {
  const tex = {};
  const s = TS;
  tex.torso = makeTexture(s, (g) => {
    shade(g, s, c.top, { folds: 14, seed: 2 });
    // 襟ぐりと前立て、ボタン
    g.fillStyle = c.collar || 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, s, 7);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 7, s, 1.5);
    g.fillStyle = c.collar || 'rgba(0,0,0,0.3)';
    g.beginPath(); g.moveTo(s * 0.42, 6); g.lineTo(s * 0.5, 20); g.lineTo(s * 0.58, 6); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(s * 0.495, 18, 1.5, s - 18);
    g.fillStyle = 'rgba(255,250,235,0.14)'; g.fillRect(s * 0.505, 18, 1, s - 18);
    for (let y = 30; y < s - 10; y += 20) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(s * 0.515, y, 3, 3); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(s * 0.515, y, 1, 1); }
    // 肩と脇の縫い目
    seam(g, s * 0.25, 8, s * 0.25, s); seam(g, s * 0.75, 8, s * 0.75, s);
    if (c.vest) {
      // ベスト：前身頃の2枚と背中。ポケットとファスナー
      g.fillStyle = c.vest;
      g.fillRect(s * 0.3, 10, s * 0.17, s - 14); g.fillRect(s * 0.53, 10, s * 0.17, s - 14);
      g.fillRect(0, 10, s * 0.13, s - 14); g.fillRect(s * 0.87, 10, s * 0.13, s - 14);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(s * 0.47, 10, 1.5, s - 14); g.fillRect(s * 0.53 - 1, 10, 1.5, s - 14);
      patch(g, s * 0.32, 40, s * 0.13, 18, 'rgba(255,250,235,0.06)'); patch(g, s * 0.55, 40, s * 0.13, 18, 'rgba(255,250,235,0.06)');
      patch(g, s * 0.32, 72, s * 0.13, 22, 'rgba(0,0,0,0.12)'); patch(g, s * 0.55, 72, s * 0.13, 22, 'rgba(0,0,0,0.12)');
      seam(g, s * 0.31, 12, s * 0.31, s - 6, 0.3); seam(g, s * 0.69, 12, s * 0.69, s - 6, 0.3);
    } else {
      patch(g, s * 0.33, 26, 16, 18); patch(g, s * 0.56, 26, 16, 18);
    }
    if (c.stripe) {
      // 反射材のライン（救急隊員の上着）
      for (const y of [s * 0.62]) {
        g.fillStyle = c.stripe; g.fillRect(0, y, s, 5);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y, s, 1);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y + 5, s, 1);
      }
    }
    if (c.patch) {
      // 胸の徽章
      g.fillStyle = c.patch; g.beginPath(); g.arc(s * 0.39, 30, 5, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(s * 0.39 - 3, 29, 7, 2); g.fillRect(s * 0.39 - 0.5, 26, 2, 8);
    }
    if (c.torn) {
      g.fillStyle = c.skinTone;
      g.beginPath(); g.ellipse(s * 0.6, s * 0.55, 10, 16, 0.4, 0, 7); g.fill();
      g.beginPath(); g.ellipse(s * 0.15, s * 0.3, 9, 13, -0.3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(s * 0.6, s * 0.55, 10, 16, 0.4, 0, 7); g.stroke();
      blood(g, s, 12, 3);
    }
  });
  tex.pants = makeTexture(s, (g) => {
    shade(g, s, c.pants, { folds: 14, seed: 4 });
    // 外側と内側の縫い目、膝のしわ、腿のポケット
    seam(g, s * 0.25, 0, s * 0.25, s); seam(g, s * 0.75, 0, s * 0.75, s);
    patch(g, s * 0.14, s * 0.3, 22, 26, 'rgba(0,0,0,0.12)');
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(s * 0.14, s * 0.3 + 6, 22, 1);
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s * 0.38, s * 0.62 + i * 5); g.quadraticCurveTo(s * 0.5, s * 0.6 + i * 5, s * 0.62, s * 0.63 + i * 5); g.stroke();
    }
    if (c.torn) blood(g, s, 5, 5);
  });
  tex.sleeve = makeTexture(s, (g) => {
    shade(g, s, c.sleeve, { folds: 10, seed: 6 });
    seam(g, s * 0.0, 4, s, 4, 0.3);
    // 肘のしわと袖口
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s * 0.3, s * 0.82 + i * 4); g.quadraticCurveTo(s * 0.5, s * 0.86 + i * 4, s * 0.7, s * 0.82 + i * 4); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, s - 8, s, 8);
    g.fillStyle = 'rgba(255,250,235,0.12)'; g.fillRect(0, s - 8, s, 1);
    if (c.stripe) { g.fillStyle = c.stripe; g.fillRect(0, s * 0.45, s, 4); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, s * 0.45, s, 1); }
    if (c.patch) { g.fillStyle = c.patch; g.fillRect(s * 0.42, 14, 14, 14); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(s * 0.42 + 3, 20, 8, 2); g.fillRect(s * 0.42 + 6, 17, 2, 8); }
    if (c.torn) blood(g, s, 4, 7);
  });
  tex.skin = makeTexture(64, (g, ss) => {
    skinPaint(g, ss, c, 8);
    // 指の節と爪（手の箱に貼られる）
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 8; x < ss; x += 12) g.fillRect(x, 0, 1, ss);
    if (c.torn) { g.fillStyle = 'rgba(70,40,40,0.5)'; g.fillRect(ss * 0.4, ss * 0.2, 9, 16); }
  });
  tex.boots = makeTexture(64, (g, ss) => {
    shade(g, ss, c.boots, { folds: 3, noise: 10, seed: 9, weave: false, top: 0.2 });
    // 靴紐と縫い目、照り
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 5, ss, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ss * 0.44, 0, 6, ss * 0.6);
    for (let y = 4; y < ss * 0.6; y += 6) { g.fillStyle = 'rgba(200,190,170,0.3)'; g.fillRect(ss * 0.44, y, 6, 1.5); }
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, ss - 8, ss, 8);
  });
  tex.hair = makeTexture(64, (g, ss) => {
    const r = rng(11);
    g.fillStyle = c.hair; g.fillRect(0, 0, ss, ss);
    // 毛束：つむじから下へ流れる線と、天辺のつや
    for (let i = 0; i < 140; i++) {
      const x = r() * ss, y = r() * ss * 0.4, len = ss * (0.3 + r() * 0.6);
      g.strokeStyle = r() < 0.55 ? `rgba(0,0,0,${0.18 + r() * 0.25})` : `rgba(255,235,205,${0.06 + r() * 0.12})`;
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 6, y + len * 0.5, x + (r() - 0.5) * 8, y + len); g.stroke();
    }
    const vg = g.createLinearGradient(0, 0, 0, ss);
    vg.addColorStop(0, 'rgba(0,0,0,0.15)'); vg.addColorStop(0.3, 'rgba(255,240,210,0.16)'); vg.addColorStop(0.45, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = vg; g.fillRect(0, 0, ss, ss);
  });
  // 顔：球の u=0.5 が正面、v=0 が頭頂
  tex.face = makeTexture(s, (g) => {
    skinPaint(g, s, c, 12);
    const cx = s * 0.5;
    const blob = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
    // 彫り：眼窩・頬骨の下・鼻の脇・あごの下を暗く、額・鼻筋・頬を明るく
    blob(cx - 7, s * 0.485, 6, 4, 'rgba(70,30,20,0.22)'); blob(cx + 7, s * 0.485, 6, 4, 'rgba(70,30,20,0.22)');
    blob(cx - 13, s * 0.61, 3, 7, 'rgba(70,30,20,0.09)'); blob(cx + 13, s * 0.61, 3, 7, 'rgba(70,30,20,0.09)');
    blob(cx, s * 0.4, 12, 5, 'rgba(255,240,225,0.12)');
    blob(cx, s * 0.545, 2, 6, 'rgba(255,240,225,0.18)');
    blob(cx - 9, s * 0.56, 4, 3, c.torn ? 'rgba(80,90,110,0.15)' : 'rgba(210,110,90,0.07)'); blob(cx + 9, s * 0.56, 4, 3, c.torn ? 'rgba(80,90,110,0.15)' : 'rgba(210,110,90,0.07)');
    blob(cx, s * 0.73, 10, 3, 'rgba(50,20,10,0.28)');
    // 髪：上と後ろ、こめかみ
    g.fillStyle = c.hair;
    g.fillRect(0, 0, s, s * 0.3);
    g.fillRect(0, 0, s * 0.24, s * 0.78); g.fillRect(s * 0.76, 0, s * 0.24, s * 0.78);
    g.beginPath(); g.moveTo(s * 0.24, s * 0.3); g.quadraticCurveTo(s * 0.5, s * 0.4, s * 0.76, s * 0.3); g.lineTo(s * 0.76, s * 0.26); g.lineTo(s * 0.24, s * 0.26); g.fill();
    g.beginPath(); g.moveTo(s * 0.24, s * 0.3); g.lineTo(s * 0.3, s * 0.5); g.lineTo(s * 0.24, s * 0.55); g.fill();
    g.beginPath(); g.moveTo(s * 0.76, s * 0.3); g.lineTo(s * 0.7, s * 0.5); g.lineTo(s * 0.76, s * 0.55); g.fill();
    const r = rng(21);
    for (let i = 0; i < 90; i++) {
      const x = r() * s, y = r() * s * 0.3;
      g.strokeStyle = r() < 0.6 ? 'rgba(0,0,0,0.25)' : 'rgba(255,235,205,0.12)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + 8 + r() * 14); g.stroke();
    }
    // 生え際の影
    g.fillStyle = 'rgba(40,20,10,0.25)'; g.beginPath(); g.moveTo(s * 0.3, s * 0.36); g.quadraticCurveTo(s * 0.5, s * 0.43, s * 0.7, s * 0.36); g.lineTo(s * 0.7, s * 0.4); g.quadraticCurveTo(s * 0.5, s * 0.46, s * 0.3, s * 0.4); g.fill();
    // 耳
    blob(s * 0.255, s * 0.52, 3, 7, c.skin); blob(s * 0.745, s * 0.52, 3, 7, c.skin);
    blob(s * 0.255, s * 0.52, 1.5, 4, 'rgba(70,30,20,0.35)'); blob(s * 0.745, s * 0.52, 1.5, 4, 'rgba(70,30,20,0.35)');
    // 眉
    const eye = c.eye || '#2a1c14';
    g.fillStyle = c.hair;
    g.beginPath(); g.moveTo(cx - 13, s * 0.455); g.lineTo(cx - 3, s * 0.445); g.lineTo(cx - 3, s * 0.462); g.lineTo(cx - 13, s * 0.468); g.fill();
    g.beginPath(); g.moveTo(cx + 13, s * 0.455); g.lineTo(cx + 3, s * 0.445); g.lineTo(cx + 3, s * 0.462); g.lineTo(cx + 13, s * 0.468); g.fill();
    if (c.torn) {
      // 濁った白目、黒ずんだ口元と垂れた血
      blob(cx - 7, s * 0.495, 5, 3.5, 'rgba(40,20,20,0.75)'); blob(cx + 7, s * 0.495, 5, 3.5, 'rgba(40,20,20,0.75)');
      blob(cx - 7, s * 0.495, 3, 2, '#d8d0a0'); blob(cx + 7, s * 0.495, 3, 2, '#d8d0a0');
      g.fillStyle = 'rgba(120,110,60,0.6)'; g.fillRect(cx - 8, s * 0.49, 2, 2); g.fillRect(cx + 6, s * 0.49, 2, 2);
      blob(cx, s * 0.65, 6, 3, '#2a0806');
      g.fillStyle = '#c8c0a0'; for (let x = -4; x <= 3; x += 2) g.fillRect(cx + x, s * 0.635, 1.5, 2);
      g.fillStyle = 'rgba(110,10,8,0.85)'; g.fillRect(cx - 3, s * 0.66, 2, 16); g.fillRect(cx + 2, s * 0.66, 2, 10); g.fillRect(cx - 1, s * 0.67, 1.5, 22);
    } else {
      // 白目・瞳・ハイライト・まぶたの線・まつ毛
      for (const sx of [-1, 1]) {
        const ex = cx + sx * 7, ey = s * 0.497;
        blob(ex, ey, 4.5, 2.2, '#ebe4da');
        blob(ex - sx * 0.3, ey, 2, 2, eye);
        g.fillStyle = '#0a0606'; g.fillRect(ex - sx * 0.3 - 0.5, ey - 0.5, 1.5, 1.5);
        g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(ex - sx * 0.3 + 0.5, ey - 1.5, 1, 1);
        g.fillStyle = 'rgba(30,15,10,0.85)'; g.fillRect(ex - 4.5, ey - 2.6, 9, 1.4);
        g.fillStyle = 'rgba(70,30,20,0.35)'; g.fillRect(ex - 4, ey + 2, 8, 1);
        if (c.lashes) { g.fillStyle = 'rgba(20,10,5,0.9)'; g.fillRect(ex + sx * 3.5, ey - 3, 2, 1.5); }
      }
      // 鼻：鼻筋の陰、小鼻、鼻の下
      g.fillStyle = 'rgba(90,40,20,0.30)'; g.fillRect(cx + 1.5, s * 0.5, 1.5, 10);
      blob(cx, s * 0.587, 4, 1.8, 'rgba(90,40,20,0.35)');
      g.fillStyle = 'rgba(40,15,10,0.6)'; g.fillRect(cx - 3, s * 0.585, 1.5, 1.2); g.fillRect(cx + 1.5, s * 0.585, 1.5, 1.2);
      // 唇
      g.fillStyle = c.lips || '#8a4a3a';
      g.beginPath(); g.ellipse(cx, s * 0.645, 6, 1.8, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx, s * 0.658, 4.5, 2, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(40,10,5,0.6)'; g.fillRect(cx - 5, s * 0.648, 10, 1);
      g.fillStyle = 'rgba(255,230,220,0.25)'; g.fillRect(cx - 2, s * 0.662, 4, 1);
      if (c.beard) { g.fillStyle = c.beard; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(cx, s * 0.68, 14, 8, 0, 0, Math.PI); g.fill(); g.globalAlpha = 1; }
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

// 断面が丸い回転体（筋肉の盛り上がりを輪郭で表す）。pts は [半径, 高さ] の列で上から下へ
function lathe(mat, pts, seg = 10, sz = 1) {
  const g = new THREE.LatheGeometry(pts.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y)), seg, -Math.PI, Math.PI * 2);
  g.scale(1, 1, sz);
  return new THREE.Mesh(withColor(g), mat);
}

// 球の一部（髪の房など）。phi は正面(+z)からの開き、theta は頭頂からの角度
function shell(mat, r, { phiOpen = 0, theta0 = 0, theta1 = Math.PI * 0.5, sx = 1, sy = 1, sz = 1, seg = 12, rows = 5 } = {}) {
  const g = new THREE.SphereGeometry(r, seg, rows, Math.PI / 2 + phiOpen, Math.PI * 2 - phiOpen * 2, theta0, theta1 - theta0);
  g.scale(sx, sy, sz);
  return new THREE.Mesh(withColor(g), mat);
}

// 体の骨格を太さのある線分として扱い、頂点ごとにほかの部位からの遮蔽を見積もって頂点カラーへ焼き込む
// （当時の作品が頂点カラーで脇や股の陰を描いていたのと同じ考え方）
function bakeVertexAO(root, capsules) {
  root.updateMatrixWorld(true);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3(), ab = new THREE.Vector3(), nm = new THREE.Matrix3();
  root.traverse((m) => {
    if (!m.isMesh || !m.geometry.attributes.color) return;
    const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal, col = m.geometry.attributes.color;
    nm.getNormalMatrix(m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      let occ = 0;
      for (const [a, b, r] of capsules) {
        ab.subVectors(b, a);
        const t = Math.max(0, Math.min(1, q.subVectors(p, a).dot(ab) / Math.max(ab.lengthSq(), 1e-6)));
        q.copy(a).addScaledVector(ab, t).sub(p);
        const d = q.length();
        if (d < r * 0.98) continue; // 自分の部位の内側
        occ += Math.max(0, n.dot(q) / d) * (r * r) / (d * d);
      }
      // 床からの遮蔽：下を向いた面と足元を暗く
      occ += Math.max(0, -n.y) * 0.25 + Math.max(0, 1 - p.y / 0.35) * 0.25;
      const k = 1 - Math.min(0.5, occ * 0.7);
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
    col.needsUpdate = true;
  });
}

export function makeHumanoid(c) {
  const tex = makeSkinTextures(c);
  const mat = {};
  for (const k in tex) mat[k] = ps1Material({ map: tex[k] });
  const hairMat = ps1Material({ map: tex.hair, side: THREE.DoubleSide });
  const plain = ps1Material();
  const slim = c.build === 'slim' ? 0.9 : 1;

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = HIP_HEIGHT;
  root.add(hips);
  hips.add(lathe(mat.pants, [[0.15, 0.08], [0.16, 0.05], [0.168, -0.03], [0.15, -0.09], [0.12, -0.125], [0.06, -0.145]].map(([r, y]) => [r * slim, y]), 14, 0.72));

  const torso = new THREE.Group();
  hips.add(torso);
  const chest = c.build === 'slim'
    ? [[0.04, 0.63], [0.1, 0.605], [0.165, 0.575], [0.18, 0.52], [0.182, 0.45], [0.17, 0.38], [0.145, 0.27], [0.135, 0.17], [0.148, 0.07], [0.152, -0.02]]
    : [[0.04, 0.63], [0.11, 0.6], [0.185, 0.565], [0.205, 0.5], [0.203, 0.44], [0.19, 0.37], [0.172, 0.29], [0.155, 0.2], [0.153, 0.1], [0.158, -0.02]];
  torso.add(lathe(mat.torso, chest, 14, 0.64));
  torso.add(prism(mat.boots, 0.168 * slim, 0.168 * slim, 0.07, 10, 0.04, 1, 0.71)); // ベルト
  // バックル
  torso.add(part([[[-0.025, -0.02, 0.112 * slim], [0.025, 0.03, 0.125 * slim], '#8a8478']], plain));
  if (c.extra) torso.add(part(c.extra, plain));

  const head = new THREE.Group();
  head.position.y = 0.56;
  torso.add(head);
  head.add(prism(mat.skin, 0.048, 0.056, 0.11, 8, 0.085));
  // 頭：あごを少し細く、後頭部を少し張り出させる
  const skull = new THREE.SphereGeometry(0.112, 12, 10, -Math.PI / 2);
  {
    const sp = skull.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
      const low = Math.max(0, -y / 0.112);           // 下半分ほど細く
      const k = 1 - 0.22 * low * low;
      sp.setXYZ(i, x * k, y, z * (z < 0 ? 1.04 : k * 1.02 + 0.02 * (1 - low)));
    }
    skull.computeVertexNormals();
  }
  skull.scale(0.95, 1.14, 1.0);
  skull.translate(0, 0.16, 0.005);
  head.add(new THREE.Mesh(withColor(skull), mat.face));
  // 鼻：小さな三角柱
  {
    const b = new THREE.BufferGeometry();
    const v = [0, 0.175, 0.112, -0.012, 0.13, 0.108, 0.012, 0.13, 0.108, 0, 0.135, 0.128];
    b.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    b.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0.5, 0.47, 0.58, 0.53, 0.58, 0.5, 0.58], 2));
    b.setIndex([0, 1, 3, 0, 3, 2, 1, 2, 3]);
    b.computeVertexNormals();
    head.add(new THREE.Mesh(withColor(b), mat.face));
  }
  const hairCap = new THREE.SphereGeometry(0.12, 12, 6, -Math.PI / 2, Math.PI * 2, 0, Math.PI * 0.4);
  hairCap.scale(0.96, 1.16, 1.04);
  hairCap.translate(0, 0.165, -0.008);
  head.add(new THREE.Mesh(withColor(hairCap), mat.hair));
  // 髪型：bob は肩上で切りそろえた髪、long は肩まで、それ以外は短髪
  if (c.hairStyle === 'bob' || c.hairStyle === 'long') {
    const long = c.hairStyle === 'long';
    const h = shell(hairMat, 0.128, { phiOpen: 0.95, theta0: Math.PI * 0.22, theta1: Math.PI * (long ? 0.86 : 0.7), sx: 0.98, sy: long ? 1.35 : 1.18, sz: 1.04, seg: 14, rows: 6 });
    h.position.set(0, 0.165, -0.01);
    head.add(h);
    // 前髪
    const f = shell(hairMat, 0.124, { phiOpen: 0, theta0: 0, theta1: Math.PI * 0.3, sx: 0.98, sy: 1.18, sz: 1.06, seg: 12, rows: 3 });
    f.position.set(0, 0.168, 0.0);
    f.rotation.x = 0.18;
    head.add(f);
  } else if (c.hairStyle === 'pony') {
    const t = prism(mat.hair, 0.035, 0.012, 0.22, 6, 0);
    t.position.set(0, 0.2, -0.1); t.rotation.x = 0.5;
    head.add(t);
  }

  // 手：手のひら・指（軽く曲げる）・親指
  const hand = (side) => {
    const g = new THREE.Group();
    const add = (min, max) => { const b = newBuilder(); addBox(b, min, max, 0.12, 10, [1, 1, 1], false); g.add(new THREE.Mesh(buildGeometry(b), mat.skin)); };
    add([-0.026, -0.31, -0.02], [0.026, -0.24, 0.03]);
    const fingers = new THREE.Group(); fingers.position.set(0, -0.31, 0.005); fingers.rotation.x = 0.35; g.add(fingers);
    { const b = newBuilder(); addBox(b, [-0.025, -0.055, -0.02], [0.025, 0, 0.025], 0.12, 10, [0.92, 0.92, 0.92], false); fingers.add(new THREE.Mesh(buildGeometry(b), mat.skin)); }
    const thumb = new THREE.Group(); thumb.position.set(side * 0.022, -0.26, 0.025); thumb.rotation.set(0.4, 0, side * 0.5); g.add(thumb);
    { const b = newBuilder(); addBox(b, [-0.01, -0.05, -0.011], [0.01, 0, 0.011], 0.12, 10, [1, 1, 1], false); thumb.add(new THREE.Mesh(buildGeometry(b), mat.skin)); }
    return g;
  };

  const sw = c.build === 'slim' ? 0.235 : 0.255;
  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * sw, 0.5, 0);
    torso.add(shoulder);
    shoulder.add(lathe(mat.sleeve, [[0.02, 0.075], [0.055, 0.06], [0.07, 0.02], [0.071, -0.03], [0.064, -0.12], [0.054, -0.22], [0.049, -0.27], [0.045, -0.3]], 10));
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);
    elbow.add(lathe(c.forearmSleeve ? mat.sleeve : mat.skin, [[0.044, 0.02], [0.05, -0.04], [0.049, -0.09], [0.042, -0.16], [0.033, -0.23], [0.03, -0.245]], 10));
    elbow.add(hand(side));
    return [shoulder, elbow];
  };
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.09 * slim, 0, 0);
    hips.add(hip);
    hip.add(lathe(mat.pants, [[0.06, 0.05], [0.094, 0.0], [0.096, -0.08], [0.088, -0.2], [0.076, -0.32], [0.067, -0.42], [0.064, -0.46]].map(([r, y]) => [r * (slim < 1 ? 0.95 : 1), y]), 11));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(lathe(mat.pants, [[0.06, 0.03], [0.068, -0.02], [0.069, -0.08], [0.06, -0.17], [0.053, -0.24], [0.05, -0.3]], 10));
    knee.add(prism(mat.boots, 0.062, 0.068, 0.16, 9, -0.28));
    // 靴：甲を斜めに落とした形と、厚い靴底
    const b = newBuilder();
    addBox(b, [-0.064, -0.43, -0.07], [0.064, -0.38, 0.12], 0.2, 10, [1, 1, 1], false);
    addBox(b, [-0.058, -0.43, 0.12], [0.058, -0.395, 0.17], 0.2, 10, [0.9, 0.9, 0.9], false);
    addBox(b, [-0.068, -0.46, -0.075], [0.068, -0.43, 0.175], 0.2, 10, [0.45, 0.43, 0.4], false);
    knee.add(new THREE.Mesh(buildGeometry(b), mat.boots));
    return [hip, knee];
  };

  const [armL, elbowL] = arm(1);
  const [armR, elbowR] = arm(-1);
  const [legL, kneeL] = leg(1);
  const [legR, kneeR] = leg(-1);
  const parts = { hips, torso, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR };

  // 立ち姿勢で骨格を見積もり、接触陰影を頂点カラーへ焼き込む
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const H = HIP_HEIGHT;
  bakeVertexAO(root, [
    [V(0, H + 0.05, 0), V(0, H + 0.42, 0), 0.15 * slim],
    [V(0, H + 0.72, 0.005), V(0, H + 0.72, 0.005), 0.1],
    [V(0, H + 0.6, 0), V(0, H + 0.66, 0), 0.05],
    ...[1, -1].flatMap((s) => [
      [V(s * sw, H + 0.52, 0), V(s * sw, H + 0.24, 0), 0.058],
      [V(s * sw, H + 0.22, 0), V(s * sw, H + 0.0, 0), 0.042],
      [V(s * 0.09 * slim, H - 0.02, 0), V(s * 0.09 * slim, H - 0.42, 0), 0.085],
      [V(s * 0.09, H - 0.46, 0), V(s * 0.09, H - 0.74, 0), 0.058],
    ]),
  ]);
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
