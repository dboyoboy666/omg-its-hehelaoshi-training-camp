/* =====================================================================
   铸铭问鼎论英雄 · p6 彩蛋关卡 1「点兵点将」（V3.2：四关三档改造，2026-10-08 何何老师定稿）
   ---------------------------------------------------------------------
   玩法（综合运用：识+辨）：
   · 三档难度（关卡页芯片自选，独立于主线难度）——
     菜鸟：3/6/9 三关 · 无答题限时 · 字消后 Ready→3→2→1→Go 五步倒计时（共 5 秒思考）
     困难：6/9/12 三关（12 字=新增第四关）· 同款五步倒计时共 3 秒 · 答题限时 8/12/16 秒
     梦魇：6/9/12 三关 · 只跳 Go! Go! Go!（共 1 秒）· 答题限时 6/9/12 秒
   · 军阵每秒亮一字、同屏累积列阵、N 字 N 秒全体隐去 → 倒计时特效（火焰大字：
     瞬间放大 3 倍→缩回原大→消失）→ Go 后换位军阵现身（限时档同步起倒计时条+音效）
   · 点将盖序号（可撤销压实）；限时档超时=按已点自动判定（严格按限时内实际点选计分）；
     确定可提前交卷。计分：答对序位 × DIAN_PT(10) 分（V3.2 全档统一 10 分/字，原 26 分 retired）
   · 双人分屏：同题同字同乱序；确认键分立中缝两侧垂直居中；真分屏独立推进
     （倒计时特效也在各自半屏内居中，互不遮掩）
   · 结算按惯例：爬榜动画 + 头衔/颁奖词（按档满分折算）+ 点兵榜（按难度分档）；
     **New Winner**：本局玩家新进该难度点兵榜前三（替换了原坐者）→ "New Winner" 火焰大字
     + 全屏玫瑰花瓣 3 秒（结算页一次性播报）
   · 旧档迁移：V3.1 及更早的点兵记录无 diff 字段 → 视作菜鸟档
   ===================================================================== */
const DIAN_PT = 10;   /* 每个答对位置的分值（V3.2 何何老师定稿：全档统一 10 分/字，V3 的 26 分退役） */
/* 三档模型（数据驱动：轮数/倒计时/限时全部从这张表读，新增难度只加一项） */
const DIAN_CDN_READY = ['Ready...', '3', '2', '1', 'Go!'];
const DIAN_TIERS = {
  rookie: { label: '菜鸟', icon: '🪶', rounds: [3, 6, 9],
    cdn: DIAN_CDN_READY, cdnMs: 1000, limits: null,
    desc: '3/6/9 三关 · 答题不限时 · 字消后 Ready→3→2→1→Go 五步倒计时共 5 秒，供回忆思考' },
  hard: { label: '困难', icon: '⚔️', rounds: [6, 9, 12],
    cdn: DIAN_CDN_READY, cdnMs: 600, limits: { 6: 8, 9: 12, 12: 16 },
    desc: '6/9/12 三关（12 字新关）· 同款倒计时共 3 秒 · 答题限时 8/12/16 秒' },
  nightmare: { label: '梦魇', icon: '💀', rounds: [6, 9, 12],
    cdn: ['Go! Go! Go!'], cdnMs: 1000, limits: { 6: 6, 9: 9, 12: 12 },
    desc: '6/9/12 三关 · 只跳 Go! Go! Go! 共 1 秒即开 · 答题限时 6/9/12 秒' }
};
const DIAN_DIFF_KEY_DEFAULT = 'rookie';
function dianMaxOf(key) { return DIAN_TIERS[key].rounds.reduce((a, b) => a + b, 0) * DIAN_PT; }
let DIAN = null, DIAN2 = null, DIAN_LAST = null;
let DIAN_DIFF_KEY = DIAN_DIFF_KEY_DEFAULT;   /* 点兵点将自选难度（独立于主线 CUR.diff，互不干扰） */

/* ---------- 数据层 ---------- */
function betterDian(a, b) { return a.score > b.score || (a.score === b.score && a.time < b.time); }
function dianStore() {
  DB.eggRec = DB.eggRec || {};
  DB.eggRec.dian = DB.eggRec.dian || {};
  if (!Array.isArray(DB.eggRec.dian.solo)) DB.eggRec.dian.solo = [];
  if (!Array.isArray(DB.eggRec.dian.duo)) DB.eggRec.dian.duo = [];
  return DB.eggRec.dian;
}
/* 出题：三关字互不重复（3+6+9=18 ≤ 35）；相似对优先成对混入 —— 近似字同场，
   记忆的同时必须辨认同形近字（综合运用之意）。断言只查互异+在库，不写死具体字 */
