// 人型：骨に重みをつけた一体の体に、彫り出した頭・指のある手・靴・毛束の髪を付ける
// 肩・肘・股・膝の角度だけで動かす。服には陰影やしわを描き込み、頂点カラーに接触陰影を焼き込む
import * as THREE from 'three';
import { addBox, buildGeometry, makeTexture, newBuilder, ps1Material } from './ps1.js';

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

function part(boxes, mat) {
  const b = newBuilder();
  for (const [min, max, color] of boxes) addBox(b, min, max, 10, 10, hex(color), false);
  return new THREE.Mesh(buildGeometry(b), mat);
}

// 角を丸めた箱（ポーチ・背負い物）。色は頂点色で持つ
function roundedParts(boxes, mat) {
  const g = new THREE.Group();
  for (const [min, max, color] of boxes) {
    const w = max[0] - min[0], h = max[1] - min[1], d = max[2] - min[2];
    const r = Math.min(w, h, d) * 0.35;
    const geo = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
    const p = geo.attributes.position, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const cx = Math.max(-hx, Math.min(hx, x)), cy = Math.max(-hy, Math.min(hy, y)), cz = Math.max(-hz, Math.min(hz, z));
      const dx = x - cx, dy = y - cy, dz = z - cz, l = Math.hypot(dx, dy, dz) || 1;
      p.setXYZ(i, cx + (dx / l) * r, cy + (dy / l) * r, cz + (dz / l) * r);
    }
    geo.computeVertexNormals();
    const col = new THREE.Color(color), n = p.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = 0.85 + 0.3 * Math.max(0, p.getY(i) / h + 0.5) * 0.5; cols[i * 3] = col.r * k; cols[i * 3 + 1] = col.g * k; cols[i * 3 + 2] = col.b * k; }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(geo, mat);
    m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    g.add(m);
  }
  return g;
}

export const HIP_HEIGHT = 0.9;

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
    const x = s * (0.3 + r() * 0.4), y = r() * s, w = (3 + r() * 9) * s / 128;
    g.fillStyle = `rgba(${70 + r() * 30},${6 + r() * 8},5,${0.4 + r() * 0.3})`;
    g.beginPath(); g.ellipse(x, y, w * 1.3, w * (0.8 + r()), r() * 3, 0, 7); g.fill();
    g.fillStyle = `rgba(${100 + r() * 40},${8 + r() * 10},6,${0.6 + r() * 0.35})`;
    g.beginPath(); g.ellipse(x, y, w, w * (0.6 + r()), r() * 3, 0, 7); g.fill();
    g.fillRect(x - 1, y, 2, (6 + r() * 12) * s / 96);
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
  const cw = g.canvas.width, img = g.getImageData(0, 0, cw, cw), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}

