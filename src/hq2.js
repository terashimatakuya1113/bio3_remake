// 2 章以降の部屋で使う背景用テクスチャ（hq.js と同じく手続き生成）
import * as THREE from 'three';
import { fbm, hash, rnd, canvasTex, pixels, mul, mix, sat, smooth, grain } from './hq.js';

const signCache = new Map();

// 文字だけの看板。lines は [文字, 相対サイズ, 色] の列
export function signTex(key, { w = 256, h = 128, bg = '#d8d2c0', fg = '#1a1a1a', lines = [], border = null, dirt = 0.5 } = {}) {
  if (signCache.has(key)) return signCache.get(key);
  const t = canvasTex(w, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = border; g.lineWidth = Math.max(4, h * 0.06); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const total = lines.reduce((a, l) => a + (l[1] || 0.3), 0);
    let y = h * (0.5 - total / 2);
    for (const [text, size = 0.3, col = fg, weight = 'bold'] of lines) {
      g.fillStyle = col; g.font = `${weight} ${h * size * 0.82}px sans-serif`;
      g.fillText(text, w / 2, y + h * size / 2);
      y += h * size;
    }
    if (dirt > 0) pixels(g, w, h, (u, v, c) => mix(c, mul(c, 0.55), smooth(0.55, 0.85, fbm(u * 5, v * 3, 5, 4, 7)) * dirt));
  }, { repeat: false, h });
  signCache.set(key, t);
  return t;
}

