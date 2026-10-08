// 人型のアニメーション。状態から「目標ポーズ」を組み立てる（関節角はラジアン）
// 腿は -x で前へ、膝は +x で曲がる。腕は -x で前へ、肘は -x で曲がる。
import { POSE_KEYS } from './actors.js';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const pos = (v) => Math.max(0, v);

export const WALK_SPEED = 1.45;
export const RUN_SPEED = 3.1;
export const BACK_SPEED = 0.9;

// 歩幅（左右1歩ずつ＝1周期で進む距離）。足が滑らないよう速度から位相を進める
export function strideLength(speed) {
  if (speed < 0) return 1.0;
  return lerp(1.4, 2.3, clamp01((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)));
}

const AIM_UPPER = {
  armRx: -Math.PI / 2 + 0.03, armRy: 0, armRz: 0.14, elbowR: 0,
  armLx: -1.32, armLy: 0, armLz: -0.55, elbowL: -0.45,
  torsoRx: 0, torsoRy: 0.12, torsoRz: 0, headRx: 0.06, headRy: -0.1, headRz: 0,
};

export function playerPose(p, t, o) {
  for (const k of POSE_KEYS) o[k] = 0;
  const fwd = pos(p.speed);
  const walkW = clamp01(fwd / WALK_SPEED);
  const runW = clamp01((fwd - WALK_SPEED) / (RUN_SPEED - WALK_SPEED));
  const backW = clamp01(-p.speed / BACK_SPEED);
  const s = Math.sin(p.phase), c = Math.cos(p.phase), c2 = Math.cos(p.phase * 2);

  // 立ち姿勢（呼吸と重心移動、ときどき周りを見る）
  const breath = Math.sin(t * 1.9);
  const still = 1 - Math.max(walkW, backW);
  o.torsoRx = 0.015 * breath;
  o.headRx = -0.012 * breath;
  o.hipsX = 0.012 * Math.sin(t * 0.45) * still;
  o.headRy = p.look * still;
  o.armLz = 0.07; o.armRz = -0.07;
  o.elbowL = -0.14 + 0.02 * breath; o.elbowR = -0.14 + 0.02 * breath;
  o.kneeL = 0.04; o.kneeR = 0.04;

  // 前進（歩き〜走りを速度でブレンド）
  if (walkW > 0) {
    const A = lerp(0.42, 0.78, runW) * walkW;
    const K = lerp(0.85, 1.55, runW) * walkW;
    const stanceK = lerp(0.07, 0.32, runW) * walkW;
    const lean = lerp(0.05, 0.24, runW) * walkW;
    o.legLx += -A * s - 0.1 * runW;
    o.legRx += A * s - 0.1 * runW;
    o.kneeL += K * pos(c) + stanceK * pos(-c);
    o.kneeR += K * pos(-c) + stanceK * pos(c);
    o.hipsY += lerp(0.022, -0.035, runW) * walkW * c2 - 0.045 * runW - 0.01 * walkW;
    o.hipsX += -0.025 * c * walkW * (1 - runW);
    o.hipsRy += -0.13 * s * walkW;
    o.hipsRz += 0.035 * c * walkW;
    o.torsoRy += 0.22 * s * walkW;
    o.torsoRz += -0.03 * c * walkW;
    o.torsoRx += lean;
    o.headRx -= lean * 0.7;
    const Aa = lerp(0.35, 0.8, runW) * walkW;
    o.armLx += Aa * s - 0.12 * runW;
    o.armRx += -Aa * s - 0.12 * runW;
    o.elbowL += -lerp(0.15, 1.45, runW) * walkW - 0.3 * pos(-s) * walkW;
    o.elbowR += -lerp(0.15, 1.45, runW) * walkW - 0.3 * pos(s) * walkW;
  }

  // 後退：小さな歩幅で、重心はやや後ろ
  if (backW > 0) {
    const A = 0.3 * backW;
    o.legLx += -A * s; o.legRx += A * s;
    o.kneeL += 0.6 * backW * pos(c);
    o.kneeR += 0.6 * backW * pos(-c);
    o.hipsY += 0.014 * backW * c2 - 0.015 * backW;
    o.torsoRx -= 0.07 * backW;
    o.armLx += 0.15 * s * backW; o.armRx -= 0.15 * s * backW;
    o.elbowL -= 0.2 * backW; o.elbowR -= 0.2 * backW;
  }

  // その場旋回：足踏みで向きを変える。頭が先に向き、腰は遅れてついてくる
  if (p.turnW > 0) {
    const ls = Math.sin(p.turnPhase);
    const liftL = pos(ls), liftR = pos(-ls);
    o.legLx -= 0.22 * liftL * p.turnW; o.kneeL += 0.55 * liftL * p.turnW;
    o.legRx -= 0.22 * liftR * p.turnW; o.kneeR += 0.55 * liftR * p.turnW;
    o.hipsY -= 0.012 * (liftL + liftR) * p.turnW;
  }
  o.headRy += p.turnVel * 0.13;
  o.torsoRy += p.turnVel * 0.04;
  o.hipsRy -= p.turnVel * 0.05;
  o.torsoRz -= p.turnVel * 0.05 * runW;

  // 負傷（DANGER）：右足を引きずり、左手で脇腹を押さえる
  if (p.limpW > 0) {
    const w = p.limpW;
    o.kneeR *= 1 - 0.6 * w;
    o.hipsRz += 0.07 * s * walkW * w;
    o.torsoRz += 0.07 * w;
    o.torsoRx += 0.08 * w;
    o.headRx += 0.12 * w;
    const hold = w * (1 - p.aimW);
    o.armLx = lerp(o.armLx, -0.55, hold);
    o.armLz = lerp(o.armLz, -0.3, hold);
    o.elbowL = lerp(o.elbowL, -1.7, hold);
  }

  // 構え：上半身は構えのポーズへ、足は前後に開いて踏ん張る
  if (p.aimW > 0) {
    const w = p.aimW;
    for (const k in AIM_UPPER) o[k] = lerp(o[k], AIM_UPPER[k], w);
    o.armRx -= p.recoil * 0.35 * w;
    o.elbowR -= p.recoil * 0.15 * w;
    o.torsoRx -= p.recoil * 0.05 * w;
    o.headRx -= p.recoil * 0.04 * w;
    o.legLx -= 0.17 * w; o.legRx += 0.17 * w;
    o.legLz += 0.05 * w; o.legRz -= 0.05 * w;
    o.kneeL += 0.12 * w; o.kneeR += 0.06 * w;
    o.hipsY -= 0.02 * w;
  }

  // クイックターン：一瞬沈み込んで踏み返す
  if (p.quickW > 0) {
    const w = Math.sin(Math.PI * p.quickW);
    o.hipsY -= 0.07 * w;
    o.kneeL += 0.55 * w; o.kneeR += 0.35 * w;
    o.legLx -= 0.3 * w; o.legRx += 0.1 * w;
    o.armLz += 0.25 * w; o.armRz -= 0.25 * w;
    o.torsoRx += 0.12 * w;
    o.headRy += 0.6 * w;
  }

  // 掴まれている：もがいて押し返す
  if (p.heldW > 0) {
    const w = p.heldW;
    const shake = Math.sin(t * 13);
    const held = {
      torsoRx: -0.25, torsoRz: 0.12 * shake, torsoRy: 0.1 * shake, headRx: -0.35, headRy: 0.2 * shake,
      armLx: -1.25, armLz: -0.2, elbowL: -0.7, armRx: -1.1, armRz: 0.2, elbowR: -0.8,
      kneeL: 0.3, kneeR: 0.15, legLx: -0.2, legRx: 0.25, hipsY: -0.04,
    };
    for (const k in held) o[k] = lerp(o[k], held[k], w);
  }

  // 力尽きる：膝から崩れ落ちてうなだれる
  if (p.deadW > 0) {
    const w = p.deadW;
    const down = {
      hipsY: -0.44, hipsX: 0, hipsRx: 0, hipsRy: 0, hipsRz: 0.05, legLx: -0.05, legRx: 0.05, legLz: 0.08, legRz: -0.08,
      kneeL: 1.57, kneeR: 1.5, torsoRx: 0.55, torsoRy: 0, torsoRz: 0.08, headRx: 0.5, headRy: 0.2, headRz: 0.1,
      armLx: 0.15, armLy: 0, armLz: 0.2, armRx: 0.25, armRy: 0, armRz: -0.15, elbowL: -0.3, elbowR: -0.2,
    };
    for (const k in down) o[k] = lerp(o[k], down[k], w);
  }
  return o;
}

// ゾンビ：片足を引きずるすり足と、前に伸ばした腕
export function zombieWalkPose(z, t, o) {
  for (const k of POSE_KEYS) o[k] = 0;
  const s = Math.sin(z.phase), c = Math.cos(z.phase);
  o.legLx = -0.3 * s; o.legRx = 0.12 * s;
  o.kneeL = 0.15 + 0.55 * pos(c); o.kneeR = 0.1 + 0.12 * pos(-c);
  o.hipsY = -0.03 + 0.02 * Math.cos(z.phase * 2);
  o.hipsRz = 0.08 * s;
  o.hipsRy = -0.1 * s;
  o.torsoRx = 0.18; o.torsoRz = 0.1 * s - 0.05;
  o.torsoRy = 0.12 * s;
  o.headRx = 0.25; o.headRz = 0.35 + 0.08 * Math.sin(t * 1.3);
  o.armLx = -1.35 + 0.08 * s + 0.05 * Math.sin(t * 2.1); o.armLz = 0.05;
  o.armRx = -1.25 - 0.08 * s; o.armRz = -0.1;
  o.elbowL = -0.25; o.elbowR = -0.4;
  return o;
}