function dianPickChars(n) {
  const taken = [];
  const heads = shuffle(Object.keys(SIMILAR).filter(c => CHARS.indexOf(c) >= 0 && SIMILAR[c] && SIMILAR[c].length));
  for (const h of heads) {
    if (taken.length + 2 > n) break;
    if (taken.indexOf(h) >= 0) continue;
    const p = SIMILAR[h].find(x => CHARS.indexOf(x) >= 0 && taken.indexOf(x) < 0);
    if (p) taken.push(h, p);
  }
  shuffle(CHARS.filter(c => taken.indexOf(c) < 0)).slice(0, n - taken.length).forEach(c => taken.push(c));
  return shuffle(taken).slice(0, n);
}
/* 强制非原排列的洗牌（3 字时恒等排列概率 1/6，会让该关白给） */
function dianShuffleOff(arr) {
  for (let g = 0; g < 20; g++) {
    const s = shuffle(arr);
    if (s.some((c, i) => c !== arr[i])) return s;
  }
  return arr.slice().reverse();
}
function dianSideState() {
  return { ri: 0, phase: 'mem', step: 0, clicks: [], score: 0, per: [], lastHits: 0, marks: {}, done: false, tLeft: 0, barIv: null };
}

/* ---------- 单人开局 ---------- */
function dianStartSolo() {
  const tier = DIAN_TIERS[DIAN_DIFF_KEY] || DIAN_TIERS.rookie;
  const chars = dianPickChars(tier.rounds.reduce((a, b) => a + b, 0));
  let off = 0;
  DIAN = {
    mode: 'solo', name: curPlayer(), tier: DIAN_DIFF_KEY,
    rounds: tier.rounds.map(n => {
      const seq = chars.slice(off, off + n); off += n;
      return { seq, off: dianShuffleOff(seq), n };
    }),
    score: 0, per: [], t0: Date.now(), saved: false, done: false
  };
  Object.assign(DIAN, dianSideState());
  go(P_DIAN);   /* go → renderDianHome 检测到 DIAN 会话 → 直接进第一关军阵 */
}
/* ---------- 双人开局（同题同字同乱序：rounds 建一份，两侧状态共享同一引用） ---------- */
function dianStartDuo() {
  const a = ($('dianA').value || '').trim() || '将军甲';
  const b = ($('dianB').value || '').trim() || '将军乙';
  if (a === b) { toast('两位将军不能同名（战报按名字区分）', true); return; }
  const tier = DIAN_TIERS[DIAN_DIFF_KEY] || DIAN_TIERS.rookie;
  const chars = dianPickChars(tier.rounds.reduce((a, b) => a + b, 0));
  let off = 0;
  const rounds = tier.rounds.map(n => {
    const seq = chars.slice(off, off + n); off += n;
    return { seq, off: dianShuffleOff(seq), n };
  });
  DIAN2 = {
    mode: 'duo', names: [a, b], rounds, tier: DIAN_DIFF_KEY,
    /* 侧状态必须自带 rounds 引用（与 solo 的 DIAN 同构）：dianScheduleMem/dianHalfHTML
       统一从 st.rounds 取题 —— 双侧引用同一数组即天然"同题同字同乱序" */
    L: Object.assign(dianSideState(), { rounds, tier: DIAN_DIFF_KEY }),
    R: Object.assign(dianSideState(), { rounds, tier: DIAN_DIFF_KEY }),
    t0: Date.now(), done: false, saved: false
  };
  go(P_DIANPK);   /* go → renderDianPkIdle 检测到 DIAN2 → 双半屏同列阵 */
}

/* ---------- 落地页 / 冷启动守卫（go(i) 必须能独立渲染每一页） ---------- */
function renderDianHome() {
  const s = $('s14');
  if (DIAN && !DIAN.done) { dianRenderStage('solo'); return; }
  const tKey = DIAN_TIERS[DIAN_DIFF_KEY] ? DIAN_DIFF_KEY : DIAN_DIFF_KEY_DEFAULT;
  const t = DIAN_TIERS[tKey];
  s.innerHTML = `
  <div class="duoForm">
    <div class="h1">⛺ 点 兵 点 将</div>
    <div class="sub">沙场点兵 —— 大篆军阵眨眼即散，凭记忆按原次序点将归位！每字 <b>${DIAN_PT}</b> 分，按答对位置计分</div>
    <div class="panel dianRules">
      <b>选难度</b>（三档独立榜单，实力分开比）：
      <span class="chip ${tKey === 'rookie' ? 'on' : ''}" data-tier="rookie">🪶 菜鸟</span>
      <span class="chip ${tKey === 'hard' ? 'on' : ''}" data-tier="hard">⚔️ 困难</span>
      <span class="chip ${tKey === 'nightmare' ? 'on' : ''}" data-tier="nightmare">💀 梦魇</span>
      <div class="tierDesc" id="dianTierDesc">>> ${esc(t.desc)}</div>
      <b>玩法</b>：军阵<b>每秒亮出一字、同屏列阵</b>，计时一到<b>全体隐去</b>；隐去瞬间倒计时特效（<b>Ready→3→2→1→Go</b>）供回忆思考，
      随后同一批字换位重排 —— 按<b>刚才的次序</b>依次点选，每点一字盖上序号，点「确定」判定（限时档超时按已点自动判定）。
      近似字混编入阵，认字 + 记序缺一不可！
    </div>
    <button class="btn gold" id="btnDianSolo">⛺ 单人点将</button>
    <div class="vsRow dianVsRow">
      <input id="dianA" maxlength="8" placeholder="左营·将军甲" value="${esc(DIAN2 ? DIAN2.names[0] : '')}">
      <span style="font-size:26px;font-weight:900;color:var(--gold-hi)">VS</span>
      <input id="dianB" maxlength="8" placeholder="右营·将军乙" value="${esc(DIAN2 ? DIAN2.names[1] : '')}">
      <button class="btn" id="btnDianDuo">⚔️ 双人分屏 PK</button>
    </div>
    <div class="footNote">单人成绩以封面「参赛名字」入榜；双人 PK 同题同字同乱序，先答完者自行进入下一关。</div>
  </div>`;
  s.querySelectorAll('[data-tier]').forEach(c => c.onclick = () => {
    DIAN_DIFF_KEY = c.dataset.tier;
    sndSeal();
    renderDianHome();
  });
  $('btnDianSolo').onclick = dianStartSolo;
  $('btnDianDuo').onclick = dianStartDuo;
}
function renderDianPkIdle() {
  const s = $('s15');
  if (DIAN2 && !DIAN2.done) { dianRenderStage('duo'); return; }
  s.innerHTML = `<div class="boardEmpty" style="padding:60px 0">还没有开战 —— 先去点兵点将营地报名。<br>
    <button class="btn" id="btnDianIdleGo" style="margin-top:14px">⛺ 去点兵点将</button></div>`;
  $('btnDianIdleGo').onclick = () => go(P_DIAN);
}
function dianStateOf(side) { return side === 'M' ? DIAN : (DIAN2 && DIAN2[side]); }
function dianActiveOf(side) { return side === 'M' ? DIAN : DIAN2; }