export function makeHQTextures2() {
  const T = {};

  // 打ちっぱなしのコンクリート床：1 枚 2m、目地と油じみ
  T.concrete = canvasTex(512, (g, S) => {
    pixels(g, S, S, (u, v) => {
      let c = mul([0.46, 0.45, 0.42], 0.86 + 0.2 * fbm(u * 24, v * 24, 24, 4, 201));
      c = mul(c, 0.94 + 0.1 * fbm(u * 160, v * 160, 160, 2, 203));
      const oil = fbm(u * 5, v * 5, 5, 5, 205);
      c = mix(c, [0.18, 0.17, 0.15], smooth(0.58, 0.78, oil) * 0.7);
      const tyre = Math.abs(fbm(u * 2, v * 9, 2, 3, 207) - 0.5);
      if (tyre < 0.03) c = mul(c, 0.82);
      const crack = Math.abs(fbm(u * 14, v * 14, 14, 4, 209) - 0.5);
      if (crack < 0.005 && fbm(u * 4, v * 4, 4, 2, 211) > 0.5) c = mul(c, 0.4);
      const e = Math.min(u % 1, 1 - u % 1, v, 1 - v);
      if (e < 0.004) c = mul(c, 0.45);
      return c;
    });
  });

  // 濡れたアスファルト：水たまりは暗く、ざらつきは細かく
  T.asphalt = canvasTex(512, (g, S) => {
    pixels(g, S, S, (u, v) => {
      let c = mul([0.24, 0.24, 0.25], 0.75 + 0.5 * fbm(u * 200, v * 200, 200, 2, 221));
      c = mul(c, 0.85 + 0.3 * fbm(u * 12, v * 12, 12, 4, 223));
      const puddle = smooth(0.58, 0.63, fbm(u * 4, v * 4, 4, 5, 225));
      c = mix(c, [0.1, 0.11, 0.13], puddle * 0.6);
      const patch = fbm(u * 3, v * 3, 3, 3, 227);
      if (patch > 0.66) c = mul(c, 0.8);
      return c;
    });
  });

  // 波板の外壁：縦のうねり、塗装の色あせと錆の垂れ。1 枚 4m 四方
  T.corrugated = canvasTex(512, (g, S) => {
    pixels(g, S, S, (u, v, _, x) => {
      const rib = 0.5 + 0.5 * Math.sin(u * 64 * Math.PI);
      let c = mul([0.56, 0.6, 0.62], 0.7 + 0.35 * rib);
      c = mul(c, 0.9 + 0.15 * fbm(u * 30, v * 30, 30, 3, 231));
      const rust = smooth(0.55, 0.8, fbm(u * 18, v * 3, 18, 4, 233)) * (0.3 + v * 0.9);
      c = mix(c, [0.4, 0.2, 0.08], sat(rust) * 0.75);
      const streak = smooth(0.62, 0.8, fbm(u * 40, 0.5, 40, 2, 235)) * (1 - v) * 0.6;
      c = mix(c, [0.25, 0.14, 0.06], streak);
      if (v > 0.98) c = mul(c, 0.5);
      return c;
    });
  });

  // コンクリートブロック塀
  T.block = canvasTex(512, (g, S) => {
    pixels(g, S, S, (u, v) => {
      const row = Math.floor(v * 8), off = row % 2 ? 0.125 : 0;
      const bu = ((u + off) * 4) % 1, bv = (v * 8) % 1;
      let c = mul([0.55, 0.54, 0.5], 0.85 + 0.2 * fbm(u * 80, v * 80, 80, 3, 241));
      c = mul(c, 0.94 + 0.12 * hash(Math.floor((u + off) * 4), row, 243));
      if (bu < 0.025 || bv < 0.05) c = mul(c, 0.62);
      const wet = smooth(0.5, 0.75, fbm(u * 6, v * 2, 6, 4, 245)) * (0.4 + v * 0.6);
      c = mix(c, [0.24, 0.24, 0.22], wet * 0.6);
      return c;
    });
  });

  // シャッター：横のスラット
  T.shutter = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => {
      const s = (v * 24) % 1;
      let c = mul([0.52, 0.55, 0.56], 0.75 + 0.35 * Math.sin(s * Math.PI));
      if (s < 0.08) c = mul(c, 0.5);
      c = mix(c, [0.38, 0.22, 0.12], smooth(0.6, 0.85, fbm(u * 8, v * 8, 8, 4, 251)) * 0.6);
      c = mul(c, 1 - smooth(0.7, 1, v) * 0.35);
      return c;
    });
  }, { repeat: false });

  // 木箱
  T.crate = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => {
      const plank = Math.floor(v * 5);
      let c = mul([0.55, 0.42, 0.26], 0.7 + 0.45 * grain(u, v * 0.2 + plank * 0.31, 31 + plank));
      if ((v * 5) % 1 < 0.04) c = mul(c, 0.45);
      const fr = Math.min(u, 1 - u, v, 1 - v);
      if (fr < 0.09) c = mul([0.48, 0.36, 0.22], 0.7 + 0.4 * grain(v, u, 37));
      if (fr < 0.012 || Math.abs(fr - 0.09) < 0.006) c = mul(c, 0.5);
      // 斜めの筋交い
      if (Math.abs(u - v) < 0.06 && fr > 0.08) c = mul([0.48, 0.36, 0.22], 0.75 + 0.35 * grain(u + v, 0.3, 41));
      return c;
    });
    g.fillStyle = 'rgba(20,14,8,0.65)'; g.font = `bold ${S * 0.09}px sans-serif`; g.textAlign = 'center';
    g.fillText('VESPER PHARM.', S * 0.5, S * 0.32);
    g.font = `${S * 0.06}px sans-serif`; g.fillText('THIS SIDE UP  ↑', S * 0.5, S * 0.8);
  }, { repeat: false });

  // 冷蔵倉庫の断熱パネル
  T.panel = canvasTex(512, (g, S) => {
    pixels(g, S, S, (u, v) => {
      let c = mul([0.8, 0.82, 0.82], 0.92 + 0.08 * fbm(u * 60, v * 60, 60, 2, 261));
      const pu = (u * 4) % 1;
      if (pu < 0.012) c = mul(c, 0.55); else if (pu < 0.02) c = mul(c, 1.08);
      const grime = smooth(0.5, 0.8, fbm(u * 8, v * 8, 8, 4, 263)) * (0.3 + 0.7 * v);
      c = mix(c, [0.5, 0.48, 0.42], grime * 0.5);
      // 霜
      const frost = smooth(0.45, 0.7, fbm(u * 20, v * 20, 20, 4, 265)) * smooth(0.6, 1, v);
      c = mix(c, [0.86, 0.92, 0.98], frost * 0.7);
      return c;
    });
  });

  // 床に張られたステンレスの縞鋼板
  T.plate = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v, _, x, y) => {
      let c = mul([0.5, 0.52, 0.54], 0.8 + 0.25 * fbm(u * 40, v * 40, 40, 3, 271));
      const cx = (x % 16), cy = (y % 16);
      const off = (Math.floor(y / 16) % 2) * 8;
      const lx = (x + off) % 16;
      if (Math.abs(lx - cy) < 1.5 && lx > 3 && lx < 13) c = mul(c, 1.35);
      if (cx === 0 && cy === 0) c = mul(c, 0.8);
      c = mix(c, [0.32, 0.3, 0.28], smooth(0.55, 0.8, fbm(u * 6, v * 6, 6, 4, 273)) * 0.6);
      return c;
    });
  });

  // 金網フェンス（透過）
  T.chain = canvasTex(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.strokeStyle = 'rgba(150,155,160,0.95)'; g.lineWidth = 2;
    const n = 12, step = S / n;
    for (let i = -n; i < n * 2; i++) {
      g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step + S, S); g.stroke();
      g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step - S, S); g.stroke();
    }
  }, { srgb: true });

  T.hazard = canvasTex(128, (g, S) => {
    g.fillStyle = '#d8b018'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#141414';
    for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + S, S); g.lineTo(i * 32 + S, S); g.fill(); }
    pixels(g, S, S, (u, v, c) => mix(c, mul(c, 0.5), smooth(0.5, 0.8, fbm(u * 6, v * 6, 6, 4, 281)) * 0.6));
  });

  T.redwhite = canvasTex(128, (g, S) => {
    g.fillStyle = '#e8e4dc'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#b02018';
    for (let i = 0; i < 4; i++) g.fillRect(i * 32, 0, 16, S);
  });

  // 砂利と枕木
  T.gravel = canvasTex(512, (g, S) => {
    pixels(g, S, S, (u, v) => {
      const n = fbm(u * 120, v * 120, 120, 2, 291);
      const stone = hash(Math.floor(u * 150), Math.floor(v * 150), 293);
      let c = mul([0.34, 0.32, 0.3], 0.6 + 0.6 * stone * (0.6 + 0.4 * n));
      c = mix(c, [0.18, 0.12, 0.08], smooth(0.5, 0.8, fbm(u * 6, v * 6, 6, 4, 295)) * 0.6);
      return c;
    });
  });

  // 有蓋貨車：錆びた赤い鋼板と縦リブ、白い社名
  T.boxcar = canvasTex(512, (g, S) => {
    pixels(g, S, S, (u, v) => {
      let c = mul([0.42, 0.14, 0.09], 0.8 + 0.3 * fbm(u * 40, v * 20, 40, 3, 301));
      const rib = (u * 10) % 1;
      if (rib < 0.04) c = mul(c, 1.35); else if (rib < 0.07) c = mul(c, 0.6);
      c = mix(c, [0.3, 0.16, 0.08], smooth(0.55, 0.8, fbm(u * 10, v * 4, 10, 4, 303)) * 0.7);
      return c;
    });
    g.fillStyle = 'rgba(230,226,210,0.8)'; g.font = `bold ${S * 0.08}px sans-serif`;
    g.fillText('HC&W  40782', S * 0.08, S * 0.2);
    g.font = `${S * 0.04}px sans-serif`; g.fillText('LD LMT 132000  LT WT 61400', S * 0.08, S * 0.82);
  });

  // 輸送コンテナの鋼板（冷蔵ユニットつきの特別便）
  T.container = canvasTex(512, (g, S) => {
    pixels(g, S, S, (u, v) => {
      const rib = 0.5 + 0.5 * Math.sin(u * 20 * Math.PI);
      let c = mul([0.66, 0.68, 0.7], 0.72 + 0.32 * rib);
      c = mix(c, [0.36, 0.22, 0.12], smooth(0.6, 0.85, fbm(u * 10, v * 10, 10, 4, 311)) * 0.6);
      const frost = smooth(0.5, 0.75, fbm(u * 24, v * 24, 24, 4, 313)) * smooth(0.3, 1, v);
      c = mix(c, [0.86, 0.92, 0.98], frost * 0.55);
      return c;
    });
    g.fillStyle = '#1a1a1a'; g.font = `bold ${S * 0.07}px sans-serif`;
    g.fillText('VPX-0928', S * 0.06, S * 0.12);
    g.fillStyle = '#a81810'; g.font = `bold ${S * 0.05}px sans-serif`;
    g.fillText('BIOLOGICAL  /  KEEP FROZEN  -20°C', S * 0.06, S * 0.2);
  });

  // 無線機のラック
  T.radio = canvasTex(256, (g, S) => {
    g.fillStyle = '#2a2c2a'; g.fillRect(0, 0, S, S);
    const unit = (y, h, kind) => {
      g.fillStyle = '#4a4c48'; g.fillRect(6, y, S - 12, h - 4);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(6, y, S - 12, 2);
      g.fillStyle = '#111'; for (const x of [10, S - 16]) g.fillRect(x, y + 4, 6, 6);
      if (kind === 0) {
        g.fillStyle = '#0a1a10'; g.fillRect(30, y + 10, 90, h - 24);
        g.fillStyle = '#5af07a'; g.font = `${h * 0.3}px monospace`; g.fillText('148.250', 36, y + h * 0.55);
        for (let i = 0; i < 4; i++) { g.fillStyle = '#ccc'; g.beginPath(); g.arc(150 + i * 24, y + h / 2, 7, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(149 + i * 24, y + h / 2 - 7, 2, 7); }
      } else if (kind === 1) {
        for (let i = 0; i < 2; i++) {
          g.fillStyle = '#e8e4d0'; g.fillRect(30 + i * 100, y + 8, 80, h - 20);
          g.strokeStyle = '#222'; g.beginPath(); g.moveTo(70 + i * 100, y + h - 14); g.lineTo(52 + i * 100 + i * 30, y + 16); g.stroke();
        }
        g.fillStyle = '#e04020'; g.beginPath(); g.arc(S - 36, y + h / 2, 5, 0, 7); g.fill();
      } else {
        g.fillStyle = '#222'; for (let x = 24; x < S - 30; x += 6) g.fillRect(x, y + 10, 3, h - 22);
      }
    };
    unit(10, 70, 0); unit(84, 64, 1); unit(152, 50, 2); unit(206, 44, 0);
  }, { repeat: false });

  // ロッカー
  T.locker = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => {
      let c = mul([0.36, 0.44, 0.5], 0.85 + 0.2 * fbm(u * 30, v * 30, 30, 3, 321));
      const lu = (u * 3) % 1;
      if (lu < 0.03 || lu > 0.97) c = mul(c, 0.45);
      if (v > 0.08 && v < 0.2 && lu > 0.25 && lu < 0.75 && (v * 40) % 1 < 0.5) c = mul(c, 0.4);
      c = mix(c, [0.3, 0.18, 0.1], smooth(0.62, 0.85, fbm(u * 10, v * 10, 10, 4, 323)) * 0.6);
      return c;
    });
  }, { repeat: false });

  // 霜と氷（透過）
  T.frost = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => {
      const n = fbm(u * 10, v * 10, 10, 5, 331);
      return [0.88, 0.94, 1.0, sat(smooth(0.45, 0.7, n) * 0.85)];
    });
  });

  // 水たまり（透過、ほとんど黒）
  T.puddle = canvasTex(256, (g, S) => {
    pixels(g, S, S, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5);
      const n = fbm(u * 5, v * 5, 5, 4, 341);
      return [0.04, 0.05, 0.07, smooth(0.5, 0.4, d + (n - 0.5) * 0.35)];
    });
  }, { repeat: false });

  // 割れた点滴瓶・アンプル（透過）
  T.ampoules = canvasTex(128, (g, S) => {
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < 18; i++) {
      const x = 10 + rnd() * (S - 20), y = 10 + rnd() * (S - 20);
      g.fillStyle = 'rgba(120,200,150,0.55)'; g.beginPath(); g.ellipse(x, y, 6 + rnd() * 10, 3 + rnd() * 6, rnd() * 3, 0, 7); g.fill();
      g.fillStyle = 'rgba(220,240,230,0.9)'; g.fillRect(x - 2, y - 1, 4, 2);
    }
  }, { repeat: false });

  return T;
}
