// 台本：部屋ごとの敵の配置、出来事、調べたときの反応
import { TEXT } from './text.js';
import { CRANE } from './rooms/freight.js';

const say = (G, key) => G.say(TEXT.lines[key]);

// その部屋に初めて入ったときだけ章の題を出す
function chapterOnce(G, key) {
  if (G.flags[`ch.${key}`]) return;
  G.flags[`ch.${key}`] = true;
  G.chapter(TEXT.chapters[key]);
}

export const STORY = {
  start(G) {
    G.give('photo');
    G.cut(async () => {
      G.flags['ch.office'] = true;
      G.chapter(TEXT.chapters.office);
      await G.wait(1.2);
      await G.say(TEXT.officeIntro);
    });
  },

  // ---- 第1章：管理事務所 ----
  office: {
    enemies(G) {
      return [
        // マイク：ソファの横で倒れている男。鍵を取ると起き上がる
        { id: 'mike', colors: 'worker', x: 1.6, z: 0.9, yaw: Math.PI / 2, state: G.flags.mikeUp ? 'walk' : 'dormant', hp: 5 },
        // 職員：犬が破った窓から、あとで這い込んでくる
        { id: 'office.staff', colors: 'staff', x: 0.3, z: -4.2, yaw: 0, state: G.flags.staffIn ? 'walk' : 'hidden', hp: 4, climb: { x: 0.3, z0: -4.2, z1: -3.25, y: 0.95 } },
        { id: 'office.dog', type: 'dog', x: 0.3, y: 1.35, z: -4.3, yaw: 0, state: G.flags.dogIn ? 'run' : 'hidden', hp: 3,
          win: { x: 0.3, y: 1.35, z: -4.3 }, onCrash: () => { G.room.objects.brokenGlass.visible = true; G.fx.glassBurst(0.3, 1.65, -3.9, 2.4, 1.1); } },
      ];
    },
    enter(G) {
      G.room.objects.brokenGlass.visible = !!G.flags.dogIn;
      G.staffT = 0;
    },
    onPickup(G, pk) {
      if (pk.item === 'key' && !G.flags.mikeUp) {
        G.flags.mikeUp = true;
        const m = G.enemy('mike');
        if (m && m.state === 'dormant') { m.state = 'rising'; m.t = 0; G.sfx.groan(); }
        G.staffT = 5;
      }
    },
    tick(G, dt) {
      // 奥へ進むと、雷と同時に犬が窓を突き破ってくる
      if (!G.flags.dogIn && G.player.x > -2.3) {
        G.flags.dogIn = true;
        const dog = G.enemy('office.dog');
        G.lightning(0.62);
        G.cut(async () => {
          G.cam('window');
          dog.state = 'crash'; dog.t = -0.45; dog.broke = false;
          G.setRain(2.2);
          await G.wait(2.3);
        }, { live: true });
      }
      if (G.staffT > 0) {
        G.staffT -= dt;
        if (G.staffT <= 0) {
          G.flags.staffIn = true;
          const s = G.enemy('office.staff');
          if (s && s.state === 'hidden') { s.state = 'climb'; s.t = 0; G.sfx.groan(); }
        }
      }
    },
    examine(G, e) {
      if (e.id === 'mike' && e.state === 'dead') { G.say(TEXT.office.mikeDead); return true; }
      return false;
    },
  },

  // ---- 荷さばき場（屋外）：各章の行き来の中心 ----
  yard: {
    enemies(G) {
      const list = [
        { id: 'yard.driver', colors: 'driver', x: -2.9, z: 2.3, yaw: -Math.PI / 2, state: 'dead', hp: 1 },
        { id: 'yard.eater', colors: 'worker', x: -3.6, z: 2.0, yaw: Math.PI / 2, state: 'eating', hp: 4, wake: 3.2 },
        { id: 'yard.fence', colors: 'staff', x: 2.4, z: 5.6, yaw: Math.PI, state: 'idle', hp: 4, wake: 4 },
      ];
      // 冷蔵倉庫で薬を浴びたあと：ポーターが匂いを追ってくる
      if (G.flags.exposed && !G.flags.yardChase) {
        G.flags.yardChase = true;
        list.push({ id: 'yard.porter', type: 'porter', x: 9.2, z: -2.0, yaw: -Math.PI / 2, state: 'enter', hp: 8, downTime: 6, leaveTo: [9.6, -2.0] });
      }
      // 所長が出ていったあと：門の外から感染者が入り込んでくる
      if (G.flags.holtLeft) {
        list.push({ id: 'yard.late1', colors: 'guard', x: 5.2, z: 6.2, yaw: Math.PI, state: 'walk', hp: 4, speed: 1.1 });
        list.push({ id: 'yard.late2', type: 'dog', x: 6.4, z: 5.6, yaw: Math.PI, state: 'land', hp: 3 });
      }
      return list;
    },
    enter(G) {
      if (!G.flags.yardSeen) {
        G.flags.yardSeen = true;
        G.cut(async () => { await G.wait(0.4); await say(G, 'yardFirst'); });
      }
      if (G.enemy('yard.porter')) {
        G.setTension(2);
        G.cut(async () => {
          G.cam('cold');
          await G.wait(1.2);
          await say(G, 'yardChase');
        }, { live: true });
      }
    },
    interact(G, id) {
      if (id === 'mapboard') {
        G.flags.map = true;
        G.say([...TEXT.yard.mapboard, '構内の配置を覚えた。（ステータス画面の MAP で見られる）']);
        return true;
      }
      return false;
    },
  },

  // ---- 第2章：倉庫棟 ----
  warehouse: {
    enemies(G) {
      return [
        { id: 'warehouse.foreman', colors: 'driver', x: 4.3, z: 1.4, yaw: -2.4, state: 'dead', hp: 1 },
        { id: 'warehouse.z1', colors: 'worker', x: -4.2, z: -3.7, yaw: Math.PI / 2, state: 'feign', hp: 4 },
        { id: 'warehouse.z2', colors: 'staff', x: -5.2, z: 2.6, yaw: 0.4, state: 'idle', hp: 4, wake: 5 },
      ];
    },
    enter(G) { chapterOnce(G, 'warehouse'); },
    // 通用口は内側からかんぬきを外せる
    door(G, name) { if (name === 'yardSide') G.flags.sideOpen = true; return false; },
    examine(G, e) {
      if (e.id !== 'warehouse.foreman') return false;
      if (G.flags.cardGot) { G.say(TEXT.warehouse.foremanAfter); return true; }
      G.flags.cardGot = true;
      G.sfx.pickup();
      G.give('card');
      G.say(TEXT.warehouse.foreman);
      return true;
    },
    tick(G) {
      // カードを手にして出口へ戻ろうとすると、棚の上から「積み荷」が降ってくる
      if (G.flags.cardGot && !G.flags.porterDrop && G.player.x < 3.2) {
        G.flags.porterDrop = true;
        dropEvent(G);
      }
    },
  },

  // ---- 第3章：冷蔵倉庫 ----
  cold: {
    enemies(G) {
      const list = [
        { id: 'cold.z1', colors: 'staff', x: -3.5, z: -3.2, yaw: Math.PI / 2, state: 'idle', hp: 6, speed: 0.6, wake: 3.4 },
        { id: 'cold.z2', colors: 'worker', x: -0.4, z: 1.7, yaw: -0.6, state: 'feign', hp: 6, speed: 0.6 },
      ];
      return list;
    },
    enter(G) {
      chapterOnce(G, 'cold');
      const o = G.room.objects;
      o.spill.visible = !!G.flags.exposed;
      o.freezerDoor.visible = true; o.handle.visible = true;
      // 薬を浴びた直後に部屋を出入りしても、ポーターは戻ってこない
      if (G.flags.emmaMet && !G.flags.exposed) coldPorter(G, true);
      if (G.flags.exposed) G.flags.coldPorterGone = true;
    },
    interact(G, id) {
      if (id === 'freezer') { freezer(G); return true; }
      if (id === 'lzcase' && G.flags.exposed) { G.say(TEXT.cold.lzcaseAfter); return true; }
      return false;
    },
    tick(G) {
      const p = G.enemy('cold.porter');
      if (p && p.state === 'gone' && !G.flags.coldPorterGone) {
        G.flags.coldPorterGone = true;
        G.setTension(1);
        G.cut(async () => { await G.wait(0.6); await say(G, 'porterLeftCold'); });
      }
    },
  },

  // ---- 第4章：無線室 ----
  radio: {
    enter(G) {
      chapterOnce(G, 'radio');
      if (!G.flags.holtMet) radioScene(G);
    },
    interact(G, id) {
      if (id === 'radioSet' && G.flags.holtMet) { G.say(TEXT.radio.radioAfter); return true; }
      return false;
    },
  },

  // ---- 第4章後半：正門の検問所 ----
  checkpoint: {
    enemies(G) {
      if (G.flags.checkpointClear) {
        const dead = [];
        for (const [id, x, z, yaw] of [['cp.s1', -1.6, 2.4, -1.4], ['cp.s2', -5.0, 0.2, 0.4], ['cp.s3', -3.0, -1.6, 2.6]]) dead.push({ id, type: 'soldier', x, z, yaw, state: 'dead' });
        return dead;
      }
      return [
        { id: 'cp.s1', type: 'soldier', x: -1.6, z: 2.4, yaw: -Math.PI / 2, state: 'aimStill', hp: 5, accuracy: 0.4 },
        { id: 'cp.s2', type: 'soldier', x: -5.0, z: 0.2, yaw: 0.6, state: 'still', hp: 5, accuracy: 0.4 },
        { id: 'cp.s3', type: 'soldier', x: -8.6, z: 0.6, yaw: Math.PI / 2, state: 'hidden', hp: 5, accuracy: 0.35 },
      ];
    },
    enter(G) {
      if (!G.flags.standoff) standoff(G);
      else if (G.flags.checkpointClear) placeSurvivors(G, 'checkpoint');
    },
    tick(G) {
      if (!G.flags.standoffDone || G.flags.checkpointClear) return;
      const soldiersDown = ['cp.s1', 'cp.s2', 'cp.s3'].every((id) => { const s = G.enemy(id); return !s || s.state === 'dead' || s.state === 'dying'; });
      const p = G.enemy('cp.porter');
      const porterQuiet = !p || ['down', 'leave', 'gone'].includes(p.state);
      if (soldiersDown && porterQuiet) { G.flags.checkpointClear = true; afterBattle(G); }
    },
    examine(G, e) {
      if (e.kind !== 'soldier') return false;
      if (!G.flags.orderRead) { G.flags.orderRead = true; G.say(TEXT.checkpoint.soldierFirst).then(() => G.doc('order')); }
      else G.say(TEXT.checkpoint.soldier);
      return true;
    },
    talk(G, name) { G.say(TEXT.talk[`${name}.${G.flags.holtDead ? 'b' : 'a'}`] || TEXT.talk[name]); },
  },

  // ---- 第5章：貨物ヤード ----
  freight: {
    enemies(G) {
      if (G.flags.porterDead) return [];
      return [{ id: 'final.porter', type: 'porter', x: CRANE.x, z: 0.4, yaw: -Math.PI / 2, state: G.flags.finalStart ? 'walk' : 'hidden', hp: 16, final: true, dropFrom: 6.2,
        onDeath: () => { G.flags.porterDead = true; finale(G); } }];
    },
    enter(G) {
      chapterOnce(G, 'freight');
      const o = G.room.objects;
      o.hung.position.y = G.flags.craneDropped ? 2.4 : 5.6;
      o.wires.visible = !G.flags.craneDropped;
      G.dropT = -1;
      placeSurvivors(G, 'freight');
      if (!G.flags.finalStart) finalIntro(G);
      else if (G.flags.porterDead && !G.flags.ended) finale(G);
    },
    interact(G, id) {
      if (id !== 'crane') return false;
      if (G.flags.craneDropped) { G.say(TEXT.freight.craneUsed); return true; }
      const p = G.enemy('final.porter');
      if (p && p.active() && Math.hypot(p.x - CRANE.x, p.z - CRANE.z) < 1.9) { dropContainer(G, p); return true; }
      G.say(TEXT.freight.crane);
      return true;
    },
    tick(G, dt) {
      // 吊り荷の落下
      if (G.dropT >= 0) {
        G.dropT += dt;
        const k = Math.min(1, G.dropT / 0.35);
        G.room.objects.hung.position.y = 5.6 - 3.2 * k * k;
      }
    },
    talk(G, name) { G.say(TEXT.talk[`${name}.${G.flags.holtDead ? 'b' : 'a'}`] || TEXT.talk[name]); },
  },
};

