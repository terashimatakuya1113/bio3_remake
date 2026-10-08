// PS1 風の描画まわり：頂点スナップ・アフィンテクスチャ・頂点ライティング・15bit ディザ
import * as THREE from 'three';

// 16進カラーをそのまま頂点色として使うため、色空間変換を切る
THREE.ColorManagement.enabled = false;

export const RES_W = 320;
export const RES_H = 240;
export const MAX_LIGHTS = 4;

// シーン全体で共有するライティング用ユニフォーム
export const lighting = {
  uAmbient: { value: new THREE.Color(0.16, 0.17, 0.22) },
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  uLightColor: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
  uLightRange: { value: new Array(MAX_LIGHTS).fill(1) },
  uFogColor: { value: new THREE.Color(0, 0, 0) },
  uFogNear: { value: 7.0 },
  uFogFar: { value: 16.0 },
  uSnap: { value: new THREE.Vector2(RES_W / 2, RES_H / 2) },
};

const vertexShader = /* glsl */ `
  uniform vec3 uAmbient;
  uniform vec3 uLightPos[${MAX_LIGHTS}];
  uniform vec3 uLightColor[${MAX_LIGHTS}];
  uniform float uLightRange[${MAX_LIGHTS}];
  uniform vec2 uSnap;
  uniform float uEmissive;
  uniform vec3 uTint;
  uniform vec2 uUvOffset;
  attribute vec3 color;
  varying vec3 vUvW;
  varying vec3 vLight;
  varying float vFogDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vec3 light = uAmbient;
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec3 d = uLightPos[i] - world.xyz;
      float dist = length(d);
      float att = clamp(1.0 - dist / uLightRange[i], 0.0, 1.0);
      att *= att;
      float ndl = max(dot(n, d / max(dist, 0.0001)), 0.0);
      light += uLightColor[i] * att * (0.25 + 0.75 * ndl);
    }
    vLight = mix(light, vec3(1.0), uEmissive) * color * uTint;

    vec4 mv = viewMatrix * world;
    vec4 clip = projectionMatrix * mv;
    // 頂点を低解像度グリッドへ吸着（PS1 の固定小数点ジッター）
    vec2 ndc = clip.xy / clip.w;
    ndc = floor(ndc * uSnap + 0.5) / uSnap;
    clip.xy = ndc * clip.w;
    gl_Position = clip;

    // UV に w を掛けて渡し、フラグメント側で割るとアフィン補間になる
    vUvW = vec3((uv + uUvOffset) * clip.w, clip.w);
    vFogDepth = -mv.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uOpacity;
  varying vec3 vUvW;
  varying vec3 vLight;
  varying float vFogDepth;

  float bayer4(vec2 p) {
    ivec2 i = ivec2(mod(p, 4.0));
    int idx = i.x + i.y * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return float(m[idx]) / 16.0;
  }

  void main() {
    vec2 uv = vUvW.xy / vUvW.z;
    vec4 tex = texture2D(map, uv);
    if (tex.a < 0.5) discard;
    // PS1 はテクスチャ×頂点色を最大2倍まで明るくできる
    vec3 c = tex.rgb * vLight * 1.6;
    float fog = clamp((vFogDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
    c = mix(c, uFogColor, fog);
    // 15bit カラー + 4x4 オーダードディザ
    c += (bayer4(gl_FragCoord.xy) - 0.5) / 31.0;
    c = floor(clamp(c, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
    gl_FragColor = vec4(c, uOpacity);
  }
`;

const whiteTex = makeTexture(4, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); });

export function ps1Material({ map = whiteTex, emissive = 0, tint = 0xffffff, opacity = 1, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...lighting,
      map: { value: map },
      uEmissive: { value: emissive },
      uTint: { value: new THREE.Color(tint) },
      uOpacity: { value: opacity },
      uUvOffset: { value: new THREE.Vector2() },
    },
    vertexShader,
    fragmentShader,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
    side,
  });
}

// ---- 手続き生成テクスチャ（64px・最近傍補間） ----

let seed = 1998;
export function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

export function makeTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function noise(g, size, amount, alpha = 1) {
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    img.data[i + 3] *= alpha;
  }
  g.putImageData(img, 0, 0);
}

