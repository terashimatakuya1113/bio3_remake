// ステータス画面：原作の配置に合わせる
// 左上＝アイテムの 3D 表示窓とコマンド、右上＝MAP/FILE/RADIO/EXIT、右＝アイテム欄、
// 左下＝顔・心電図・装備中の武器、最下段＝アイテム名とメッセージ
export const ITEMS = {
  handgun: { name: 'ハンドガン', desc: '9mm 口径の自動拳銃。\n装弾数は 15 発。', equip: true },
  ammo: { name: 'ハンドガンの弾', desc: 'ハンドガン用の 9mm 弾。\nハンドガンと組み合わせると装填できる。', stack: true },
  key: { name: '事務所の鍵', desc: '「管理事務所」と書かれた札がついた鍵。\n表の扉の鍵らしい。' },
  herb: { name: 'グリーンハーブ', desc: 'この地方に自生する薬草。\n体力を回復する。' },
};

const SLOTS = 8;
const TABS = ['MAP', 'FILE', 'RADIO', 'EXIT'];
const TAB_TEXT = {
  MAP: 'この辺りの地図は持っていない。',
  FILE: 'ファイルはまだ一冊もない。',
  RADIO: 'ザーッ…………\nノイズしか聞こえない。',
};

// ---- アイテム欄の小さな絵（1 ドット = 画面の 1 ピクセル） ----
const ICON_W = 34, ICON_H = 26;
function icon(id) {
  const c = document.createElement('canvas');
  c.width = ICON_W; c.height = ICON_H;
  const g = c.getContext('2d');
  const r = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const poly = (col, pts) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.fill(); };
  if (id === 'handgun') {
    poly('#1a1a1c', [[9, 12], [15, 12], [13, 23], [6, 23]]);
    poly('#3a2e24', [[10, 13], [14, 13], [12.5, 21], [7.5, 21]]);
    r('#2c2e32', 6, 10, 22, 3);
    r('#5a5e66', 5, 6, 25, 5);
    r('#8a909a', 5, 6, 25, 1);
    r('#1a1a1c', 12, 7, 6, 2);
    r('#2c2e32', 15, 13, 7, 1); r('#2c2e32', 21, 11, 1, 3);
    r('#111', 17, 12, 1, 2);
    r('#111', 29, 7, 1, 3); r('#111', 4, 6, 2, 3);
  } else if (id === 'ammo') {
    r('#3e3420', 6, 11, 23, 12);
    r('#a89464', 6, 10, 22, 12);
    r('#8a1c12', 6, 14, 22, 4);
    r('#e8d8a0', 9, 15, 6, 2);
    r('#6a5a3a', 27, 10, 1, 12);
    for (let i = 0; i < 6; i++) { r('#c8a040', 8 + i * 3, 5, 2, 5); r('#9a6030', 8 + i * 3, 4, 2, 1); r('#f0d890', 8 + i * 3, 6, 1, 3); }
  } else if (id === 'key') {
    g.strokeStyle = '#d0a848'; g.lineWidth = 2;
    g.strokeRect(5, 4, 7, 7);
    r('#d0a848', 12, 7, 15, 2);
    r('#d0a848', 21, 9, 2, 3); r('#d0a848', 25, 9, 2, 4);
    r('#f0d890', 13, 7, 13, 1);
    r('#5a4a34', 6, 11, 1, 5);
    r('#e0d8c0', 2, 16, 10, 7);
    r('#9a2418', 2, 16, 10, 1); r('#9a2418', 2, 22, 10, 1);
    r('#555', 4, 18, 6, 1); r('#555', 4, 20, 5, 1);
  } else if (id === 'herb') {
    r('#8a4a28', 12, 17, 10, 7);
    r('#a85c34', 11, 16, 12, 2);
    r('#5a2e18', 13, 23, 8, 1);
    const leaf = (x, y, w, h, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill(); };
    leaf(11, 11, 5, 2.5, '#3a7a26'); leaf(23, 11, 5, 2.5, '#3a7a26');
    leaf(14, 7, 4, 2.5, '#4a9a30'); leaf(20, 7, 4, 2.5, '#4a9a30');
    leaf(17, 4, 2.5, 3, '#5aae3a');
    r('#2e5a1c', 16, 8, 2, 9);
  }
  return c.toDataURL();
}
const ICONS = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, icon(id)]));

// 320x240 の座標で置く
const at = (x, y, w, h) => `left:calc(var(--u)*${x});top:calc(var(--u)*${y});width:calc(var(--u)*${w});height:calc(var(--u)*${h})`;
const bolts = '<i class="bolt tl"></i><i class="bolt tr"></i><i class="bolt bl"></i><i class="bolt br"></i>';