// ---------------------------------------------------------------- 倉庫棟：ポーター初登場と緊急選択
function dropEvent(G) {
  G.setTension(2);
  const p = G.spawn({ id: 'warehouse.porter', type: 'porter', x: 1.0, z: 0.4, yaw: -Math.PI / 2, state: 'hidden', hp: 10, dropFrom: 5.0, leaveTo: [6.4, 0.9] });
  G.cut(async () => {
    G.sfx.heavyStep();
    G.shake(0.25);
    await G.wait(0.5);
    await say(G, 'dropBefore');
    G.cam('drop');
    p.yaw = Math.atan2(G.player.x - p.x, G.player.z - p.z);
    p.state = 'drop'; p.t = 0;
    await G.wait(2.6);
    const pick = await G.select('ポーターが迫ってくる！', ['棚の下をくぐる', '来た道を引き返す'], 6, 1);
    if (pick === 0) {
      // 棚の最下段をくぐって、向こうの通路へ抜ける
      await G.fade(1, 0.3);
      Object.assign(G.player, { x: -0.6, z: -3.4, yaw: Math.PI });
      G.cam('aisle');
      p.state = 'idleScript';
      await G.fade(0, 0.4);
      await say(G, 'dropDodge');
    } else {
      // まっすぐ逃げても、一撃は避けられない
      G.cam('container');
      p.state = 'charge'; p.t = 0;
      await G.wait(0.9);
      G.sfx.punch(); G.shake(0.4);
      G.player.knock = { x: Math.sin(p.yaw) * 4, z: Math.cos(p.yaw) * 4, t: 0.3 };
      G.hurt(30);
      p.state = 'idleScript';
      await G.wait(0.8);
      await say(G, 'dropHit');
    }
    // 吠えて、コンテナの陰へ消えていく
    G.sfx.porterRoar(1);
    p.state = 'leave'; p.t = 0;
    await G.wait(2.2);
    G.flags.porterMet = true;
    G.setTension(1);
    await say(G, 'dropAfter');
  }, { live: true });
}

