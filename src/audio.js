// 効果音はすべて WebAudio で合成する（外部の音声素材は使わない）
let ctx = null;
let master = null;
let noiseBuf = null;

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startRain();
  startAmbience();
}

function noise(loop = false) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = loop;
  return s;
}

function env(gain, t, attack, peak, decay) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function burst({ freq = 800, q = 1, type = 'bandpass', peak = 0.5, attack = 0.002, decay = 0.1, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const src = noise();
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, attack, peak, decay);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random()); src.stop(t + attack + decay + 0.05);
}

let rainGain = null;
let ambBus = null;
export function setTension(level) {
  if (ambBus) ambBus.gain.setTargetAtTime(0.16 * level, ctx.currentTime, 1.5);
}
export function setRain(level) {
  if (rainGain) rainGain.gain.setTargetAtTime(0.05 * level, ctx.currentTime, 0.3);
}

function startRain() {
  const src = noise(true);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  rainGain = g;
  src.connect(f).connect(g).connect(master);
  src.start();
}

// 不穏な環境音楽：低い持続音がゆっくり揺れ、ときどき高い音が鳴る
function startAmbience() {
  const bus = ctx.createGain();
  ambBus = bus;
  bus.gain.value = 0.0;
  bus.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 6);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 2;
  bus.connect(lp).connect(master);
  [[55, 'sawtooth', 0.3], [55.4, 'sawtooth', 0.3], [82.4, 'triangle', 0.25], [116.5, 'sine', 0.12]].forEach(([f, type, v], i) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = v;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.031;
    const lg = ctx.createGain(); lg.gain.value = v * 0.8;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(bus);
    o.start(); lfo.start();
  });
  const sweep = ctx.createOscillator(); sweep.frequency.value = 0.02;
  const sg = ctx.createGain(); sg.gain.value = 220;
  sweep.connect(sg).connect(lp.frequency); sweep.start();
  const ting = () => {
    const t = ctx.currentTime;
    const f = [622, 659, 932, 987][Math.floor(Math.random() * 4)];
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 1.007;
    const g = ctx.createGain(); env(g, t, 0.8, 0.035, 5);
    o.connect(g); o2.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + 6.5); o2.stop(t + 6.5);
    setTimeout(ting, 9000 + Math.random() * 12000);
  };
  setTimeout(ting, 7000);
}

