// ROOM 01：町外れの管理事務所
import * as THREE from 'three';
import { addBox, addQuad, boxMesh, buildGeometry, newBuilder, ps1Material, textures } from './ps1.js';

export const ROOM = { x0: -6, x1: 6, z0: -4, z1: 4, h: 3.2 };

export function buildRoom() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const colliders = []; // [x0, z0, x1, z1]
  const solid = (x0, z0, x1, z1) => colliders.push([x0, z0, x1, z1]);
  const { x0, x1, z0, z1, h } = ROOM;

  // 床・天井・壁（内向き）
  const floor = newBuilder();
  addQuad(floor, [x0, 0, z1], [1, 0, 0], [0, 0, -1], x1 - x0, z1 - z0, [0, 1, 0], 1.2, 1);
  scene.add(new THREE.Mesh(buildGeometry(floor), ps1Material({ map: textures.floor })));

  const ceil = newBuilder();
  addQuad(ceil, [x0, h, z0], [1, 0, 0], [0, 0, 1], x1 - x0, z1 - z0, [0, -1, 0], 1.2, 1.5);
  scene.add(new THREE.Mesh(buildGeometry(ceil), ps1Material({ map: textures.ceiling })));

  const walls = newBuilder();
  addQuad(walls, [x0, 0, z0], [1, 0, 0], [0, 1, 0], x1 - x0, h, [0, 0, 1], h, 1); // 北
  addQuad(walls, [x1, 0, z1], [-1, 0, 0], [0, 1, 0], x1 - x0, h, [0, 0, -1], h, 1); // 南
  addQuad(walls, [x0, 0, z1], [0, 0, -1], [0, 1, 0], z1 - z0, h, [1, 0, 0], h, 1); // 西
  addQuad(walls, [x1, 0, z0], [0, 0, 1], [0, 1, 0], z1 - z0, h, [-1, 0, 0], h, 1); // 東
  scene.add(new THREE.Mesh(buildGeometry(walls), ps1Material({ map: textures.wall })));

  const wood = ps1Material({ map: textures.wood });
  const metal = ps1Material({ map: textures.metal });
  const dark = ps1Material({ tint: 0x2a2522 });

  // 北西：タイプライターの机とスタンドライト
  scene.add(boxMesh([-4.6, 0, -4], [-2.6, 0.76, -3.15], wood, 1.2, 0.7));
  solid(-4.6, -4, -2.6, -3.15);
  scene.add(boxMesh([-4.05, 0.76, -3.75], [-3.45, 0.9, -3.35], ps1Material({ tint: 0x3a3c3a }), 10, 1));
  scene.add(boxMesh([-3.95, 0.9, -3.75], [-3.55, 0.97, -3.6], ps1Material({ tint: 0x202020 }), 10, 1));
  const paperIn = boxMesh([-3.9, 0.95, -3.62], [-3.6, 1.12, -3.6], ps1Material({ map: textures.paper }), 1, 1);
  scene.add(paperIn);
  scene.add(boxMesh([-3.1, 0.76, -3.75], [-2.9, 0.8, -3.55], dark, 10, 1));
  scene.add(boxMesh([-3.02, 0.8, -3.67], [-2.98, 1.1, -3.63], dark, 10, 1));
  scene.add(boxMesh([-3.15, 1.1, -3.8], [-2.85, 1.25, -3.5], ps1Material({ tint: 0xffcc88, emissive: 0.8 }), 10, 1));

  // 北：雨の窓
  const winMat = ps1Material({ map: textures.window, emissive: 0.35 });
  const win = newBuilder();
  addQuad(win, [-1, 1.0, -3.98], [1, 0, 0], [0, 1, 0], 2.6, 1.3, [0, 0, 1], 1.3, 0.65);
  scene.add(new THREE.Mesh(buildGeometry(win), winMat));
  const frame = ps1Material({ tint: 0x4a3a2a, map: textures.wood });
  scene.add(boxMesh([-1.1, 0.9, -4], [1.7, 1.0, -3.85], frame, 1, 1));
  scene.add(boxMesh([-1.1, 2.3, -4], [1.7, 2.4, -3.9], frame, 1, 1));
  scene.add(boxMesh([-1.1, 1.0, -4], [-1.0, 2.3, -3.9], frame, 1, 1));
  scene.add(boxMesh([1.6, 1.0, -4], [1.7, 2.3, -3.9], frame, 1, 1));
  scene.add(boxMesh([0.25, 1.0, -4], [0.35, 2.3, -3.92], frame, 1, 1));
  scene.add(boxMesh([-1.0, 1.62, -4], [1.6, 1.68, -3.92], frame, 1, 1));

  // 北東：書類棚と弾薬箱
  scene.add(boxMesh([2.4, 0, -4], [3.0, 1.3, -3.4], metal, 1.3, 0.65));
  scene.add(boxMesh([3.02, 0, -4], [3.62, 1.3, -3.4], metal, 1.3, 0.65));
  solid(2.4, -4, 3.62, -3.4);
  const ammo = boxMesh([3.15, 1.3, -3.78], [3.45, 1.42, -3.58], ps1Material({ tint: 0x7a6a2a, emissive: 0.15 }), 10, 1);
  scene.add(ammo);

  // 西：本棚
  scene.add(boxMesh([-6, 0, -3.6], [-5.6, 2.1, -1.6], wood, 1, 0.7));
  const books = newBuilder();
  addQuad(books, [-5.59, 0.1, -1.7], [0, 0, -1], [0, 1, 0], 1.8, 1.9, [1, 0, 0], 1.9, 0.6);
  scene.add(new THREE.Mesh(buildGeometry(books), ps1Material({ map: textures.books })));
  solid(-6, -3.6, -5.6, -1.6);

  // 南：ソファとローテーブル、メモ
  const sofa = ps1Material({ map: textures.sofa });
  scene.add(boxMesh([-1.8, 0, 3.2], [0.8, 0.45, 3.95], sofa, 0.8, 0.6));
  scene.add(boxMesh([-1.8, 0.45, 3.7], [0.8, 0.95, 3.95], sofa, 0.8, 0.6));
  scene.add(boxMesh([-2.0, 0, 3.2], [-1.8, 0.65, 3.95], sofa, 0.8, 0.6));
  scene.add(boxMesh([0.8, 0, 3.2], [1.0, 0.65, 3.95], sofa, 0.8, 0.6));
  solid(-2.0, 3.2, 1.0, 4);
  scene.add(boxMesh([-1.2, 0, 2.0], [0.2, 0.42, 2.7], wood, 1, 0.7));
  solid(-1.2, 2.0, 0.2, 2.7);
  const memo = boxMesh([-0.75, 0.42, 2.25], [-0.45, 0.43, 2.45], ps1Material({ map: textures.paper, emissive: 0.2 }), 0.3, 1);
  memo.rotation.y = 0.3;
  scene.add(memo);

  // 東：事務机と鍵
  scene.add(boxMesh([2.8, 0, -1.6], [4.6, 0.76, -0.6], wood, 1.2, 0.6));
  solid(2.8, -1.6, 4.6, -0.6);
  scene.add(boxMesh([3.2, 0.76, -1.5], [3.8, 0.78, -1.1], ps1Material({ map: textures.paper }), 0.6, 1));
  const key = boxMesh([3.95, 0.76, -1.05], [4.12, 0.8, -0.95], ps1Material({ tint: 0xd8b040, emissive: 0.45 }), 10, 1);
  scene.add(key);
  // 倒れた椅子
  const chair = boxMesh([-0.25, 0, -0.25], [0.25, 0.08, 0.25], dark, 10, 1);
  chair.position.set(4.0, 0, 0.2); chair.rotation.y = 0.7;
  scene.add(chair);
  const chairBack = boxMesh([-0.25, 0, 0.18], [0.25, 0.05, 0.75], dark, 10, 1);
  chairBack.position.set(4.0, 0, 0.2); chairBack.rotation.y = 0.7;
  scene.add(chairBack);

  // 扉
  const doorMat = ps1Material({ map: textures.door });
  const exitDoor = newBuilder();
  addQuad(exitDoor, [5.98, 0, 2.0], [0, 0, 1], [0, 1, 0], 1.2, 2.2, [-1, 0, 0], [1.2, 2.2], 0.6);
  scene.add(new THREE.Mesh(buildGeometry(exitDoor), doorMat));
  scene.add(boxMesh([5.9, 0, 1.9], [6, 2.3, 2.0], frame, 1, 1));
  scene.add(boxMesh([5.9, 0, 3.2], [6, 2.3, 3.3], frame, 1, 1));
  scene.add(boxMesh([5.9, 2.2, 1.9], [6, 2.3, 3.3], frame, 1, 1));
  scene.add(boxMesh([5.9, 0.95, 2.15], [5.97, 1.05, 2.25], ps1Material({ tint: 0xb09040 }), 10, 1));

  const westDoor = newBuilder();
  addQuad(westDoor, [-5.98, 0, 1.4], [0, 0, -1], [0, 1, 0], 1.2, 2.2, [1, 0, 0], [1.2, 2.2], 0.6);
  scene.add(new THREE.Mesh(buildGeometry(westDoor), doorMat));
  scene.add(boxMesh([-6, 0, 0.1], [-5.9, 2.3, 0.2], frame, 1, 1));
  scene.add(boxMesh([-6, 0, 1.4], [-5.9, 2.3, 1.5], frame, 1, 1));
  scene.add(boxMesh([-6, 2.2, 0.1], [-5.9, 2.3, 1.5], frame, 1, 1));
  // 扉の前に積まれた木箱
  scene.add(boxMesh([-5.9, 0, 0.15], [-5.3, 0.6, 0.95], wood, 0.6, 0.6));
  scene.add(boxMesh([-5.85, 0.6, 0.3], [-5.4, 1.05, 0.8], wood, 0.45, 0.45));
  solid(-6, 0.1, -5.3, 1.5);

  // 天井の蛍光灯
  const fluoro = boxMesh([-0.9, 3.08, -0.12], [0.9, 3.2, 0.12], ps1Material({ tint: 0xfff4dd, emissive: 1 }), 10, 1);
  scene.add(fluoro);

  // 血だまり・散らばった書類
  const decal = (x, z, w, d, map, rot = 0, y = 0.01) => {
    const b = newBuilder();
    addQuad(b, [-w / 2, 0, d / 2], [1, 0, 0], [0, 0, -1], w, d, [0, 1, 0], w, 1);
    const m = new THREE.Mesh(buildGeometry(b), ps1Material({ map }));
    m.position.set(x, y, z); m.rotation.y = rot;
    scene.add(m);
    return m;
  };
  decal(0.8, 0.9, 1.8, 1.4, textures.blood, 0.4);
  decal(4.9, 1.3, 0.9, 0.9, textures.blood, 1.1);
  decal(-2.4, 0.6, 0.3, 0.22, textures.paper, 0.6, 0.012);
  decal(0.9, -1.6, 0.3, 0.22, textures.paper, -0.4, 0.012);
  decal(2.0, -2.4, 0.3, 0.22, textures.paper, 1.4, 0.012);

  // 調べられる場所
  const interactables = [
    { id: 'typewriter', x: -3.6, z: -3.0, r: 0.9 },
    { id: 'lamp', x: -2.9, z: -3.1, r: 0.5 },
    { id: 'window', x: 0.3, z: -3.8, r: 1.4 },
    { id: 'ammo', x: 3.3, z: -3.3, r: 0.6 },
    { id: 'cabinet', x: 2.7, z: -3.3, r: 0.6 },
    { id: 'bookshelf', x: -5.5, z: -2.6, r: 1.1 },
    { id: 'sofa', x: -0.5, z: 3.2, r: 1.2 },
    { id: 'memo', x: -0.6, z: 2.35, r: 0.8 },
    { id: 'key', x: 4.0, z: -0.5, r: 0.6 },
    { id: 'desk', x: 3.4, z: -0.5, r: 0.8 },
    { id: 'chair', x: 4.0, z: 0.4, r: 0.6 },
    { id: 'exitDoor', x: 5.9, z: 2.6, r: 0.9 },
    { id: 'westDoor', x: -5.2, z: 0.8, r: 0.9 },
  ];

  return { scene, colliders, interactables, objects: { key, ammo, memo, winMat, fluoro } };
}

