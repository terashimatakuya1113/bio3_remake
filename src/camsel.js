// 固定カメラの選び方
// 1. 部屋ごとに決めた範囲（test）で、いちばん先に当てはまるカメラを選ぶ
// 2. ただし、そのカメラで主人公が画面からはみ出すなら、いちばんよく映るカメラに切り替える
// 3. いまのカメラできちんと映っているうちは、境目を少し越えても切り替えない（行ったり来たりを防ぐ）
const ASPECT = 4 / 3;

// 主人公の足元と頭が、カメラの画面のどこに映るか（-1〜1 が画面内）
function project(c, x, y, z) {
  if (!c._basis) {
    const f = norm([c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]]);
    const r = norm([-f[2], 0, f[0]]);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    c._basis = { f, r, u, t: Math.tan(c.fov * Math.PI / 360) };
  }
  const { f, r, u, t } = c._basis;
  const d = [x - c.pos[0], y - c.pos[1], z - c.pos[2]];
  const depth = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  return { x: (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (depth * t * ASPECT), y: (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (depth * t), depth };
}
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

// 映り具合：0 に近いほど画面の真ん中、1 を超えるとはみ出している
export function frameScore(c, x, z) {
  const a = project(c, x, 0.05, z), b = project(c, x, 1.7, z);
  if (a.depth < 0.8 || b.depth < 0.8) return 9;
  const sx = Math.max(Math.abs(a.x), Math.abs(b.x)) / 0.86;
  const sy = Math.max(-a.y / 0.96, b.y / 0.96, 0);
  const close = a.depth < 1.6 ? (1.6 - a.depth) : 0;
  return Math.max(sx, sy) + close;
}

// 足元が少し切れる程度（1.1 まで）は許す
const OK = 1.1;

export function pickCam(cams, x, z, cur) {
  const score = (i) => frameScore(cams[i], x, z);
  let pref = cams.length - 1;
  for (let i = 0; i < cams.length; i++) if (!cams[i].event && cams[i].test(x, z, 0)) { pref = i; break; }
  const curOk = cur >= 0 && !cams[cur].event && score(cur) < OK;
  if (curOk) {
    // いまのカメラの範囲に（少し余裕をもって）まだいれば、そのまま
    if (cams[cur].test(x, z, 0.35)) return cur;
    // 範囲を出ても、次のカメラで余裕をもって映るようになるまでは切り替えない
    return score(pref) < 0.8 ? pref : cur;
  }
  if (score(pref) < OK) return pref;
  // 決めた範囲のカメラでは映らない：近くの範囲のカメラ（棚や壁の裏を映さないように）か、
  // 範囲を決めていない補助のカメラから、一番よく映るものを選ぶ
  let best = pref, bs = score(pref);
  for (let i = 0; i < cams.length; i++) {
    const c = cams[i];
    if (c.event || !(c.assist || c.test(x, z, 2.0))) continue;
    const s = score(i);
    if (s < bs) { bs = s; best = i; }
  }
  return best;
}