// ---------------------------------------------------------------- 冷蔵倉庫：エマと、LZ-9 を浴びる場面
function freezer(G) {
  const o = G.room.objects;
  if (G.flags.coldPorterGone) {
    G.cut(async () => {
      G.sfx.radio(0.2);
      await say(G, G.flags.holtLeft ? 'emmaWaitHolt' : 'emmaWait');
    });
    return;
  }
  if (G.flags.emmaMet) { G.say(TEXT.cold.freezerLocked); return; }
  G.flags.emmaMet = true;
  G.cut(async () => {
    G.cam('freezer');
    Object.assign(G.player, { x: 2.5, z: -2.9, yaw: Math.PI });
    await say(G, 'emmaKnock');
    G.sfx.door();
    o.freezerDoor.visible = false; o.handle.visible = false;
    const emma = G.npc('emma', { x: 1.8, z: -4.2, yaw: 0, pose: 'hug' });
    await G.wait(0.8);
    emma.pose = 'stand';
    await new Promise((res) => emma.walkTo(1.5, -3.4, res));
    emma.face(G.player.x, G.player.z);
    await say(G, 'emmaMeet');
    G.give('radioKey');
    G.sfx.pickup();
    await G.say(['「無線室の鍵」を受け取った。']);
    await say(G, 'emmaMeet2');
    // 西の扉が内側へ吹き飛ぶ
    G.sfx.crash(); G.shake(0.6);
    await G.wait(0.4);
    await say(G, 'emmaScream');
    await new Promise((res) => { emma.run = true; emma.walkTo(1.8, -4.3, res); });
    G.removeNpc('emma');
    o.freezerDoor.visible = true; o.handle.visible = true;
    G.sfx.door();
    coldPorter(G, false);
  });
}

