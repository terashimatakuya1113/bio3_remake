// ゲーム全体で共有する状態と、当たり判定などの小さな道具
import * as THREE from 'three';
import { addQuad, buildGeometry, newBuilder, ps1Material, textures } from './ps1.js';

// main.js が中身を入れる。敵や台本（story.js）はここを通してプレイヤーや部屋に触る
export const W = {
  state: 'title',
  player: null,
  room: null,     // いまいる部屋（rooms/*.js の build() の戻り値）
  scene: null,
  fxs: null,
  enemies: [],
  npcs: [],
  flags: {},
  // 被弾したときの赤い点滅と体調表示（main.js が差し替える）
  hurtFx() {},
  die() {},
};

export const PLAYER_R = 0.28;
export const angleDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
export const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
export const smooth = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

export function collide(o, r) {
  const { x0, x1, z0, z1 } = W.room.bounds;
  o.x = Math.min(x1 - r, Math.max(x0 + r, o.x));
  o.z = Math.min(z1 - r, Math.max(z0 + r, o.z));
  for (const [ax0, az0, ax1, az1] of W.room.colliders) {
    const cx = Math.max(ax0, Math.min(o.x, ax1));
    const cz = Math.max(az0, Math.min(o.z, az1));
    const dx = o.x - cx, dz = o.z - cz;
    const d = Math.hypot(dx, dz);
    if (d < r) {
      if (d > 1e-5) { o.x = cx + (dx / d) * r; o.z = cz + (dz / d) * r; }
      else { o.x += r; }
    }
  }
}

export function pushApart(a, b, minD) {
  const dx = a.x - b.x, dz = a.z - b.z;
  const d = Math.hypot(dx, dz);
  if (d < minD && d > 1e-5) { a.x = b.x + (dx / d) * minD; a.z = b.z + (dz / d) * minD; collide(a, PLAYER_R); }
}

// 足元の丸い影
export function blobShadow(size = 0.7) {
  const b = newBuilder();
  addQuad(b, [-size / 2, 0, size / 2], [1, 0, 0], [0, 0, -1], size, size, [0, 1, 0], 0.7, 1);
  const m = new THREE.Mesh(buildGeometry(b), ps1Material({ map: textures.shadow, opacity: 0.55 }));
  m.position.y = 0.015;
  return m;
}

// 壁越しに撃てないよう、2 点の間に当たり判定の箱があるか調べる
export function lineBlocked(ax, az, bx, bz) {
  for (const [x0, z0, x1, z1] of W.room.colliders) {
    if (W.room.lowColliders?.has(`${x0},${z0},${x1},${z1}`)) continue;
    // 線分と矩形の交差（スラブ法）
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-9) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az) && t0 < t1 && t0 > 0.02 && t1 < 0.98) return true;
  }
  return false;
}
