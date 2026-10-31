'use strict';
const $ = (id) => document.getElementById(id);

const LANE = {
  kick: ['キック', '#ff6a3d'], kick_punch: ['キック', '#ff6a3d'], snare: ['スネア', '#f2c14e'], clap: ['クラップ', '#e86aa8'],
  hat_closed: ['ハット閉', '#3dd6c6'], hat_open: ['ハット開', '#5aa9ff'], sub: ['サブ808', '#a58bff'], dive: ['ダイブ', '#a58bff'], bass: ['プラックベース', '#7a6bff'],
  tom_low: ['タム低', '#8bd450'], tom_high: ['タム高', '#6fc2a0'], shaker: ['シェイカー', '#d8d36a'], clave: ['クラーベ', '#e0915a'], conga: ['コンガ', '#e8c4ff'], snap: ['スナップ', '#7fd0e8'], rim: ['リム', '#ffb347'], cowbell: ['カウベル', '#c9a227'],
};
const GENRE = { trap: 'トラップ', drill: 'ドリル', boombap: 'ブーンバップ', perc: 'パーカッション', house: 'ハウス', techno: 'テクノ' };
// 横3 × 縦5。上が高い音、下が低い音。1行が1つの系統（高域・金属小物・手拍子・太鼓・低域）。[ジャンル, 音]
const PADS = [
  ['perc', 'shaker'], ['trap', 'hat_closed'], ['perc', 'clave'],
  ['perc', 'cowbell'], ['perc', 'rim'], ['perc', 'conga'],
  ['perc', 'snap'], ['trap', 'clap'], ['house', 'clap'],
  ['trap', 'snare'], ['perc', 'tom_high'], ['perc', 'tom_low'],
  ['perc', 'kick_punch'], ['perc', 'dive'], ['perc', 'bass'],
];
// 同時に鳴らさない組。ハットは閉が開を止める、サブは1音ずつ
const groupOf = (lane) => (lane === 'hat_closed' || lane === 'hat_open' ? 'hat' : lane === 'sub' || lane === 'dive' || lane === 'bass' ? 'sub' : null);

let ctx = null, master = null;
const buffers = new Array(PADS.length).fill(null);
const active = { hat: null, sub: null };

/* ---------- 音を鳴らす ---------- */
function fire(i, vel, when) {
  const buf = buffers[i];
  if (!buf) return;
  const lane = PADS[i][1], grp = groupOf(lane), t = Math.max(when, ctx.currentTime);
  if (grp && active[grp]) { try { active[grp].g.gain.setTargetAtTime(0, t, 0.005); active[grp].s.stop(t + 0.03); } catch (_) { /* 止まっている */ } }
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buf; g.gain.value = vel;
  s.connect(g); g.connect(master); s.start(t);
  if (grp) { const me = { s, g }; active[grp] = me; s.onended = () => { if (active[grp] === me) active[grp] = null; }; }
}
function click(when, accent) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = accent ? 1600 : 1100;
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.25, when + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.06);
}

/* ---------- ループ ---------- */
const loop = { running: false, recording: false, start: 0, scheduled: 0, layers: [], cur: null };
const bpm = () => Math.min(200, Math.max(60, Number($('bpm').value) || 120));
const beat = () => 60 / bpm();
const loopLen = () => Number($('bars').value) * 4 * beat();
const lookahead = 0.12;

function pos() { return loop.running ? (((ctx.currentTime - loop.start) % loopLen()) + loopLen()) % loopLen() : 0; }

function tick() {
  if (!loop.running) return;
  const len = loopLen(), now = ctx.currentTime, until = now + lookahead;
  const k0 = Math.floor((loop.scheduled - loop.start) / len);
  for (let k = Math.max(0, k0); loop.start + k * len < until; k++) {
    const base = loop.start + k * len;
    for (const layer of loop.layers) for (const e of layer) {
      const at = base + e.t;
      if (at >= loop.scheduled && at < until) fire(e.pad, e.vel, at);
    }
    if ($('metro').checked) {
      for (let b = 0; b < Number($('bars').value) * 4; b++) {
        const at = base + b * beat();
        if (at >= loop.scheduled && at < until) click(at, b % 4 === 0);
      }
    }
  }
  loop.scheduled = until;
}
setInterval(tick, 25);