function coldPorter(G, again) {
  const o = G.room.objects;
  G.setTension(2);
  const p = G.spawn({ id: 'cold.porter', type: 'porter', x: -5.6, z: 0.2, yaw: Math.PI / 2, state: 'enter', hp: 8, downTime: 6, leaveTo: [-5.8, 0.0] });
  if (again) return;
  G.cut(async () => {
    G.cam('entry');
    Object.assign(G.player, { x: 3.4, z: -0.9, yaw: -Math.PI / 2 });
    await G.wait(2.8);
    // 中央のケースへ歩み寄り、台ごと薙ぎ払う
    G.cam('back');
    p.dest = [1.85, 0.6];
    await new Promise((res) => { p.onArrive = res; p.state = 'goto'; p.t = 0; });
    p.state = 'idleScript';
    G.sfx.swing();
    await G.wait(0.3);
    G.sfx.crash(); G.sfx.glassSmall(); G.shake(0.5);
    G.fx.glassBurst(3.2, 1.1, 1.0, 1.2, 0.3);
    o.spill.visible = true;
    G.flags.exposed = true;
    G.player.knock = { x: 2.5, z: -1.5, t: 0.25 };
    G.hurt(8);
    await G.wait(0.7);
    await say(G, 'exposed');
    p.state = 'roar'; p.t = 0;
    await G.wait(1.6);
  }, { live: true });
}

