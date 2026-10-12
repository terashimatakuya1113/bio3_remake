// 扉が開く演出用の小さなシーン（こちらは毎フレーム高品質で描く）
// 木の扉・鉄の扉・シャッター・金網の門の 4 種類を切り替えて使う
import * as THREE from 'three';
import { addBox, addQuad, boxMesh, buildGeometry, newBuilder } from './ps1.js';
import { hqMat, tex } from './rooms/kit.js';

export function buildDoorScene() {
  const scene = new THREE.Scene();
  const T = tex();
  const wallMats = { wood: hqMat(T.wall, { rough: 0.9 }), metal: hqMat(T.block, { rough: 0.9 }), shutter: hqMat(T.corrugated, { rough: 0.6, metal: 0.3 }) };

  // 扉まわりの壁と枠
  const frame = new THREE.Group();
  const fb = newBuilder();
  addBox(fb, [-0.75, 0, -0.1], [-0.6, 2.35, 0.12], 1, 1);
  addBox(fb, [0.6, 0, -0.1], [0.75, 2.35, 0.12], 1, 1);
  addBox(fb, [-0.75, 2.2, -0.1], [0.75, 2.35, 0.12], 1, 1);
  const frameMesh = new THREE.Mesh(buildGeometry(fb), hqMat(T.woodDark, { rough: 0.5 }));
  frame.add(frameMesh);
  const wall = newBuilder();
  addQuad(wall, [-4, 0, 0.1], [1, 0, 0], [0, 1, 0], 3.25, 3.2, [0, 0, 1], [6.4, 3.2], 0.8);
  addQuad(wall, [0.75, 0, 0.1], [1, 0, 0], [0, 1, 0], 3.25, 3.2, [0, 0, 1], [6.4, 3.2], 0.8, [1, 1, 1], [0.74, 0]);
  addQuad(wall, [-0.75, 2.35, 0.1], [1, 0, 0], [0, 1, 0], 1.5, 0.85, [0, 0, 1], [6.4, 3.2], 0.8, [1, 1, 1], [0.5, 2.35 / 3.2]);
  const wallMesh = new THREE.Mesh(buildGeometry(wall), wallMats.wood);
  frame.add(wallMesh);
  scene.add(frame);

  // 開き戸
  const hinge = new THREE.Group();
  hinge.position.set(-0.6, 0, 0);
  const door = newBuilder();
  addBox(door, [0, 0, -0.04], [1.2, 2.2, 0.04], [1.2, 2.2], 0.4);
  const doorMats = { wood: hqMat(T.door, { rough: 0.6 }), metal: hqMat(T.metal, { rough: 0.45, metal: 0.5, color: 0x8a9298 }) };
  const doorMesh = new THREE.Mesh(buildGeometry(door), doorMats.wood);
  doorMesh.castShadow = true;
  hinge.add(doorMesh);
  const knob = boxMesh([1.0, 1.0, 0.04], [1.12, 1.05, 0.1], hqMat(null, { rough: 0.3, metal: 0.8, color: 0xb08a40 }), 10, 1);
  hinge.add(knob);
  const bar = boxMesh([0.2, 1.0, 0.05], [1.1, 1.06, 0.11], hqMat(null, { rough: 0.3, metal: 0.8, color: 0x9a9ea4 }), 10, 1);
  hinge.add(bar);
  scene.add(hinge);

  // シャッター：上へ巻き上がる
  const shutter = new THREE.Group();
  const sb = newBuilder();
  addBox(sb, [-0.62, 0, -0.03], [0.62, 2.2, 0.03], [1.24, 2.2], 0.4);
  shutter.add(new THREE.Mesh(buildGeometry(sb), hqMat(T.shutter, { rough: 0.5, metal: 0.4 })));
  scene.add(shutter);

  // 金網の門：外は雨の夜
  const gate = new THREE.Group();
  const gb = newBuilder();
  addQuad(gb, [0, 0.05, 0], [1, 0, 0], [0, 1, 0], 1.2, 2.1, [0, 0, 1], [1.2, 2.1], 1);
  addQuad(gb, [1.2, 0.05, 0], [-1, 0, 0], [0, 1, 0], 1.2, 2.1, [0, 0, -1], [1.2, 2.1], 1);
  const chainMat = hqMat(T.chain, { rough: 0.4, metal: 0.6, alpha: true });
  chainMat.side = THREE.DoubleSide;
  gate.add(new THREE.Mesh(buildGeometry(gb), chainMat));
  const pipeMat = hqMat(null, { rough: 0.4, metal: 0.7, color: 0x8a8e94 });
  for (const [a, b] of [[[0, 0, -0.03], [0.05, 2.2, 0.03]], [[1.15, 0, -0.03], [1.2, 2.2, 0.03]], [[0, 2.15, -0.03], [1.2, 2.2, 0.03]], [[0, 0.05, -0.03], [1.2, 0.1, 0.03]]]) gate.add(boxMesh(a, b, pipeMat, 1, 1));
  gate.position.set(-0.6, 0, 0);
  scene.add(gate);

  const floor = newBuilder();
  addQuad(floor, [-4, 0, 6], [1, 0, 0], [0, 0, -1], 8, 12, [0, 1, 0], 1.2, 1);
  const floorMats = { wood: hqMat(T.floor, { rough: 0.5 }), metal: hqMat(T.concrete, { rough: 0.6 }), outdoor: hqMat(T.asphalt, { rough: 0.25 }) };
  const fl = new THREE.Mesh(buildGeometry(floor), floorMats.wood);
  fl.receiveShadow = true;
  scene.add(fl);
  const light = new THREE.PointLight(0xffe0b0, 30, 0, 2);
  light.position.set(0.3, 2.6, 2.2);
  light.castShadow = true; light.shadow.mapSize.set(512, 512);
  scene.add(light);
  // 扉の向こうはほとんど真っ暗
  const beyond = new THREE.PointLight(0x5070a0, 3, 0, 2);
  beyond.position.set(0, 1.5, -3);
  scene.add(beyond);
  scene.add(new THREE.HemisphereLight(0x606878, 0x201810, 0.5));

  let kind = 'wood';
  return {
    scene,
    setKind(k) {
      kind = k;
      const outdoor = k === 'gate';
      hinge.visible = k === 'wood' || k === 'metal';
      shutter.visible = k === 'shutter';
      gate.visible = outdoor;
      frame.visible = !outdoor;
      doorMesh.material = doorMats[k === 'metal' ? 'metal' : 'wood'];
      knob.visible = k === 'wood';
      bar.visible = k === 'metal';
      wallMesh.material = wallMats[k] || wallMats.wood;
      fl.material = outdoor ? floorMats.outdoor : k === 'wood' ? floorMats.wood : floorMats.metal;
      light.color.set(outdoor ? 0x8090b0 : k === 'shutter' ? 0xffc890 : 0xffe0b0);
      light.intensity = outdoor ? 14 : 30;
    },
    // t 秒目の扉の開き具合とカメラ位置
    animate(t, cam) {
      const open = THREE.MathUtils.smoothstep(t, 0.9, 2.6);
      if (kind === 'shutter') shutter.position.y = open * 2.0;
      else if (kind === 'gate') gate.rotation.y = open * 1.6;
      else hinge.rotation.y = open * 1.75;
      const dolly = THREE.MathUtils.smoothstep(t, 1.6, 3.9);
      cam.position.set(0.05, 1.45 - dolly * 0.1 - (kind === 'shutter' ? dolly * 0.2 : 0), 2.4 - dolly * 3.6);
      cam.lookAt(0.05, 1.25, -2);
    },
  };
}