// 顔のテクスチャ：u=0.5 が正面、v=0 が頭頂。s=128 の座標で描く（大きいキャンバスには拡大して描く）
function paintFace(g, s, c) {
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
    // 眉：眉頭が太く眉尻へ細る。毛の流れを細い線で
    const eye = c.eye || '#2a1c14';
    for (const sx of [-1, 1]) {
      g.fillStyle = c.hair;
      g.beginPath(); g.moveTo(cx + sx * 3, s * 0.462); g.quadraticCurveTo(cx + sx * 8, s * 0.438, cx + sx * 13.5, s * 0.456);
      g.quadraticCurveTo(cx + sx * 8, s * 0.448, cx + sx * 3, s * 0.472); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.35;
      for (let k = 0; k < 9; k++) { const x = cx + sx * (3.5 + k * 1.1); g.beginPath(); g.moveTo(x, s * 0.466 - k * 0.12); g.lineTo(x + sx * 1.2, s * 0.452 - k * 0.1); g.stroke(); }
    }
    if (c.torn) {
      // 濁った白目、黒ずんだ口元と垂れた血
      blob(cx - 7, s * 0.495, 5, 3.5, 'rgba(40,20,20,0.75)'); blob(cx + 7, s * 0.495, 5, 3.5, 'rgba(40,20,20,0.75)');
      blob(cx - 7, s * 0.495, 3, 2, '#d8d0a0'); blob(cx + 7, s * 0.495, 3, 2, '#d8d0a0');
      g.fillStyle = 'rgba(120,110,60,0.6)'; g.fillRect(cx - 8, s * 0.49, 2, 2); g.fillRect(cx + 6, s * 0.49, 2, 2);
      blob(cx, s * 0.65, 6, 3, '#2a0806');
      g.fillStyle = '#c8c0a0'; for (let x = -4; x <= 3; x += 2) g.fillRect(cx + x, s * 0.635, 1.5, 2);
      g.fillStyle = 'rgba(110,10,8,0.85)'; g.fillRect(cx - 3, s * 0.66, 2, 16); g.fillRect(cx + 2, s * 0.66, 2, 10); g.fillRect(cx - 1, s * 0.67, 1.5, 22);
    } else {
      for (const sx of [-1, 1]) {
        const ex = cx + sx * 7, ey = s * 0.497;
        // 眼窩の影と二重のしわ
        blob(ex, ey - 0.6, 5.6, 3.4, 'rgba(90,40,30,0.16)');
        g.strokeStyle = 'rgba(80,35,25,0.45)'; g.lineWidth = 0.5;
        g.beginPath(); g.ellipse(ex, ey + 0.2, 4.6, 3.7, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        // 白目（目尻と目頭は少し暗く）
        g.save(); g.beginPath(); g.ellipse(ex, ey, 4.6, 2.35, 0, 0, 7); g.clip();
        g.fillStyle = '#e8e0d6'; g.fillRect(ex - 5, ey - 3, 10, 6);
        const sg = g.createRadialGradient(ex, ey, 1, ex, ey, 5); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(120,70,60,0.45)');
        g.fillStyle = sg; g.fillRect(ex - 5, ey - 3, 10, 6);
        // 瞳：外周を濃く、中心に瞳孔、上側はまぶたの影
        const ix = ex - sx * 0.2, iy = ey + 0.1;
        const ig = g.createRadialGradient(ix, iy, 0.3, ix, iy, 2.3);
        const ec = new THREE.Color(eye);
        const rgb = (k2) => `rgb(${Math.min(255, ec.r * 255 * k2) | 0},${Math.min(255, ec.g * 255 * k2) | 0},${Math.min(255, ec.b * 255 * k2) | 0})`;
        ig.addColorStop(0, rgb(1.6)); ig.addColorStop(0.7, rgb(1.0)); ig.addColorStop(1, rgb(0.4));
        g.fillStyle = ig; g.beginPath(); g.arc(ix, iy, 2.3, 0, 7); g.fill();
        g.fillStyle = '#060404'; g.beginPath(); g.arc(ix, iy, 0.95, 0, 7); g.fill();
        g.fillStyle = 'rgba(20,10,5,0.45)'; g.fillRect(ex - 5, ey - 3, 10, 1.3);
        g.restore();
        g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(ix - 0.8, iy - 0.8, 0.55, 0, 7); g.fill();
        // 上まぶたの縁（太め）と下まぶた（細く明るい縁と影）
        g.strokeStyle = 'rgba(25,12,8,0.95)'; g.lineWidth = c.lashes ? 0.95 : 0.7;
        g.beginPath(); g.ellipse(ex, ey + 0.35, 4.7, 2.75, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
        g.strokeStyle = 'rgba(90,45,35,0.55)'; g.lineWidth = 0.45;
        g.beginPath(); g.ellipse(ex, ey - 0.2, 4.3, 2.5, 0, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
        blob(ex, ey + 2.8, 3.6, 0.9, 'rgba(90,40,30,0.18)');
        if (c.lashes) { g.strokeStyle = 'rgba(15,8,5,0.95)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(ex + sx * 3.9, ey - 1.6); g.lineTo(ex + sx * 5.4, ey - 2.6); g.stroke(); }
      }
      // 鼻：小鼻のふちと鼻の穴、鼻の下の溝
      g.strokeStyle = 'rgba(100,45,30,0.4)'; g.lineWidth = 0.6;
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * 3.2, s * 0.582, 1.6, sx > 0 ? -1.2 : Math.PI - 1.5, sx > 0 ? 1.5 : Math.PI + 1.2); g.stroke(); }
      g.fillStyle = 'rgba(40,15,10,0.7)'; g.beginPath(); g.ellipse(cx - 1.8, s * 0.588, 1.0, 0.55, 0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx + 1.8, s * 0.588, 1.0, 0.55, -0.3, 0, 7); g.fill();
      g.fillStyle = 'rgba(100,45,30,0.15)'; g.fillRect(cx - 1, s * 0.6, 2, 4.5);
      // 唇：上唇は山形、下唇はふっくら。口角の影と下唇のつや
      const lc = new THREE.Color(c.lips || '#8a4a3a');
      const lrgb = (k2, a) => `rgba(${Math.min(255, lc.r * 255 * k2) | 0},${Math.min(255, lc.g * 255 * k2) | 0},${Math.min(255, lc.b * 255 * k2) | 0},${a})`;
      const ly = s * 0.651;
      g.fillStyle = lrgb(0.85, 1);
      g.beginPath(); g.moveTo(cx - 6, ly); g.quadraticCurveTo(cx - 3, ly - 2.4, cx - 0.8, ly - 2.0); g.lineTo(cx, ly - 1.5); g.lineTo(cx + 0.8, ly - 2.0);
      g.quadraticCurveTo(cx + 3, ly - 2.4, cx + 6, ly); g.closePath(); g.fill();
      g.fillStyle = lrgb(1.0, 1);
      g.beginPath(); g.moveTo(cx - 5.4, ly + 0.2); g.quadraticCurveTo(cx, ly + 4.2, cx + 5.4, ly + 0.2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,10,5,0.75)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(cx - 6, ly); g.quadraticCurveTo(cx, ly + 0.8, cx + 6, ly); g.stroke();
      blob(cx - 6.2, ly + 0.3, 0.9, 0.9, 'rgba(60,20,10,0.4)'); blob(cx + 6.2, ly + 0.3, 0.9, 0.9, 'rgba(60,20,10,0.4)');
      blob(cx, ly + 2.0, 2.4, 0.7, 'rgba(255,235,225,0.3)');
      blob(cx, ly + 5.5, 4, 1.4, 'rgba(70,30,20,0.18)');
      if (c.beard) { g.fillStyle = c.beard; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(cx, s * 0.68, 14, 8, 0, 0, Math.PI); g.fill(); g.globalAlpha = 1; }
    }
}

function withColor(geo) {
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return geo;
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

// 顔のテクスチャ（128px、u=0.5 が正面、v=0 が頭頂）の座標で、表面をどれだけ盛るか／彫るか（半径に対する割合）
function faceRelief(px, py) {
  const g = (x, y, cx, cy, rx, ry) => Math.exp(-(((x - cx) / rx) ** 2) - (((y - cy) / ry) ** 2));
  const ax = Math.abs(px);
  let d = 0;
  // 眉の張り出しと、その下の眼窩
  d += 0.065 * g(ax, py, 7, 57.5, 7, 2.8);
  d -= 0.09 * g(ax, py, 7, 63.5, 4.8, 3.2);
  d += 0.03 * g(ax, py, 7, 63.8, 3, 1.8); // 眼球のふくらみ
  d -= 0.045 * g(ax, py, 17, 62, 3.5, 7); // こめかみ
  // 鼻：眉間から鼻先へ高くなり、鼻先の下で急に落ちる。小鼻を左右に
  if (py > 56 && py < 78) {
    const t = Math.min(1, (py - 56) / 18);
    const h = py <= 74 ? 0.03 + 0.22 * t ** 1.6 : 0.25 * Math.max(0, 1 - (py - 74) / 3.6);
    d += h * Math.exp(-((px / (1.5 + 2.4 * t)) ** 2));
  }
  d += 0.055 * g(ax, py, 3.6, 74.8, 2.2, 1.8);
  // 頬骨と、その下のくぼみ
  d += 0.05 * g(ax, py, 11, 70, 4.5, 4.5);
  d -= 0.035 * g(ax, py, 12.5, 80, 3.5, 4.5);
  // 唇（上唇・下唇）と口の線、あご
  d += 0.045 * g(px, py, 0, 82.3, 6, 1.6);
  d += 0.05 * g(px, py, 0, 85, 4.8, 1.8);
  d -= 0.02 * g(px, py, 0, 83.6, 5.5, 0.8);
  d -= 0.02 * g(px, py, 0, 88.5, 5, 1.6);
  d += 0.065 * g(px, py, 0, 93, 6.5, 3.5);
  return d;
}

// 正面ほど細かい格子の球。顔の凹凸は faceRelief で頂点を押し出して作る
function sculptedHead(r) {
  const COLS = 34, ROWS = 28;
  const azs = [], ths = [];
  for (let j = 0; j <= COLS; j++) { const t = (j / COLS) * 2 - 1; azs.push(Math.PI * Math.sign(t) * Math.abs(t) ** 1.35); }
  // 縦：頭頂〜額は粗く、顔の帯（眉〜あご）は細かく、首側はまた粗く
  const band0 = Math.PI * 0.4, band1 = Math.PI * 0.78;
  for (let i = 0; i <= 6; i++) ths.push((band0 * i) / 6);
  for (let i = 1; i <= ROWS - 10; i++) ths.push(band0 + ((band1 - band0) * i) / (ROWS - 10));
  for (let i = 1; i <= 4; i++) ths.push(band1 + ((Math.PI - band1) * i) / 4);
  const pos = [], uv = [], idx = [];
  for (const th of ths) {
    for (const az of azs) {
      const u = 0.5 + az / (Math.PI * 2), v = th / Math.PI;
      const k = r * (1 + faceRelief((u - 0.5) * 128, v * 128));
      pos.push(k * Math.sin(th) * Math.sin(az), k * Math.cos(th), k * Math.sin(th) * Math.cos(az));
      uv.push(u, 1 - v);
    }
  }
  const W = azs.length;
  for (let i = 0; i < ths.length - 1; i++) {
    for (let j = 0; j < W - 1; j++) {
      const a = i * W + j, b = a + 1, c = a + W, e = c + 1;
      idx.push(a, c, b, b, c, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// ---------------------------------------------------------------- 人物（高精細版）
// 体は骨（Bone）に重みをつけた一体のメッシュ。胴・腕・脚・首はつなぎ目なく曲がる
// 頭・手・靴・髪は骨に付けた部品。光は画素ごとに計算し、肌や髪に軽いつやを乗せる

const CTS = 256; // 服のテクスチャの大きさ

// なめらかに拡大・縮小する人物用テクスチャ
function charTexture(size, draw) {
  const t = makeTexture(size, draw);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// 縦の帯（v0〜v1）に布地を描く
function band(g, s, v0, v1, base, opts) {
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const cg = c.getContext('2d');
  shade(cg, s, base, opts);
  g.drawImage(c, 0, v0 * s, s, (v1 - v0) * s, 0, v0 * s, s, (v1 - v0) * s);
}

// 胴：v=0 が首の付け根、v=1 が股。腰のベルトから下はズボン
const TORSO_TOP = 0.62, TORSO_BOT = -0.14;
const torsoV = (y) => (TORSO_TOP - y) / (TORSO_TOP - TORSO_BOT);
// 腕：v=0 が肩の上、v=1 が手首
const ARM_TOP = 0.07, ARM_BOT = -0.51;
const armV = (y) => (ARM_TOP - y) / (ARM_TOP - ARM_BOT);
// 脚：v=0 が股関節の上、v=1 が足首
const LEG_TOP = 0.08, LEG_BOT = -0.87;
const legV = (y) => (LEG_TOP - y) / (LEG_TOP - LEG_BOT);

function makeBodyTextures(c) {
  const s = CTS, tex = {};
  const belt = torsoV(0.06), beltB = torsoV(0.005);
  tex.torso = charTexture(s, (g) => {
    shade(g, s, c.top, { folds: 26, seed: 2, noise: 12 });
    // 胸と背中のしわ：脇から胸へ流れる斜めのしわ
    const r = rng(41);
    for (let i = 0; i < 14; i++) {
      const side = r() < 0.5 ? 0.25 : 0.75, y = s * (0.2 + r() * 0.45);
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(s * side, y); g.quadraticCurveTo(s * (side + (side < 0.5 ? 0.06 : -0.06)), y + 8, s * (side + (side < 0.5 ? 0.12 : -0.12)), y + 4 + r() * 10); g.stroke();
      g.strokeStyle = 'rgba(255,250,235,0.08)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s * side, y - 3); g.quadraticCurveTo(s * (side + (side < 0.5 ? 0.06 : -0.06)), y + 5, s * (side + (side < 0.5 ? 0.12 : -0.12)), y + 1 + r() * 10); g.stroke();
    }
    // 襟
    g.fillStyle = c.collar || 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, s, 14);
    g.fillStyle = 'rgba(255,250,235,0.12)'; g.fillRect(0, 1, s, 1.5);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 14, s, 2);
    g.fillStyle = c.collar || 'rgba(0,0,0,0.3)';
    g.beginPath(); g.moveTo(s * 0.43, 12); g.lineTo(s * 0.5, 40); g.lineTo(s * 0.57, 12); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(s * 0.43, 12); g.lineTo(s * 0.5, 40); g.lineTo(s * 0.57, 12); g.stroke();
    // 前立てとファスナー
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(s * 0.497, 40, 2, belt * s - 40);
    g.fillStyle = 'rgba(200,200,190,0.35)'; for (let y = 42; y < belt * s; y += 3) g.fillRect(s * 0.497, y, 2, 1);
    // 脇と肩の縫い目
    seam(g, s * 0.25, 16, s * 0.25, belt * s); seam(g, s * 0.75, 16, s * 0.75, belt * s);
    if (c.vest) {
      // ベスト：前身頃と背中。厚みの縁取り、胸と腹のポケット、マジックテープ
      const v0 = 30, v1 = belt * s - 4;
      g.fillStyle = c.vest;
      g.fillRect(s * 0.3, v0, s * 0.18, v1 - v0); g.fillRect(s * 0.52, v0, s * 0.18, v1 - v0);
      g.fillRect(0, v0 - 10, s * 0.15, v1 - v0 + 10); g.fillRect(s * 0.85, v0 - 10, s * 0.15, v1 - v0 + 10);
      const edge = (x, w) => { g.fillStyle = 'rgba(255,250,235,0.12)'; g.fillRect(x, v0, 1.5, v1 - v0); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + w - 2, v0, 2, v1 - v0); };
      edge(s * 0.3, s * 0.18); edge(s * 0.52, s * 0.18);
      for (const x of [s * 0.315, s * 0.535]) {
        patch(g, x, 62, s * 0.15, 30, 'rgba(255,250,235,0.05)'); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x, 70, s * 0.15, 1.5);
        patch(g, x, 120, s * 0.15, 40, 'rgba(0,0,0,0.12)'); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x, 130, s * 0.15, 1.5);
      }
      seam(g, s * 0.31, v0 + 2, s * 0.31, v1, 0.35); seam(g, s * 0.69, v0 + 2, s * 0.69, v1, 0.35);
    } else {
      patch(g, s * 0.33, 56, 30, 34); patch(g, s * 0.55, 56, 30, 34);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(s * 0.33, 64, 30, 1.5); g.fillRect(s * 0.55, 64, 30, 1.5);
    }
    if (c.stripe) {
      // 反射材のライン
      const y = torsoV(0.3) * s;
      g.fillStyle = c.stripe; g.fillRect(0, y, s, 9);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, y, s, 1.5);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 9, s, 1.5);
    }
    if (c.patch) {
      // 胸の徽章
      const x = s * 0.6, y = 52;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(x + 1, y + 1, 10, 0, 7); g.fill();
      g.fillStyle = c.patch; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill();
      g.strokeStyle = 'rgba(230,220,180,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 8.5, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(x - 6, y - 1.5, 12, 3); g.fillRect(x - 1.5, y - 6, 3, 12);
    }
    // ズボン（腰から下）とベルト
    band(g, s, beltB, 1, c.pants, { folds: 8, seed: 14 });
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, beltB * s, s, 3);
    seam(g, s * 0.5, beltB * s + 6, s * 0.5, s, 0.45); // 前の縫い目
    seam(g, s * 0.0 + 1, beltB * s + 4, s * 0.0 + 1, s, 0.45);
    for (const x of [s * 0.08, s * 0.8]) { patch(g, x, beltB * s + 10, s * 0.12, 22, 'rgba(0,0,0,0.12)'); }
    g.fillStyle = c.belt || '#1c1916'; g.fillRect(0, belt * s, s, (beltB - belt) * s);
    g.fillStyle = 'rgba(255,240,220,0.15)'; g.fillRect(0, belt * s + 1, s, 1);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, beltB * s - 1.5, s, 1.5);
    for (let x = 6; x < s; x += 26) g.fillRect(x, belt * s + 1, 5, (beltB - belt) * s - 2); // ベルト通し
    g.fillStyle = '#9a9488'; g.fillRect(s * 0.47, belt * s - 1, s * 0.06, (beltB - belt) * s + 2);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(s * 0.48, belt * s + 2, s * 0.04, (beltB - belt) * s - 4);
    if (c.torn) {
      // 破れて肌がのぞく穴と、血の染み
      const rr = rng(77);
      for (let i = 0; i < 4; i++) {
        const x = s * (0.15 + rr() * 0.7), y = s * (0.15 + rr() * 0.5), w = 10 + rr() * 14, h = 14 + rr() * 22;
        // ぎざぎざの裂け目。縁は布がほつれ、奥の肌は傷で赤黒い
        const pts = [];
        for (let k = 0; k < 14; k++) { const t = (k / 14) * Math.PI * 2, q = 0.55 + rr() * 0.5; pts.push([x + Math.cos(t) * w * q, y + Math.sin(t) * h * q]); }
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px + 1.5, py + 2) : g.moveTo(px + 1.5, py + 2))); g.fill();
        g.fillStyle = c.skinTone || c.skin; g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.fill();
        const wg = g.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.7);
        wg.addColorStop(0, 'rgba(70,6,6,0.85)'); wg.addColorStop(0.5, 'rgba(110,20,14,0.45)'); wg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = wg; g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.fill();
        g.strokeStyle = 'rgba(255,250,235,0.18)'; g.lineWidth = 1;
        for (const [px, py] of pts) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + (px - x) * 0.15, py + (py - y) * 0.15 + 2); g.stroke(); }
      }
      blood(g, s, 10, 3);
    }
  });
  const elbowV = armV(-0.27);
  tex.arm = charTexture(s, (g) => {
    const sleeveEnd = c.forearmSleeve ? 1 : armV(-0.2);
    skinPaint(g, s, c, 8);
    // 前腕の筋と手首の陰
    g.fillStyle = 'rgba(70,30,20,0.12)'; g.fillRect(s * 0.2, elbowV * s, s * 0.12, s * (1 - elbowV));
    g.fillStyle = 'rgba(70,30,20,0.2)'; g.fillRect(0, s - 8, s, 8);
    band(g, s, 0, sleeveEnd, c.sleeve, { folds: 14, seed: 6 });
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, s, 10);
    seam(g, 0, 14, s, 14, 0.35);
    seam(g, s * 0.0 + 1, 0, s * 0.0 + 1, sleeveEnd * s, 0.4);
    // 袖口：折り返しの厚みと影
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, sleeveEnd * s - 12, s, 12);
    g.fillStyle = 'rgba(255,250,235,0.14)'; g.fillRect(0, sleeveEnd * s - 12, s, 1.5);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, sleeveEnd * s, s, 3);
    if (c.forearmSleeve) for (let i = 0; i < 4; i++) {
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(s * 0.3, elbowV * s - 6 + i * 6); g.quadraticCurveTo(s * 0.5, elbowV * s + i * 6, s * 0.7, elbowV * s - 6 + i * 6); g.stroke();
    }
    if (c.stripe) { const y = armV(-0.08) * s; g.fillStyle = c.stripe; g.fillRect(0, y, s, 7); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, y, s, 1.5); }
    if (c.patch) {
      // 肩の部隊章（外側 = u 0.75 付近）
      for (const x of [s * 0.75, s * 0.25]) {
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x - 13, 21, 28, 28);
        g.fillStyle = c.patch; g.fillRect(x - 14, 20, 28, 28);
        g.strokeStyle = 'rgba(230,220,180,0.7)'; g.lineWidth = 1.5; g.strokeRect(x - 12, 22, 24, 24);
        g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x - 7, 32, 14, 3); g.fillRect(x - 1.5, 26, 3, 15);
      }
    }
    if (c.torn) blood(g, s, 6, 7);
  });
  tex.leg = charTexture(s, (g) => {
    shade(g, s, c.pants, { folds: 22, seed: 4, noise: 12 });
    // 外側と内側の縫い目、腿のポケット、膝のしわ
    seam(g, s * 0.25, 0, s * 0.25, s, 0.45); seam(g, s * 0.75, 0, s * 0.75, s, 0.45);
    for (const x of [s * 0.18, s * 0.7]) {
      patch(g, x, legV(-0.12) * s, s * 0.12, 44, 'rgba(0,0,0,0.12)');
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x, legV(-0.12) * s + 10, s * 0.12, 1.5);
    }
    const kv = legV(-0.44) * s;
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(s * 0.36, kv - 14 + i * 6); g.quadraticCurveTo(s * 0.5, kv - 18 + i * 6 + (i & 1) * 4, s * 0.64, kv - 12 + i * 6); g.stroke();
      g.strokeStyle = 'rgba(255,250,235,0.08)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s * 0.36, kv - 11 + i * 6); g.quadraticCurveTo(s * 0.5, kv - 15 + i * 6 + (i & 1) * 4, s * 0.64, kv - 9 + i * 6); g.stroke();
    }
    // 腰まわりの陰
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, s, 14);
    if (c.torn) blood(g, s, 8, 5);
  });
  tex.skin = charTexture(64, (g, ss) => {
    skinPaint(g, ss, c, 8);
    if (c.torn) { g.fillStyle = 'rgba(70,40,40,0.5)'; g.fillRect(ss * 0.4, ss * 0.2, 9, 16); }
  });
  tex.boots = charTexture(128, (g, ss) => {
    shade(g, ss, c.boots, { folds: 6, noise: 10, seed: 9, weave: false, top: 0.25 });
    // 革のしわ・照り・縫い目
    const r = rng(91);
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.5; const y = r() * ss; g.beginPath(); g.moveTo(r() * ss, y); g.lineTo(r() * ss, y + (r() - 0.5) * 6); g.stroke(); }
    seam(g, 0, ss * 0.1, ss, ss * 0.1, 0.4); seam(g, ss * 0.25, 0, ss * 0.25, ss, 0.35); seam(g, ss * 0.75, 0, ss * 0.75, ss, 0.35);
    // 靴紐（正面 u=0.5）
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(ss * 0.44, 0, ss * 0.12, ss * 0.9);
    for (let y = 6; y < ss * 0.9; y += 9) {
      g.fillStyle = 'rgba(200,190,170,0.45)'; g.fillRect(ss * 0.43, y, ss * 0.14, 2);
      g.fillStyle = '#9a9488'; g.fillRect(ss * 0.42, y - 1, 2, 2); g.fillRect(ss * 0.57, y - 1, 2, 2);
    }
  });
  tex.sole = charTexture(64, (g, ss) => {
    shade(g, ss, '#141210', { folds: 0, noise: 8, seed: 3, weave: false, top: 0 });
    g.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x < ss; x += 4) g.fillRect(x, 0, 1, ss);
  });
  tex.face = charTexture(256, (g) => { g.scale(2, 2); paintFace(g, 128, c); });
  // 装備：厚手のナイロン地。縫い目とバックル
  tex.gear = charTexture(64, (g, ss) => {
    shade(g, ss, '#8a8a8a', { folds: 4, noise: 16, seed: 23, top: 0.15 });
    seam(g, 3, 3, ss - 3, 3, 0.5); seam(g, 3, ss - 4, ss - 3, ss - 4, 0.5); seam(g, 3, 3, 3, ss - 3, 0.5); seam(g, ss - 4, 3, ss - 4, ss - 3, 0.5);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ss * 0.4, 0, ss * 0.2, ss);
    g.fillStyle = 'rgba(40,40,40,0.9)'; g.fillRect(ss * 0.42, ss * 0.3, ss * 0.16, ss * 0.12);
  });
  tex.hair = charTexture(128, (g, ss) => {
    const r = rng(11);
    g.fillStyle = c.hair; g.fillRect(0, 0, ss, ss);
    for (let i = 0; i < 260; i++) {
      const x = r() * ss, y = r() * ss * 0.5, len = ss * (0.3 + r() * 0.6);
      g.strokeStyle = r() < 0.55 ? `rgba(0,0,0,${0.18 + r() * 0.25})` : `rgba(255,235,205,${0.06 + r() * 0.14})`;
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 8, y + len * 0.5, x + (r() - 0.5) * 10, y + len); g.stroke();
    }
  });
  // 毛束：上が根元、下が毛先。毛先はまばらに細くなって抜ける
  tex.strand = charTexture(128, (g, ss) => {
    const r = rng(17);
    g.clearRect(0, 0, ss, ss);
    const base = new THREE.Color(c.hair);
    for (let i = 0; i < 150; i++) {
      const x = r() * ss, end = ss * (0.55 + r() * 0.45), k = 0.7 + r() * 0.6;
      const col = base.clone().multiplyScalar(k);
      g.strokeStyle = `rgb(${Math.min(255, col.r * 255) | 0},${Math.min(255, col.g * 255) | 0},${Math.min(255, col.b * 255) | 0})`;
      g.lineWidth = 1.5 + r() * 2.5;
      g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (r() - 0.5) * 10, end * 0.5, x + (r() - 0.5) * 16, end); g.stroke();
    }
    // 根元はすき間なく
    g.fillStyle = c.hair; g.fillRect(0, 0, ss, ss * 0.12);
    // つや：上 1/3 あたりに明るい帯
    const gr = g.createLinearGradient(0, 0, 0, ss);
    gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.22, 'rgba(255,240,220,0.18)'); gr.addColorStop(0.4, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, ss, ss); g.globalCompositeOperation = 'source-over';
  });
  return tex;
}