// ---------------------------------------------------------------- 無線室：所長と、回収課からの無線
function radioScene(G) {
  const holt = G.npc('holt', { x: 1.75, z: -0.4, yaw: Math.PI / 2, pose: 'sit', gun: true });
  Object.assign(G.player, { x: 0.3, z: 0.9, yaw: Math.PI * 0.75 });
  G.cut(async () => {
    G.cam('radio');
    await G.wait(0.6);
    holt.pose = 'stand';
    holt.face(G.player.x, G.player.z);
    await G.wait(0.5);
    holt.pose = 'aim';
    await say(G, 'holtMeet');
    holt.pose = 'stand';
    await say(G, 'holtMeet2');
    holt.face(3, -0.4);
    G.sfx.radio(1.2);
    await G.wait(0.8);
    G.flags.radioHeard = true;
    await say(G, 'radioCall');
    G.sfx.radio(0.8);
    holt.face(G.player.x, G.player.z);
    await G.wait(0.6);
    await say(G, 'holtConfess');
    if (G.flags.exposed) await say(G, 'holtExposed');
    await say(G, 'holtLeave');
    G.cam('door');
    await new Promise((res) => holt.walkTo(-1.0, -1.6, res));
    await new Promise((res) => holt.walkTo(-1.0, -2.4, res));
    G.sfx.door();
    G.removeNpc('holt');
    G.flags.holtMet = true; G.flags.holtLeft = true; G.flags.gateOpen = true;
    await G.wait(0.6);
    await say(G, 'afterHolt');
  });
}

