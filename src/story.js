// 台本：部屋ごとの敵の配置、出来事、調べたときの反応
import { TEXT } from './text.js';
import { COLORS } from './enemies.js';

export const STORY = {
  start(G) {
    G.cut(async () => {
      await G.wait(0.6);
      await G.say(TEXT.officeIntro);
    });
  },

  // ---- 第1章：管理事務所 ----
  office: {
    enemies(G) {
      return [
        // マイク：机の横で倒れている男。鍵を取ると起き上がる
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
  },

  // ---- 荷さばき場（屋外） ----
  yard: {
    enemies(G) {
      return [
        { id: 'yard.driver', colors: 'driver', x: -2.9, z: 2.3, yaw: -Math.PI / 2, state: 'dead', hp: 1 },
        { id: 'yard.eater', colors: 'worker', x: -3.6, z: 2.0, yaw: Math.PI / 2, state: 'eating', hp: 4, wake: 3.2 },
        { id: 'yard.fence', colors: 'staff', x: 2.4, z: 5.6, yaw: Math.PI, state: 'idle', hp: 4, wake: 4 },
      ];
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
  },
};