/* ---------- 舞台渲染（solo=单半屏 M / duo=左右半屏，同一套状态机） ---------- */
function dianRenderStage(kind) {
  const s = kind === 'solo' ? $('s14') : $('s15');
  if (kind === 'solo') {
    s.innerHTML = `<div class="dianStage"><div class="dianHalf" id="dh_M"></div></div>`;
    dianRenderHalf('M');
  } else {
    s.innerHTML = `
    <div class="dianStage">
      <div class="dianBanner">⚔️ 双人点将 PK · 同题同字同乱序 —— 各自按次序点将，先答完者点「下一关」立即前进，无需等对手</div>
      <div class="dianPk">
        <div class="dianHalf" id="dh_L"></div>
        <div class="dianDivider"></div>
        <div class="dianHalf" id="dh_R"></div>
      </div>
    </div>`;
    dianRenderHalf('L'); dianRenderHalf('R');
  }
}
function dianHalfHTML(side, st) {
  const r = st.ri, round = st.rounds[r], n = round.n, ph = st.phase, isDuo = side !== 'M';
  const tier = DIAN_TIERS[st.tier] || DIAN_TIERS.rookie;
  const limit = tier.limits ? tier.limits[n] : null;   /* 该关答题限时（秒）；菜鸟=null 不限时 */
  const name = isDuo ? DIAN2.names[side === 'L' ? 0 : 1] : st.name;
  const cells = ph === 'mem'
    ? Array.from({ length: n }, () => dianCellHTML('', ''))
    : round.off.map(ch => dianCellHTML(ch, 'lit stamped ' + (st.marks[ch] || ''), st.clicks.indexOf(ch) + 1));
  const grid = `<div class="dianGrid">${cells.join('')}</div>`;
  const hint = ph === 'mem'
    ? `第 ${'一二三四'[r]}关 · 军阵列队中 —— 每秒现一字，共 ${n} 字 ${n} 秒，记住次序！`
    : (ph === 'recall' ? (limit ? `军阵已换位 —— 按<b>刚才的次序</b>依次点将（限时 <b>${limit} 秒</b>）！` : '军阵已换位 —— 按<b>刚才的次序</b>依次点将！')
      : '判定完毕 —— 标绿=位置正确');
  const bar = (limit && ph === 'recall')
    ? `<div class="tmbar dianBar"><i></i></div><div class="dianBarNum" data-bar-num>${st.tLeft || limit}s</div>`
    : '';
  const okBtn = ph === 'mem'
    ? `<button class="btn dianOk" disabled>确 定</button>`
    : ph === 'recall'
      ? `<button class="btn gold dianOk">确 定</button>`
      : `<button class="btn gold dianOk">${r < st.rounds.length - 1 ? '下一关 ⏭' : (isDuo ? '完成 ⏭' : '去结算 ⏭')}</button>`;
  const feed = ph === 'feed'
    ? `<div class="dianFeed ${st.lastHits === n ? 'good' : (st.lastHits ? 'mid' : 'bad')}">答对 <b>${st.lastHits}</b> / ${n} · ${st.lastHits ? '+' + st.lastHits * DIAN_PT + ' 分' : '再接再厉'}</div>`
    : `<div class="dianFeed"></div>`;
  const main = `<div class="dianMain">
      <div class="dianHalfName">${esc(name)}</div>
      <div class="dianScoreTag">${esc(tier.icon)} ${esc(tier.label)}档 · 累计 <b>${st.score}</b> 分</div>
      ${grid}<div class="dianMemHint">${hint}</div>${bar}</div>`;
  const ctl = `<div class="dSide">${okBtn}${ph === 'recall' ? `<div class="dianCount">已点 <b>${st.clicks.length}</b> / ${n}</div>` : ''}${feed}</div>`;
  /* 确认键位置（何何老师定稿）：分屏时在答题区相邻处（中缝两侧）垂直居中，
     不在屏幕底部 —— L 侧确认键在答题区右缘、R 侧在其左缘，两键环抱中缝；单人 = 右侧居中 */
  return (isDuo && side === 'R') ? ctl + main : main + ctl;
}
function dianCellHTML(ch, cls, stamp) {
  return `<div class="dcell ${cls || ''}"${ch ? ` data-ch="${esc(ch)}"` : ''}>${ch ? dianGlyphHTML(ch) : ''}${stamp ? `<span class="dstamp">${stamp}</span>` : ''}</div>`;
}
function dianGlyphHTML(ch) { return svgOf(ch); }   /* 反白由 CSS `.dcell svg path{fill:!important}` 覆盖（rubCard 同法） */
function dianRenderHalf(side) {
  const st = dianStateOf(side);
  const host = document.getElementById('dh_' + side);
  if (!host || !st) return;
  host.innerHTML = dianHalfHTML(side, st);
  if (st.phase === 'mem') dianScheduleMem(side, st);
  else if (st.phase === 'recall') dianWireRecall(side, st);
  else if (st.phase === 'feed') dianWireFeed(side, st);
}