// ---------------------------------------------------------------- 検問所：回収課との対峙
function standoff(G) {
  G.flags.standoff = true;
  G.setTension(2);
  const holt = G.npc('holt', { x: -3.0, z: 1.4, yaw: 0, pose: 'kneel' });
  const emma = G.npc('emma', { x: -4.3, z: -0.6, yaw: 0.6, pose: 'hands' });
  const victor = G.npc('victor', { x: -3.6, z: 3.4, yaw: Math.PI, pose: 'stand', gun: true });
  const s1 = G.enemy('cp.s1'), s2 = G.enemy('cp.s2'), s3 = G.enemy('cp.s3');
  s1.faceTo = Math.atan2(holt.x - s1.x, holt.z - s1.z);
  G.cut(async () => {
    G.cam('standoff');
    await G.wait(0.8);
    await say(G, 'standoff1');
    victor.face(G.player.x, G.player.z);
    await say(G, 'standoff2');
    victor.face(holt.x, holt.z);
    await say(G, 'standoff3');
    const pick = await G.select('兵士が所長に銃口を向けた！', ['所長をかばって撃つ', '物陰に身を隠す'], 6, 1);
    if (pick === 0) {
      G.flags.holtSaved = true;
      G.player.yaw = Math.atan2(s1.x - G.player.x, s1.z - G.player.z);
      G.player.forceAim = true;
      await G.wait(0.4);
      for (let i = 0; i < 3; i++) { G.sfx.gun(); s1.hit(Math.sin(G.player.yaw), Math.cos(G.player.yaw)); await G.wait(0.25); }
      for (let i = 0; i < 4 && s1.state !== 'dying' && s1.state !== 'dead'; i++) s1.hit(0, 0);
      G.player.forceAim = false;
      holt.pose = 'stand';
      holt.run = true;
      holt.walkTo(4.0, 0.2);
      await say(G, 'saveHolt');
    } else {
      G.flags.holtDead = true;
      await G.fade(0.6, 0.2);
      G.sfx.rifle();
      await G.fade(0, 0.3);
      holt.pose = 'lie';
      G.fx.bloodSpray({ x: holt.x, y: 1.0, z: holt.z }, 0, -1);
      G.fx.startPool(holt.x, holt.z + 0.6);
      await say(G, 'holtShot');
    }
    // 道路の向こうから、吠え声
    G.sfx.porterRoar(0.8);
    G.shake(0.3);
    await G.wait(0.8);
    G.cam('road');
    const p = G.spawn({ id: 'cp.porter', type: 'porter', x: 9.6, z: 2.4, yaw: -Math.PI / 2, state: 'enter', hp: 8, downTime: 8, leaveTo: [10.0, 2.4] });
    await G.wait(2.6);
    G.cam('standoff');
    await say(G, 'porterArrives');
    victor.run = true; victor.walkTo(-8.6, 0.6);
    emma.pose = 'stand'; emma.run = true; emma.walkTo(-4.0, -5.4);
    await G.wait(1.6);
    G.removeNpc('victor'); G.removeNpc('emma');
    if (!G.flags.holtDead) G.removeNpc('holt');
    for (const s of [s1, s2, s3]) if (s.state !== 'dying' && s.state !== 'dead') { s.state = 'hunt'; s.t = 0; s.cd = 1.5 + Math.random(); }
    p.state = 'walk';
    G.flags.standoffDone = true;
    await say(G, 'battle');
  });
}

function afterBattle(G) {
  G.setTension(1);
  G.cut(async () => {
    await G.wait(1.2);
    G.cam('van');
    const emma = G.npc('emma', { x: -4.0, z: -5.4, yaw: Math.PI, pose: 'stand' });
    if (G.flags.holtDead) {
      await new Promise((res) => emma.walkTo(-3.0, 0.6, res));
      emma.pose = 'kneel';
      await say(G, 'afterB');
    } else {
      const holt = G.npc('holt', { x: 4.0, z: 0.2, yaw: -Math.PI / 2, pose: 'stand' });
      holt.limp = true;
      emma.walkTo(-1.2, -0.6);
      await new Promise((res) => holt.walkTo(0.2, 0.0, res));
      holt.face(G.player.x, G.player.z); emma.face(G.player.x, G.player.z);
      await say(G, 'afterA');
    }
  });
}

