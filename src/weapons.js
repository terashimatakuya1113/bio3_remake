// 武器の性能と、手に持つモデル
// ナイフは弾がいらないので、弾が尽きても戦える（詰み対策）
import * as THREE from 'three';
import { addBox, buildGeometry, newBuilder, ps1Material } from './ps1.js';

// range：届く距離、cone：当たる扇形の半角、dmg：1 発の威力（ハンドガン = 1）、cd：次に撃てるまでの秒数
// pellets：散弾（扇形の中の敵すべてに当たり、遠いほど弱い）、pierce：貫通（扇形の中の敵すべてに当たる）
export const WEAPONS = {
  knife: { name: 'KNIFE', melee: true, range: 1.3, cone: 0.75, dmg: 0.6, cd: 0.5 },
  handgun: { name: 'HANDGUN', ammo: 'ammo', cap: 15, range: 12, cone: 0.35, dmg: 1, cd: 0.3, recoil: 1, flash: 0.26 },
  shotgun: { name: 'SHOTGUN', ammo: 'shells', cap: 7, range: 8, cone: 0.55, dmg: 3.2, cd: 0.85, pellets: true, recoil: 1.6, flash: 0.5 },
  magnum: { name: 'MAGNUM', ammo: 'magnumAmmo', cap: 6, range: 14, cone: 0.32, dmg: 6, cd: 0.95, pierce: true, recoil: 2, flash: 0.33 },
};

// 弾の種類 → 使う武器
export const AMMO_FOR = { ammo: 'handgun', shells: 'shotgun', magnumAmmo: 'magnum' };

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
function part(boxes, mat) {
  const b = newBuilder();
  for (const [min, max, color] of boxes) addBox(b, min, max, 10, 10, hex(color), false);
  return new THREE.Mesh(buildGeometry(b), mat);
}

// 前腕の先に付ける。+z が銃口（刃先）の向き
export function makeWeaponMesh(id) {
  const mat = ps1Material();
  if (id === 'knife') {
    return part([
      [[-0.014, -0.02, -0.04], [0.014, 0.02, 0.06], '#1c1a18'],
      [[-0.03, -0.024, 0.06], [0.03, 0.024, 0.07], '#3a3a3e'],
      [[-0.004, -0.018, 0.07], [0.004, 0.02, 0.22], '#b8bcc4'],
      [[-0.004, -0.008, 0.22], [0.004, 0.012, 0.25], '#d8dce4'],
    ], ps1Material({ emissive: 0.15 }));
  }
  if (id === 'shotgun') {
    return part([
      [[-0.018, 0.0, -0.05], [0.018, 0.034, 0.5], '#26282c'],   // 銃身
      [[-0.022, -0.04, 0.05], [0.022, 0.0, 0.36], '#4a3424'],   // 先台
      [[-0.024, -0.03, -0.12], [0.024, 0.036, 0.05], '#2e3034'], // 機関部
      [[-0.016, -0.1, -0.06], [0.016, -0.03, -0.02], '#2e3034'], // 握り
      [[-0.026, -0.09, -0.42], [0.026, 0.02, -0.12], '#5a3c26'], // 銃床
    ], mat);
  }
  if (id === 'magnum') {
    return part([
      [[-0.018, 0.01, 0.06], [0.018, 0.045, 0.31], '#9aa0aa'],  // 銃身
      [[-0.03, -0.015, -0.01], [0.03, 0.045, 0.08], '#7a808a'], // 弾倉
      [[-0.02, -0.015, -0.06], [0.02, 0.05, 0.0], '#8a909a'],
      [[-0.018, -0.13, -0.05], [0.018, -0.01, 0.02], '#3a2a1e'], // 握り
    ], mat);
  }
  return part([
    [[-0.02, -0.02, 0.0], [0.02, 0.03, 0.2], '#222428'],
    [[-0.018, -0.12, 0.0], [0.018, 0.0, 0.05], '#2a2a2a'],
  ], mat);
}