/* ---------- 记忆阶段：每秒亮一字（300ms 起拍），N 字 N 秒后全体隐去 → 倒计时特效 → 换位 ---------- */
function dianScheduleMem(side, st) {
  const round = st.rounds[st.ri], n = round.n, seq = round.seq;
  const host = document.getElementById('dh_' + side);
  const grid = host.querySelector('.dianGrid');
  st.phase = 'mem'; st.step = 0; st.clicks = []; st.marks = {};
  const alive = () => dianStateOf(side) === st && st.phase === 'mem';   /* 换局/重开/离屏即失效 */
  for (let i = 0; i < n; i++) {
    later(() => {
      if (!alive() || st.step !== i) return;
      const cell = grid.children[i];
      if (!cell) return;
      st.step = i + 1;
      cell.dataset.ch = seq[i];
      cell.innerHTML = dianGlyphHTML(seq[i]);
      cell.classList.add('lit');
      sndTick();
    }, 300 + i * 1000);
  }
  later(() => {
    if (!alive()) return;
    [...grid.children].forEach(c => { c.classList.remove('lit'); c.classList.add('gone'); c.innerHTML = ''; delete c.dataset.ch; });
    later(() => {
      if (!alive()) return;
      /* 字消瞬间（何何老师 V3.2 定稿）：倒计时特效供回忆思考（菜鸟 5 秒 / 困难 3 秒 / 梦魇 1 秒），
         播完才亮换位军阵开答 —— 特效在各自半屏内居中（分屏互不遮掩） */
      dianCdnPlay(side, st, () => { if (dianStateOf(side) === st) dianToRecall(side, st); });
    }, 620);
  }, 300 + n * 1000);
}
/* 倒计时特效序列：每项火焰大字瞬间放大 3 倍→缩回原大→消失，依次更替；
   菜鸟 Ready.../3/2/1/Go! 各 1 秒（共 5 秒）、困难同序列各 0.6 秒（共 3 秒）、梦魇只 Go! Go! Go! 1 秒 */
