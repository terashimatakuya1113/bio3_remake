// ステータス画面の 3D 表示：左上の窓で選んだアイテムを回し、左下の窓に主人公の顔を映す
// どちらもゲーム本体と同じ 320x240 のキャンバスに、ビューポートを絞って描く
import * as THREE from 'three';
import { makeWeaponMesh } from './weapons.js';
import { lighting, ps1Material, newBuilder, addBox, buildGeometry, RES_H, MAX_LIGHTS } from './ps1.js';

// index.html のメニュー配置（320x240 の座標）と合わせる
export const VIEW_RECT = { x: 32, y: 20, w: 108, h: 106 };
export const FACE_RECT = { x: 35, y: 141, w: 30, h: 36 };

const mat = ps1Material();

function boxes(parts) {
  const b = newBuilder();
  for (const [min, max, col] of parts) addBox(b, min, max, 1, 1, col, false);
  return new THREE.Mesh(buildGeometry(b), mat);
}

function makeHandgun() {
  const g = new THREE.Group();
  const slide = [0.32, 0.33, 0.36], frame = [0.2, 0.21, 0.23], dark = [0.1, 0.1, 0.11];
  g.add(boxes([
    [[-0.32, 0.06, -0.045], [0.3, 0.17, 0.045], slide],
    [[-0.3, 0.17, -0.03], [-0.26, 0.195, 0.03], dark],
    [[0.25, 0.17, -0.01], [0.28, 0.195, 0.01], dark],
    [[0.3, 0.085, -0.028], [0.325, 0.145, 0.028], dark],
    [[-0.2, 0.1, 0.045], [-0.08, 0.15, 0.05], dark],          // 排莢口
    [[-0.28, 0.0, -0.04], [0.22, 0.06, 0.04], frame],
    [[-0.08, -0.095, -0.02], [0.08, -0.075, 0.02], frame],    // 用心金
    [[0.06, -0.095, -0.02], [0.08, 0.0, 0.02], frame],
    [[-0.025, -0.065, -0.012], [-0.005, 0.0, 0.012], dark],   // 引き金
    [[-0.34, 0.12, -0.02], [-0.31, 0.16, 0.02], dark],        // 撃鉄
  ]));
  const grip = boxes([
    [[-0.07, -0.36, -0.042], [0.07, 0, 0.042], frame],
    [[-0.058, -0.33, -0.048], [0.058, -0.03, 0.048], [0.16, 0.12, 0.09]],
    [[-0.075, -0.38, -0.04], [0.075, -0.355, 0.04], dark],    // 弾倉の底
  ]);
  grip.position.set(-0.2, 0.02, 0);
  grip.rotation.z = -0.22;
  g.add(grip);
  g.position.y = 0.06;
  g.scale.setScalar(0.78);
  return g;
}

function makeAmmo() {
  const parts = [
    [[-0.22, -0.12, -0.15], [0.22, 0.08, 0.15], [0.62, 0.55, 0.36]],
    [[-0.225, -0.06, -0.155], [0.225, 0.02, 0.155], [0.62, 0.12, 0.08]],
    [[-0.225, 0.06, -0.155], [0.225, 0.08, 0.155], [0.5, 0.44, 0.28]],
  ];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const x = -0.15 + i * 0.1, z = -0.09 + j * 0.09;
      parts.push([[x - 0.025, 0.08, z - 0.025], [x + 0.025, 0.15, z + 0.025], [0.85, 0.66, 0.28]]);
      parts.push([[x - 0.017, 0.15, z - 0.017], [x + 0.017, 0.18, z + 0.017], [0.7, 0.42, 0.22]]);
    }
  }
  const g = new THREE.Group();
  g.add(boxes(parts));
  g.position.y = 0.0;
  return g;
}

function makeKey() {
  const brass = [0.82, 0.64, 0.3], tag = [0.86, 0.82, 0.68], red = [0.6, 0.12, 0.1];
  const g = new THREE.Group();
  g.add(boxes([
    [[-0.04, -0.014, -0.014], [0.28, 0.014, 0.014], brass],
    [[0.17, -0.09, -0.01], [0.2, -0.014, 0.01], brass],
    [[0.23, -0.065, -0.01], [0.26, -0.014, 0.01], brass],
    [[-0.22, 0.07, -0.016], [-0.04, 0.1, 0.016], brass],
    [[-0.22, -0.1, -0.016], [-0.04, -0.07, 0.016], brass],
    [[-0.22, -0.1, -0.016], [-0.19, 0.1, 0.016], brass],
    [[-0.07, -0.1, -0.016], [-0.04, 0.1, 0.016], brass],
    [[-0.25, -0.2, -0.004], [-0.235, -0.07, 0.004], [0.3, 0.26, 0.2]],
    [[-0.38, -0.36, -0.008], [-0.14, -0.2, 0.008], tag],
    [[-0.38, -0.36, -0.01], [-0.14, -0.34, 0.01], red],
    [[-0.38, -0.22, -0.01], [-0.14, -0.2, 0.01], red],
  ]));
  g.position.set(0.04, 0.1, 0);
  return g;
}

