// ステータス画面の 3D 表示：左上の窓で選んだアイテムを回し、左下の窓に主人公の顔を映す
// どちらもゲーム本体と同じ 320x240 のキャンバスに、ビューポートを絞って描く
import * as THREE from 'three';
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

function makeHerb() {
  const g = new THREE.Group();
  g.add(boxes([
    [[-0.13, -0.3, -0.13], [0.13, -0.08, 0.13], [0.58, 0.3, 0.17]],
    [[-0.15, -0.1, -0.15], [0.15, -0.05, 0.15], [0.62, 0.33, 0.19]],
    [[-0.12, -0.06, -0.12], [0.12, -0.04, 0.12], [0.2, 0.13, 0.08]],
    [[-0.012, -0.05, -0.012], [0.012, 0.08, 0.012], [0.25, 0.4, 0.15]],
  ]));
  const leaf = (len, col) => boxes([[[0, -0.01, -0.04], [len, 0.01, 0.04], col]]);
  for (let i = 0; i < 9; i++) {
    const l = leaf(0.18 + (i % 3) * 0.04, [0.22 + (i % 2) * 0.06, 0.5 + (i % 3) * 0.06, 0.16]);
    l.position.set(0, -0.03 + (i % 3) * 0.05, 0);
    l.rotation.set(0, i * 2.4, 0.35 + (i % 3) * 0.25);
    g.add(l);
  }
  g.position.y = 0.04;
  g.scale.setScalar(0.85);
  return g;
}

export function createItemView() {
  const scene = new THREE.Scene();
  const models = { handgun: makeHandgun(), ammo: makeAmmo(), key: makeKey(), herb: makeHerb() };
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

  return {
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
