// 事前レンダリング背景用の高解像度テクスチャ（すべて手続き生成）
import * as THREE from 'three';

// ---- ノイズ（周期つきなので継ぎ目なくタイルできる） ----
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (a) => ((a % p) + p) % p;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s);
  const c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, p, oct = 4, s = 0) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, y * f, p * f, s + i * 17);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

let seed = 4242;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function canvasTex(size, draw, { srgb = true, repeat = true, h = size } = {}) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h;
  const g = c.getContext('2d');
  draw(g, size, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 画素ごとに色を決める（u,v は 0..1、戻り値は 0..1 の RGB）
function pixels(g, w, h, fn) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const out = fn(x / w, y / h, [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255], x, y);
      d[i] = out[0] * 255; d[i + 1] = out[1] * 255; d[i + 2] = out[2] * 255;
      d[i + 3] = out.length > 3 ? out[3] * 255 : 255;
    }
  }
  g.putImageData(img, 0, 0);
}
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const sat = (v) => Math.min(1, Math.max(0, v));
const smooth = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

function grain(u, v, s) {
  // 木目：ゆがめた縞
  const warp = fbm(u * 4, v * 1, 4, 3, s) * 9;
  const ring = Math.sin((v * 34 + warp) * Math.PI);
  const fine = fbm(u * 64, v * 4, 64, 2, s + 3);
  return 0.5 + 0.25 * ring + 0.25 * (fine - 0.5) * 2;
}