function dianCdnPlay(side, st, onDone) {
  const tier = DIAN_TIERS[st.tier] || DIAN_TIERS.rookie;
  const host = document.getElementById('dh_' + side);
  if (!host) { if (onDone) onDone(); return; }
  const ov = document.createElement('div');
  ov.className = 'dianCdn';
  host.appendChild(ov);
  let i = 0;
  const aliveCdn = () => dianStateOf(side) === st && document.getElementById('dh_' + side) === host;
  const step = () => {
    if (!aliveCdn()) { ov.remove(); return; }
    if (i >= tier.cdn.length) { ov.remove(); if (onDone) onDone(); return; }
    const d = document.createElement('div');
    d.className = 'dianCdnNum';
    d.textContent = tier.cdn[i];
    d.style.animationDuration = Math.max(280, Math.round(tier.cdnMs * 0.92)) + 'ms';
    ov.appendChild(d);
    sndTick();
    i++;
    later(() => { d.remove(); step(); }, tier.cdnMs);
  };
  step();
}
function dianToRecall(side, st) {
  st.phase = 'recall';
  dianRenderHalf(side);
  /* 限时档（困难/梦魇）：Go 即起倒计时条+音效，超时按已点自动判定；菜鸟不限时 */
  const tier = DIAN_TIERS[st.tier] || DIAN_TIERS.rookie;
  const n = st.rounds[st.ri].n;
  const limit = tier.limits ? tier.limits[n] : null;
  if (limit) dianBarStart(side, st, limit, () => dianJudge(side, st));
}
/* 答题倒计时条（限时档）：不断缩短 + 每秒音效 + 收尾加急；确认即停 */
function dianBarStart(side, st, secs, onEnd) {
  const host = document.getElementById('dh_' + side);
  const bar = host && host.querySelector('.dianBar');
  if (!bar) { if (onEnd) onEnd(); return; }
  const fill = bar.querySelector('i');
  const num = host.querySelector('[data-bar-num]');
  st.tLeft = secs;
  fill.style.width = '100%';
  num.textContent = secs + 's';
  const iv = every(() => {
    if (dianStateOf(side) !== st || st.phase !== 'recall') { clearInterval(iv); return; }
    st.tLeft--;
    fill.style.width = Math.max(0, st.tLeft / secs * 100) + '%';
    num.textContent = Math.max(0, st.tLeft) + 's';
    bar.classList.toggle('urgent', st.tLeft <= Math.max(2, Math.round(secs * 0.25)));
    if (st.tLeft <= 3 && st.tLeft > 0) sndTick();
    if (st.tLeft <= 0) { clearInterval(iv); st.barIv = null; sndWhoops(); if (onEnd) onEnd(); }
  }, 1000);
  st.barIv = iv;
}

/* ---------- 还原阶段：点将盖序号（可撤销、序号压实），确定即判定 ---------- */
function dianWireRecall(side, st) {
  const host = document.getElementById('dh_' + side);
  const grid = host.querySelector('.dianGrid');
  const refresh = () => {
    [...grid.children].forEach(cell => {
      const ch = cell.dataset.ch, k = st.clicks.indexOf(ch) + 1;
      const tag = cell.querySelector('.dstamp');
      if (k && tag) tag.textContent = k;
      else if (k) cell.insertAdjacentHTML('beforeend', `<span class="dstamp">${k}</span>`);
      else if (tag) tag.remove();
      cell.classList.toggle('stamped', !!k);
    });
    const cnt = host.querySelector('.dianCount b');
    if (cnt) cnt.textContent = st.clicks.length;
  };
  [...grid.children].forEach(cell => {
    cell.onclick = () => {
      if (st.phase !== 'recall') return;
      const ch = cell.dataset.ch, at = st.clicks.indexOf(ch);
      if (at >= 0) st.clicks.splice(at, 1); else st.clicks.push(ch);
      sndTick(); refresh();
    };
  });
  host.querySelector('.dianOk').onclick = () => dianJudge(side, st);
}
/* 判定：点选序位 == 原次序（点中的第 k 字正是当初第 k 个亮的字）才算答对。
   限时档严格按"限时内实际点选"计 —— 超时自动判定与提前确定走同一条路 */
function dianJudge(side, st) {
  if (st.phase !== 'recall') return;
  if (st.barIv) { clearInterval(st.barIv); st.barIv = null; }   /* 提前交卷即停表 */
  const r = st.ri, n = st.rounds[r].n, seq = st.rounds[r].seq;
  let hits = 0;
  st.clicks.forEach((ch, k) => { if (seq[k] === ch) hits++; });
  st.lastHits = hits;
  st.score += hits * DIAN_PT;
  st.per.push(hits);
  st.marks = {};
  const host = document.getElementById('dh_' + side);
  [...host.querySelectorAll('.dcell')].forEach(cell => {
    const ch = cell.dataset.ch, k = st.clicks.indexOf(ch) + 1;
    if (!k) { st.marks[ch] = 'dim'; return; }
    st.marks[ch] = seq[k - 1] === ch ? 'right' : 'wrong';
  });
  st.phase = 'feed';
  dianRenderHalf(side);
  (hits === n ? sndRight : (hits ? sndJudge : sndWrong))();
}
function dianWireFeed(side, st) {
  const host = document.getElementById('dh_' + side);
  const btn = host.querySelector('.dianOk');
  if (btn) btn.onclick = () => {
    if (st.phase !== 'feed') return;
    st.ri++;
    if (st.ri < st.rounds.length) { st.phase = 'mem'; dianRenderHalf(side); }
    else dianFinishSide(side, st);
  };
}
function dianFinishSide(side, st) {
  if (side === 'M') {
    DIAN.done = true;
    dianSaveSolo();
    dianGoClimbSolo();
  } else {
    DIAN2[side].done = true;
    const host = document.getElementById('dh_' + side);
    if (host) host.innerHTML = `<div class="boardEmpty" style="padding:40px 0">⚔️ 三关点毕！战报汇总中……</div>`;
    if (DIAN2.L.done && DIAN2.R.done) dianEndDuo();
  }
}

/* ---------- 成绩入库（同名保最佳，keepBest 复用）与结算 ---------- */
/* 该难度点兵榜前三名名单（solo+duo 合并 —— 同档内单人/双人是同一任务，可比）；
   V3.1 及更早的记录无 diff 字段 → 视作菜鸟档 */