// 応急パック：白い箱に赤十字
function makeHerb() {
  const g = new THREE.Group();
  const white = [0.86, 0.85, 0.8], red = [0.75, 0.1, 0.07], dark = [0.2, 0.2, 0.2];
  g.add(boxes([
    [[-0.26, -0.14, -0.17], [0.26, 0.14, 0.17], white],
    [[-0.262, 0.06, -0.172], [0.262, 0.075, 0.172], [0.7, 0.7, 0.66]],
    [[-0.05, -0.1, 0.171], [0.05, 0.1, 0.18], red],
    [[-0.13, -0.035, 0.171], [0.13, 0.035, 0.18], red],
    [[-0.08, 0.14, -0.025], [0.08, 0.19, 0.025], dark],
  ]));
  g.rotation.y = 0.3;
  return g;
}

function makeCard() {
  const g = new THREE.Group();
  g.add(boxes([
    [[-0.27, -0.17, -0.008], [0.27, 0.17, 0.008], [0.84, 0.86, 0.88]],
    [[-0.27, 0.09, -0.01], [0.27, 0.17, 0.01], [0.16, 0.29, 0.54]],
    [[-0.22, -0.02, 0.008], [-0.1, 0.07, 0.012], [0.82, 0.68, 0.25]],
    [[-0.27, -0.13, -0.012], [0.27, -0.09, -0.008], [0.06, 0.06, 0.06]],
    [[0.05, -0.12, 0.008], [0.2, -0.05, 0.012], [0.5, 0.05, 0.04]],
  ]));
  g.rotation.x = -0.2;
  return g;
}

function makeKey2(tag) {
  const g = makeKey();
  g.children[0].material = mat;
  const t = boxes([[[-0.38, -0.36, -0.012], [-0.14, -0.2, 0.012], tag]]);
  g.add(t);
  return g;
}

function makePhoto() {
  const g = new THREE.Group();
  g.add(boxes([
    [[-0.26, -0.2, -0.004], [0.26, 0.2, 0.004], [0.9, 0.88, 0.82]],
    [[-0.22, -0.1, 0.004], [0.22, 0.17, 0.007], [0.24, 0.3, 0.38]],
    [[-0.12, -0.04, 0.007], [-0.04, 0.12, 0.009], [0.23, 0.29, 0.4]],
    [[0.04, -0.04, 0.007], [0.12, 0.12, 0.009], [0.23, 0.29, 0.4]],
  ]));
  return g;
}

function weaponModel(id, scale, y = 0) {
  const g = new THREE.Group();
  const m = makeWeaponMesh(id);
  m.rotation.y = Math.PI / 2;
  m.scale.setScalar(scale);
  g.add(m);
  g.position.y = y;
  return g;
}

function makeAmmoBox(box, band, round, tip) {
  const parts = [
    [[-0.2, -0.12, -0.14], [0.2, 0.06, 0.14], box],
    [[-0.205, -0.06, -0.145], [0.205, 0.0, 0.145], band],
  ];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const x = -0.135 + i * 0.09, z = -0.05 + j * 0.1;
    parts.push([[x - 0.03, 0.06, z - 0.03], [x + 0.03, 0.15, z + 0.03], round]);
    parts.push([[x - 0.022, 0.15, z - 0.022], [x + 0.022, 0.18, z + 0.022], tip]);
  }
  const g = new THREE.Group();
  g.add(boxes(parts));
  return g;
}