export function makeHQTextures() {
  const T = {};

  // 壁：上はくすんだ緑の塗装壁、下は木の腰板と巾木。1 枚で高さ 3.2m
  T.wall = canvasTex(512, (g, S) => {
    const rail = Math.round(S * (1 - 1.0 / 3.2));
    const base = Math.round(S * (1 - 0.12 / 3.2));
    pixels(g, S, S, (u, v, _, x, y) => {
      if (y < rail - 6) {
        const n = fbm(u * 8, v * 8, 8, 5, 1);
        const stripe = (x % 24 < 2) ? 0.95 : 1.0;
        let c = mix([0.36, 0.42, 0.34], [0.46, 0.5, 0.4], n);
        c = mul(c, stripe);
        // 雨漏りの筋
        const col = fbm(u * 6, 0.5, 6, 2, 9);
        const streak = smooth(0.62, 0.8, col) * (1 - v * 1.3) * (0.6 + 0.4 * fbm(u * 40, v * 3, 40, 2, 4));
        c = mix(c, [0.24, 0.2, 0.12], sat(streak) * 0.7);
        // 下に行くほど手垢と汚れ
        const grime = smooth(0.45, 0.66, v) * fbm(u * 16, v * 16, 16, 3, 7);
        c = mul(c, 1 - grime * 0.35);
        c = mul(c, 1 - smooth(0.06, 0, v) * 0.4);
        return c;
      }
      if (y < rail + 2) {
        // 腰板の笠木
        const sh = y < rail - 3 ? 1.15 : y > rail ? 0.6 : 0.9;
        return mul([0.27, 0.17, 0.1], sh * (0.85 + 0.3 * fbm(u * 64, v * 4, 64, 2, 2)));
      }
      if (y < base) {
        const board = Math.floor(x / 64);
        const bx = (x % 64) / 64;
        let c = mul([0.33, 0.21, 0.12], 0.8 + 0.4 * grain(u * 8, v * 2 + board * 0.37, board));
        if (bx < 0.03) c = mul(c, 0.45);
        else if (bx < 0.06) c = mul(c, 1.12);
        c = mul(c, 1 - fbm(u * 20, v * 20, 20, 3, 5) * 0.3);
        return c;
      }
      const b = y < base + 2 ? 1.2 : 0.75;
      return mul([0.13, 0.09, 0.06], b * (0.8 + 0.4 * fbm(u * 32, v * 8, 32, 2, 3)));
    });
  });

  // 床：すり減ったリノリウム。1 枚 1.2m で 2×2 タイル
  T.floor = canvasTex(512, (g, S) => {
    pixels(g, S, S, (u, v, _, x, y) => {
      const tx = Math.floor(u * 2), ty = Math.floor(v * 2);
      const checker = (tx + ty) % 2;
      let c = checker ? [0.5, 0.48, 0.42] : [0.43, 0.42, 0.39];
      c = mul(c, 0.94 + 0.12 * hash(tx, ty, 3));
      const speck = fbm(u * 96, v * 96, 96, 2, 11);
      c = mul(c, 0.9 + 0.2 * speck);
      const dirt = fbm(u * 12, v * 12, 12, 5, 21);
      c = mix(c, [0.24, 0.2, 0.15], smooth(0.45, 0.8, dirt) * 0.45);
      const wear = fbm(u * 4, v * 4, 4, 4, 31);
      c = mix(c, [0.6, 0.58, 0.52], smooth(0.6, 0.8, wear) * 0.2);
      // 目地
      const gx = (u * 2) % 1, gy = (v * 2) % 1;
      const edge = Math.min(gx, 1 - gx, gy, 1 - gy);
      if (edge < 0.006) c = mul(c, 0.35);
      else if (edge < 0.014) c = mul(c, 0.82);
      return c;
    });
    // 擦り傷
    g.globalAlpha = 0.25; g.strokeStyle = '#1a140c'; g.lineWidth = 1.2;
    for (let i = 0; i < 60; i++) {
      const x = rnd() * S, y = rnd() * S, r = 6 + rnd() * 30, a = rnd() * 6;
      g.beginPath(); g.arc(x, y, r, a, a + 0.4 + rnd()); g.stroke();
    }
    g.globalAlpha = 1;
  });

  // 天井：ジプトーン風の天井板と T バー
  T.ceiling = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => {
      let c = mul([0.72, 0.71, 0.66], 0.9 + 0.15 * fbm(u * 64, v * 64, 64, 2, 41));
      const pits = fbm(u * 48, v * 48, 48, 1, 43);
      if (pits > 0.7) c = mul(c, 0.75);
      const stain = fbm(u * 3, v * 3, 3, 4, 47);
      c = mix(c, [0.48, 0.4, 0.26], smooth(0.62, 0.72, stain) * 0.5);
      const gx = (u * 2) % 1, gy = (v * 2) % 1;
      const edge = Math.min(gx, 1 - gx, gy, 1 - gy);
      if (edge < 0.012) c = [0.62, 0.62, 0.6];
      else if (edge < 0.02) c = mul(c, 0.7);
      return c;
    });
  });

  T.wood = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => mul([0.36, 0.22, 0.12], 0.7 + 0.5 * grain(u, v, 5)));
  });
  T.woodDark = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => mul([0.2, 0.12, 0.07], 0.75 + 0.45 * grain(u, v, 8)));
  });

  // 書類棚：3 段の引き出し
  T.cabinet = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => {
      let c = mul([0.36, 0.4, 0.37], 0.9 + 0.15 * fbm(u * 32, v * 32, 32, 3, 51));
      const rust = fbm(u * 10, v * 10, 10, 4, 53) * smooth(0.6, 1, v);
      c = mix(c, [0.36, 0.2, 0.1], smooth(0.5, 0.7, rust));
      const dv = (v * 3) % 1;
      if (dv < 0.025 || u < 0.03 || u > 0.97) c = mul(c, 0.4);
      else if (dv < 0.045) c = mul(c, 1.25);
      return c;
    }, false);
    for (let i = 0; i < 3; i++) {
      const y = i * S / 3;
      g.fillStyle = '#c8c8be'; g.fillRect(S * 0.38, y + S * 0.08, S * 0.24, S * 0.035);
      g.fillStyle = '#2a2a28'; g.fillRect(S * 0.38, y + S * 0.115, S * 0.24, S * 0.01);
      g.fillStyle = '#ddd6c0'; g.fillRect(S * 0.42, y + S * 0.16, S * 0.16, S * 0.05);
      g.strokeStyle = '#555'; g.strokeRect(S * 0.42, y + S * 0.16, S * 0.16, S * 0.05);
    }
    g.strokeStyle = 'rgba(220,220,210,0.25)';
    for (let i = 0; i < 25; i++) { g.beginPath(); const x = rnd() * S, y = rnd() * S; g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 8); g.stroke(); }
  }, { repeat: false });

  // 扉：鏡板 4 枚。光は左上から当たっている体で陰影を描き込む
  T.door = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => mul([0.3, 0.18, 0.1], 0.7 + 0.45 * grain(u * 0.5, v * 0.25, 13)));
    const panel = (x, y, w, h) => {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,220,180,0.12)'; g.fillRect(x + 4, y + 4, w - 8, h - 8);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + w - 6, y + 4, 4, h - 6); g.fillRect(x + 4, y + h - 6, w - 6, 4);
      g.fillStyle = 'rgba(255,230,200,0.18)'; g.fillRect(x, y, w, 3); g.fillRect(x, y, 3, h);
    };
    panel(S * 0.12, S * 0.06, S * 0.32, S * 0.4); panel(S * 0.56, S * 0.06, S * 0.32, S * 0.4);
    panel(S * 0.12, S * 0.54, S * 0.32, S * 0.4); panel(S * 0.56, S * 0.54, S * 0.32, S * 0.4);
    const grd = g.createLinearGradient(0, S * 0.7, 0, S);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(10,6,2,0.45)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
  }, { repeat: false });

  T.leather = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => {
      let c = mul([0.34, 0.07, 0.06], 0.75 + 0.4 * fbm(u * 24, v * 24, 24, 4, 61));
      const crack = Math.abs(fbm(u * 12, v * 12, 12, 3, 63) - 0.5);
      if (crack < 0.012) c = mix(c, [0.55, 0.42, 0.36], 0.6);
      return c;
    });
  });

  T.books = canvasTex(256, (g, S) => {
    g.fillStyle = '#1c130b'; g.fillRect(0, 0, S, S);
    const cols = ['#5a1f18', '#1f2d45', '#2c4424', '#6b5a2c', '#3c2240', '#4a4a46', '#7a6a50', '#20302e'];
    for (let row = 0; row < 4; row++) {
      const top = row * S / 4;
      let x = 2;
      while (x < S - 6) {
        const w = 6 + Math.floor(rnd() * 12), hgt = S / 4 * (0.66 + rnd() * 0.26);
        const lean = rnd() < 0.08;
        g.fillStyle = cols[Math.floor(rnd() * cols.length)];
        g.save(); g.translate(x, top + S / 4 - 6);
        if (lean) g.rotate(-0.15);
        g.fillRect(0, -hgt, w, hgt);
        g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(1, -hgt * 0.75, w - 2, 3); g.fillRect(1, -hgt * 0.3, w - 2, 2);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(w - 2, -hgt, 2, hgt);
        g.restore();
        x += w + (rnd() < 0.12 ? 10 : 0);
      }
      g.fillStyle = '#3a2614'; g.fillRect(0, top + S / 4 - 6, S, 6);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, top, S, 10);
    }
  }, { repeat: false });

  T.paper = canvasTex(64, (g, S) => {
    g.fillStyle = '#dcd6c2'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#6a665c';
    for (let y = 8; y < S - 6; y += 4) g.fillRect(6, y, 30 + rnd() * 20, 1);
  }, { repeat: false });

  T.cardboard = canvasTex(128, (g, S) => {
    pixels(g, S, S, (u, v) => mul([0.55, 0.41, 0.26], 0.85 + 0.25 * fbm(u * 16, v * 16, 16, 3, 71)));
    g.fillStyle = 'rgba(200,180,140,0.7)'; g.fillRect(S * 0.42, 0, S * 0.16, S);
    g.fillStyle = 'rgba(30,20,10,0.6)'; g.font = `${S * 0.12}px sans-serif`; g.fillText('FRAGILE', S * 0.06, S * 0.3);
  }, { repeat: false });

  T.metal = canvasTex(128, (g, S) => {
    pixels(g, S, S, (u, v) => mul([0.5, 0.5, 0.48], 0.8 + 0.3 * fbm(u * 32, v * 4, 32, 3, 81)));
  });

  // 張り紙：安全標語
  T.poster = canvasTex(256, (g, S) => {
    g.fillStyle = '#e4dcc4'; g.fillRect(0, 0, S, S * 1.4);
    g.fillStyle = '#a8261c'; g.fillRect(0, 0, S, S * 0.3);
    g.fillStyle = '#f4ecd8'; g.font = `bold ${S * 0.17}px sans-serif`; g.textAlign = 'center';
    g.fillText('安全第一', S / 2, S * 0.21);
    g.fillStyle = '#2a2a2a'; g.font = `${S * 0.07}px sans-serif`;
    g.fillText('指差し確認', S / 2, S * 0.5);
    g.fillText('整理・整頓', S / 2, S * 0.62);
    g.fillText('無断外出禁止', S / 2, S * 0.74);
    g.font = `${S * 0.05}px sans-serif`; g.fillStyle = '#555';
    g.fillText('UMBRELLA LOGISTICS', S / 2, S * 0.92);
    pixels(g, S, S, (u, v, c) => mix(c, mul(c, 0.6), smooth(0.55, 0.8, fbm(u * 6, v * 6, 6, 4, 91)) * 0.6));
  }, { repeat: false });

  // カレンダー：1998 年 9 月
  T.calendar = canvasTex(256, (g, S) => {
    g.fillStyle = '#ece6d4'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#2a3a5a'; g.fillRect(0, 0, S, S * 0.22);
    g.fillStyle = '#eee'; g.font = `bold ${S * 0.1}px sans-serif`; g.textAlign = 'center';
    g.fillText('1998  9', S / 2, S * 0.15);
    g.font = `${S * 0.055}px sans-serif`;
    for (let d = 1; d <= 30; d++) {
      const i = d + 1, col = i % 7, row = Math.floor(i / 7);
      g.fillStyle = col === 0 ? '#a02020' : '#333';
      g.fillText(String(d), S * (0.09 + col * 0.137), S * (0.33 + row * 0.13));
      if (d === 28) { g.strokeStyle = '#b01010'; g.lineWidth = 3; g.beginPath(); g.arc(S * (0.09 + col * 0.137), S * (0.31 + row * 0.13), S * 0.045, 0, 7); g.stroke(); }
    }
  }, { repeat: false });

  T.clock = canvasTex(128, (g, S) => {
    g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#222';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(S / 2 + Math.sin(a) * S * 0.38 - 2, S / 2 - Math.cos(a) * S * 0.38 - 2, 4, 4); }
    const hand = (a, l, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + Math.sin(a) * l, S / 2 - Math.cos(a) * l); g.stroke(); };
    hand((2 + 47 / 60) / 12 * Math.PI * 2, S * 0.24, 5);
    hand(47 / 60 * Math.PI * 2, S * 0.36, 3);
  }, { repeat: false });

  T.screen = canvasTex(64, (g, S) => {
    const grd = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.7);
    grd.addColorStop(0, '#2a3a34'); grd.addColorStop(1, '#0a100e');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
  }, { repeat: false });

  T.blood = canvasTex(128, (g, S) => {
    pixels(g, S, S, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5);
      const n = fbm(u * 6, v * 6, 6, 4, 101);
      const a = smooth(0.5, 0.42, d + (n - 0.5) * 0.5);
      const drop = fbm(u * 20, v * 20, 20, 2, 103) > 0.72 && d < 0.5 ? 1 : 0;
      return [0.22 + n * 0.1, 0.02, 0.02, Math.max(a, drop * 0.9)];
    });
  }, { repeat: false });

  T.papers = canvasTex(64, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#d6d0bc'; g.fillRect(4, 4, S - 8, S - 8);
    g.fillStyle = '#77736a';
    for (let y = 12; y < S - 10; y += 5) g.fillRect(10, y, 20 + rnd() * 24, 1.5);
  }, { repeat: false });

  return T;
}

export function hqMat(map, { rough = 0.8, metal = 0, color = 0xffffff, alpha = false, emissive = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: metal, color });
  if (alpha) { m.alphaTest = 0.4; m.transparent = false; }
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 1; }
  return m;
}
