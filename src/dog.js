// 感染犬（ケルベロス）：箱で組んだ四つ足のモデルと、走り・飛びかかりなどのポーズ
import * as THREE from 'three';
import { addBox, buildGeometry, makeTexture, newBuilder, ps1Material } from './ps1.js';

const BODY_Y = 0.56;

function furTexture() {
  return makeTexture(32, (g, s) => {
    g.fillStyle = '#2a211c'; g.fillRect(0, 0, s, s);
    let k = 1234;
    const r = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
    for (let i = 0; i < 90; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(120,90,70,0.25)';
      g.fillRect(Math.floor(r() * s), Math.floor(r() * s), 1, 2 + Math.floor(r() * 3));
    }
    // 毛が抜けて肉が見えているところ
    for (let i = 0; i < 4; i++) {
      g.fillStyle = `rgba(${110 + r() * 40},${20 + r() * 20},18,0.85)`;
      g.beginPath(); g.ellipse(r() * s, r() * s, 2 + r() * 4, 1.5 + r() * 3, r() * 3, 0, 7); g.fill();
    }
  });
}

function mesh(mat, boxes) {
  const b = newBuilder();
  for (const [min, max, col = [1, 1, 1]] of boxes) addBox(b, min, max, 0.3, 1, col, false);
  return new THREE.Mesh(buildGeometry(b), mat);
}

export function makeDog() {
  const fur = ps1Material({ map: furTexture() });
  const flesh = ps1Material({ tint: 0x8a2a20 });
  const dark = ps1Material({ tint: 0x101010 });
  const eye = ps1Material({ tint: 0xe8e0c0, emissive: 0.7 });

  const root = new THREE.Group();
  const roll = new THREE.Group();
  root.add(roll);
  const body = new THREE.Group();
  body.position.y = BODY_Y;
  roll.add(body);
  body.add(mesh(fur, [
    [[-0.1, -0.11, -0.36], [0.1, 0.09, 0.16]],
    [[-0.125, -0.17, 0.08], [0.125, 0.12, 0.36]],
  ]));
  body.add(mesh(flesh, [[[0.101, -0.07, -0.18], [0.106, 0.05, 0.04]], [[-0.106, -0.05, -0.05], [-0.101, 0.04, 0.1]]]));

  const neck = new THREE.Group();
  neck.position.set(0, 0.05, 0.33);
  body.add(neck);
  neck.add(mesh(fur, [[[-0.06, -0.06, 0], [0.06, 0.07, 0.18]]]));
  const head = new THREE.Group();
  head.position.set(0, 0.02, 0.17);
  neck.add(head);
  head.add(mesh(fur, [
    [[-0.075, -0.05, -0.03], [0.075, 0.07, 0.12]],
    [[-0.045, -0.02, 0.12], [0.045, 0.035, 0.27]],
    [[-0.07, 0.07, 0.0], [-0.035, 0.15, 0.04]],
    [[0.035, 0.07, 0.0], [0.07, 0.15, 0.04]],
  ]));
  head.add(mesh(dark, [[[-0.025, 0.0, 0.265], [0.025, 0.035, 0.285]]]));
  head.add(mesh(eye, [[[-0.058, 0.025, 0.115], [-0.026, 0.045, 0.125]], [[0.026, 0.025, 0.115], [0.058, 0.045, 0.125]]]));
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.025, 0.11);
  head.add(jaw);
  jaw.add(mesh(flesh, [[[-0.04, -0.03, 0], [0.04, 0.0, 0.15]]]));
  jaw.add(mesh(eye, [[[-0.035, 0.0, 0.1], [-0.02, 0.012, 0.14]], [[0.02, 0.0, 0.1], [0.035, 0.012, 0.14]]]));

  const legs = [];
  for (const [x, z, front] of [[0.075, 0.27, true], [-0.075, 0.27, true], [0.075, -0.29, false], [-0.075, -0.29, false]]) {
    const upper = new THREE.Group();
    upper.position.set(x, -0.1, z);
    body.add(upper);
    upper.add(mesh(fur, [[[-0.035, -0.24, -0.04], [0.035, 0.02, front ? 0.045 : 0.06]]]));
    const lower = new THREE.Group();
    lower.position.y = -0.23;
    upper.add(lower);
    lower.add(mesh(fur, [[[-0.025, -0.22, -0.03], [0.025, 0, 0.03]]]));
    lower.add(mesh(dark, [[[-0.03, -0.25, -0.02], [0.03, -0.21, 0.06]]]));
    legs.push({ upper, lower });
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.05, -0.36);
  body.add(tail);
  tail.add(mesh(fur, [[[-0.02, -0.02, -0.26], [0.02, 0.02, 0]]]));

  return { root, parts: { roll, body, neck, head, jaw, legs, tail } };
}