// ---- 部屋に置く武器と弾 ----
// at：調べる場所（部屋側の look の id）。pos を省くと、その場所のそばの空いた床に置く
export const WEAPON_PICKUPS = {
  warehouse: [
    { id: 'warehouse.shotgun', item: 'shotgun', at: 'forklift', found: 'フォークリフトの脇に、ショットガンが落ちている。\n警備員のものだろうか。' },
    { id: 'warehouse.shells', item: 'shells', count: 7, at: 'boxes', found: '箱のあいだに、ショットガンの弾がある。' },
  ],
  yard: [{ id: 'yard.shells', item: 'shells', count: 7, at: 'drums', found: 'ドラム缶の陰に、ショットガンの弾の箱が落ちている。' }],
  cold: [{ id: 'cold.shells', item: 'shells', count: 7, at: 'pallet', found: 'パレットの上に、ショットガンの弾がある。' }],
  radio: [{ id: 'radio.magnum', item: 'magnum', at: 'lockers', pos: [-2.95, 1.9, 0.25], found: '所長のロッカーの上に、大型のリボルバーが置いてある。\n…護身用だろうか。' }],
  checkpoint: [
    { id: 'checkpoint.magnumAmmo', item: 'magnumAmmo', count: 6, at: 'vanSide', found: 'バンの荷台に、マグナムの弾がある。' },
    { id: 'checkpoint.shells', item: 'shells', count: 7, at: 'sandbags', found: '土のうの上に、ショットガンの弾が置いてある。' },
  ],
  freight: [{ id: 'freight.magnumAmmo', item: 'magnumAmmo', count: 6, at: 'boxcar', found: '貨車の足元に、マグナムの弾が落ちている。' }],
};

function floorMesh(item) {
  if (WEAPONS[item]) {
    const m = makeWeaponMesh(item);
    m.scale.setScalar(1.5);
    const g = new THREE.Group();
    m.rotation.z = Math.PI / 2; // 横倒しにして床に寝かせる
    m.position.y = 0.04;
    g.add(m);
    return g;
  }
  const col = item === 'shells' ? 0x9a2016 : item === 'magnumAmmo' ? 0x2a3e70 : 0x7a6a2a;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(...boxArgs([-0.12, 0, -0.08], [0.12, 0.1, 0.08], col)));
  return g;
}
function boxArgs(min, max, tint) {
  const b = newBuilder();
  addBox(b, min, max, 10, 10, [1, 1, 1], false);
  return [buildGeometry(b), ps1Material({ tint, emissive: 0.25 })];
}

// 調べる場所のそばで、どの当たり判定にも入らない床の点を探す
function freeSpot(room, x, z) {
  const { x0, x1, z0, z1 } = room.bounds;
  const blocked = (px, pz) => px < x0 + 0.3 || px > x1 - 0.3 || pz < z0 + 0.3 || pz > z1 - 0.3
    || room.colliders.some(([ax0, az0, ax1, az1]) => px > ax0 - 0.2 && px < ax1 + 0.2 && pz > az0 - 0.2 && pz < az1 + 0.2);
  if (!blocked(x, z)) return [x, z];
  for (let r = 0.2; r < 1.6; r += 0.1) {
    for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * r, pz = z + Math.sin(a / 16 * Math.PI * 2) * r;
      if (!blocked(px, pz)) return [px, pz];
    }
  }
  return [x, z];
}

export function addWeaponPickups(room) {
  for (const spec of WEAPON_PICKUPS[room.id] || []) {
    const spot = room.interactables.find((it) => it.id === spec.at);
    if (!spot) continue;
    const mesh = floorMesh(spec.item);
    if (spec.pos) mesh.position.set(...spec.pos);
    let at = spec.at;
    if (!spec.pos) {
      // 床に置いたものは、置いた場所そのものを調べられるようにする
      const [x, z] = freeSpot(room, spot.x, spot.z);
      mesh.position.set(x, 0.005, z);
      at = `pk:${spec.id}`;
      room.interactables.push({ id: at, x, z, r: 0.6 });
    }
    mesh.rotation.y = (spec.id.length * 0.7) % Math.PI;
    mesh.traverse((m) => m.layers.set(0));
    room.scene.add(mesh);
    room.pickups = room.pickups || [];
    room.pickups.push({ ...spec, at, mesh });
  }
}
