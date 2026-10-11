// ステータス画面：体調（心電図）・装備・アイテム欄
export const ITEMS = {
  handgun: { name: 'ハンドガン', desc: '9mm 口径の自動拳銃。\n装弾数は 15 発。', equip: true },
  ammo: { name: 'ハンドガンの弾', desc: 'ハンドガン用の 9mm 弾。\n「使う」で装填する。', stack: true },
  key: { name: '事務所の鍵', desc: '「管理事務所」と書かれた札がついた鍵。\n表の扉の鍵らしい。' },
  herb: { name: 'グリーンハーブ', desc: 'この地方に自生する薬草。\n体力を回復する。' },
};

const SLOTS = 8;

export function createMenu(root) {
  const el = (id) => root.querySelector(id);
  const ecg = el('#ecg');
  const g = ecg.getContext('2d');
  const items = el('#m-items');
  const desc = el('#m-desc');
  const cmds = el('#m-cmds');
  let inv = [], player = null, cursor = 0, cmd = -1, cmdList = [], ecgX = 0, ecgT = 0, onUse = null, message = '';

  function level(h) { return h >= 66 ? 'fine' : h >= 33 ? 'caution' : 'danger'; }

  function render() {
    const lv = level(player.health);
    el('#m-cond-text').textContent = { fine: 'FINE', caution: 'CAUTION', danger: 'DANGER' }[lv];
    el('#m-cond').dataset.level = lv;
    el('#m-equip-ammo').textContent = String(player.ammo).padStart(2, '0');
    let html = '';
    for (let i = 0; i < SLOTS; i++) {
      const it = inv[i];
      const def = it && ITEMS[it.id];
      html += `<div class="slot${i === cursor ? ' sel' : ''}${def ? '' : ' empty'}">${def ? `<span>${def.name}</span>${def.stack ? `<b>${it.count}</b>` : def.equip ? '<b>E</b>' : ''}` : ''}</div>`;
    }
    items.innerHTML = html;
    const cur = inv[cursor] && ITEMS[inv[cursor].id];
    desc.textContent = message || (cur ? cur.desc : '');
    cmds.hidden = cmd < 0;
    cmds.innerHTML = cmdList.map((c, i) => `<span class="${i === cmd ? 'sel' : ''}">${c}</span>`).join('');
  }

  function drawEcg(dt) {
    const lv = level(player.health);
    const color = { fine: '#5ef05e', caution: '#e8c840', danger: '#f04030' }[lv];
    const bpm = { fine: 70, caution: 95, danger: 130 }[lv];
    const W = ecg.width, H = ecg.height;
    const steps = Math.max(1, Math.round(dt * 90));
    for (let s = 0; s < steps; s++) {
      ecgT += 1 / 90;
      const beat = (ecgT * bpm / 60) % 1;
      // P 波・QRS・T 波をざっくり再現
      let y = 0;
      if (beat < 0.08) y = Math.sin(beat / 0.08 * Math.PI) * 0.12;
      else if (beat > 0.16 && beat < 0.19) y = -0.25;
      else if (beat >= 0.19 && beat < 0.23) y = 1.0;
      else if (beat >= 0.23 && beat < 0.27) y = -0.4;
      else if (beat > 0.4 && beat < 0.55) y = Math.sin((beat - 0.4) / 0.15 * Math.PI) * 0.25;
      g.fillStyle = 'rgba(4,10,6,1)';
      g.fillRect(ecgX, 0, 4, H);
      g.fillStyle = color;
      g.fillRect(ecgX, H * 0.62 - y * H * 0.45, 2, 2);
      ecgX = (ecgX + 1) % W;
    }
  }

  return {
    open(inventory, p, use) {
      inv = inventory; player = p; onUse = use; cursor = 0; cmd = -1; message = '';
      g.fillStyle = '#040a06'; g.fillRect(0, 0, ecg.width, ecg.height);
      root.hidden = false;
      render();
    },
    close() { root.hidden = true; },
    // 戻り値が true なら画面を閉じる
    update(dt, pressed, sfx) {
      drawEcg(dt);
      if (pressed.has('menu')) { sfx.cursor(); return true; }
      if (cmd >= 0) {
        if (pressed.has('up') || pressed.has('down')) { cmd = (cmd + 1) % cmdList.length; sfx.cursor(); render(); }
        if (pressed.has('run')) { cmd = -1; render(); }
        if (pressed.has('action')) {
          const c = cmdList[cmd];
          const it = inv[cursor];
          cmd = -1;
          if (c === '調べる') message = ITEMS[it.id].desc;
          else message = onUse(it) || '';
          render();
        }
        return false;
      }
      let moved = false;
      if (pressed.has('left') || pressed.has('right')) { cursor ^= 1; moved = true; }
      if (pressed.has('up')) { cursor = (cursor + SLOTS - 2) % SLOTS; moved = true; }
      if (pressed.has('down')) { cursor = (cursor + 2) % SLOTS; moved = true; }
      if (moved) { message = ''; sfx.cursor(); render(); }
      if (pressed.has('run')) { sfx.cursor(); return true; }
      if (pressed.has('action') && inv[cursor]) {
        const def = ITEMS[inv[cursor].id];
        cmdList = def.equip ? ['調べる'] : ['使う', '調べる'];
        cmd = 0; message = ''; sfx.cursor(); render();
      }
      return false;
    },
    refresh() { render(); },
  };
}