// ---- 骨に重みをつけたメッシュを組み立てる道具 ----
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

class SkinBuilder {
  constructor() { this.pos = []; this.uv = []; this.si = []; this.sw = []; this.idx = []; }
  vert(x, y, z, u, v, w) {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z); this.uv.push(u, v);
    const ws = w.filter(([, k]) => k > 1e-3).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = ws.reduce((a, [, k]) => a + k, 0) || 1;
    for (let k = 0; k < 4; k++) { this.si.push(ws[k] ? ws[k][0] : 0); this.sw.push(ws[k] ? ws[k][1] / sum : 0); }
    return i;
  }
  // 外向き（out の向き）になるよう三角形を並べる
  tri(a, b, c, out) {
    const P = this.pos, v = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    const A = v(a), Bv = v(b), C = v(c);
    const e1 = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) this.idx.push(a, c, b); else this.idx.push(a, b, c);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    smoothNormals(g);
    return withColor(g);
  }
}

// 継ぎ目（u=0/1 の重なりなど）で法線が割れないよう、同じ位置の頂点の法線をそろえる
function smoothNormals(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, map = new Map();
  const key = (i) => `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i); const e = map.get(k);
    if (e) { e.push(i); } else map.set(k, [i]);
  }
  for (const list of map.values()) {
    if (list.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const i of list) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of list) n.setXYZ(i, x / l, y / l, z / l);
  }
}

// 制御断面を Catmull-Rom でなめらかにつなぎ、細かい断面の列にする（y は上から下へ）
function resample(ctrl, step) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.abs(p1.y - p2.y) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, o = {};
      for (const key in p1) {
        if (key === 'y') { o.y = p1.y + (p2.y - p1.y) * t; continue; }
        const b = p1[key], c = p2[key] ?? b, a = p0[key] ?? b, d = p3[key] ?? c;
        o[key] = 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
      }
      out.push(o);
    }
  }
  out.push({ ...ctrl[ctrl.length - 1] });
  return out;
}

// 縦に伸びる筒。断面は楕円に shape(a, ring) の倍率を掛けたもの（a=0 が正面 +z、+x 側へ正）
// weight(y) はその高さの骨の重み、vOf(y) はテクスチャの v。capTop / capBot で端をふさぐ
function tube(S, ctrl, { seg = 20, step = 0.015, shape = () => 1, weight, vOf, capTop = false, capBot = false }) {
  const rings = resample(ctrl, step);
  const W = seg + 1, base = S.pos.length / 3;
  for (const R of rings) {
    const w = weight(R.y);
    for (let k = 0; k <= seg; k++) {
      const u = k / seg, a = (u - 0.5) * Math.PI * 2, m = shape(a, R);
      S.vert((R.cx || 0) + Math.sin(a) * R.rx * m, R.y, (R.cz || 0) + Math.cos(a) * R.rz * m, u, 1 - vOf(R.y), w);
    }
  }
  for (let j = 0; j < rings.length - 1; j++) {
    for (let k = 0; k < seg; k++) {
      const a = base + j * W + k, b = a + 1, c = a + W, d = c + 1;
      S.idx.push(a, c, b, b, c, d);
    }
  }
  const cap = (R, j, dir) => {
    const ci = S.vert(R.cx || 0, R.y + dir * 0.004, R.cz || 0, 0.5, 1 - vOf(R.y), weight(R.y));
    for (let k = 0; k < seg; k++) S.tri(ci, base + j * W + k, base + j * W + k + 1, [0, dir, 0]);
  };
  if (capTop) cap(rings[0], 0, 1);
  if (capBot) cap(rings[rings.length - 1], rings.length - 1, -1);
}

// 前後に伸びる筒（靴）。断面は横 rx・縦 ry の角の丸い四角（超楕円）
function loftZ(ctrl, { seg = 16, step = 0.012, pow = 3, vScale = 1 } = {}) {
  const rings = resample(ctrl.map((c) => ({ ...c, y: -c.z })), step).map((r) => ({ ...r, z: -r.y }));
  const pos = [], uv = [], idx = [];
  const W = seg + 1;
  rings.forEach((R) => {
    for (let k = 0; k <= seg; k++) {
      const u = k / seg, a = (u - 0.5) * Math.PI * 2;
      const sx = Math.sin(a), cy = Math.cos(a);
      const e = 2 / pow;
      const x = Math.sign(sx) * Math.abs(sx) ** e * R.rx, y = Math.sign(cy) * Math.abs(cy) ** e * R.ry;
      pos.push(x, R.cy + y, R.z); uv.push(u, (R.z - rings[0].z) * vScale);
    }
  });
  for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < seg; k++) {
    const a = j * W + k, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  // 端のふた
  for (const [j, dir] of [[0, -1], [rings.length - 1, 1]]) {
    const R = rings[j], ci = pos.length / 3;
    pos.push(0, R.cy, R.z); uv.push(0.5, 0.5);
    for (let k = 0; k < seg; k++) dir > 0 ? idx.push(ci, j * W + k + 1, j * W + k) : idx.push(ci, j * W + k, j * W + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  smoothNormals(g);
  // 外向きかを確かめ、内向きなら面を裏返す
  const n = g.attributes.normal, p = g.attributes.position;
  let dot = 0;
  for (let i = 0; i < p.count; i++) dot += n.getX(i) * p.getX(i) + n.getY(i) * (p.getY(i) - rings[0].cy);
  if (dot < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } smoothNormals(g); }
  return withColor(g);
}

// 両端の丸い棒（指など）。上端を原点に -y へ len 伸びる
function capsuleGeo(len, r0, r1, seg = 7, caps = 2) {
  const g = new THREE.CapsuleGeometry(1, 1, caps, seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); // 上の半球 0.5〜1.5、胴 -0.5〜0.5、下の半球 -1.5〜-0.5
    let yy, r;
    if (y >= 0.5) { r = r0; yy = -r0 + (y - 0.5) * r0; }
    else if (y <= -0.5) { r = r1; yy = -(len - r1) + (y + 0.5) * r1; }
    else { const t = 0.5 - y; r = r0 + (r1 - r0) * t; yy = -r0 - t * (len - r0 - r1); }
    p.setXYZ(i, p.getX(i) * r, yy, p.getZ(i) * r);
  }
  g.computeVertexNormals();
  return withColor(g);
}

// 手：手のひらは内側（体のほう）を向く。指は 2 節で軽く曲げ、親指は前寄りに
function makeHand(side, mat, slim) {
  const g = new THREE.Group();
  const k = slim < 1 ? 0.92 : 1;
  const palm = new THREE.Mesh(capsuleGeo(0.075 * k, 0.026 * k, 0.03 * k, 8), mat);
  palm.scale.set(0.55, 1, 1.25);
  palm.position.set(0, -0.235, 0.004);
  g.add(palm);
  const zs = [0.022, 0.008, -0.007, -0.021];
  const lens = [0.042, 0.047, 0.044, 0.035];
  zs.forEach((z, i) => {
    const f = new THREE.Group();
    f.position.set(-side * 0.002, -0.305, z * k);
    f.rotation.set(0, 0, side * 0.32);
    const a = new THREE.Mesh(capsuleGeo(lens[i] * 0.55 * k, 0.0085 * k, 0.008 * k, 5, 1), mat); f.add(a);
    const j2 = new THREE.Group(); j2.position.y = -lens[i] * 0.55 * k; j2.rotation.z = side * 0.45; f.add(j2);
    j2.add(new THREE.Mesh(capsuleGeo(lens[i] * 0.45 * k, 0.008 * k, 0.007 * k, 5, 2), mat));
    g.add(f);
  });
  const th = new THREE.Group();
  th.position.set(-side * 0.008, -0.255, 0.03 * k);
  th.rotation.set(0.5, 0, side * 0.55);
  th.add(new THREE.Mesh(capsuleGeo(0.04 * k, 0.011 * k, 0.009 * k, 5, 1), mat));
  const th2 = new THREE.Group(); th2.position.y = -0.04 * k; th2.rotation.z = side * 0.35; th.add(th2);
  th2.add(new THREE.Mesh(capsuleGeo(0.028 * k, 0.009 * k, 0.008 * k, 5, 2), mat));
  g.add(th);
  return g;
}

// 靴：筒（足首まわり）・甲から爪先・靴底。膝の骨の下に付ける（足首は膝から -0.42）
function makeBoot(mat, soleMat, slim) {
  const g = new THREE.Group();
  const k = slim < 1 ? 0.93 : 1;
  const S = new SkinBuilder();
  tube(S, [
    { y: -0.15, rx: 0.06 * k, rz: 0.066 * k, cz: -0.004 },
    { y: -0.2, rx: 0.058 * k, rz: 0.063 * k, cz: -0.005 },
    { y: -0.3, rx: 0.05 * k, rz: 0.054 * k, cz: -0.004 },
    { y: -0.38, rx: 0.046 * k, rz: 0.05 * k, cz: 0 },
    { y: -0.43, rx: 0.05 * k, rz: 0.062 * k, cz: 0.01 },
  ], { seg: 16, weight: () => [[0, 1]], vOf: (y) => (-0.15 - y) / 0.3, capTop: true });
  const shaftGeo = S.geometry(); shaftGeo.deleteAttribute('skinIndex'); shaftGeo.deleteAttribute('skinWeight');
  g.add(new THREE.Mesh(shaftGeo, mat));
  g.add(new THREE.Mesh(loftZ([
    { z: -0.075, rx: 0.045 * k, ry: 0.03, cy: -0.425 },
    { z: -0.04, rx: 0.052 * k, ry: 0.045, cy: -0.41 },
    { z: 0.02, rx: 0.056 * k, ry: 0.045, cy: -0.415 },
    { z: 0.08, rx: 0.058 * k, ry: 0.03, cy: -0.43 },
    { z: 0.14, rx: 0.052 * k, ry: 0.022, cy: -0.437 },
    { z: 0.175, rx: 0.036 * k, ry: 0.017, cy: -0.441 },
  ].map((o) => o), { seg: 18, vScale: 3 }), mat));
  g.add(new THREE.Mesh(loftZ([
    { z: -0.08, rx: 0.048 * k, ry: 0.012, cy: -0.448 },
    { z: 0.0, rx: 0.058 * k, ry: 0.012, cy: -0.448 },
    { z: 0.1, rx: 0.062 * k, ry: 0.012, cy: -0.448 },
    { z: 0.182, rx: 0.04 * k, ry: 0.011, cy: -0.448 },
  ], { seg: 14, pow: 5 }), soleMat));
  return g;
}

// 毛束の板を頭の楕円体に沿わせて垂らす。roots は [頭頂からの角, 方位角, 長さの割合, 外へ浮かす量]
function hairStrands(mat, list, { cy = 0.165, cz = -0.006, rx = 0.118, ry = 0.142, rz = 0.13, yEnd = 0.05, width = 0.045, curl = 0.25, segs = 7, drift = 0 } = {}) {
  const pos = [], uv = [], idx = [];
  for (const [th0, az0, lenK, off, w0 = 1, yE = yEnd] of list) {
    const k = 1 + off;
    const thEnd = Math.acos(Math.max(-0.98, Math.min(0.98, (yE - cy) / (ry * k))));
    const th1 = th0 + (thEnd - th0) * lenK;
    const base = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, th = th0 + (th1 - th0) * t, az = az0 + drift * t * t;
      // 赤道より下は真下へ落ち、毛先だけ内へ巻く
      const st = th > Math.PI / 2 ? 1 - curl * t * t * t : Math.sin(th);
      const cx = Math.sin(az), cz2 = Math.cos(az);
      const x = rx * k * st * cx, y = cy + ry * k * Math.cos(th), z = cz + rz * k * st * cz2;
      const ww = width * w0 * (1 - 0.35 * t) * 0.5;
      const tx = cz2, tz = -cx; // 方位の接線
      pos.push(x - tx * ww, y, z - tz * ww, x + tx * ww, y, z + tz * ww);
      uv.push(0, 1 - t, 1, 1 - t);
    }
    for (let i = 0; i < segs; i++) {
      const a = base + i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // 板の法線は外向き（頭の中心から離れる向き）にそろえる
  const n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const ox = p.getX(i), oy = p.getY(i) - cy, oz = p.getZ(i) - cz;
    if (n.getX(i) * ox + n.getY(i) * oy + n.getZ(i) * oz < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return new THREE.Mesh(withColor(g), mat);
}

function makeHair(c, mat, strandMat, slim) {
  const g = new THREE.Group();
  const r = rng(c.hair.length * 7 + (c.hairStyle || 's').length);
  const cap = new THREE.SphereGeometry(0.12, 18, 8, -Math.PI / 2, Math.PI * 2, 0, Math.PI * 0.42);
  cap.scale(0.97, 1.17, 1.06);
  cap.translate(0, 0.165, -0.008);
  g.add(new THREE.Mesh(withColor(cap), mat));
  const style = c.hairStyle;
  if (style === 'bob' || style === 'long') {
    const long = style === 'long';
    const yEnd = long ? -0.16 : 0.035;
    const list = [];
    // 後ろと横：2 層。顔の前（方位 ±0.6）は空ける
    for (const [off, n] of [[0.022, 26], [0.045, 22]]) {
      for (let i = 0; i < n; i++) {
        const az = 1.0 + (Math.PI * 2 - 2.0) * (i + r() * 0.6) / n;
        list.push([0.18 + r() * 0.2, az, 0.92 + r() * 0.08, off + r() * 0.008, 1 + r() * 0.3]);
      }
    }
    // 顔の脇に下がる房（頬にかからないよう、耳の前あたりから）
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) list.push([0.3 + i * 0.05, sx * (0.92 + i * 0.07), 0.95, 0.03 + i * 0.006, 0.85, yEnd + 0.01]);
    g.add(hairStrands(strandMat, list, { yEnd, curl: long ? 0.08 : 0.28, width: 0.05 }));
    // 前髪：頭頂から額へ、片側に流す
    const bangs = [];
    for (let i = 0; i < 13; i++) bangs.push([0.05 + r() * 0.05, -0.9 + i * 0.145 + r() * 0.04, 1, 0.028 + r() * 0.008, 1.0, 0.198 - Math.abs(i - 6) * 0.003]);
    g.add(hairStrands(strandMat, bangs, { yEnd: 0.2, curl: 0, width: 0.04, drift: 0.25, segs: 6 }));
  } else {
    // 短髪：頭皮に沿って短い房を寝かせる。額の生え際とこめかみで止める
    const list = [];
    for (let i = 0; i < 70; i++) {
      const az = (r() - 0.5) * Math.PI * 2, front = Math.cos(az);
      const th0 = 0.05 + r() * 0.35;
      const yE = front > 0.6 ? 0.22 : front > 0 ? 0.17 : 0.09;
      list.push([th0, az, 0.6 + r() * 0.4, 0.02 + r() * 0.015, 0.9 + r() * 0.4, yE]);
    }
    g.add(hairStrands(strandMat, list, { yEnd: 0.1, curl: 0, width: 0.05, segs: 5 }));
    if (style === 'pony') {
      const tail = [];
      for (let i = 0; i < 10; i++) tail.push([0.62 + r() * 0.05, Math.PI + (r() - 0.5) * 0.4, 1, 0.07 + r() * 0.02, 0.6, -0.15]);
      g.add(hairStrands(strandMat, tail, { yEnd: -0.15, curl: 0, width: 0.04 }));
    }
  }
  return g;
}

export function makeHumanoid(c) {
  const tex = makeBodyTextures(c);
  const slim = c.build === 'slim' ? 0.9 : 1;
  const fem = c.build === 'slim';
  const cloth = (map) => ps1Material({ map, hq: true, spec: 0.03, rim: 0.5 });
  const mat = {
    torso: cloth(tex.torso), arm: ps1Material({ map: tex.arm, hq: true, spec: 0.05, rim: 0.5, sss: 0.35 }), leg: cloth(tex.leg),
    skin: ps1Material({ map: tex.skin, hq: true, spec: 0.1, rim: 0.5, sss: 0.6 }),
    face: ps1Material({ map: tex.face, hq: true, spec: 0.12, rim: 0.45, sss: 0.6 }),
    boots: ps1Material({ map: tex.boots, hq: true, spec: 0.35, rim: 0.5 }),
    sole: ps1Material({ map: tex.sole, hq: true, rim: 0.3 }),
    hair: ps1Material({ map: tex.hair, hq: true, spec: 0.25, rim: 0.6 }),
    strand: ps1Material({ map: tex.strand, hq: true, spec: 0.3, rim: 0.6, side: THREE.DoubleSide }),
  };
  const plain = ps1Material({ hq: true, spec: 0.08, rim: 0.4 });
  const H = HIP_HEIGHT;
  const sw = c.build === 'slim' ? 0.215 : 0.25;  // 肩の関節
  const lx = 0.09 * slim;                        // 股関節

  // 骨：添字は重みの番号と同じ
  const root = new THREE.Group();
  const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); parent.add(b); return b; };
  const hips = bone(root, 0, H, 0);
  const torso = bone(hips, 0, 0, 0);
  const head = bone(torso, 0, 0.56, 0);
  const armL = bone(torso, sw, 0.5, 0), elbowL = bone(armL, 0, -0.27, 0);
  const armR = bone(torso, -sw, 0.5, 0), elbowR = bone(armR, 0, -0.27, 0);
  const legL = bone(hips, lx, 0, 0), kneeL = bone(legL, 0, -0.44, 0);
  const legR = bone(hips, -lx, 0, 0), kneeR = bone(legR, 0, -0.44, 0);
  const bones = [hips, torso, head, armL, elbowL, armR, elbowR, legL, kneeL, legR, kneeR];
  const [HIPS, TORSO, HEAD, AL, EL, AR, ER, LL, KL, LR, KR] = bones.map((_, i) => i);

  const front = (a) => Math.max(0, Math.cos(a));
  const back = (a) => Math.max(0, -Math.cos(a));
  const lobe = (a, at, wd) => Math.exp(-(((Math.abs(a) - at) / wd) ** 2));

  // ---- 胴（股〜首の付け根）。腰から上は胴の骨、下は腰の骨
  const S = new SkinBuilder();
  const hw = fem ? 1.06 : 1, ww = fem ? 0.86 : 1, cw = fem ? 0.9 : 1;
  tube(S, [
    { y: H + 0.625, rx: 0.055, rz: 0.05, cz: -0.004 },
    { y: H + 0.6, rx: 0.1 * cw, rz: 0.065, cz: -0.01, chest: 0, bust: 0, butt: 0, blade: 0 },
    { y: H + 0.57, rx: 0.17 * cw, rz: 0.085, cz: -0.01, chest: 0, bust: 0, butt: 0, blade: 0.05 },
    { y: H + 0.53, rx: 0.205 * cw, rz: 0.1, cz: -0.006, chest: 0.05, bust: 0, butt: 0, blade: 0.1 },
    { y: H + 0.46, rx: 0.19 * cw, rz: 0.112, cz: 0, chest: 0.12, bust: fem ? 0.1 : 0, butt: 0, blade: 0.08 },
    { y: H + 0.38, rx: 0.178 * cw, rz: 0.115, cz: 0.004, chest: 0.12, bust: fem ? 0.26 : 0.02, butt: 0, blade: 0.04 },
    { y: H + 0.3, rx: 0.165 * cw, rz: 0.108, cz: 0.004, chest: 0.06, bust: fem ? 0.12 : 0, butt: 0, blade: 0 },
    { y: H + 0.2, rx: 0.152 * ww, rz: 0.1, cz: 0, chest: 0.02, bust: 0, butt: 0, blade: 0 },
    { y: H + 0.11, rx: 0.145 * ww, rz: 0.098, cz: -0.002, chest: 0.03, bust: 0, butt: 0, blade: 0 },
    { y: H + 0.04, rx: 0.158 * hw, rz: 0.104, cz: -0.004, chest: 0.02, bust: 0, butt: 0.04, blade: 0 },
    { y: H - 0.03, rx: 0.172 * hw, rz: 0.11, cz: -0.008, chest: 0, bust: 0, butt: fem ? 0.16 : 0.1, blade: 0 },
    { y: H - 0.08, rx: 0.165 * hw, rz: 0.106, cz: -0.01, chest: 0, bust: 0, butt: fem ? 0.14 : 0.08, blade: 0 },
    { y: H - 0.115, rx: 0.12 * hw, rz: 0.085, cz: -0.006, chest: 0, bust: 0, butt: 0.03, blade: 0 },
    { y: H - 0.14, rx: 0.04, rz: 0.04, cz: 0 },
  ].map((o) => ({ chest: 0, bust: 0, butt: 0, blade: 0, ...o, rx: o.rx * slim / (slim < 1 ? 0.95 : 1) })), {
    seg: 22, step: 0.02,
    shape: (a, R) => 1 + R.chest * front(a) ** 2 + R.bust * front(a) * lobe(a, 0.42, 0.3) + R.butt * back(a) * lobe(Math.PI - Math.abs(a), 0.42, 0.4) + R.blade * back(a) * lobe(Math.PI - Math.abs(a), 0.55, 0.35),
    weight: (y) => { const k = sstep(H + 0.03, H + 0.16, y); return [[HIPS, 1 - k], [TORSO, k]]; },
    vOf: (y) => torsoV(y - H), capBot: true,
  });
  const torsoMesh = new THREE.SkinnedMesh(S.geometry(), mat.torso);

  // ---- 首（胴から頭へ）
  const N = new SkinBuilder();
  tube(N, [
    { y: H + 0.58, rx: 0.055, rz: 0.052, cz: -0.004 },
    { y: H + 0.62, rx: 0.05, rz: 0.05, cz: -0.002 },
    { y: H + 0.67, rx: 0.046, rz: 0.048, cz: 0.002 },
    { y: H + 0.72, rx: 0.045, rz: 0.047, cz: 0.004 },
  ], { seg: 14, weight: (y) => { const k = sstep(H + 0.6, H + 0.68, y); return [[TORSO, 1 - k], [HEAD, k]]; }, vOf: (y) => (H + 0.72 - y) * 4 });
  const neckMesh = new THREE.SkinnedMesh(N.geometry(), mat.skin);

  // ---- 腕（肩〜手首）。肩の丸み・力こぶ・肘・前腕のふくらみ
  const A = new SkinBuilder();
  for (const side of [1, -1]) {
    const SH = side > 0 ? AL : AR, EB = side > 0 ? EL : ER;
    const x0 = side * sw, y0 = H + 0.5, k = slim < 1 ? 0.88 : 1;
    tube(A, [
      { y: 0.045, rx: 0.026, rz: 0.03, cx: -0.05, delt: 0, bi: 0 },
      { y: 0.03, rx: 0.048, rz: 0.054, cx: -0.02, delt: 0.08, bi: 0 },
      { y: 0.0, rx: 0.062, rz: 0.065, cx: 0.002, delt: 0.12, bi: 0 },
      { y: -0.06, rx: 0.058, rz: 0.06, cx: 0.004, delt: 0.04, bi: 0.05 },
      { y: -0.13, rx: 0.05, rz: 0.056, cx: 0.002, delt: 0, bi: 0.1 },
      { y: -0.21, rx: 0.045, rz: 0.049, cx: 0, delt: 0, bi: 0.04 },
      { y: -0.27, rx: 0.041, rz: 0.044, cx: 0, delt: 0, bi: 0 },
      { y: -0.32, rx: 0.046, rz: 0.047, cx: 0, delt: 0.06, bi: 0 },
      { y: -0.4, rx: 0.038, rz: 0.036, cx: 0, delt: 0.02, bi: 0 },
      { y: -0.47, rx: 0.03, rz: 0.024, cx: 0, delt: 0, bi: 0 },
      { y: -0.515, rx: 0.028, rz: 0.022, cx: 0, delt: 0, bi: 0 },
    ].map((o) => ({ ...o, y: y0 + o.y, rx: o.rx * k, rz: o.rz * k, cx: x0 + side * o.cx, cz: 0 })), {
      seg: 14, step: 0.02,
      shape: (a, R) => 1 + R.delt * lobe(a, Math.PI / 2, 0.8) * (Math.sign(a) === side ? 1 : 0.2) + R.bi * front(a) ** 2,
      weight: (y) => {
        const t = sstep(y0 + 0.05, y0 - 0.015, y), e = sstep(y0 - 0.235, y0 - 0.305, y);
        return [[TORSO, (1 - t) * 0.6], [SH, (t + (1 - t) * 0.4) * (1 - e)], [EB, e]];
      },
      vOf: (y) => armV(y - y0), capTop: true,
    });
  }
  const armMesh = new THREE.SkinnedMesh(A.geometry(), mat.arm);

  // ---- 脚（股関節〜足首）。腿の前・膝頭・ふくらはぎ
  const L = new SkinBuilder();
  for (const side of [1, -1]) {
    const HP = side > 0 ? LL : LR, KN = side > 0 ? KL : KR;
    const x0 = side * lx, k = slim < 1 ? 0.94 : 1;
    tube(L, [
      { y: 0.08, rx: 0.07, rz: 0.08, cx: 0.0, quad: 0, knee: 0, calf: 0 },
      { y: 0.03, rx: 0.088, rz: 0.098, cx: 0.004, quad: 0.03, knee: 0, calf: 0 },
      { y: -0.05, rx: 0.09, rz: 0.098, cx: 0.004, quad: 0.06, knee: 0, calf: 0 },
      { y: -0.18, rx: 0.08, rz: 0.088, cx: 0.0, quad: 0.06, knee: 0, calf: 0 },
      { y: -0.32, rx: 0.066, rz: 0.07, cx: -0.004, quad: 0.03, knee: 0, calf: 0 },
      { y: -0.42, rx: 0.056, rz: 0.058, cx: -0.006, quad: 0, knee: 0.12, calf: 0 },
      { y: -0.48, rx: 0.054, rz: 0.058, cx: -0.006, quad: 0, knee: 0.04, calf: 0.06 },
      { y: -0.56, rx: 0.056, rz: 0.064, cx: -0.005, quad: 0, knee: 0, calf: 0.14 },
      { y: -0.66, rx: 0.047, rz: 0.052, cx: -0.004, quad: 0, knee: 0, calf: 0.06 },
      { y: -0.78, rx: 0.036, rz: 0.038, cx: -0.003, quad: 0, knee: 0, calf: 0 },
      { y: -0.87, rx: 0.032, rz: 0.034, cx: -0.003, quad: 0, knee: 0, calf: 0 },
    ].map((o) => ({ ...o, y: H + o.y, rx: o.rx * k, rz: o.rz * k, cx: x0 + side * o.cx, cz: 0 })), {
      seg: 14, step: 0.024,
      shape: (a, R) => 1 + R.quad * front(a) ** 2 + R.knee * Math.exp(-((a / 0.55) ** 2)) + R.calf * back(a) ** 2
        - 0.06 * (Math.sign(a) === -side ? Math.abs(Math.sin(a)) ** 4 : 0) * (R.y > H - 0.3 ? 1 : 0.3),
      weight: (y) => {
        const t = sstep(H + 0.07, H - 0.05, y), e = sstep(H - 0.405, H - 0.475, y);
        return [[HIPS, 1 - t], [HP, t * (1 - e)], [KN, e]];
      },
      vOf: (y) => legV(y - H), capTop: true,
    });
  }
  const legMesh = new THREE.SkinnedMesh(L.geometry(), mat.leg);

  const skinned = [torsoMesh, neckMesh, armMesh, legMesh];
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const m of skinned) { root.add(m); m.updateMatrixWorld(true); m.bind(skeleton); m.frustumCulled = false; }

  // ---- 頭（骨に付けた部品）：彫り出した顔・耳・髪
  const skull = sculptedHead(0.112);
  {
    const sp = skull.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
      const low = Math.max(0, -y / 0.112);           // 下半分ほど細く
      const kk = 1 - 0.22 * low * low;
      sp.setXYZ(i, x * kk, y, z * (z < 0 ? 1.04 : kk * 1.02 + 0.02 * (1 - low)));
    }
  }
  skull.scale(fem ? 0.92 : 0.95, 1.14, 1.0);
  skull.translate(0, 0.16, 0.005);
  smoothNormals(skull);
  head.add(new THREE.Mesh(withColor(skull), mat.face));
  for (const sx of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.028, 8, 6);
    ear.scale(0.38, 1, 0.62);
    ear.rotateY(sx * 0.35);
    ear.translate(sx * (fem ? 0.1 : 0.104), 0.153, -0.008);
    head.add(new THREE.Mesh(withColor(ear), mat.skin));
  }
  head.add(makeHair(c, mat.hair, mat.strand, slim));

  // ---- 手・靴
  elbowL.add(makeHand(1, mat.skin, slim));
  elbowR.add(makeHand(-1, mat.skin, slim));
  kneeL.add(makeBoot(mat.boots, mat.sole, slim));
  kneeR.add(makeBoot(mat.boots, mat.sole, slim));

  // ---- 装備（ポーチ・背負い物など。胴の骨に付ける）
  if (c.extra) torso.add(roundedParts(c.extra, ps1Material({ map: tex.gear, hq: true, spec: 0.08, rim: 0.4 })));

  const parts = { hips, torso, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR };

  // 立ち姿勢で骨格を見積もり、接触陰影を頂点カラーへ焼き込む
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  bakeVertexAO(root, [
    [V(0, H + 0.05, 0), V(0, H + 0.42, 0), 0.15 * slim],
    [V(0, H + 0.72, 0.005), V(0, H + 0.72, 0.005), 0.1],
    [V(0, H + 0.6, 0), V(0, H + 0.66, 0), 0.05],
    ...[1, -1].flatMap((s) => [
      [V(s * sw, H + 0.52, 0), V(s * sw, H + 0.24, 0), 0.058],
      [V(s * sw, H + 0.22, 0), V(s * sw, H + 0.0, 0), 0.042],
      [V(s * lx, H - 0.02, 0), V(s * lx, H - 0.42, 0), 0.085],
      [V(s * lx, H - 0.46, 0), V(s * lx, H - 0.74, 0), 0.058],
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