function dianTop3Names(diffKey) {
  const store = dianStore();
  const list = store.solo.concat(store.duo).filter(r => (r.diff || 'rookie') === diffKey);
  return list.slice().sort((a, b) => betterDian(a, b) ? -1 : 1).slice(0, 3).map(r => r.name);
}
function dianSaveSolo() {
  const st = DIAN;
  if (st.saved) return;
  st.saved = true;
  const slots = st.rounds.reduce((a, b) => a + b.n, 0);
  const oldTop3 = dianTop3Names(st.tier);
  const rec = {
    name: st.name, mode: 'solo', diff: st.tier, score: st.score,
    hits: st.per.reduce((a, b) => a + b, 0), slots,
    per: st.per.slice(), time: Math.round((Date.now() - st.t0) / 1000), ts: Date.now()
  };
  keepBest(dianStore().solo, rec, betterDian);
  lastTs = [rec.ts];
  saveDB();
  const newWinner = dianTop3Names(st.tier).filter(nm => oldTop3.indexOf(nm) < 0);
  DIAN_LAST = { mode: 'solo', tier: st.tier, name: st.name, score: st.score, per: st.per.slice(), time: rec.time, newWinner };
}
function dianEndDuo() {
  DIAN2.done = true;
  if (!DIAN2.saved) {
    const t = Math.round((Date.now() - DIAN2.t0) / 1000);
    const win = DIAN2.L.score > DIAN2.R.score ? 'L' : (DIAN2.R.score > DIAN2.L.score ? 'R' : 'T');
    const store = dianStore();
    const nmOf = sd => DIAN2.names[sd === 'L' ? 0 : 1];   /* 名字在 DIAN2.names[]，侧状态无 name 字段 */
    const slots = DIAN2.rounds.reduce((a, b) => a + b.n, 0);
    const oldTop3 = dianTop3Names(DIAN2.tier);
    const push = (sd, rv, ts) => keepBest(store.duo, {
      name: nmOf(sd), rival: nmOf(rv), mode: 'duo', diff: DIAN2.tier, score: DIAN2[sd].score,
      hits: DIAN2[sd].per.reduce((a, b) => a + b, 0), slots,
      win: win === 'T' ? 'T' : (win === sd ? 'W' : 'L'), time: t, ts
    }, betterDian);
    const rL = push('L', 'R', Date.now() + 1), rR = push('R', 'L', Date.now() + 2);
    lastTs = [rL.rec.ts, rR.rec.ts];
    saveDB();
    DIAN2.saved = true;
    const newWinner = dianTop3Names(DIAN2.tier).filter(nm => oldTop3.indexOf(nm) < 0);
    DIAN_LAST = {
      mode: 'duo', tier: DIAN2.tier, win,
      L: { name: nmOf('L'), score: DIAN2.L.score, per: DIAN2.L.per.slice() },
      R: { name: nmOf('R'), score: DIAN2.R.score, per: DIAN2.R.per.slice() },
      newWinner
    };
  }
  go(P_ANIM_DUO);
  /* 爬榜=本难度子榜（2026-10-08 何何老师复核定稿：跨难度踢飞=越界，三档实力不可比）；
     旧档无 diff → 菜鸟档 */
  const { head } = topForClimb(dianStore().duo.filter(r => (r.diff || 'rookie') === DIAN2.tier), betterDian, 8);
  playClimb(head, 'duoStage', 'duo', () => go(P_DIAN_RES));
}
function dianGoClimbSolo() {
  go(P_ANIM_SOLO);
  const { head } = topForClimb(dianStore().solo.filter(r => (r.diff || 'rookie') === DIAN.tier), betterDian, 8);
  playClimb(head, 'soloStage', 'dian', () => go(P_DIAN_RES));
}

/* ---------- 点兵榜（拓片墙新页签 + 结算页内嵌共用同一渲染；按难度分档 2026-10-08） ---------- */
function dianBoardHTML(limit, diffFilter) {
  const store = dianStore();
  const list = store.solo.map(r => Object.assign({ kind: '单人' }, r))
    .concat(store.duo.map(r => Object.assign({ kind: 'PK' }, r)))
    .filter(r => !diffFilter || (r.diff || 'rookie') === diffFilter);   /* 旧档无 diff → 菜鸟档 */
  if (!list.length) return { html: '<div class="boardEmpty">点兵簿上还无名将 —— 先去点兵点将练一阵！<br><span style="font-size:12px;color:var(--muted)">（成绩与主线一致：打完整局才会记榜，中退不计；记榜后存于本机 localStorage，刷新不丢）</span></div>', rows: 0 };
  const sorted = list.slice().sort((a, b) => betterDian(a, b) ? -1 : 1).slice(0, limit || 12);
  const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
  const html = `<table class="rk"><tr><th>#</th><th>将军</th><th>对局</th><th>总分</th><th>答对</th><th>日期</th></tr>
    ${sorted.map((r, i) => `<tr${(lastTs || []).indexOf(r.ts) >= 0 ? ' class="me"' : ''}>
      <td>${medal(i)}</td><td>${esc(r.name)}</td>
      <td>${r.kind === 'PK' ? '⚔️ vs ' + esc(r.rival || '-') : '⛺ 单人'}</td>
      <td><b>${r.score}</b></td><td>${r.hits}/${r.slots}</td>
      <td>${new Date(r.ts).toLocaleDateString()}</td></tr>`).join('')}</table>`;
  return { html, rows: sorted.length };
}

