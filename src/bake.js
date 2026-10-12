// 背景の事前レンダリングと、実行時の合成
// 高解像度で描いた絵を 320×240 に縮小し、トーンマップ → 15bit + ディザで「当時の CG 背景」にする
import * as THREE from 'three';
import { RES_W, RES_H } from './ps1.js';

const SS = 4; // 縦横 4 倍で描いてから縮小する

const fsVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const downFrag = /* glsl */ `
  uniform sampler2D src;
  uniform sampler2D aoTex;
  uniform float aoAmount;
  uniform vec2 outRes;
  uniform float exposure;
  uniform float dither;
  varying vec2 vUv;
  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  float bayer4(vec2 p) {
    ivec2 i = ivec2(mod(p, 4.0));
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return float(m[i.x + i.y * 4]) / 16.0;
  }
  void main() {
    vec2 px = floor(gl_FragCoord.xy);
    vec3 c = vec3(0.0);
    for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
      vec2 suv = (px + (vec2(i, j) + 0.5) / 4.0) / outRes;
      c += texture2D(src, suv).rgb * mix(1.0, texture2D(aoTex, suv).r, aoAmount);
    }
    c /= 16.0;
    // 周辺減光
    vec2 q = gl_FragCoord.xy / outRes - 0.5;
    c *= 1.0 - dot(q, q) * 0.9;
    c = aces(c * exposure);
    c = pow(c, vec3(1.0 / 2.2));
    // 当時のプリレンダ背景らしく、少し彩度を落として黄味を足す
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, 0.85) * vec3(1.02, 1.0, 0.94);
    c += (bayer4(px) - 0.5) / 31.0 * dither;
    c = floor(clamp(c, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const bgFrag = /* glsl */ `
  uniform sampler2D bgOn;
  uniform sampler2D bgOff;
  uniform float lit;
  uniform float bolt;
  uniform float flash;
  varying vec2 vUv;
  void main() {
    vec3 c = mix(texture2D(bgOff, vUv).rgb, texture2D(bgOn, vUv).rgb, lit);
    float l = dot(c, vec3(0.3, 0.6, 0.1));
    c += bolt * vec3(0.22, 0.27, 0.4) * (0.35 + l);
    c *= 1.0 + flash * vec3(0.5, 0.35, 0.15);
    gl_FragColor = vec4(c, 1.0);
  }
`;

// 画面空間アンビエントオクルージョン：隅や物の接地面を暗くして、当時の CG レンダーらしい陰影を足す
const ssaoFrag = /* glsl */ `
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform mat4 proj;
  uniform mat4 invProj;
  uniform vec3 kernel[24];
  uniform float radius;
  varying vec2 vUv;
  vec3 viewPos(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    vec4 p = invProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    return p.xyz / p.w;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    float d = texture2D(tDepth, vUv).x;
    if (d >= 1.0) { gl_FragColor = vec4(1.0); return; }
    vec3 P = viewPos(vUv);
    vec3 N = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);
    float a = hash(gl_FragCoord.xy) * 6.2831853;
    vec3 rnd = vec3(cos(a), sin(a), 0.0);
    vec3 T = normalize(rnd - N * dot(rnd, N));
    vec3 B = cross(N, T);
    mat3 TBN = mat3(T, B, N);
    float occ = 0.0;
    for (int i = 0; i < 24; i++) {
      vec3 sp = P + TBN * kernel[i] * radius;
      vec4 o = proj * vec4(sp, 1.0);
      o.xy = o.xy / o.w * 0.5 + 0.5;
      if (o.x < 0.0 || o.x > 1.0 || o.y < 0.0 || o.y > 1.0) continue;
      float sz = viewPos(o.xy).z;
      float range = smoothstep(0.0, 1.0, radius / abs(P.z - sz));
      occ += (sz >= sp.z + 0.02 ? 1.0 : 0.0) * range;
    }
    float ao = 1.0 - occ / 24.0;
    gl_FragColor = vec4(vec3(pow(ao, 1.6)), 1.0);
  }