// その場にいる生き残り（エマと、生きていれば所長）を立たせる
function placeSurvivors(G, where) {
  if (!G.flags.checkpointClear) return;
  if (where === 'checkpoint') {
    if (G.flags.holtDead) {
      G.npc('holt', { x: -3.0, z: 1.4, yaw: 0, pose: 'lie' });
      G.npc('emma', { x: -3.0, z: 0.6, yaw: 0, pose: 'kneel' });
    } else {
      G.npc('holt', { x: 0.2, z: 0.0, yaw: -Math.PI / 2, pose: 'stand' }).limp = true;
      G.npc('emma', { x: -1.2, z: -0.6, yaw: Math.PI / 2, pose: 'stand' });
    }
  } else {
    G.npc('emma', { x: -8.4, z: 2.6, yaw: Math.PI / 2, pose: 'stand' });
    if (!G.flags.holtDead) G.npc('holt', { x: -8.8, z: 0.0, yaw: Math.PI / 2, pose: 'wounded' });
  }
}

// ---------------------------------------------------------------- 貨物ヤード：最終戦と取引
function finalIntro(G) {
  G.flags.finalStart = true;
  G.setTension(2);
  const victor = G.npc('victor', { x: 1.6, z: -1.3, yaw: -Math.PI / 2, pose: 'stand', gun: true });
  const p = G.enemy('final.porter');
  G.cut(async () => {
    G.cam('intro');
    await G.wait(0.8);
    await say(G, 'victorFreight');
    G.sfx.heavyStep(); G.shake(0.3);
    await G.wait(0.6);
    G.cam('drop');
    p.yaw = Math.atan2(G.player.x - p.x, G.player.z - p.z);
    p.state = 'drop'; p.t = 0;
    await G.wait(2.4);
    G.cam('crane');
    await say(G, 'finalPorter');
    victor.run = true; victor.walkTo(8.0, -1.6);
    await G.wait(1.4);
    G.removeNpc('victor');
    p.state = 'walk';
    await say(G, 'finalHint');
  });
}

function dropContainer(G, p) {
  G.flags.craneDropped = true;
  G.cut(async () => {
    G.sfx.motor(0.6);
    await G.wait(0.3);
    G.cam('drop');
    p.state = 'idleScript';
    G.room.objects.wires.visible = false;
    G.room.colliders.push([CRANE.x - 1.3, CRANE.z - 0.95, CRANE.x + 1.3, CRANE.z + 0.95]);
    G.dropT = 0;
    await G.wait(0.35);
    G.sfx.crash(); G.sfx.heavyLand(); G.shake(0.8);
    p.state = 'crushed';
    p.root.position.y = 0;
    G.fx.startPool(p.x, p.z + 1.2);
    await G.wait(1.6);
    G.flags.porterDead = true;
  }).then(() => finale(G));
}

function finale(G) {
  if (G.flags.finaleStarted) return;
  G.flags.finaleStarted = true;
  G.setTension(0.6);
  G.cut(async () => {
    await G.wait(1.2);
    // 燃えるドラム缶のそばで、ヴィクトルと向き合う
    await G.fade(1, 0.8);
    Object.assign(G.player, { x: -2.0, z: 1.3, yaw: Math.PI / 2, aiming: false });
    G.npc('victor', { x: -0.5, z: 1.3, yaw: -Math.PI / 2, pose: 'stand' });
    G.cam('deal');
    await G.fade(0, 0.8);
    await say(G, 'deal');
    const pick = await G.select('記録ディスクを――', ['受け取る', '炎に投げ込む'], 10, 0);
    G.flags.ended = true;
    if (pick === 0) {
      await say(G, 'keepDisc');
      await G.fade(1, 1.6);
      G.sfx.horn();
      await G.wait(1.2);
      G.ending(G.flags.holtDead ? 'B' : 'A');
    } else {
      await say(G, 'burnDisc');
      await G.fade(1, 1.6);
      G.sfx.horn();
      await G.wait(1.2);
      G.ending('C');
    }
  });
}
