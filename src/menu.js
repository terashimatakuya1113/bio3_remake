// ステータス画面：原作の配置に合わせる
// 左上＝アイテムの 3D 表示窓とコマンド、右上＝MAP/FILE/RADIO/EXIT、右＝アイテム欄、
// 左下＝顔・心電図・装備中の武器、最下段＝アイテム名とメッセージ
export const ITEMS = {
  knife: { name: 'ナイフ', desc: 'UBCS 支給のコンバットナイフ。\n弾はいらないが、近づかないと届かない。', equip: true },
  handgun: { name: 'ハンドガン', desc: '9mm 口径の自動拳銃。\n装弾数は 15 発。', equip: true },
  shotgun: { name: 'ショットガン', desc: '警備員用のポンプ式散弾銃。\n近いほど威力が高く、まとめてなぎ倒せる。装弾数 7 発。', equip: true },
  magnum: { name: 'マグナム', desc: '所長の大型リボルバー。\n一発の威力は桁違いで、並んだ敵も貫く。装弾数 6 発。', equip: true },
  ammo: { name: 'ハンドガンの弾', desc: 'ハンドガン用の 9mm 弾。\nハンドガンと組み合わせると装填できる。', stack: true },
  shells: { name: 'ショットガンの弾', desc: '12 ゲージの散弾。\nショットガンと組み合わせると装填できる。', stack: true },
  magnumAmmo: { name: 'マグナムの弾', desc: '.44 マグナム弾。\nマグナムと組み合わせると装填できる。', stack: true },
  key: { name: '事務所の鍵', desc: '「管理事務所」と書かれた札がついた鍵。\n表の扉の鍵らしい。' },
  herb: { name: '応急パック', desc: '包帯と消毒液、鎮痛剤のセット。\n救急隊の手つきなら、体力をかなり戻せる。' },
  card: { name: '冷蔵倉庫のカードキー', desc: '「冷蔵倉庫　入室許可」と印字された磁気カード。\n血で汚れている。' },
  radioKey: { name: '無線室の鍵', desc: '赤い札に「無線室　所長」と書かれた鍵。\nエマから預かった。' },
  gateKey: { name: '貨物ヤードの鍵', desc: '真鍮の大きな鍵。\n札には「ヤード門　第2」とある。' },
  photo: { name: 'ダニーの写真', desc: '相棒のダニーと、救急車の前で撮った写真。\n…今は見ないでおこう。' },
};

const SLOTS = 8;
const TABS = ['MAP', 'FILE', 'RADIO', 'EXIT'];
const TAB_TEXT = {
  MAP: 'この辺りの地図は持っていない。',
  FILE: 'ファイルはまだ一冊もない。',
  RADIO: 'ザーッ…………\nノイズしか聞こえない。',
};
let tabText = (t) => TAB_TEXT[t];