function stains(g, size, count, color) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = color;
    g.globalAlpha = 0.15 + rand() * 0.25;
    const x = rand() * size, y = rand() * size, r = 2 + rand() * 7;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

export const textures = {
  floor: makeTexture(64, (g, s) => {
    // 汚れたリノリウムタイル
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#6b6656' : '#7c7764';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
    g.fillStyle = '#3d3a31';
    g.fillRect(0, 0, s, 1); g.fillRect(0, 32, s, 1); g.fillRect(0, 0, 1, s); g.fillRect(32, 0, 1, s);
    stains(g, s, 10, '#2e2a20');
    noise(g, s, 26);
  }),
  wall: makeTexture(64, (g, s) => {
    // 上：くすんだ緑の壁紙、下：木の腰板
    g.fillStyle = '#4f5e4c'; g.fillRect(0, 0, s, 40);
    for (let x = 0; x < s; x += 8) { g.fillStyle = '#47553f'; g.fillRect(x, 0, 2, 40); }
    g.fillStyle = '#3a2a1c'; g.fillRect(0, 40, s, 24);
    g.fillStyle = '#4a3523'; for (let x = 0; x < s; x += 16) g.fillRect(x + 1, 43, 14, 18);
    g.fillStyle = '#22180f'; g.fillRect(0, 39, s, 2); g.fillRect(0, 62, s, 2);
    stains(g, s, 6, '#2a2a1c');
    noise(g, s, 20);
  }),
  ceiling: makeTexture(64, (g, s) => {
    g.fillStyle = '#8a8a80'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#5c5c55';
    g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
    for (let i = 0; i < 60; i++) { g.fillStyle = '#6f6f68'; g.fillRect(rand() * s, rand() * s, 1, 1); }
    stains(g, s, 4, '#4a4030');
    noise(g, s, 18);
  }),
  wood: makeTexture(64, (g, s) => {
    g.fillStyle = '#5a3b22'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      g.fillStyle = `rgba(30,18,8,${0.2 + rand() * 0.3})`;
      g.fillRect(0, y, s, 1);
    }
    noise(g, s, 18);
  }),
  metal: makeTexture(64, (g, s) => {
    g.fillStyle = '#6a7072'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#3c4042';
    g.fillRect(0, 21, s, 1); g.fillRect(0, 42, s, 1);
    g.fillStyle = '#9aa0a2'; g.fillRect(26, 8, 12, 3); g.fillRect(26, 29, 12, 3); g.fillRect(26, 50, 12, 3);
    stains(g, s, 5, '#4a3020');
    noise(g, s, 16);
  }),
  door: makeTexture(64, (g, s) => {
    g.fillStyle = '#4b301d'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#3a2414'; g.fillRect(6, 4, 22, 26); g.fillRect(36, 4, 22, 26); g.fillRect(6, 36, 22, 24); g.fillRect(36, 36, 22, 24);
    g.fillStyle = '#5b3c25'; g.fillRect(8, 6, 18, 22); g.fillRect(38, 6, 18, 22); g.fillRect(8, 38, 18, 20); g.fillRect(38, 38, 18, 20);
    noise(g, s, 18);
  }),
  sofa: makeTexture(64, (g, s) => {
    g.fillStyle = '#5a2424'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) { g.fillStyle = rand() < 0.5 ? '#4a1c1c' : '#662c2a'; g.fillRect(rand() * s, rand() * s, 2, 1); }
    stains(g, s, 5, '#2a1010');
    noise(g, s, 14);
  }),
  books: makeTexture(64, (g, s) => {
    g.fillStyle = '#2a1d12'; g.fillRect(0, 0, s, s);
    const cols = ['#6b2a22', '#2a3d5a', '#3d5a2a', '#7a6a3a', '#4a2a4a', '#555'];
    for (let row = 0; row < 4; row++) {
      let x = 1;
      while (x < s - 2) {
        const w = 2 + Math.floor(rand() * 4), h = 11 + Math.floor(rand() * 4);
        g.fillStyle = cols[Math.floor(rand() * cols.length)];
        g.fillRect(x, row * 16 + 16 - h, w, h);
        x += w + (rand() < 0.1 ? 3 : 0);
      }
      g.fillStyle = '#1a120a'; g.fillRect(0, row * 16 + 15, s, 1);
    }
    noise(g, s, 14);
  }),
  paper: makeTexture(16, (g, s) => {
    g.fillStyle = '#d8d2bc'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#7a7466'; for (let y = 3; y < s - 2; y += 2) g.fillRect(2, y, 6 + (y % 5), 1);
  }),
  window: makeTexture(64, (g, s) => {
    // 雨の夜空。縦方向にスクロールさせて雨に見せる
    g.fillStyle = '#0c1424'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(140,160,200,${0.25 + rand() * 0.4})`;
      g.fillRect(Math.floor(rand() * s), Math.floor(rand() * s), 1, 3 + Math.floor(rand() * 5));
    }
  }),
  blood: makeTexture(32, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#4a0606';
    for (let i = 0; i < 9; i++) {
      g.beginPath(); g.arc(16 + (rand() - 0.5) * 16, 16 + (rand() - 0.5) * 16, 3 + rand() * 6, 0, Math.PI * 2); g.fill();
    }
  }),
  shadow: makeTexture(16, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#000';
    g.beginPath(); g.arc(8, 8, 7, 0, Math.PI * 2); g.fill();
  }),
};

// ---- ジオメトリ：ワールド座標でUVを振り、1m 程度に分割した箱 ----
// 分割しておくとアフィン歪みが暴れすぎず、頂点ライティングの階調も出る

export function addQuad(builder, origin, uDir, vDir, uLen, vLen, normal, texScale = 1, seg = 1, color = [1, 1, 1], uvOffset = [0, 0]) {
  const [su, sv] = Array.isArray(texScale) ? texScale : [texScale, texScale];
  const nu = Math.max(1, Math.round(uLen / seg));
  const nv = Math.max(1, Math.round(vLen / seg));
  const base = builder.pos.length / 3;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const a = (i / nu) * uLen, b = (j / nv) * vLen;
      builder.pos.push(
        origin[0] + uDir[0] * a + vDir[0] * b,
        origin[1] + uDir[1] * a + vDir[1] * b,
        origin[2] + uDir[2] * a + vDir[2] * b,
      );
      builder.nor.push(...normal);
      builder.uv.push(uvOffset[0] + a / su, uvOffset[1] + b / sv);
      builder.col.push(...color);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i;
      const b = a + 1, c = a + (nu + 1), d = c + 1;
      builder.idx.push(a, b, d, a, d, c);
    }
  }
}

export function newBuilder() {
  return { pos: [], nor: [], uv: [], col: [], idx: [] };
}

export function buildGeometry(b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setIndex(b.idx);
  return g;
}

// 外向きの箱（家具など）。[x0,y0,z0]-[x1,y1,z1]
export function addBox(b, min, max, texScale = 1, seg = 1, color = [1, 1, 1], skipBottom = true) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  addQuad(b, [x0, y1, z1], [1, 0, 0], [0, 0, -1], w, d, [0, 1, 0], texScale, seg, color); // 上
  addQuad(b, [x0, y0, z1], [1, 0, 0], [0, 1, 0], w, h, [0, 0, 1], texScale, seg, color); // 手前(+z)
  addQuad(b, [x1, y0, z0], [-1, 0, 0], [0, 1, 0], w, h, [0, 0, -1], texScale, seg, color); // 奥(-z)
  addQuad(b, [x1, y0, z1], [0, 0, -1], [0, 1, 0], d, h, [1, 0, 0], texScale, seg, color); // +x
  addQuad(b, [x0, y0, z0], [0, 0, 1], [0, 1, 0], d, h, [-1, 0, 0], texScale, seg, color); // -x
  if (!skipBottom) addQuad(b, [x0, y0, z0], [1, 0, 0], [0, 0, 1], w, d, [0, -1, 0], texScale, seg, color);
}

export function boxMesh(min, max, material, texScale = 1, seg = 1) {
  const b = newBuilder();
  addBox(b, min, max, texScale, seg);
  return new THREE.Mesh(buildGeometry(b), material);
}