function startLoop() {
  loop.start = ctx.currentTime + 0.05; loop.scheduled = loop.start; loop.running = true;
  $('play').classList.add('on'); $('play').textContent = '■ 停止';
}
function stopLoop() {
  loop.running = false; stopRec();
  $('play').classList.remove('on'); $('play').textContent = '▶ 再生'; $('posbar').style.width = '0';
}
function startRec() {
  if (!loop.running) startLoop();
  loop.recording = true; loop.cur = []; loop.layers.push(loop.cur);
  $('rec').classList.add('on'); $('rec').textContent = '● 録音中';
  msg('録音中。パッドを叩くと、ループの今の位置に入ります');
}
function stopRec() {
  if (!loop.recording) return;
  loop.recording = false;
  if (loop.cur && loop.cur.length === 0) loop.layers.pop();   // 何も叩かなかった層は残さない
  loop.cur = null;
  $('rec').classList.remove('on'); $('rec').textContent = '● 録音';
  msg(loop.layers.length ? `${loop.layers.length} 層。続けて ● で重ね録りできます` : '');
}
function record(i, vel, hitTime) {
  const len = loopLen();
  let t = (((hitTime - loop.start) % len) + len) % len;
  if ($('quant').checked) {
    const step = beat() / 4;                       // 16分音符
    t = (Math.round(t / step) * step) % len;
  }
  loop.cur.push({ t, pad: i, vel });
}

/* ---------- パッド ---------- */
function build() {
  const box = $('pads');
  PADS.forEach(([g, lane], i) => {
    const el = document.createElement('div');
    el.className = 'pad'; el.style.setProperty('--c', LANE[lane][1]); el.dataset.i = i;
    el.innerHTML = `<b>${LANE[lane][0]}</b><small>${GENRE[g]}</small>`;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!ctx) return;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* 合成イベントなど。鳴らす処理は続ける */ }
      const r = el.getBoundingClientRect();
      const vel = 1 - 0.5 * Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));   // 上ほど強く
      const now = ctx.currentTime;
      fire(i, vel, now);
      el.classList.add('on');
      if (loop.recording) record(i, vel, now);
    });
    const up = () => el.classList.remove('on');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    box.appendChild(el);
  });
}
async function load() {
  await Promise.all(PADS.map(async ([g, lane], i) => {
    const r = await fetch(`samples/${g}-${lane}.wav`);
    buffers[i] = await ctx.decodeAudioData(await r.arrayBuffer());
  }));
}

/* ---------- つなぎ ---------- */
let msgTimer = null;
function msg(t) { $('msg').textContent = t; clearTimeout(msgTimer); if (t) msgTimer = setTimeout(() => { $('msg').textContent = ''; }, 4000); }

function frame() {
  if (loop.running) $('posbar').style.width = (pos() / loopLen() * 100) + '%';
  requestAnimationFrame(frame);
}

async function begin() {
  $('startbtn').disabled = true; $('startbtn').textContent = '読み込み中…';
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  await ctx.resume();
  try { await load(); } catch (e) { msg('音の読み込みに失敗しました: ' + e); }
  $('start').classList.add('hide');
}

build();
$('startbtn').onclick = begin;
$('play').onclick = () => (loop.running ? stopLoop() : startLoop());
$('rec').onclick = () => (loop.recording ? stopRec() : startRec());
$('undo').onclick = () => {
  if (loop.recording) stopRec();
  if (loop.layers.pop()) msg(`1つ戻しました（残り ${loop.layers.length} 層）`);
};
$('clear').onclick = () => { stopRec(); loop.layers = []; msg('録音を全部消しました'); };
['bpm', 'bars'].forEach((id) => $(id).addEventListener('change', () => {
  // 長さやテンポを変えると録音の位置がずれるので、録音は消す
  if (loop.layers.length) { loop.layers = []; stopRec(); msg('テンポか小節数を変えたので、録音を消しました'); }
  if (loop.running) { loop.start = ctx.currentTime + 0.05; loop.scheduled = loop.start; }
}));
document.addEventListener('contextmenu', (e) => e.preventDefault());
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
requestAnimationFrame(frame);