export const DOG_KEYS = ['y', 'pitch', 'neck', 'head', 'jaw', 'u0', 'u1', 'u2', 'u3', 'l0', 'l1', 'l2', 'l3', 'tail', 'tailY', 'roll'];
export const dogZero = () => Object.fromEntries(DOG_KEYS.map((k) => [k, 0]));

// 前脚は膝が後ろへ、後脚は飛節が前へ曲がる。脚の角度は正で後ろへ振る
export function dogPose(kind, ph, t, o) {
  for (const k of DOG_KEYS) o[k] = 0;
  if (kind === 'run') {
    const s = Math.sin(ph);
    o.u0 = 0.8 * s; o.u1 = 0.8 * Math.sin(ph + 0.5);
    o.l0 = 1.0 * Math.max(0, -Math.cos(ph)); o.l1 = 1.0 * Math.max(0, -Math.cos(ph + 0.5));
    o.u2 = 0.3 + 0.7 * Math.sin(ph + Math.PI); o.u3 = 0.3 + 0.7 * Math.sin(ph + Math.PI + 0.5);
    o.l2 = -0.35 - 0.7 * Math.max(0, -Math.cos(ph + Math.PI)); o.l3 = -0.35 - 0.7 * Math.max(0, -Math.cos(ph + Math.PI + 0.5));
    o.pitch = 0.1 * Math.sin(ph + 1.2);
    o.y = 0.04 * Math.sin(ph * 2) - 0.03;
    o.neck = -0.25 + 0.12 * Math.sin(ph); o.head = 0.25;
    o.jaw = 0.35; o.tail = -0.2 + 0.2 * Math.sin(ph * 2);
  } else if (kind === 'growl') {
    o.u0 = -0.2; o.u1 = -0.15; o.l0 = 0.15; o.l1 = 0.1;
    o.u2 = 0.6; o.u3 = 0.55; o.l2 = -0.8; o.l3 = -0.75;
    o.y = -0.08; o.pitch = 0.08;
    o.neck = 0.05; o.head = 0.3 + 0.04 * Math.sin(t * 7);
    o.jaw = 0.3 + 0.15 * Math.sin(t * 13); o.tail = 0.5;
  } else if (kind === 'lunge') {
    o.u0 = -1.2; o.u1 = -1.1; o.l0 = 0.25; o.l1 = 0.2;
    o.u2 = 1.0; o.u3 = 0.95; o.l2 = -0.1; o.l3 = -0.1;
    o.pitch = -0.2; o.neck = -0.45; o.head = 0.3; o.jaw = 0.75; o.tail = -0.5;
  } else if (kind === 'bite') {
    o.u0 = -1.0; o.u1 = -0.9; o.u2 = 0.7; o.u3 = 0.7; o.l2 = -0.4; o.l3 = -0.4;
    o.pitch = -0.55; o.y = 0.08; o.neck = -0.5; o.head = 0.5 + 0.15 * Math.sin(t * 30);
    o.jaw = 0.25 + 0.2 * Math.sin(t * 26); o.tail = -0.3;
  } else if (kind === 'hit') {
    o.u0 = 0.4; o.u1 = 0.3; o.u2 = 0.6; o.u3 = 0.5; o.l2 = -0.7; o.l3 = -0.7;
    o.pitch = 0.25; o.y = -0.06; o.neck = 0.4; o.head = -0.3; o.jaw = 0.6; o.tail = 0.6;
  } else if (kind === 'dead') {
    o.roll = Math.PI / 2; o.u0 = 0.3; o.u1 = -0.4; o.u2 = 0.5; o.u3 = -0.2; o.l0 = 0.4; o.l2 = -0.3;
    o.neck = 0.2; o.head = 0.2; o.jaw = 0.5; o.tail = 0.3; o.y = -BODY_Y + 0.12;
  }
  return o;
}

export function dampDog(cur, target, dt, rate) {
  const k = 1 - Math.exp(-rate * dt);
  for (const key of DOG_KEYS) cur[key] += (target[key] - cur[key]) * k;
}

export function applyDog(m, p) {
  const P = m.parts;
  P.body.position.y = BODY_Y + p.y;
  P.body.rotation.x = p.pitch;
  P.roll.rotation.z = p.roll;
  P.neck.rotation.x = -0.55 + p.neck;
  P.head.rotation.x = 0.45 + p.head;
  P.jaw.rotation.x = p.jaw;
  for (let i = 0; i < 4; i++) {
    P.legs[i].upper.rotation.x = p['u' + i];
    P.legs[i].lower.rotation.x = p['l' + i];
  }
  P.tail.rotation.x = -0.5 + p.tail;
  P.tail.rotation.y = p.tailY;
}