/* ---------- 点兵点将结算页（solo/duo 共用，惯例：头衔+颁奖词+内嵌榜单） ---------- */
function renderDianResult() {
  const s = $('s16');
  const head = '<div class="h1">⛺ 点兵点将 · 结算</div>';
  if (!DIAN_LAST) {
    s.innerHTML = `<div class="wrap">${head}<div class="panel"><div class="boardEmpty">还没有点将战报 —— 先回营地玩一局。</div>
      <div class="resBtns" style="margin-top:14px"><button class="btn" id="btnDianResGo">⛺ 去点兵点将</button>
      <button class="btn ghost" id="btnDianResHome">⌂ 回封面</button></div></div></div>`;
    $('btnDianResGo').onclick = () => go(P_DIAN);
    $('btnDianResHome').onclick = () => go(P_COVER);
    return;
  }
  const d = DIAN_LAST;
  const tier = DIAN_TIERS[d.tier] || DIAN_TIERS.rookie;
  const tMax = dianMaxOf(d.tier);
  const mini = dianBoardHTML(5, d.tier);   /* 结算页小榜只排本局难度（2026-10-08 分档定稿） */
  const mgmtHTML = `
    <div class="resBtns" style="margin-top:10px">
      <button class="btn ghost sm" id="btnExport">⬇ 导出成绩</button>
      <button class="btn ghost sm" id="btnImport">⬆ 导入成绩</button>
      <button class="btn ghost sm" id="btnDianClear">🗑 清空点兵成绩</button>
      <input type="file" id="importFile" accept=".json" style="display:none">
    </div>`;
  const btnsHTML = `
    <div class="resBtns">
      <button class="btn gold" id="btnDianAgain">🔁 再来一局</button>
      <button class="btn ghost" id="btnDianBoard2">🏛️ 拓片墙</button>
      <button class="btn ghost" id="btnDianHome2">⌂ 回封面</button>
    </div>`;
  if (d.mode === 'solo') {
    /* TIERS 分档阈值按 0~100 标定 → 点兵总分按该档满分折算后复用同一头衔/结语池（按惯例随机+针对） */
    const t = titleOf(Math.round(d.score / tMax * 100));
    const perStat = d.per.map((h, i) => `<div class="resStat"><div class="v">${h}/${tier.rounds[i]}</div><div class="k">第${'一二三四'[i]}关答对</div></div>`).join('');
    s.innerHTML = `
    <div class="resWrap">
      ${head}
      <div class="resScore">${d.score}</div>
      <div class="sub">${tier.icon} ${esc(tier.label)}档点将总分（满分 ${tMax} · 每个答对位置 ${DIAN_PT} 分）</div>
      <div class="resTitle">${esc(t.name)}</div>
      <div class="resWord">${t.word}</div>
      <div class="resStats">${perStat}<div class="resStat"><div class="v">${d.time}s</div><div class="k">用时</div></div></div>
      <div class="boardMini">
        <div class="bminiT">⛺ 点兵榜 · ${tier.icon} ${esc(tier.label)}档 · 本轮成绩已计入</div>
        ${mini.html}
        ${mini.rows ? '<div class="bminiMore" id="btnDianBoardAll">展开完整榜单 →</div>' : ''}
      </div>
      ${btnsHTML}${mgmtHTML}
    </div>`;
  } else {
    const tie = d.win === 'T', win = d.win;
    const who = tie ? '平手' : (win === 'L' ? d.L.name : d.R.name);
    const tL = tie ? duoTitleOf(true) : duoTitleOf(win === 'L');
    const tR = tie ? duoTitleOf(true) : duoTitleOf(win === 'R');
    const avgScore = (d.L.score + d.R.score) / 2;
    const spL = tie ? duoSpeechOf(true, true, avgScore) : duoSpeechOf(win === 'L', false);
    const spR = tie ? duoSpeechOf(true, true, avgScore) : duoSpeechOf(win === 'R', false);
    const roundsTxt = tier.rounds.join('+');
    s.innerHTML = `
    <div class="wrap">
      ${head}
      <div class="panel">
        <div style="text-align:center;font-family:'STKaiti','Kaiti SC',KaiTi,serif;font-size:clamp(24px,5vh,40px);letter-spacing:.1em">
          ${tie ? '<span style="color:var(--gold-hi)">势均力敌 · 平手</span>' : '<span style="color:var(--cin)">🏆 ' + esc(who) + '</span> 胜出'}</div>
        <div class="sub" style="text-align:center;margin:6px 0 0">${tier.icon} ${esc(tier.label)}档 · 同题同字同乱序 · 点将（${roundsTxt} 字）</div>
        <div class="pkwrap duoResultCols">
          <div class="pkcol L${win === 'L' ? ' act' : ''}"><h3>${esc(d.L.name)}</h3>
            <div class="pks">${win === 'L' ? '🏆 胜' : tie ? '平' : '负'}</div><div class="pkv">${d.L.score}</div>
            <div style="font-size:13px;font-weight:700;color:var(--cin)">「${esc(tL)}」</div></div><div></div>
          <div class="pkcol R${win === 'R' ? ' act' : ''}"><h3>${esc(d.R.name)}</h3>
            <div class="pks">${win === 'R' ? '🏆 胜' : tie ? '平' : '负'}</div><div class="pkv">${d.R.score}</div>
            <div style="font-size:13px;font-weight:700;color:var(--patina-deep)">「${esc(tR)}」</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div style="font-size:13.5px;line-height:1.8;color:var(--ink)">${spL}</div>
          <div style="font-size:13.5px;line-height:1.8;color:var(--ink)">${spR}</div>
        </div>
        <div class="boardMini">
          <div class="bminiT">⛺ 点兵榜 · ${tier.icon} ${esc(tier.label)}档 · 本轮双方已上榜</div>
          ${mini.html}
          ${mini.rows ? '<div class="bminiMore" id="btnDianBoardAll">展开完整榜单 →</div>' : ''}
        </div>
        ${btnsHTML}${mgmtHTML}
      </div>
    </div>`;
  }
  wireScoreMgmt(() => renderDianResult());
  if ($('btnDianClear')) $('btnDianClear').onclick = () => {
    if (!confirm('确定清空点兵点将成绩吗？此操作不可撤销（建议先导出备份）。')) return;
    dianStore().solo = []; dianStore().duo = [];
    lastTs = []; saveDB(); toast('已清空点兵成绩'); renderDianResult();
  };
  if ($('btnDianBoardAll')) $('btnDianBoardAll').onclick = () => { BOARD_TAB = 'dian'; BOARD_DIFF = d.tier; go(P_BOARD); };
  $('btnDianAgain').onclick = () => go(P_DIAN);
  $('btnDianBoard2').onclick = () => { BOARD_TAB = 'dian'; BOARD_DIFF = d.tier; go(P_BOARD); };
  $('btnDianHome2').onclick = () => go(P_COVER);
  startFx();
  dianNewWinnerFx();   /* 新王播报（一次性：本局玩家新进该难度点兵榜前三） */
}