// ---- アイテム欄の小さな絵（1 ドット = 画面の 1 ピクセル） ----
const ICON_W = 34, ICON_H = 26;
function icon(id) {
  const c = document.createElement('canvas');
  c.width = ICON_W; c.height = ICON_H;
  const g = c.getContext('2d');
  const r = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const poly = (col, pts) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.fill(); };
  if (id === 'knife') {
    r('#1c1a18', 4, 12, 9, 4); r('#3a3a3e', 13, 10, 2, 8);
    poly('#b8bcc4', [[15, 11], [28, 12], [31, 14], [15, 16]]);
    r('#e8ecf4', 15, 11, 13, 1);
  } else if (id === 'shotgun') {
    r('#5a3c26', 1, 12, 9, 6); r('#3a2818', 1, 17, 7, 2);
    r('#2e3034', 9, 11, 7, 5); r('#26282c', 15, 10, 18, 3);
    r('#4a3424', 17, 13, 9, 3); r('#2e3034', 11, 16, 2, 4);
    r('#6a6e76', 15, 10, 18, 1);
  } else if (id === 'magnum') {
    r('#9aa0aa', 13, 7, 18, 3); r('#d0d4dc', 13, 7, 18, 1);
    r('#7a808a', 9, 6, 7, 7); r('#5a606a', 10, 8, 5, 1); r('#5a606a', 10, 10, 5, 1);
    poly('#3a2a1e', [[7, 12], [12, 12], [10, 22], [5, 22]]);
    r('#2a2c30', 12, 13, 5, 1); r('#2a2c30', 16, 11, 1, 3);
  } else if (id === 'shells' || id === 'magnumAmmo') {
    const box = id === 'shells' ? ['#7a1a14', '#a8281c'] : ['#1e2a4a', '#2e4278'];
    r('#1a1a1a', 6, 11, 23, 12); r(box[1], 6, 10, 22, 12); r(box[0], 6, 18, 22, 4);
    r('#e8d8a0', 9, 13, 8, 2);
    for (let i = 0; i < 5; i++) {
      if (id === 'shells') { r('#c02818', 8 + i * 4, 4, 3, 6); r('#c8a040', 8 + i * 4, 8, 3, 2); }
      else { r('#c8a040', 8 + i * 4, 5, 3, 5); r('#8a8a8a', 8 + i * 4, 4, 3, 1); }
    }
  } else if (id === 'handgun') {
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
    r('#6a665c', 6, 9, 23, 14);
    r('#e8e4d8', 6, 8, 22, 13);
    r('#c8c4b4', 6, 19, 22, 2);
    r('#c01810', 15, 10, 4, 9); r('#c01810', 12, 13, 10, 3);
    r('#3a3a3a', 13, 5, 8, 3); r('#e8e4d8', 15, 6, 4, 2);
  } else if (id === 'card') {
    r('#1a1a1c', 5, 8, 25, 15);
    r('#d8dce0', 5, 7, 24, 15);
    r('#2a4a8a', 5, 7, 24, 4);
    r('#111', 5, 17, 24, 2);
    r('#d8b040', 8, 12, 5, 4);
    r('#555', 15, 12, 11, 1); r('#555', 15, 14, 8, 1);
    r('#8a1010', 20, 18, 6, 3); r('#8a1010', 23, 9, 3, 2);
  } else if (id === 'radioKey' || id === 'gateKey') {
    const col = id === 'gateKey' ? '#b89a50' : '#a8a8a0', hi = id === 'gateKey' ? '#f0d890' : '#e0e0d8';
    g.strokeStyle = col; g.lineWidth = 2;
    g.beginPath(); g.arc(9, 9, 4, 0, 7); g.stroke();
    r(col, 13, 8, 15, 2);
    r(col, 21, 10, 2, 3); r(col, 25, 10, 2, 4);
    r(hi, 14, 8, 13, 1);
    const tag = id === 'gateKey' ? '#3a5a8a' : '#a02018';
    r(tag, 3, 15, 11, 8); r('#e8e0d0', 5, 17, 7, 1); r('#e8e0d0', 5, 19, 5, 1);
  } else if (id === 'photo') {
    r('#1a1a1a', 7, 6, 21, 17);
    r('#e8e4d8', 6, 5, 21, 17);
    r('#3a4a5a', 8, 7, 17, 11);
    r('#c8a080', 12, 9, 3, 3); r('#c8a080', 19, 9, 3, 3);
    r('#3a4a66', 11, 12, 5, 6); r('#3a4a66', 18, 12, 5, 6);
    r('#e8e8e8', 8, 15, 17, 3); r('#c01810', 14, 16, 4, 1);
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
    <div class="mx m-equip" style="${at(150, 135, 52, 46)}"><span class="arrow"></span><img id="m-equip-img" src="${ICONS.handgun}" alt=""><b id="m-equip-ammo">10</b></div>
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
    const W = player.weapon;
    el('#m-equip-ammo').textContent = W === 'knife' ? '' : player.loaded[W];
    el('#m-equip-img').src = ICONS[W];
    let html = '';
    for (let i = 0; i < SLOTS; i++) {
      const it = inv[i];
      const cls = ['slot'];
      if ((mode === 'items' || mode === 'cmd' || mode === 'combine') && i === cursor) cls.push('sel');
      if (mode === 'combine' && i === from) cls.push('from');
      let inner = '';
      if (it) {
        const count = player.loaded[it.id] ?? (ITEMS[it.id].stack ? it.count : null);
        inner = `<img src="${ICONS[it.id]}" alt="">${count != null ? `<b>${count}</b>` : ''}${it.id === player.weapon ? '<em>E</em>' : ''}`;
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
    const pair = { ammo: 'handgun', shells: 'shotgun', magnumAmmo: 'magnum' };
    for (const [x, y] of [[a, b], [b, a]]) if (pair[x.id] === y.id) return onUse(x) || '';
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
    open(inventory, p, use, tabs) {
      inv = inventory; player = p; onUse = use;
      if (tabs) tabText = tabs;
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
          else if (c === '装備') say(onUse(it));
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
          say(tabText(TABS[tab])); render();
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