let stepFlip = false;
export const sfx = {
  step(run) {
    stepFlip = !stepFlip;
    burst({ freq: stepFlip ? 260 : 300, q: 2, peak: run ? 0.35 : 0.22, decay: 0.07 });
    burst({ freq: 2400, q: 1, peak: 0.04, decay: 0.03 });
  },
  gun() {
    burst({ freq: 1200, q: 0.5, type: 'lowpass', peak: 0.9, decay: 0.25 });
    burst({ freq: 120, q: 1, type: 'lowpass', peak: 1.0, decay: 0.35 });
    burst({ freq: 3000, q: 0.7, peak: 0.2, decay: 0.6, delay: 0.05 });
  },
  empty() { burst({ freq: 3500, q: 6, peak: 0.25, decay: 0.03 }); },
  hit() { burst({ freq: 400, q: 1.5, peak: 0.5, decay: 0.12 }); },
  thunder(delay = 0) {
    burst({ freq: 90, q: 0.7, type: 'lowpass', peak: 0.9, attack: 0.05, decay: 2.8, delay });
    burst({ freq: 300, q: 0.5, type: 'lowpass', peak: 0.4, attack: 0.01, decay: 0.8, delay });
  },
  pickup() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [660, 990].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const g = ctx.createGain(); env(g, t + i * 0.09, 0.005, 0.08, 0.18);
      o.connect(g).connect(master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.3);
    });
  },
  cursor() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1320;
    const g = ctx.createGain(); env(g, t, 0.002, 0.05, 0.05);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.1);
  },
  groan() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const base = 70 + Math.random() * 25;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 0.75, t + 1.3);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
    const lg = ctx.createGain(); lg.gain.value = 120;
    lfo.connect(lg).connect(f.frequency);
    const g = ctx.createGain(); env(g, t, 0.25, 0.35, 1.2);
    o.connect(f).connect(g).connect(master);
    o.start(t); lfo.start(t); o.stop(t + 1.6); lfo.stop(t + 1.6);
  },
  bite() {
    burst({ freq: 600, q: 0.8, peak: 0.7, decay: 0.3 });
    burst({ freq: 150, q: 1, type: 'lowpass', peak: 0.6, decay: 0.4 });
  },
  door() {
    if (!ctx) return;
    const t = ctx.currentTime + 0.3;
    // 取っ手の金属音 → きしみ
    burst({ freq: 2200, q: 8, peak: 0.3, decay: 0.15, delay: 0.1 });
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(260, t + 0.6);
    o.frequency.linearRampToValueAtTime(150, t + 1.6);
    const wob = ctx.createOscillator(); wob.frequency.value = 23;
    const wg = ctx.createGain(); wg.gain.value = 25;
    wob.connect(wg).connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 4;
    const g = ctx.createGain(); env(g, t, 0.3, 0.12, 1.5);
    o.connect(f).connect(g).connect(master);
    o.start(t); wob.start(t); o.stop(t + 2); wob.stop(t + 2);
    burst({ freq: 140, q: 1, type: 'lowpass', peak: 0.7, decay: 0.5, delay: 2.4 });
  },
  reload() {
    burst({ freq: 2600, q: 5, peak: 0.3, decay: 0.05 });
    burst({ freq: 1800, q: 5, peak: 0.35, decay: 0.06, delay: 0.25 });
  },
  heal() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain(); env(g, t + i * 0.12, 0.01, 0.1, 0.4);
      o.connect(g).connect(master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.5);
    });
  },
  // 窓ガラスが割れる：低い衝撃と、散らばる破片の音
  glass() {
    burst({ freq: 200, q: 0.8, type: 'lowpass', peak: 0.9, decay: 0.3 });
    burst({ freq: 4200, q: 0.6, peak: 0.7, decay: 0.5 });
    for (let i = 0; i < 9; i++) burst({ freq: 3000 + Math.random() * 4000, q: 12, peak: 0.25, decay: 0.08 + Math.random() * 0.1, delay: 0.1 + Math.random() * 0.8 });
  },
  growl() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 62 + Math.random() * 12;
    const am = ctx.createOscillator(); am.frequency.value = 23;
    const ag = ctx.createGain(); ag.gain.value = 0.5;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 480; f.Q.value = 2.5;
    const g = ctx.createGain(); env(g, t, 0.15, 0.4, 1.1);
    const v = ctx.createGain(); v.gain.value = 0.6;
    am.connect(ag).connect(v.gain);
    o.connect(f).connect(v).connect(g).connect(master);
    o.start(t); am.start(t); o.stop(t + 1.4); am.stop(t + 1.4);
  },
  bark() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 0.16].forEach((d) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, t + d); o.frequency.exponentialRampToValueAtTime(240, t + d + 0.12);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5;
      const g = ctx.createGain(); env(g, t + d, 0.005, 0.45, 0.13);
      o.connect(f).connect(g).connect(master); o.start(t + d); o.stop(t + d + 0.2);
      burst({ freq: 1500, q: 1, peak: 0.25, decay: 0.08, delay: d });
    });
  },
  yelp() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.35);
    const g = ctx.createGain(); env(g, t, 0.01, 0.3, 0.35);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.45);
  },
  locked() {
    burst({ freq: 1800, q: 6, peak: 0.25, decay: 0.08 });
    burst({ freq: 1500, q: 6, peak: 0.25, decay: 0.08, delay: 0.12 });
  },
  // 追跡者の咆哮：低いうなりに歪んだ倍音を重ねる
  porterRoar(vol = 1) {
    if (!ctx) return;
    const t = ctx.currentTime;
    [48, 73, 97].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.3, t); o.frequency.linearRampToValueAtTime(f, t + 1.4);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 11 + i * 3;
      const lg = ctx.createGain(); lg.gain.value = f * 0.25;
      lfo.connect(lg).connect(o.frequency);
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 700; flt.Q.value = 3;
      const g = ctx.createGain(); env(g, t, 0.12, 0.5 * vol / (i + 1), 1.6);
      o.connect(flt).connect(g).connect(master);
      o.start(t); lfo.start(t); o.stop(t + 1.9); lfo.stop(t + 1.9);
    });
    burst({ freq: 500, q: 0.6, peak: 0.35 * vol, attack: 0.1, decay: 1.4 });
  },
  heavyStep() {
    burst({ freq: 90, q: 1, type: 'lowpass', peak: 0.7, decay: 0.18 });
    burst({ freq: 400, q: 2, peak: 0.12, decay: 0.06 });
  },
  heavyLand() {
    burst({ freq: 70, q: 0.8, type: 'lowpass', peak: 1.0, decay: 0.7 });
    burst({ freq: 1200, q: 0.5, peak: 0.3, decay: 0.4 });
  },
  swing() { burst({ freq: 900, q: 0.7, peak: 0.35, attack: 0.05, decay: 0.15 }); },
  punch() {
    burst({ freq: 140, q: 1, type: 'lowpass', peak: 1.0, decay: 0.3 });
    burst({ freq: 700, q: 1, peak: 0.6, decay: 0.15 });
  },
  rifle() {
    burst({ freq: 1600, q: 0.5, type: 'lowpass', peak: 0.7, decay: 0.2 });
    burst({ freq: 150, q: 1, type: 'lowpass', peak: 0.7, decay: 0.3 });
    burst({ freq: 3500, q: 0.7, peak: 0.25, decay: 0.8, delay: 0.04 });
  },
  grunt() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.25);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2;
    const g = ctx.createGain(); env(g, t, 0.01, 0.35, 0.25);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.35);
  },
  // 重い金属の衝撃（棚が倒れる・コンテナが落ちる）
  crash() {
    burst({ freq: 60, q: 0.7, type: 'lowpass', peak: 1.0, decay: 1.2 });
    burst({ freq: 900, q: 0.4, peak: 0.6, decay: 0.8 });
    for (let i = 0; i < 6; i++) burst({ freq: 1500 + Math.random() * 3000, q: 10, peak: 0.25, decay: 0.3 + Math.random() * 0.5, delay: 0.05 + Math.random() * 0.6 });
  },
  // 汽笛：二つの音を重ねた長い音
  horn() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [277, 349, 415].forEach((f) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1200;
      const g = ctx.createGain(); env(g, t, 0.15, 0.12, 2.2);
      o.connect(flt).connect(g).connect(master); o.start(t); o.stop(t + 2.6);
    });
  },
  // 無線のノイズ
  radio(len = 0.6) { burst({ freq: 2200, q: 0.4, peak: 0.25, attack: 0.02, decay: len }); },
  // モーターのうなり（クレーン・シャッター）
  motor(len = 2) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t); o.frequency.linearRampToValueAtTime(80, t + len);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.3); g.gain.setValueAtTime(0.3, t + len - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + len + 0.1);
  },
  glassSmall() { for (let i = 0; i < 5; i++) burst({ freq: 3000 + Math.random() * 4000, q: 12, peak: 0.3, decay: 0.1, delay: Math.random() * 0.3 }); },
  heartbeat() {
    burst({ freq: 60, q: 1, type: 'lowpass', peak: 0.6, decay: 0.15 });
    burst({ freq: 55, q: 1, type: 'lowpass', peak: 0.45, decay: 0.15, delay: 0.22 });
  },
};