`;

function fsQuad(material) {
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return scene;
}

export function createBackdrop(renderer) {
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const hdr = new THREE.WebGLRenderTarget(RES_W * SS, RES_H * SS, {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  // 毎フレーム描く演出用は 2 倍で十分
  const hdrLive = new THREE.WebGLRenderTarget(RES_W * 2, RES_H * 2, {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const downMat = new THREE.ShaderMaterial({
    uniforms: { src: { value: hdr.texture }, aoTex: { value: null }, aoAmount: { value: 0 }, outRes: { value: new THREE.Vector2(RES_W, RES_H) }, exposure: { value: 1.0 }, dither: { value: 1.0 } },
    vertexShader: fsVert, fragmentShader: downFrag, depthTest: false, depthWrite: false,
  });
  const downScene = fsQuad(downMat);

  const W = RES_W * SS, H = RES_H * SS;
  const gbuf = new THREE.WebGLRenderTarget(W, H, { depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedIntType) });
  const aoRT = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const kernel = [];
  for (let i = 0; i < 24; i++) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 0.9 + 0.1).normalize();
    const t = i / 24;
    v.multiplyScalar((0.1 + 0.9 * t * t) * (0.5 + Math.random() * 0.5));
    kernel.push(v);
  }
  const ssaoMat = new THREE.ShaderMaterial({
    uniforms: { tNormal: { value: gbuf.texture }, tDepth: { value: gbuf.depthTexture }, proj: { value: new THREE.Matrix4() },
      invProj: { value: new THREE.Matrix4() }, kernel: { value: kernel }, radius: { value: 0.55 } },
    vertexShader: fsVert, fragmentShader: ssaoFrag, depthTest: false, depthWrite: false,
  });
  const ssaoScene = fsQuad(ssaoMat);
  const normalMat = new THREE.MeshNormalMaterial();

  function bakeAO(scene, cam) {
    scene.overrideMaterial = normalMat;
    renderer.setRenderTarget(gbuf);
    renderer.setClearColor(0x8080ff, 1);
    renderer.clear();
    renderer.render(scene, cam);
    scene.overrideMaterial = null;
    ssaoMat.uniforms.proj.value.copy(cam.projectionMatrix);
    ssaoMat.uniforms.invProj.value.copy(cam.projectionMatrixInverse);
    renderer.setRenderTarget(aoRT);
    renderer.render(ssaoScene, fsCam);
    renderer.setRenderTarget(null);
  }

  const bgMat = new THREE.ShaderMaterial({
    uniforms: { bgOn: { value: null }, bgOff: { value: null }, lit: { value: 1 }, bolt: { value: 0 }, flash: { value: 0 } },
    vertexShader: fsVert, fragmentShader: bgFrag, depthTest: false, depthWrite: false,
  });
  const bgScene = fsQuad(bgMat);
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });

  const newTarget = () => new THREE.WebGLRenderTarget(RES_W, RES_H, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false,
  });

  // シーンを高解像度で描き、縮小して target（null なら画面）へ
  function renderHQ(scene, cam, target, exposure = 1, live = false) {
    const src = live ? hdrLive : hdr;
    downMat.uniforms.src.value = src.texture;
    downMat.uniforms.aoTex.value = aoRT.texture;
    downMat.uniforms.aoAmount.value = live ? 0 : 0.85;
    renderer.setRenderTarget(src);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, cam);
    downMat.uniforms.exposure.value = exposure;
    renderer.setRenderTarget(target);
    renderer.render(downScene, fsCam);
    renderer.setRenderTarget(null);
  }

  // 各カメラについて「蛍光灯あり／なし」の 2 枚を焼く（明滅しない部屋は 1 枚だけ）
  function bakeRoom(room, cams, camera) {
    const variant = room.bake?.variant;
    const prevLayers = camera.layers.mask;
    camera.layers.disableAll();
    camera.layers.enable(1); camera.layers.enable(2);
    renderer.shadowMap.needsUpdate = true;
    const out = [];
    const set = (on) => { variant?.(on); renderer.shadowMap.needsUpdate = true; };
    for (const c of cams) {
      camera.position.set(...c.pos);
      camera.fov = c.fov;
      camera.aspect = RES_W / RES_H;
      camera.updateProjectionMatrix();
      camera.lookAt(...c.look);
      camera.updateMatrixWorld();
      const on = newTarget();
      bakeAO(room.scene, camera);
      set(true); renderHQ(room.scene, camera, on, c.exposure ?? room.exposure ?? 1.0);
      let off = on;
      if (variant) { off = newTarget(); set(false); renderHQ(room.scene, camera, off, c.exposure ?? room.exposure ?? 1.0); }
      out.push({ on: on.texture, off: off.texture });
    }
    set(true);
    camera.layers.mask = prevLayers;
    return out;
  }

  // 実行時：背景 → 部屋の奥行き → 動くもの、の順に重ねる
  function renderFrame(scene, camera, bg, fx) {
    bgMat.uniforms.bgOn.value = bg.on;
    bgMat.uniforms.bgOff.value = bg.off;
    bgMat.uniforms.lit.value = fx.lit;
    bgMat.uniforms.bolt.value = fx.bolt;
    bgMat.uniforms.flash.value = fx.flash;
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(bgScene, fsCam);
    const mask = camera.layers.mask;
    camera.layers.set(1);
    scene.overrideMaterial = depthMat;
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.set(0);
    renderer.render(scene, camera);
    camera.layers.mask = mask;
    renderer.autoClear = true;
  }

  return { bakeRoom, renderFrame, renderHQ };
}
