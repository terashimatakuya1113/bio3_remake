// 銃撃まわりの演出：血しぶき、床に残る血痕、薬莢、倒れたゾンビの血だまり
import * as THREE from 'three';
import { addQuad, boxMesh, buildGeometry, newBuilder, ps1Material, textures } from './ps1.js';

const GRAVITY = 9.8;

export function createFx(scene) {
  const dropMat = ps1Material({ tint: 0x8a0a06, emissive: 0.25 });
  const brassMat = ps1Material({ tint: 0xc8a040, emissive: 0.2 });
  const stainMat = ps1Material({ map: textures.blood, tint: 0x7a0806 });
  const poolMat = ps1Material({ map: textures.blood, tint: 0x600604, opacity: 0.92 });

  const drops = [];
  for (let i = 0; i < 40; i++) {
    const m = boxMesh([-0.018, -0.018, -0.018], [0.018, 0.018, 0.018], dropMat, 1, 1);
    m.visible = false;
    scene.add(m);
    drops.push({ m, v: new THREE.Vector3(), life: 0 });
  }
  const shells = [];
  for (let i = 0; i < 6; i++) {
    const m = boxMesh([-0.008, -0.008, -0.02], [0.008, 0.008, 0.02], brassMat, 1, 1);
    m.visible = false;
    scene.add(m);
    shells.push({ m, v: new THREE.Vector3(), spin: 0, life: 0 });
  }
  const floorQuad = (size, mat) => {
    const b = newBuilder();
    addQuad(b, [-size / 2, 0, size / 2], [1, 0, 0], [0, 0, -1], size, size, [0, 1, 0], size, 1);
    const m = new THREE.Mesh(buildGeometry(b), mat);
    m.visible = false;
    scene.add(m);
    return m;
  };
  const stains = Array.from({ length: 24 }, () => floorQuad(0.22, stainMat));
  let stainNext = 0;
  const pool = floorQuad(1.3, poolMat);
  let poolT = -1;
  let shellNext = 0;

  function addStain(x, z) {
    const s = stains[stainNext++ % stains.length];
    s.visible = true;
    s.position.set(x, 0.012 + (stainNext % 7) * 0.0005, z);
    s.rotation.y = Math.random() * 6.28;
    s.scale.setScalar(0.6 + Math.random() * 0.8);
  }

  return {
    // 弾が当たった位置から、撃った方向へ血が飛ぶ
    bloodSpray(pos, dirX, dirZ) {
      let n = 0;
      for (const d of drops) {
        if (d.life > 0) continue;
        d.life = 0.5 + Math.random() * 0.5;
        d.m.visible = true;
        d.m.position.copy(pos);
        d.v.set(dirX * (1 + Math.random() * 2) + (Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 2.2, dirZ * (1 + Math.random() * 2) + (Math.random() - 0.5) * 1.6);
        if (++n >= 12) break;
      }
    },
    ejectShell(pos, yaw) {
      const s = shells[shellNext++ % shells.length];
      s.life = 2.5;
      s.m.visible = true;
      s.m.position.copy(pos);
      // 右後ろへはじき出す
      const rx = -Math.cos(yaw), rz = Math.sin(yaw);
      s.v.set(rx * 1.4 - Math.sin(yaw) * 0.4, 2.0, rz * 1.4 - Math.cos(yaw) * 0.4);
      s.spin = 18;
    },
    startPool(x, z) {
      pool.visible = true;
      pool.position.set(x, 0.011, z);
      pool.scale.setScalar(0.05);
      poolT = 0;
    },
    update(dt) {
      for (const d of drops) {
        if (d.life <= 0) continue;
        d.life -= dt;
        d.v.y -= GRAVITY * dt;
        d.m.position.addScaledVector(d.v, dt);
        if (d.m.position.y <= 0.02) {
          if (Math.random() < 0.45) addStain(d.m.position.x, d.m.position.z);
          d.life = 0;
        }
        if (d.life <= 0) d.m.visible = false;
      }
      for (const s of shells) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.v.y -= GRAVITY * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.rotation.x += s.spin * dt;
        s.m.rotation.y += s.spin * 0.6 * dt;
        if (s.m.position.y < 0.01) {
          s.m.position.y = 0.01;
          s.v.y = Math.abs(s.v.y) * 0.35;
          s.v.x *= 0.5; s.v.z *= 0.5;
          s.spin *= 0.5;
        }
      }
      if (poolT >= 0 && poolT < 4) {
        poolT += dt;
        pool.scale.setScalar(0.05 + 0.95 * Math.min(1, poolT / 4) ** 0.5);
      }
    },
    reset() {
      for (const d of drops) { d.life = 0; d.m.visible = false; }
      for (const s of shells) { s.life = 0; s.m.visible = false; }
      for (const s of stains) s.visible = false;
      pool.visible = false; poolT = -1;
    },
  };
}