/* New Winner（V3.2 何何老师定稿）：本局有玩家新进该难度点兵榜前三（替换了原坐者）→
   "New Winner" 火焰大字（倒计时特效同款：3 倍放大→缩回→消失）+ 全屏玫瑰花瓣洒落，共 3 秒。
   只在结算页首次渲染时播一次（nwPlayed 幂等闸门，重渲染/导入刷新不重播） */
function dianNewWinnerFx() {
  if (!DIAN_LAST || !DIAN_LAST.newWinner || !DIAN_LAST.newWinner.length || DIAN_LAST.nwPlayed) return;
  DIAN_LAST.nwPlayed = true;
  /* 幂等 + 自毁独立于 TIMERS：特效层挂在 body（不随 slide 清屏），若用 later() 注册清理，
     3 秒内任何一次 go() 的 stopAll() 都会清掉定时器 → 特效层永久泄漏到后续所有页面（实测踩坑）。
     故用原生 setTimeout：切页也要在 3 秒后自毁 */
  const stale = document.getElementById('nwFx');
  if (stale) stale.remove();
  const host = document.createElement('div');
  host.id = 'nwFx';
  host.innerHTML = `<div class="dianCdnNum nwText">New Winner</div><div class="nwPetals"></div>`;
  document.body.appendChild(host);
  const petals = host.querySelector('.nwPetals');
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('i');
    p.style.left = (Math.random() * 100) + '%';
    p.style.animationDuration = (1.5 + Math.random() * 1.3).toFixed(2) + 's';
    p.style.animationDelay = (Math.random() * 0.9).toFixed(2) + 's';
    p.style.transform = `scale(${(0.6 + Math.random() * 0.9).toFixed(2)})`;
    petals.appendChild(p);
  }
  sndWin();
  setTimeout(() => host.remove(), 3000);
}

/* 测试钩子（真机断言只读，不改变任何行为） */
window.__DGE = {
  get DIAN() { return DIAN; }, get DIAN2() { return DIAN2; }, get DIAN_LAST() { return DIAN_LAST; },
  get DIAN_DIFF_KEY() { return DIAN_DIFF_KEY; },
  get EGG_SEL() { return EGG_SEL; }, get EGG_QUALIFIED() { return EGG_QUALIFIED; },
  get FX() { return { petals, fxOn }; },   /* 花瓣动画断言钩子（只读） */
  EGG_PWD, EGG_GATE_SCORE, EGG_MODES, DIAN_TIERS, DIAN_PT, eggGateQualified, eggQualifyPk, dianTop3Names,
  dianPickChars, dianShuffleOff, openEggGate, closeEggGate, dianBoardHTML
};
