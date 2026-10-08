// 箱を組み合わせたローポリ人型。各パーツは関節ごとのグループで、角度だけで動かす
import * as THREE from 'three';
import { addBox, buildGeometry, newBuilder, ps1Material } from './ps1.js';

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

function part(boxes, mat) {
  const b = newBuilder();
  for (const [min, max, color] of boxes) addBox(b, min, max, 10, 10, hex(color), false);
  return new THREE.Mesh(buildGeometry(b), mat);
}

export function makeHumanoid(c) {
  const mat = ps1Material();
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.9;
  root.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(part([
    [[-0.19, 0.0, -0.11], [0.19, 0.3, 0.11], c.top],
    [[-0.21, 0.3, -0.12], [0.21, 0.55, 0.12], c.top],
    [[-0.2, -0.04, -0.115], [0.2, 0.04, 0.115], c.belt],
    ...(c.extra || []),
  ], mat));

  const head = new THREE.Group();
  head.position.y = 0.58;
  torso.add(head);
  head.add(part([
    [[-0.05, 0.0, -0.05], [0.05, 0.06, 0.05], c.skin],
    [[-0.11, 0.05, -0.11], [0.11, 0.29, 0.11], c.skin],
    [[-0.12, 0.2, -0.13], [0.12, 0.32, 0.1], c.hair],
    [[-0.12, 0.08, -0.13], [0.12, 0.22, -0.06], c.hair],
    [[-0.07, 0.16, 0.105], [-0.03, 0.19, 0.115], '#1a1410'],
    [[0.03, 0.16, 0.105], [0.07, 0.19, 0.115], '#1a1410'],
  ], mat));

  const arm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.27, 0.5, 0);
    torso.add(g);
    g.add(part([
      [[-0.06, -0.32, -0.06], [0.06, 0.04, 0.06], c.sleeve],
      [[-0.05, -0.6, -0.05], [0.05, -0.32, 0.05], c.skin],
    ], mat));
    return g;
  };
  const leg = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.1, 0, 0);
    hips.add(g);
    g.add(part([
      [[-0.08, -0.78, -0.08], [0.08, 0.0, 0.08], c.pants],
      [[-0.085, -0.9, -0.09], [0.085, -0.76, 0.14], c.boots],
    ], mat));
    return g;
  };

  const parts = { hips, torso, head, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1) };
  return { root, parts, mat };
}

export function makeGun() {
  return part([
    [[-0.02, -0.02, 0.0], [0.02, 0.03, 0.2], '#222428'],
    [[-0.018, -0.12, 0.0], [0.018, 0.0, 0.05], '#2a2a2a'],
  ], ps1Material());
}

export function resetPose(p) {
  for (const k of ['hips', 'torso', 'head', 'armL', 'armR', 'legL', 'legR']) p[k].rotation.set(0, 0, 0);
}