export function createItemView() {
  const scene = new THREE.Scene();
  const models = {
    knife: weaponModel('knife', 2.6, 0.02), shotgun: weaponModel('shotgun', 0.82, 0.05), magnum: weaponModel('magnum', 2.1, 0.08),
    shells: makeAmmoBox([0.62, 0.14, 0.1], [0.4, 0.08, 0.06], [0.75, 0.16, 0.1], [0.8, 0.62, 0.25]),
    magnumAmmo: makeAmmoBox([0.16, 0.24, 0.45], [0.1, 0.14, 0.3], [0.85, 0.66, 0.28], [0.6, 0.6, 0.62]),
    handgun: makeHandgun(), ammo: makeAmmo(), key: makeKey(), herb: makeHerb(), card: makeCard(), radioKey: makeKey2([0.6, 0.12, 0.1]), gateKey: makeKey2([0.2, 0.32, 0.55]), photo: makePhoto() };
  const pivot = new THREE.Group();
  for (const m of Object.values(models)) { m.visible = false; pivot.add(m); }
  scene.add(pivot);
  const cam = new THREE.PerspectiveCamera(36, VIEW_RECT.w / VIEW_RECT.h, 0.1, 20);
  cam.position.set(0, 0.22, 1.25);
  cam.lookAt(0, 0, 0);
  const faceCam = new THREE.PerspectiveCamera(30, FACE_RECT.w / FACE_RECT.h, 0.05, 20);
  let spin = 0, shown = null, zoom = 1;

  // ゲーム側の照明値を退避して、展示用の照明に差し替える
  const saved = { amb: new THREE.Color(), pos: [], col: [], range: [] };
  function swapLights(on) {
    const L = lighting;
    if (on) {
      saved.amb.copy(L.uAmbient.value);
      for (let i = 0; i < MAX_LIGHTS; i++) {
        saved.pos[i] = L.uLightPos.value[i].clone();
        saved.col[i] = L.uLightColor.value[i].clone();
        saved.range[i] = L.uLightRange.value[i];
      }
      L.uAmbient.value.setRGB(0.22, 0.22, 0.26);
      const set = (i, p, c, r) => { L.uLightPos.value[i].set(...p); L.uLightColor.value[i].setRGB(...c); L.uLightRange.value[i] = r; };
      set(0, [1.2, 1.6, 1.8], [0.75, 0.72, 0.66], 8);
      set(1, [-1.6, 0.4, -0.6], [0.2, 0.24, 0.34], 6);
      set(2, [0, -1.5, 1.2], [0.08, 0.08, 0.1], 5);
      set(3, [0, 0, 0], [0, 0, 0], 1);
    } else {
      L.uAmbient.value.copy(saved.amb);
      for (let i = 0; i < MAX_LIGHTS; i++) {
        L.uLightPos.value[i].copy(saved.pos[i]);
        L.uLightColor.value[i].copy(saved.col[i]);
        L.uLightRange.value[i] = saved.range[i];
      }
    }
  }

  function viewport(renderer, r, color) {
    const y = RES_H - r.y - r.h;
    renderer.setViewport(r.x, y, r.w, r.h);
    renderer.setScissor(r.x, y, r.w, r.h);
    renderer.setClearColor(color, 1);
    renderer.clear();
  }

  const showCam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  showCam.position.set(0, 0.2, 1.5);
  showCam.lookAt(0, 0, 0);
  let showSpin = 0, showId = null;

  return {
    // 拾うときの展示：暗転した画面の中央で、アイテムをゆっくり回して見せる
    showcase(renderer, dt, id) {
      if (id !== showId) { showSpin = -0.8; showId = id; }
      showSpin += dt * 1.1;
      for (const [k, m] of Object.entries(models)) m.visible = k === id;
      pivot.rotation.set(0.3, showSpin, 0);
      pivot.scale.setScalar(1);
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      swapLights(true);
      const r = { x: 70, y: 18, w: 180, h: 140 };
      renderer.setViewport(r.x, RES_H - r.y - r.h, r.w, r.h);
      showCam.aspect = r.w / r.h; showCam.updateProjectionMatrix();
      renderer.render(scene, showCam);
      swapLights(false);
      renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
    },
    // id: 表示するアイテム（null なら空）。inspect 中は大きく速く回す
    render(renderer, dt, id, inspect, figure) {
      if (id !== shown) { spin = -0.6; shown = id; }
      spin += dt * (inspect ? 1.6 : 0.9);
      zoom += ((inspect ? 1.2 : 1) - zoom) * Math.min(1, dt * 6);
      for (const [k, m] of Object.entries(models)) m.visible = k === id;
      pivot.rotation.set(0.25, spin, 0);
      pivot.scale.setScalar(zoom);

      renderer.setRenderTarget(null);
      renderer.autoClear = false;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.setScissorTest(true);
      swapLights(true);

      viewport(renderer, VIEW_RECT, 0x000000);
      renderer.render(scene, cam);

      // 顔：主人公のモデルを一時的に借りて、胸から上を映す
      viewport(renderer, FACE_RECT, 0x1a2230);
      const parent = figure.parent, pos = figure.position.clone(), rotY = figure.rotation.y;
      pivot.visible = false;
      scene.add(figure);
      figure.position.set(0, 0, 0);
      figure.rotation.y = 0.3;
      figure.updateMatrixWorld(true);
      const head = new THREE.Vector3();
      (figure.userData.head || figure).getWorldPosition(head);
      faceCam.position.set(head.x + 0.1, head.y + 0.17, head.z + 0.66);
      faceCam.lookAt(head.x, head.y + 0.1, head.z);
      renderer.render(scene, faceCam);
      parent.add(figure);
      figure.position.copy(pos);
      figure.rotation.y = rotY;
      pivot.visible = true;

      swapLights(false);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
      renderer.autoClear = true;
    },
  };
}