function layout() {
  return `
    <div class="mx frame" style="${at(26, 14, 120, 118)}">${bolts}<div class="hole"></div></div>
    <div class="mx m-cmds" style="${at(150, 56, 52, 60)}"><div id="m-cmds"></div></div>
    <div class="mx m-tabs" style="${at(208, 14, 80, 32)}">${TABS.map((t) => `<span data-tab="${t}">${t}</span>`).join('')}</div>
    <div class="mx m-grid" style="${at(208, 50, 80, 150)}"><div id="m-items"></div></div>
    <div class="mx frame face" style="${at(31, 137, 38, 44)}"><div class="hole"></div></div>
    <div class="mx m-ecg" id="m-cond" style="${at(72, 137, 74, 44)}"><span class="ecg-label">ECG</span><canvas id="ecg" width="60" height="29"></canvas><span id="m-cond-text">Fine</span></div>
    <div class="mx m-equip" style="${at(150, 135, 52, 46)}"><span class="arrow"></span><img src="${ICONS.handgun}" alt=""><b id="m-equip-ammo">10</b></div>
    <div class="mx m-name" id="m-name" style="${at(34, 184, 170, 16)}"></div>
    <div class="mx m-bar" style="${at(22, 204, 278, 30)}"><div id="m-desc"></div></div>`;
}

