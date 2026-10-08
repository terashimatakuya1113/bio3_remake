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

function startRain() {
  const src = noise(true);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  src.connect(f).connect(g).connect(master);
  src.start();
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
  locked() {
    burst({ freq: 1800, q: 6, peak: 0.25, decay: 0.08 });
    burst({ freq: 1500, q: 6, peak: 0.25, decay: 0.08, delay: 0.12 });
  },
};