// 扉が開く演出用の小さなシーン
export function buildDoorScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const frameMat = ps1Material({ map: textures.wood });
  const b = newBuilder();
  addBox(b, [-0.75, 0, -0.1], [-0.6, 2.35, 0.1], 1, 1);
  addBox(b, [0.6, 0, -0.1], [0.75, 2.35, 0.1], 1, 1);
  addBox(b, [-0.75, 2.2, -0.1], [0.75, 2.35, 0.1], 1, 1);
  scene.add(new THREE.Mesh(buildGeometry(b), frameMat));
  const wall = newBuilder();
  addQuad(wall, [-4, 0, 0.1], [1, 0, 0], [0, 1, 0], 3.25, 3.2, [0, 0, 1], 3.2, 0.8);
  addQuad(wall, [0.75, 0, 0.1], [1, 0, 0], [0, 1, 0], 3.25, 3.2, [0, 0, 1], 3.2, 0.8);
  addQuad(wall, [-0.75, 2.35, 0.1], [1, 0, 0], [0, 1, 0], 1.5, 0.85, [0, 0, 1], 3.2, 0.8, [1, 1, 1], [0, 2.35 / 3.2]);
  scene.add(new THREE.Mesh(buildGeometry(wall), ps1Material({ map: textures.wall })));
  const hinge = new THREE.Group();
  hinge.position.set(-0.6, 0, 0);
  const door = newBuilder();
  addBox(door, [0, 0, -0.04], [1.2, 2.2, 0.04], [1.2, 2.2], 0.4);
  hinge.add(new THREE.Mesh(buildGeometry(door), ps1Material({ map: textures.door })));
  hinge.add(boxMesh([1.02, 1.0, 0.04], [1.1, 1.08, 0.1], ps1Material({ tint: 0xb09040 }), 10, 1));
  scene.add(hinge);
  const floor = newBuilder();
  addQuad(floor, [-4, 0, 6], [1, 0, 0], [0, 0, -1], 8, 6, [0, 1, 0], 1.2, 1);
  scene.add(new THREE.Mesh(buildGeometry(floor), ps1Material({ map: textures.floor })));
  return { scene, hinge };
}