export function createMenu(root) {
  root.innerHTML = layout();
  const el = (id) => root.querySelector(id);
  const ecg = el('#ecg');
  const g = ecg.getContext('2d');
  const items = el('#m-items');
  const desc = el('#m-desc');
  const cmds = el('#m-cmds');
  const name = el('#m-name');
  const tabs = [...root.querySelectorAll('[data-tab]')];
  let inv = [], player = null, onUse = null;
  let mode = 'items', cursor = 0, tab = 3, cmd = 0, cmdList = [], from = -1, message = '', inspect = false;
  let ecgX = 0, ecgT = 0, ecgPrev = null, blinkT = 0;

  const level = (h) => (h >= 66 ? 'fine' : h >= 33 ? 'caution' : 'danger');
  const say = (m) => { message = m || ''; inspect = false; };

  function render() {
    const lv = level(player.health);
    el('#m-cond-text').textContent = { fine: 'Fine', caution: 'Caution', danger: 'Danger' }[lv];
    el('#m-cond').dataset.level = lv;
    el('#m-equip-ammo').textContent = player.ammo;
    let html = '';
    for (let i = 0; i < SLOTS; i++) {
      const it = inv[i];
      const cls = ['slot'];
      if ((mode === 'items' || mode === 'cmd' || mode === 'combine') && i === cursor) cls.push('sel');
      if (mode === 'combine' && i === from) cls.push('from');
      let inner = '';
      if (it) {
        const count = it.id === 'handgun' ? player.ammo : ITEMS[it.id].stack ? it.count : null;
        inner = `<img src="${ICONS[it.id]}" alt="">${count != null ? `<b>${count}</b>` : ''}${ITEMS[it.id].equip ? '<em>E</em>' : ''}`;
      }
      html += `<div class="${cls.join(' ')}">${inner}</div>`;
    }
    items.innerHTML = html;
    tabs.forEach((t, i) => t.classList.toggle('sel', mode === 'tabs' && i === tab));
    const cur = inv[cursor];
    name.textContent = mode === 'tabs' ? TABS[tab] : cur ? ITEMS[cur.id].name : '';
    desc.textContent = message;
    cmds.innerHTML = (mode === 'cmd' ? cmdList : ['装備', '調べる', '組合せ'])
      .map((c, i) => `<span class="${mode === 'cmd' ? (i === cmd ? 'sel' : '') : 'off'}">${c}</span>`).join('');
  }

  // 心電図：左から右へ書き進み、少し先を消していくモニター表示
  function drawEcg(dt) {
    const lv = level(player.health);
    const color = { fine: '#58f058', caution: '#f0d040', danger: '#f04838' }[lv];
    const bpm = { fine: 66, caution: 96, danger: 132 }[lv];
    const W = ecg.width, H = ecg.height;
    const steps = Math.max(1, Math.round(dt * 40));
    for (let s = 0; s < steps; s++) {
      ecgT += 1 / 40;
      const beat = (ecgT * bpm / 60) % 1;
      let y = 0;
      if (beat < 0.08) y = Math.sin(beat / 0.08 * Math.PI) * 0.1;
      else if (beat > 0.14 && beat < 0.17) y = -0.2;
      else if (beat >= 0.17 && beat < 0.2) y = 1.0;
      else if (beat >= 0.2 && beat < 0.23) y = -0.45;
      else if (beat > 0.36 && beat < 0.5) y = Math.sin((beat - 0.36) / 0.14 * Math.PI) * 0.22;
      const py = Math.round(H * 0.64 - y * H * 0.5);
      clearCol((ecgX + 1) % W);
      clearCol((ecgX + 2) % W);
      g.fillStyle = color;
      if (ecgPrev != null && ecgX > 0) {
        const a = Math.min(ecgPrev, py), b = Math.max(ecgPrev, py);
        g.fillRect(ecgX, a, 1, b - a + 1);
      } else g.fillRect(ecgX, py, 1, 1);
      ecgPrev = py;
      ecgX = (ecgX + 1) % W;
    }
  }
  function clearCol(x) {
    const H = ecg.height;
    g.fillStyle = '#062010'; g.fillRect(x, 0, 1, H);
    g.fillStyle = '#0d3a1c';
    if (x % 6 === 0) g.fillRect(x, 0, 1, H);
    for (let y = 1; y < H; y += 6) g.fillRect(x, y, 1, 1);
  }

  function openCommands() {
    const it = inv[cursor];
    if (!it) return false;
    cmdList = ITEMS[it.id].equip ? ['装備', '調べる', '組合せ'] : ['使う', '調べる', '組合せ'];
    mode = 'cmd'; cmd = 0;
    return true;
  }

  function combine(a, b) {
    const ids = [a.id, b.id].sort().join('+');
    if (ids === 'ammo+handgun') return onUse(a.id === 'ammo' ? a : b) || '';
    return 'その組み合わせはできない。';
  }

  function moveGrid(pressed) {
    let moved = false;
    if (pressed.has('left') || pressed.has('right')) { cursor ^= 1; moved = true; }
    if (pressed.has('down') && cursor < SLOTS - 2) { cursor += 2; moved = true; }
    if (pressed.has('up')) {
      if (cursor >= 2) cursor -= 2;
      else if (mode === 'items') { mode = 'tabs'; tab = 2 + cursor; }
      moved = true;
    }
    return moved;
  }

  return {
    open(inventory, p, use) {
      inv = inventory; player = p; onUse = use;
      mode = 'items'; cursor = 0; from = -1; say('');
      ecgX = 0; ecgPrev = null;
      for (let x = 0; x < ecg.width; x++) clearCol(x);
      root.hidden = false;
      render();
    },
    close() { root.hidden = true; },
    // 3D 表示窓に出すアイテム
    view() {
      if (mode === 'tabs') return { id: null, inspect: false };
      const it = inv[mode === 'combine' ? cursor : cursor];
      return { id: it ? it.id : null, inspect };
    },
    // 戻り値が true なら画面を閉じる
    update(dt, pressed, sfx) {
      drawEcg(dt);
      blinkT += dt;
      root.classList.toggle('blink-on', blinkT % 0.5 < 0.3);
      if (pressed.has('menu')) { sfx.cursor(); return true; }

      if (mode === 'cmd') {
        if (pressed.has('up')) { cmd = (cmd + cmdList.length - 1) % cmdList.length; sfx.cursor(); render(); }
        if (pressed.has('down')) { cmd = (cmd + 1) % cmdList.length; sfx.cursor(); render(); }
        if (pressed.has('run')) { mode = 'items'; sfx.cursor(); render(); }
        if (pressed.has('action')) {
          const c = cmdList[cmd];
          const it = inv[cursor];
          mode = 'items';
          sfx.cursor();
          if (c === '調べる') { message = ITEMS[it.id].desc; inspect = true; }
          else if (c === '装備') say(`${ITEMS[it.id].name}を装備している。`);
          else if (c === '組合せ') { mode = 'combine'; from = cursor; say('何と組み合わせますか？'); }
          else say(onUse(it));
          if (cursor >= inv.length) cursor = Math.max(0, inv.length - 1);
          render();
        }
        return false;
      }

      if (mode === 'tabs') {
        let moved = false;
        if (pressed.has('left') || pressed.has('right')) { tab ^= 1; moved = true; }
        if (pressed.has('up') && tab >= 2) { tab -= 2; moved = true; }
        if (pressed.has('down')) {
          if (tab < 2) tab += 2;
          else { mode = 'items'; cursor = tab - 2; }
          moved = true;
        }
        if (moved) { say(''); sfx.cursor(); render(); }
        if (pressed.has('run')) { sfx.cursor(); return true; }
        if (pressed.has('action')) {
          sfx.cursor();
          if (TABS[tab] === 'EXIT') return true;
          say(TAB_TEXT[TABS[tab]]); render();
        }
        return false;
      }

      if (mode === 'combine') {
        if (moveGrid(pressed)) { sfx.cursor(); render(); }
        if (pressed.has('run')) { mode = 'items'; cursor = from; from = -1; say(''); sfx.cursor(); render(); }
        if (pressed.has('action')) {
          sfx.cursor();
          const a = inv[from], b = inv[cursor];
          mode = 'items';
          if (b && cursor !== from) say(combine(a, b));
          else say('');
          from = -1;
          if (cursor >= inv.length) cursor = Math.max(0, inv.length - 1);
          render();
        }
        return false;
      }

      if (moveGrid(pressed)) { say(''); sfx.cursor(); render(); }
      if (pressed.has('run')) { sfx.cursor(); return true; }
      if (pressed.has('action') && openCommands()) { say(''); sfx.cursor(); render(); }
      return false;
    },
    refresh() { render(); },
  };
}
