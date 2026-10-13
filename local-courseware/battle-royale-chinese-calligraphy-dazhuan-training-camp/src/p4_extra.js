/* =====================================================================
   鼎铭小史官 · p4 双人对决（V3 混合赛）/ 揭榜爬榜 / 双人结算 / 成绩管理 / 全局初始化
   继承源：篆刻工坊-小篆训练营v6.6.618.html（startDuo/pkHp/playClimb/renderDuoResult/
   exportDB 全套结构），字形与判定用本项目 bronze 引擎；两侧选项独立洗牌保留 V2 抬杠修复
   ===================================================================== */

/* ---------- 双人：准备页 ---------- */
let PK = null;
function renderDuoPrep() {
  const s = $('s7');
  const cfg = PK_ROUNDS[CUR.diff];
  const d = DIFF[CUR.diff];
  s.innerHTML = `
  <div class="duoForm">
    <div class="h1">⚔️ 双人对决</div>
    <div class="sub">同题同字混合赛 —— 辨铭抢答 + 写铭分屏描红，总分高者胜</div>
    <div class="duoCfgLine">${d.icon} <b>${d.name}关</b> · 共 <b>${cfg.d + cfg.t}</b> 轮（辨铭抢答 <b>${cfg.d}</b> + 写铭描红 <b>${cfg.t}</b>）${CUR.timed ? ' · ⏱ 限时挑战' : ''}<br>
      抢答：先答对 +${PK_GAIN.first} / 后答对 +${PK_GAIN.second} / 答错 +0 · 描红：按描红得分累加（满分 100/字）</div>
    <div class="vsRow">
      <input id="duoA" maxlength="8" placeholder="左军·史官甲" value="${esc(PK ? PK.names[0] : '')}">
      <span style="font-size:26px;font-weight:900;color:var(--gold-hi)">VS</span>
      <input id="duoB" maxlength="8" placeholder="右军·史官乙" value="${esc(PK ? PK.names[1] : '')}">
    </div>
    <div class="panel" style="max-width:520px;margin:0 auto;text-align:left;padding:12px 16px">
      <div style="font-size:13px;color:var(--muted);margin-bottom:4px">📋 班级名单（可粘贴，一行一个名字；抽前先「乱序」更有悬念）</div>
      <textarea id="rosterArea" class="rosterArea" placeholder="张三&#10;李四&#10;王五"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;justify-content:center">
        <button class="btn sm ghost" id="btnDraw">🎲 随机抽两人</button>
        <button class="btn sm ghost" id="btnSeqRoster">🔢 学号序列起止</button>
        <button class="btn sm ghost" id="btnShuffleRoster">🔀 乱序</button>
      </div>
    </div>
    <button class="btn" id="btnPkGo" style="margin-top:12px">开 战 🥁</button>
    <div class="footNote">写铭轮双方分屏同时描同一个字（多指触控已支持）；写完各自点「完成交卷」。</div>
  </div>`;
  $('btnDraw').onclick = () => rosterDrawTwo();
  $('btnSeqRoster').onclick = () => seqRoster();
  $('btnShuffleRoster').onclick = () => {
    const ta = $('rosterArea');
    const names = rosterParse(ta.value);
    if (!names.length) { toast('先粘贴名单再乱序哦', true); return; }
    ta.value = shuffle(names).join('\n');
    sndSeal();
  };
  $('btnPkGo').onclick = () => startDuo();
}
/* 学号序列捷径（复刻 v6.6.618 seqRoster）：先问首位、再问末位 → 生成全部连续学号（姓名行保留在前） */
function seqRoster() {
  const t = document.getElementById('rosterArea');
  const lines = (t.value || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  const inBox = lines.map(x => /^\d+$/.test(x) ? x : '').find(Boolean) || '';
  const sIn = prompt('序列【第一个】学号是？', inBox);
  if (sIn === null) return;
  const start = /^\d+$/.test(sIn.trim()) ? +sIn.trim() : NaN;
  if (isNaN(start)) { toast('第一个学号无效（需纯数字）', true); return; }
  const eIn = prompt('序列【最后一个】学号是？（将自动生成 ' + start + ' ~ 末号 的连续学号）', String(start));
  if (eIn === null) return;
  const end = /^\d+$/.test(eIn.trim()) ? +eIn.trim() : NaN;
  if (isNaN(end) || end < start) { toast('末尾学号无效（需 ≥ ' + start + '）', true); return; }
  if (end - start > 500) { toast('一次最多生成 500 个连续学号', true); return; }
  const names = lines.filter(x => !/^\d+$/.test(x));
  const seq = [];
  for (let n = start; n <= end; n++) seq.push(String(n));
  t.value = names.concat(seq).join('\n');
  toast('已生成 ' + seq.length + ' 个连续学号（' + start + ' ~ ' + end + '）');
}
function rosterParse(txt) {
  return String(txt || '').split(/[\n,，、;；\t]+/).map(x => x.trim()).filter(Boolean);
}
function rosterDrawTwo() {
  const names = rosterParse(($('rosterArea') || {}).value);
  if (names.length < 2) { toast('名单至少要两个人才能抽签哦', true); return; }
  const pick = shuffle(names).slice(0, 2);
  $('duoA').value = pick[0].slice(0, 8);
  $('duoB').value = pick[1].slice(0, 8);
  sndSeal(); toast('抽中：' + pick[0] + ' VS ' + pick[1]);
}

/* ---------- 双人：混合对决（辨铭抢答轮 + 写铭分屏描红轮） ---------- */
function startDuo() {
  const a = ($('duoA').value || '').trim() || '史官甲';
  const b = ($('duoB').value || '').trim() || '史官乙';
  if (a === b) { toast('两位选手不能同名（榜单要按名字区分）', true); return; }
  const cfg = PK_ROUNDS[CUR.diff];
  /* 题组：描红字沿用分层校准的 pickTraceSet（难度曲线不变）；辨铭题从其余字里抽，绝不与描红字重叠；
     同场辨铭零重复（2026-10-06 规则，去重生命周期=本场：结算即作废，下一场从头再来） */
  const tset = pickTraceSet(CUR.diff);
  const traceChars = tset.list.slice(0, cfg.t);
  const discPool = shuffle(CHARS.filter(c => !tset.list.includes(c))).slice(0, cfg.d);
  const plan = [];
  discPool.forEach(ch => plan.push({ kind: 'discern', q: mkQuestion(ch, 'b2s') }));
  traceChars.forEach(ch => plan.push({ kind: 'trace', ch }));
  PK = {
    names: [a, b], diff: CUR.diff, timed: !!CUR.timed,
    L: { name: a, score: 0 }, R: { name: b, score: 0 },
    plan, ri: 0, lock: { L: false, R: false }, answered: {},
    traceScores: { L: null, R: null },
    t0: Date.now(), saved: false, over: false
  };
  toast('PK 开始 · ' + DIFF[PK.diff].name + '难度 · ' + plan.length + ' 轮（辨铭 ' + cfg.d + ' + 写铭 ' + cfg.t + '）· 双方同题同字');
  go(P_DUO);   /* go() 触发 renderPkIdle → PK 已就绪即渲染首轮（勿再手动 renderPk，双渲染会让首帧 InkBox 重建） */
}
function renderPkIdle() {
  if (PK && !PK.over && PK.plan) { renderPk(); return; }
  const s = $('s8');
  s.innerHTML = `<div class="boardEmpty" style="padding:60px 0">还没有开战 —— 先去准备页点将。<br>
    <button class="btn" id="btnPkIdleGo" style="margin-top:14px">⚔️ 去双人对决准备</button></div>`;
  $('btnPkIdleGo').onclick = () => go(P_DUO_PREP);
}
function pkTop() {
  const r = PK.plan[PK.ri];
  const kind = r ? (r.kind === 'discern' ? '辨铭抢答' : '写铭描红') : '结束';
  return `<div class="roundBanner">双人 PK · 第 ${Math.min(PK.ri + 1, PK.plan.length)} / ${PK.plan.length} 轮 · ${kind}${PK.timed ? ' · ⏱ 限时' : ''}</div>`;
}
function pkColsHTML() {
  return `<div class="pkwrap">
    <div class="pkcol L" id="pkL"><h3>${esc(PK.L.name)}</h3><div class="pks">累计得分</div>
      <div class="pkv" id="pkVL">${PK.L.score}</div></div><div></div>
    <div class="pkcol R" id="pkR"><h3>${esc(PK.R.name)}</h3><div class="pks">累计得分</div>
      <div class="pkv" id="pkVR">${PK.R.score}</div></div></div>` + pkHp();
}
function pkHp() {
  const tot = PK.L.score + PK.R.score;
  let share = tot > 0 ? PK.L.score / tot : 0.5;
  share = Math.max(0.06, Math.min(0.94, share));   /* 留边：领先方不完全吃掉血条 */
  const pct = Math.round(share * 100);
  /* ≥56% 优势方爆闪、≤44% 弱势方呼吸（继承 v6.6.618），势均力敌无特效 */
  const lCls = pct >= 56 ? ' dominant' : (pct <= 44 ? ' weak' : '');
  const rCls = pct <= 44 ? ' dominant' : (pct >= 56 ? ' weak' : '');
  const sparks = [];
  for (let i = 1; i <= 8; i++) sparks.push('<i class="spark s' + i + '"></i>');
  return '<div class="hpwrap">' +
    '<div class="hp"><i class="l' + lCls + '" style="width:' + (share * 100) + '%"></i>' +
    '<i class="r' + rCls + '" style="width:' + ((1 - share) * 100) + '%"></i></div>' +
    '<div class="boltwrap" style="left:' + (share * 100) + '%"><i class="bolt"></i>' + sparks.join('') + '</div>' +
    '</div>';
}
function refreshHp() {
  const w = document.querySelector('#s8 .hpwrap');
  if (w) w.outerHTML = pkHp();
}
function setPkV(side, val) {
  const el = document.getElementById('pkV' + side);
  if (!el) return;
  el.textContent = val;
  el.classList.remove('bump'); void el.offsetWidth;   /* 重置动画 */
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 220);
}
function renderPk() {
  const s = $('s8');
  if (PK.ri >= PK.plan.length) return endDuo();
  const r = PK.plan[PK.ri];
  PK.lock = { L: false, R: false };
  s.innerHTML = `<div class="pkWrap">${pkTop()}<div class="tmbar" id="pkBar" style="display:none"><i></i></div>${pkColsHTML()}`;
  if (r.kind === 'discern') {
    const q = r.q;
    /* 每侧独立洗牌：两侧同序等于让后手抄位置（V2 抬杠环节抓到的 P0，保留） */
    const mk = side => shuffle(q.options).map(o => `<button class="opt" data-side="${side}" data-o="${esc(o)}">${esc(o)}</button>`).join('');
    s.innerHTML += `
      <div class="pkq"><div class="ql">青铜拓片上这个字是谁？（两边题目完全相同 · 选项各自打乱）</div>
      <div class="stemBox pkStemBox"><div class="glyphCard">${svgOf(q.ch)}</div></div></div>
      <div class="pkopts">
        <div class="pkoptbox"><h4>${esc(PK.L.name)} 的选项</h4><div class="opts" id="pkOptL">${mk('L')}</div></div>
        <div></div>
        <div class="pkoptbox"><h4>${esc(PK.R.name)} 的选项</h4><div class="opts" id="pkOptR">${mk('R')}</div></div>
      </div>
      <div class="pklock">双方各答各的 —— 先答对 +${PK_GAIN.first}，后答对 +${PK_GAIN.second}，答错 +0</div>
      <div class="qFeed" id="pkFeed"></div>`;
    ['L', 'R'].forEach(side => {
      s.querySelectorAll(`#pkOpt${side} .opt`).forEach(el => {
        el.onclick = () => pkAnswer(side, el);
      });
    });
    /* 抢答限时统一每题 3 秒（2026-10-07 何何老师定稿）：原误用描红模型 timeOf(q.ch)≈10~18s，
       对辨铭认字题过长 —— 认字只花「看」的时间，不吃「写」的工作量（QUIZ_LIM 与 solo 识铭/辨铭同源） */
    if (PK.timed) pkBarStart(QUIZ_LIM, pkTimeout);
  } else {
    /* 写篆轮真分屏：左右两块独立画布同时描同一个字，分数实时可见（继承 v6.6.618 pkTraceSetup） */
    PK.traceScores = { L: null, R: null };
    const ch = r.ch;
    /* 描红侧改为【画布 | 信息确认框】左右相邻：每侧高度减半，整页一屏内完成
       描红 PK，彻底无需页面滚动/手势（何何老师 2026-10 定稿） */
    const half = side => {
      const nm = esc(PK[side].name);
      return `<div class="pkhalf" id="pkHalf${side}">
        <div id="pkCv${side}"></div>
        <div class="drawside">
          <div style="display:flex;align-items:baseline;gap:8px;justify-content:center;flex-wrap:wrap">
            <h3 style="margin:0;font-size:16px;color:var(--ink)">${nm}</h3>
            <div class="scorebig" id="pkScore${side}" style="font-size:24px">—</div><div style="font-size:11px;color:var(--muted)">（本字满分 100）</div></div>
          <div style="font-size:13px;font-weight:800;margin:2px 0" id="pkVerdict${side}">沿灰色字形描摹</div>
          <div class="sc"><span class="lb">贴合度</span><span class="vl" id="pkPrec${side}">—</span></div>
          <div class="sc"><span class="lb">覆盖度</span><span class="vl" id="pkRec${side}">—</span></div>
          <div class="sc"><span class="lb">已描完笔画</span><span class="vl" id="pkStk${side}">—</span></div>
          <div class="chips" id="pkChips${side}"></div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:auto">
            <button class="btn sm ghost" id="pkClear${side}">清空重描</button>
            <button class="btn sm" id="pkDone${side}">完成交卷</button></div>
        </div></div>`;
    };
    s.innerHTML += `
      <div class="turnbanner" id="pkTurn">双方同时描摹「${esc(ch)}」—— 各自描完点「完成交卷」</div>
      <div class="pkduo">${half('L')}<div></div>${half('R')}</div>`;
    pkTraceSetup(ch);
  }
}
function pkBarStart(LIM, onEnd) {
  pkBarStop();
  const bar = document.getElementById('pkBar');
  if (!bar) return;
  bar.style.display = ''; bar.classList.remove('urgent');
  const fill = bar.querySelector('i'); fill.style.width = '100%';
  const URG = Math.max(1.5, LIM * 0.25);
  PK.tLeft = LIM;
  PK.cdId = every(() => {
    PK.tLeft--;
    if (fill) fill.style.width = Math.max(0, PK.tLeft / LIM * 100) + '%';
    bar.classList.toggle('urgent', PK.tLeft <= URG);
    if (PK.tLeft <= 3 && PK.tLeft > 0) sndTick();
    if (PK.tLeft <= 0) { pkBarStop(); onEnd(); }
  }, 1000);
}
function pkBarStop() { if (PK && PK.cdId) { clearInterval(PK.cdId); PK.cdId = null; } }
function pkTimeout() {
  ['L', 'R'].forEach(sd => { PK.lock[sd] = true; });
  document.querySelectorAll('#s8 .pkoptbox .opt').forEach(x => {
    x.classList.add('locked');
    if (x.dataset.o === PK.plan[PK.ri].q.ch) x.classList.add('right');
  });
  toast('⏱ 本轮超时，双方均未得分', true, 1500);
  sndWhoops();
  later(() => { PK.ri++; renderPk(); }, 900);
}
function pkAnswer(side, el) {
  if (PK.over || PK.ri >= PK.plan.length) return;
  const r = PK.plan[PK.ri];
  if (r.kind !== 'discern' || PK.lock[side]) return;
  PK.lock[side] = true;
  const ok = el.dataset.o === r.q.ch;
  const box = document.getElementById('pkOpt' + side);
  box.querySelectorAll('.opt').forEach(x => {
    x.classList.add('locked');
    if (x.dataset.o === r.q.ch) x.classList.add('right');
    else if (x === el) x.classList.add('wrong');
    else x.classList.add('dim');
  });
  if (ok) {
    const first = !PK.answered[r.q.ch];
    const gain = first ? PK_GAIN.first : PK_GAIN.second;
    if (first) PK.answered[r.q.ch] = true;
    PK[side].score = r1(PK[side].score + gain);
    sndRight(); floatScore(el, '+' + gain, side === 'L' ? '#e07b52' : '#7cc4a4');
  } else { sndWrong(); floatScore(el, '✕', '#ff8f83'); }
  setPkV(side, PK[side].score);
  refreshHp();
  if (PK.lock.L && PK.lock.R) {
    pkBarStop();
    const q = r.q, feed = $('pkFeed');
    if (feed) { feed.className = 'qFeed good'; feed.innerHTML = '正确答案：「' + esc(q.ch) + '」— ' + esc(DZINFO[q.ch].sw); }
    later(() => { PK.ri++; renderPk(); }, 1200);
  }
}
let pkBoxes = null;   /* 双实例 {L:{box,done}, R:{...}} —— 真分屏的前提（InkBox 闭包工厂） */
function pkTraceSetup(ch) {
  pkBoxes = {};
  ['L', 'R'].forEach(side => {
    const host = document.getElementById('pkCv' + side);
    const box = InkBox(host, () => pkLive(side));
    box.setChar(ch);
    pkBoxes[side] = { box, done: false };
    document.getElementById('pkClear' + side).onclick = () => {
      pkBoxes[side].box.clear();
      const sc = document.getElementById('pkScore' + side);
      sc.textContent = '—'; sc.style.color = '';
      document.getElementById('pkChips' + side).innerHTML = '';
    };
    document.getElementById('pkDone' + side).onclick = () => pkSubmit(side, false);
  });
  if (PK.timed) pkBarStart(timeOf(ch), () => { toast('⏱ 本字超时，按已描部分结算', true, 1600); pkSubmit('L', true); pkSubmit('R', true); });
}
function pkLive(side) {
  const r = PK.plan[PK.ri], st = pkBoxes && pkBoxes[side];
  if (!st || st.done || !r || r.kind !== 'trace') return;
  const used = st.box.used();
  if (!used.length) return;
  const res = judgeScore(used, r.ch, { timed: PK.timed, wholeZero: !!(PK.timed && PK.diff === 'nightmare') });
  const col = res.score >= 85 ? 'var(--patina)' : res.score >= 60 ? '#b8860b' : 'var(--cin)';
  const sc = document.getElementById('pkScore' + side);
  sc.textContent = res.score; sc.style.color = col;
  document.getElementById('pkPrec' + side).textContent = (res.prec * 100).toFixed(1) + '%';
  document.getElementById('pkRec' + side).textContent = (res.recall * 100).toFixed(1) + '%';
  document.getElementById('pkStk' + side).textContent = (res.totalStrokes - res.strokes.filter(x => x.doneR < DONE_COV).length) + ' / ' + res.totalStrokes;
  document.getElementById('pkVerdict' + side).textContent = res.score >= CAST_PASS ? '可以铸上铜鼎的水准！' : '再描描看，别灰心';
  document.getElementById('pkChips' + side).innerHTML = res.strokes.map((x, i) => {
    const cls = x.unfinished ? 'unfinished' : (x.doneR >= 0.8 && x.meanDev <= 10 ? 'ok' : 'bad');
    return `<span class="sChip ${cls}" title="覆盖${Math.round(x.doneR * 100)}% · 偏离${x.meanDev ? x.meanDev.toFixed(1) : '-'}px">${i + 1}</span>`;
  }).join('');
}
function pkSubmit(side, byTimeout) {
  const r = PK.plan[PK.ri], st = pkBoxes && pkBoxes[side];
  if (!st || st.done || !r || r.kind !== 'trace') return;
  st.done = true;
  st.box.setLock(true);
  const used = st.box.used();
  const res = used.length ? judgeScore(used, r.ch, { timed: PK.timed, wholeZero: !!(PK.timed && PK.diff === 'nightmare') }) : judgeScore([], r.ch, {});
  PK.traceScores[side] = res.score;
  PK[side].score = r1(PK[side].score + res.score);
  setPkV(side, PK[side].score);
  refreshHp();
  sndJudge();
  if (pkBoxes.L.done && pkBoxes.R.done) {
    pkBarStop();
    const a = PK.traceScores.L, b = PK.traceScores.R;
    toast('同一个字「' + r.ch + '」：' + PK.L.name + ' ' + a + ' 分 · ' + PK.R.name + ' ' + b + ' 分（' +
      (a > b ? PK.L.name + ' 本轮胜出' : a < b ? PK.R.name + ' 本轮胜出' : '本轮平手') + '）', false, 3000);
    later(() => { PK.ri++; renderPk(); }, 1500);
  } else {
    toast((byTimeout ? '⏱ ' : '') + '「' + PK[side].name + '」已交卷（' + res.score + ' 分），等对手完成…', false, 2000);
  }
}
function endDuo() {
  PK.over = true;
  pkBarStop();
  const win = PK.L.score > PK.R.score ? 'L' : (PK.R.score > PK.L.score ? 'R' : 'T');
  if (!PK.saved) {
    const t = Math.round((Date.now() - PK.t0) / 1000);
    const push = (side, rival, ts) => keepBest(DB.duo, {
      name: PK[side].name, rival: PK[rival].name, diff: PK.diff, timed: PK.timed,
      score: PK[side].score, win: win === 'T' ? 'T' : (win === side ? 'W' : 'L'),
      time: t, ts
    }, betterDuo);
    const rL = push('L', 'R', Date.now() + 1), rR = push('R', 'L', Date.now() + 2);
    lastTs = [rL.rec.ts, rR.rec.ts];
    saveDB();
    PK.saved = true;
    eggQualifyPk(PK.diff, PK.L.score, PK.R.score);   /* 彩蛋前置条件=本会话内实打的梦魇 PK ≥860（内存旗标，p5） */
  }
  LAST_DUO = {
    L: { name: PK.L.name, score: PK.L.score }, R: { name: PK.R.name, score: PK.R.score },
    win, diff: PK.diff, timed: PK.timed, rounds: PK.plan.length
  };
  go(P_ANIM_DUO);
  const { head } = topForClimb(DB.duo.filter(r => r.diff === PK.diff), betterDuo, 8);
  playClimb(head, 'duoStage', 'duo', () => go(P_DUO_RESULT));
}
let LAST_DUO = null;

/* ---------- 揭榜爬榜动画（逐字继承 v6.6.618 playClimb 全套动效与音效节奏） ---------- */
let climbCtl = null;
function stopClimb() {
  if (climbCtl) {
    climbCtl.cancel = true;
    climbCtl.audioTimers && climbCtl.audioTimers.forEach(clearTimeout);
    climbCtl.timers.forEach(clearTimeout); climbCtl = null;
  }
}
function skipClimb() {
  if (!climbCtl) return;
  const cb = climbCtl.onDone;
  climbCtl.skip = true;
  climbCtl.audioTimers && climbCtl.audioTimers.forEach(clearTimeout);
  climbCtl.timers.forEach(clearTimeout);
  finishClimb(); if (cb) cb();
}
function finishClimb() {
  if (!climbCtl) return;
  const st = climbCtl.stage, rec = climbCtl.lastRec, kind = climbCtl.kind;
  climbCtl = null;
  /* 跳过时也要保留完整的 .plate 外壳 —— 否则 hero 金光样式（.plate.hero）不会生效 */
  if (st) {
    st.innerHTML = '';
    st.appendChild(plateNode(rec, kind, 'hero'));
  }
}
function climbT(ctl, fn, ms) {
  if (ctl.cancel) return;
  const t = setTimeout(() => { if (ctl.cancel || ctl.skip) return; fn(); }, ms);
  ctl.timers.push(t); return t;
}
function climbAudio(ctl, fn, ms) { if (ctl.cancel) return; const t = setTimeout(fn, ms); ctl.audioTimers.push(t); return t; }
function plateHTML(r, kind) {
  const dname = DIFF[r.diff] ? DIFF[r.diff].name : '';
  const main = kind === 'duo' ? r.score : kind === 'dian' ? r.score : r.traceTotal;
  const sub = kind === 'duo'
    ? '对手：' + esc(r.rival || '-') + (dname ? ' · ' + dname + '难度' : '')
    : kind === 'dian'
      ? '答对 ' + (r.hits || 0) + ' / ' + (r.slots || DIAN_MAX / DIAN_PT) + ' 处'
      : dname + '难度 · 均分 ' + (r.traceAvg != null ? Number(r.traceAvg).toFixed(1) : '-') + ' · 印章 ' + (r.marks || 0);
  return '<div class="np"><div class="np-rank">' + (kind === 'duo' ? '双人对战 · ' : kind === 'dian' ? '点兵点将 · ' : '写铭描红 · ') + '第 ' + r.rank + ' 名</div>' +
    '<div class="np-name">' + esc(r.name) + '</div>' +
    '<div class="np-time">' + main + '<small> 分</small></div>' +
    '<div class="np-sub">' + sub + '</div></div>';
}
function plateNode(rec, kind, cls) {
  const div = document.createElement('div');
  div.className = 'plate' + (cls ? ' ' + cls : '');
  div.innerHTML = plateHTML(rec, kind);
  return div;
}
function dizzyStars(parent) {
  const wrap = document.createElement('div');
  wrap.className = 'dizzy-stars';
  for (let k = 0; k < 10; k++) {
    const sp = document.createElement('span');
    sp.textContent = '★';
    sp.style.setProperty('--a', (k * 36) + 'deg');
    wrap.appendChild(sp);
  }
  parent.appendChild(wrap);
  return wrap;
}
/* 播完动画自动进结算页（onDone 回调），另有「跳过动画」按钮 */
function playClimb(list, stageId, kind, onDone) {
  const st = document.getElementById(stageId);
  if (!st || !list.length) { if (onDone) onDone(); return; }
  stopClimb();
  const ctl = { cancel: false, skip: false, timers: [], audioTimers: [], stage: st,
    lastRec: list[0], kind: kind, onDone: onDone || null };
  climbCtl = ctl;
  st.innerHTML = '';
  let idx = list.length - 1;
  let cur = plateNode(list[idx], kind, 'cur');
  st.appendChild(cur); idx--;
  if (idx < 0) {
    climbT(ctl, () => {
      st.innerHTML = ''; st.appendChild(plateNode(list[0], kind, 'hero'));
      ctl.timers.forEach(clearTimeout); ctl.audioTimers.forEach(clearTimeout);
      climbCtl = null; if (ctl.onDone) ctl.onDone();
    }, 850);
    return;
  }
  function step() {
    if (idx < 0) {
      if (cur) { cur.classList.remove('cur', 'slam-in'); cur.classList.add('hero'); }
      ctl.timers.forEach(clearTimeout); ctl.audioTimers.forEach(clearTimeout);
      climbCtl = null; if (ctl.onDone) ctl.onDone();
      return;
    }
    const newP = plateNode(list[idx], kind, 'slam-in');
    st.insertBefore(newP, cur);
    climbT(ctl, () => {
      cur.classList.remove('cur'); cur.classList.add('zoom');
      sndWhack();
      climbAudio(ctl, () => tone(110, 0.10, 'square', 0.16), 30);
      climbT(ctl, () => {
        const stars = dizzyStars(cur);
        sndDizzy();
        climbT(ctl, () => {
          sndWhoops();
          cur.classList.remove('zoom'); cur.classList.add('knocked-fast');
          climbT(ctl, () => {
            stars.remove();
            if (cur.parentNode) cur.parentNode.removeChild(cur);
            cur = newP; newP.classList.remove('slam-in'); newP.classList.add('cur');
            idx--; step();
          }, 550);
        }, 1000);
      }, 280);
    }, 550);
  }
  climbT(ctl, step, 850);
}
/* 榜单里取前 N 名（含本轮成绩），逆序交给 playClimb
   记录没有名次字段，必须在这里补 rank —— 否则铭牌会显示「第 undefined 名」 */
function topForClimb(list, better, n) {
  const sorted = list.slice().sort((a, b) => (better(a, b) ? -1 : (better(b, a) ? 1 : 0)));
  const head = dedupeByName(sorted, better).slice(0, n || 8)
    .map((r, i) => Object.assign({}, r, { rank: i + 1 }));
  return { head, sorted };
}
/* 揭榜页冷启动守卫：go(i) 必须能独立渲染每一页（跳过按钮同时是出口） */
function renderAnimIdle(stageId, backPage) {
  const s = $(stageId === 'soloStage' ? 's10' : 's11');
  const title = stageId === 'soloStage' ? '单人 · 拓片榜揭榜' : '双人对战 · 揭榜';
  s.innerHTML = `<div class="panel"><div class="h1" style="text-align:center">${title}</div>
    <div class="rank-stage" id="${stageId}"><div class="animEmpty">还榜上无名 —— 先去完成一局，你的铭牌就会出现在这里。</div></div>
    <div class="resBtns"><button class="btn ghost" id="skip_${stageId}">⏭ 跳过动画 / 返回</button></div></div>`;
  $('skip_' + stageId).onclick = () => { if (climbCtl) skipClimb(); else go(backPage); };
}

/* ---------- 双人结算页（继承 v6.6.618 renderDuoResult：分栏对位 + 冠亚军颁奖词） ---------- */
function renderDuoResult() {
  const s = $('s12');
  const head = '<div class="h1">⚔️ 双人对决 · 结算</div>';
  if (!LAST_DUO) {
    s.innerHTML = `<div class="wrap">${head}<div class="panel"><div class="boardEmpty">还没有对战记录。<br>去封面点「双人对决」开战，胜者铭牌自动上榜。</div>
      <div class="resBtns" style="margin-top:14px"><button class="btn" id="btnDuoResPrep">⚔️ 去准备开战</button>
      <button class="btn ghost" id="btnDuoResHome">⌂ 回封面</button></div></div></div>`;
    $('btnDuoResPrep').onclick = () => go(P_DUO_PREP);
    $('btnDuoResHome').onclick = () => go(P_COVER);
    return;
  }
  const d = LAST_DUO, win = d.win, tie = win === 'T';
  const who = tie ? '平手' : (win === 'L' ? d.L.name : d.R.name);
  const tL = tie ? duoTitleOf(true) : duoTitleOf(win === 'L');
  const tR = tie ? duoTitleOf(true) : duoTitleOf(win === 'R');
  /* 颁奖词是内部模板（含 <br>/<b> 标记与梗词），按参考版语义原样注入，不 esc；
     平手结语按双方均分取分档预案（goldLineOf），不再写死 */
  const avgScore = (d.L.score + d.R.score) / 2;
  const spL = tie ? duoSpeechOf(true, true, avgScore) : duoSpeechOf(win === 'L', false);
  const spR = tie ? duoSpeechOf(true, true, avgScore) : duoSpeechOf(win === 'R', false);
  const cfg = PK_ROUNDS[d.diff];
  const miniBoard = boardTableHTML('duo', 5, d.diff);   /* 结算页内嵌对决榜：只排本局难度（2026-10-08 分档定稿，本轮双方 lastTs 高亮） */
  s.innerHTML = `
  <div class="wrap">
    ${head}
    <div class="panel">
      <div style="text-align:center;font-family:'STKaiti','Kaiti SC',KaiTi,serif;font-size:clamp(24px,5vh,40px);letter-spacing:.1em">
        ${tie ? '<span style="color:var(--gold-hi)">势均力敌 · 平手</span>' : '<span style="color:var(--cin)">🏆 ' + esc(who) + '</span> 胜出'}</div>
      <div class="sub" style="text-align:center;margin:6px 0 0">${DIFF[d.diff].icon} ${DIFF[d.diff].name}难度 · 同题同字 ${d.rounds} 轮（辨铭 ${cfg.d} + 写铭 ${cfg.t}）${d.timed ? ' · ⏱ 限时挑战' : ''}</div>
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
        <div class="bminiT">⚔️ 对决榜 · 本轮双方已上榜</div>
        ${miniBoard.html}
        ${miniBoard.rows ? '<div class="bminiMore" id="btnDuoBoardAll">展开完整榜单 →</div>' : ''}
      </div>
      <div class="resBtns" style="margin-top:14px">
        <button class="btn gold" id="btnDuoAgain">🔁 再战一局</button>
        <button class="btn ghost" id="btnDuoBoard">🏛️ 榜单</button>
        <button class="btn ghost" id="btnDuoHome">⌂ 回封面</button>
      </div>
      <div class="resBtns" style="margin-top:10px">
        <button class="btn ghost sm" id="btnExport">⬇ 导出成绩</button>
        <button class="btn ghost sm" id="btnImport">⬆ 导入成绩</button>
        <button class="btn ghost sm" id="btnClearScores">🗑 清空对决成绩</button>
        <input type="file" id="importFile" accept=".json" style="display:none">
      </div>
    </div>
  </div>`;
  wireScoreMgmt(() => renderDuoResult(), 'duo');
  if ($('btnDuoBoardAll')) $('btnDuoBoardAll').onclick = () => { BOARD_TAB = 'duo'; BOARD_DIFF = d.diff; go(P_BOARD); };   /* 展开完整榜=直达本局难度子榜 */
  $('btnDuoAgain').onclick = () => go(P_DUO_PREP);
  $('btnDuoBoard').onclick = () => go(P_BOARD);
  $('btnDuoHome').onclick = () => go(P_COVER);
}

/* ---------- 成绩管理（继承 v6.6.118 exportDB/importDB/clearDB；file:// 下载走 data: URL） ---------- */
function exportDB() {
  const json = JSON.stringify(DB, null, 2);
  const filename = '鼎铭小史官-成绩_' + new Date().toISOString().slice(0, 10) + '.json';
  if (typeof window.showSaveFilePicker === 'function') {   /* Chrome/Edge → 另存为对话框 */
    window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'JSON 成绩文件', accept: { 'application/json': ['.json'] } }]
    }).then(async h => {
      const w = await h.createWritable(); await w.write(json); await w.close();
      toast('已导出：' + h.name);
    }).catch(e => {
      if (e && e.name === 'AbortError') { toast('已取消导出（成绩仍保留在本页）'); return; }
      try { downloadText(filename, json, 'application/json'); toast('已导出：' + filename + '（存到「下载」文件夹）'); }
      catch (e2) { exportFallback(json, filename); }
    });
    return;
  }
  try { downloadText(filename, json, 'application/json'); toast('已导出：' + filename + '（存到「下载」文件夹）'); }
  catch (e) { exportFallback(json, filename); }
}
function exportFallback(json, filename) {
  openModal('<div style="font-size:14px;line-height:1.8">当前浏览器不支持自动下载，请全选下方内容复制到文本编辑器，保存为 <b>' + esc(filename) + '</b></div>' +
    '<textarea class="rosterArea" style="height:180px" id="exportArea"></textarea>' +
    '<div style="text-align:center;margin-top:10px"><button class="btn sm" id="mClose2">关 闭</button></div>');
  $('exportArea').value = json;
  $('mClose2').onclick = closeModal;
}
/* 成绩列表合并：逐条 keepBest（同名同难度保最佳），返回合并条数。
   导入的统一语义（2026-10-11 何何老师实测"旧档导入抹掉点兵历史"事故根治）：
   **导入=合并保最佳，绝不整替** —— 想以文件为准，用「清空 → 导入」两步等效达成 */
function mergeRecords(list, inc, better) {
  let n = 0;
  (inc || []).forEach(r => { if (r && r.name != null) { keepBest(list, r, better); n++; } });
  return n;
}
function importDB(f, rerender) {
  if (!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      /* 与本项目 DB 逐字段**合并**（绝不整对象替换丢字段）；
         拓片按玩家合并（同名覆盖、他人保留——教室多学生轮流，导入不能清掉别人的收藏）；
         成绩列表 keepBest 合并（同名同难度保最佳），旧档导入不再回滚本机新成绩 */
      const impRub = migrateRubBy(d.rubBy, d.rubbings);
      const impSeen = migrateSeenBy(d.seenBy, d.rubTourSeenN);
      mergeRecords(DB.solo, d.solo, betterSolo);
      mergeRecords(DB.duo, d.duo, betterDuo);
      DB.roster = DB.roster || [];
      (d.roster || []).forEach(nm => { if (nm && DB.roster.indexOf(nm) < 0) DB.roster.push(nm); });
      DB.lib = d.lib || DB.lib || null;
      Object.keys(d.ach || {}).forEach(k => { if (d.ach[k]) DB.ach[k] = d.ach[k]; });   /* 成就=徽记旗标，取并集 */
      DB.rubTourSeenN = Math.max(DB.rubTourSeenN || 0, d.rubTourSeenN || 0);
      DB.rubBy = Object.assign({}, DB.rubBy || {}, impRub);
      DB.seenBy = Object.assign({}, DB.seenBy || {}, impSeen);
      DB.soloName = d.soloName || DB.soloName || '';   /* 旧版全机拓片自动迁入「我」名下；导入件缺省时保留本地上次参赛名字 */
      /* eggRec 按模式合并（dian.solo/duo 逐条 keepBest）——旧档导入绝不抹掉本机彩蛋成绩；
         eggSel 已撤出 DB（勾选=内存态，导入不涉及）。新增彩蛋模式若计分模型不同，需给 mergeRecords 配对应 better */
      const incEgg = (d.eggRec && typeof d.eggRec === 'object' && !Array.isArray(d.eggRec)) ? d.eggRec : null;
      if (incEgg) {
        DB.eggRec = DB.eggRec || {};
        Object.keys(incEgg).forEach(mid => {
          const dst = (DB.eggRec[mid] = DB.eggRec[mid] || {});
          ['solo', 'duo'].forEach(k => {
            const inc = incEgg[mid] && incEgg[mid][k];
            if (Array.isArray(inc)) { if (!Array.isArray(dst[k])) dst[k] = []; mergeRecords(dst[k], inc, betterDian); }
          });
        });
      }
      lastTs = [];
      DIFF_ORDER.forEach(k => { DB.solo = dedupeList(DB.solo, k); DB.duo = dedupeList(DB.duo, k); });
      saveDB();   /* 导入后必须 saveDB（若调 loadDB 会被 localStorage 旧值覆盖回去） */
      toast('导入成功（合并保最佳）：单人 ' + DB.solo.length + ' 条 / 双人 ' + DB.duo.length + ' 条 / 拓片 ' + rubCountOf(curPlayer()) + ' 字');
      if (rerender) rerender();
    } catch (e) { toast('文件格式不对，请选择本课件导出的 JSON', true); }
  };
  fr.readAsText(f);
}
function clearScores(scope, rerender) {
  const label = scope === 'duo' ? '对决成绩' : '单人成绩';
  if (!confirm('确定清空' + label + '吗？此操作不可撤销（建议先导出备份）。拓片收集不受影响。')) return;
  DB[scope] = [];
  lastTs = []; saveDB();
  toast('已清空' + label);
  if (rerender) rerender();
}
/* 结算页成绩管理三件套绑定（solo/duo 页互斥渲染，无 id 冲突） */
function wireScoreMgmt(rerender, scope) {
  const be = $('btnExport'), bi = $('btnImport'), bc = $('btnClearScores'), bf = $('importFile');
  if (be) be.onclick = exportDB;
  if (bi) bi.onclick = () => bf && bf.click();
  if (bf) bf.onchange = () => { importDB(bf.files[0], rerender); bf.value = ''; };
  if (bc) bc.onclick = () => clearScores(scope || 'solo', rerender);
}

/* ---------- 拓片墙 · 榜单 ---------- */
let BOARD_TAB = 'rub';
let BOARD_DIFF = null;   /* 难度子榜当前档（null=未选，默认取第一档菜鸟）；2026-10-08 何何老师定稿：
                            菜鸟/困难/梦魇三档实力不可比（同一页混排不科学不公平），三档分列独立榜单页内切换 */
/* 榜单表格（拓片墙·榜单页与结算页内嵌共用同一渲染）：tab='solo'|'duo'，limit 截断条数；
   diffFilter='rookie'|'hard'|'nightmare' 只排该难度（结算页内嵌=本局难度；拓片墙=BOARD_DIFF 子榜）；
   本轮记录（lastTs，保存时写入）自动高亮 me 行 */
function boardTableHTML(tab, limit, diffFilter) {
  const isSolo = tab === 'solo';
  const src = isSolo ? DB.solo : DB.duo;
  const list = diffFilter ? src.filter(r => r.diff === diffFilter) : src;
  if (!list.length) return { html: `<div class="boardEmpty">还没有战绩 —— 先去${isSolo ? '铸铭' : '对决'}一局！</div>`, rows: 0 };
  const better = isSolo ? betterSolo : betterDuo;
  const sorted = list.slice().sort((x, y) => better(x, y) ? -1 : 1);
  const shown = dedupeByName(sorted, better).slice(0, limit);
  const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
  const html = `<table class="rk"><tr>
      <th>#</th><th>史官</th>${isSolo ? '' : '<th>对手</th>'}
      <th>${isSolo ? '写铭总分' : 'PK总分'}</th><th>点亮拓片数</th><th>${isSolo ? '印章' : '胜负'}</th><th>日期</th></tr>
      ${shown.map((r, i) => {
        const me = (lastTs || []).indexOf(r.ts) >= 0;
        const wlab = isSolo ? r.marks : (r.win === 'W' ? '🏆 胜' : r.win === 'L' ? '负' : '平');
        return `<tr${me ? ' class="me"' : ''}><td>${medal(i)}</td><td>${esc(r.name)}</td>
        ${isSolo ? '' : '<td>' + esc(r.rival || '-') + '</td>'}
        <td><b>${isSolo ? r.traceTotal : r.score}</b></td>
        <td>${rubCountOf(r.name)}</td>
        <td>${wlab}</td>
        <td>${new Date(r.ts).toLocaleDateString()}</td></tr>`;
      }).join('')}</table>`;
  return { html, rows: shown.length };
}
/* 拓片墙榜单三件套（2026-10-11 何何老师定稿：每张榜单下方**常驻** 导入/导出/清空 ——
   不再只存在于结算页，退出对局、刷新、回封面后随时可备份/迁移/清理某一榜成绩）。
   导出/导入=全档成绩（与结算页同一套 exportDB/importDB，导入=合并保最佳绝不整替）；
   清空=仅本榜（单人/对决/点兵各自独立，拓片与其它榜不受影响）。
   拓片墙页签是收藏墙非排行榜，不设本行（拓片清空属危险操作且无既有函数，不做） */
const WALL_CLEAR_LABEL = { solo: '单人', duo: '对决', dian: '点兵' };
function wallMgmtHTML(tab) {
  return `<div class="resBtns" style="margin-top:12px">
    <button class="btn ghost sm" id="wallExport">⬇ 导出成绩</button>
    <button class="btn ghost sm" id="wallImport">⬆ 导入成绩</button>
    <button class="btn ghost sm" id="wallClear">🗑 清空${WALL_CLEAR_LABEL[tab] || ''}成绩</button>
    <input type="file" id="wallImportFile" accept=".json" style="display:none">
  </div>`;
}
function wireWallMgmt(tab) {
  const be = $('wallExport'), bi = $('wallImport'), bc = $('wallClear'), bf = $('wallImportFile');
  if (be) be.onclick = exportDB;
  if (bi) bi.onclick = () => bf && bf.click();
  if (bf) bf.onchange = () => { importDB(bf.files[0], () => renderBoard()); bf.value = ''; };
  if (!bc) return;
  bc.onclick = () => {
    if (tab === 'dian') {
      if (!confirm('确定清空点兵点将成绩吗？此操作不可撤销（建议先导出备份）。')) return;
      dianStore().solo = []; dianStore().duo = [];
      lastTs = []; saveDB(); toast('已清空点兵成绩'); renderBoard();
    } else {
      clearScores(tab, () => renderBoard());
    }
  };
}
function renderBoard() {
  const s = $('s9');
  const tabs = [['rub', '🏛️ 拓片墙'], ['solo', '📜 单人榜'], ['duo', '⚔️ 对决榜'], ['dian', '⛺ 点兵榜']];
  s.innerHTML = `
  <div class="wrap">
    <div class="h1">🏛️ 拓片墙 · 榜单</div>
    <div class="tabRow">${tabs.map(t => `<span class="chip ${BOARD_TAB === t[0] ? 'on' : ''}" data-tab="${t[0]}">${t[1]}</span>`).join('')}</div>
    <div id="boardBody"></div>
  </div>`;
  s.querySelectorAll('[data-tab]').forEach(c => c.onclick = () => { BOARD_TAB = c.dataset.tab; BOARD_DIFF = null; renderBoard(); });
  const body = $('boardBody');
  if (BOARD_TAB === 'rub') {
    const player = curPlayer();   /* 拓片墙=当前玩家的收藏（2026-10-06 按玩家归属） */
    const rubs = rubMapOf(player);
    const nRub = CHARS.filter(c => rubs[c]).length;
    body.innerHTML = `
      <div class="progLine"><span>已拓</span><div class="bar"><i style="width:${(nRub / CHARS.length * 100).toFixed(1)}%"></i></div><span><b>${nRub}</b> / ${CHARS.length}</span></div>
      <div class="rubGrid">${CHARS.map(ch => {
        const sc = rubs[ch], info = DZINFO[ch];
        return sc
          ? `<div class="rubCard"><div class="glyph">${svgOf(ch)}</div><div class="kai">${esc(ch)} · ${sc} 分</div><div class="sw">${esc(info.sw)}</div></div>`
          : `<div class="rubCard empty"><div class="glyph" style="font-family:'STKaiti','Kaiti SC',KaiTi,serif;font-size:40px;color:#776c5b;padding:12px 0">${esc(ch)}</div><div class="kai">待铸 · ${'一二三'[info.lv - 1]}阶</div><div class="sw">在写铭中拿 ${CAST_PASS} 分即拓</div></div>`;
      }).join('')}</div>`;
    if (nRub > (DB.seenBy[player] || 0)) {   /* 复用本分支已算好的 nRub（该玩家已拓数）；巡游已展示数也按玩家记 */
      DB.seenBy[player] = nRub; saveDB();   /* 有未展示过的已解锁字 ⇒ 进入即巡游（切走切回不重播） */
      /* 巡游序列：按行（offsetTop 分组）升序、行内从左到右、只含已拓卡 ⇒ 空行自然跳过；
         节奏（何何老师 2026-10-06 定稿）：每行总时长 1 秒，行内均分快闪（1000/行内张数/张） */
      const cards = [...body.querySelectorAll('.rubCard:not(.empty)')];
      const rows = new Map();
      cards.forEach(c => {
        const top = Math.round(c.offsetTop);
        if (!rows.has(top)) rows.set(top, []);
        rows.get(top).push(c);
      });
      const seq = [...rows.keys()].sort((a, b) => a - b)
        .flatMap(top => {
          const row = rows.get(top).sort((x, y) => x.offsetLeft - y.offsetLeft);
          const ms = Math.round(1000 / row.length);
          return row.map(c => ({ c, ms }));
        });
      startRubTour(seq);
    }
  } else if (BOARD_TAB === 'dian') {
    /* 点兵榜同样按难度分档（V3.2 三档轮数/满分不同，混排不公平；旧档无 diff → 菜鸟档） */
    const dKey = BOARD_DIFF && DIAN_TIERS[BOARD_DIFF] ? BOARD_DIFF : DIFF_ORDER[0];
    body.innerHTML = `
      <div class="diffTabs">${DIFF_ORDER.map(k => `<span class="chip ${k === dKey ? 'on' : ''}" data-diff="${k}">${DIAN_TIERS[k].icon} ${DIAN_TIERS[k].label}</span>`).join('')}</div>
      <div class="sub" style="text-align:center;margin:2px 0 10px">${DIAN_TIERS[dKey].icon} ${DIAN_TIERS[dKey].label}档点兵榜 —— 各难度独立排名（三档轮数与满分不同）</div>
      ${dianBoardHTML(12, dKey).html}${wallMgmtHTML('dian')}`;
    body.querySelectorAll('[data-diff]').forEach(c => c.onclick = () => { BOARD_DIFF = c.dataset.diff; renderBoard(); });
    wireWallMgmt('dian');
  } else {
    /* 难度子榜（2026-10-08 何何老师定稿）：菜鸟/困难/梦魇三档实力不可比，分列独立榜单页内切换；
       档位从 DIFF_ORDER 动态生成（不写死三档），子榜标题带该档图标与名 */
    const dKey = BOARD_DIFF && DIFF_ORDER.indexOf(BOARD_DIFF) >= 0 ? BOARD_DIFF : DIFF_ORDER[0];
    const dInfo = DIFF[dKey];
    body.innerHTML = `
      <div class="diffTabs">${DIFF_ORDER.map(k => `<span class="chip ${k === dKey ? 'on' : ''}" data-diff="${k}">${DIFF[k].icon} ${DIFF[k].name}</span>`).join('')}</div>
      <div class="sub" style="text-align:center;margin:2px 0 10px">${dInfo.icon} ${dInfo.name}榜 —— 各难度独立排名（三档实力不可比）</div>
      ${boardTableHTML(BOARD_TAB, 12, dKey).html}${wallMgmtHTML(BOARD_TAB)}`;
    body.querySelectorAll('[data-diff]').forEach(c => c.onclick = () => { BOARD_DIFF = c.dataset.diff; renderBoard(); });
    wireWallMgmt(BOARD_TAB);
  }
}

/* 拓片墙金框巡游：每行总时长 1 秒（行内均分，脉冲动画时长随槽位压缩=快闪），
   依次点亮下一张（later 注册进 TIMERS，离屏自动清理）；
   卡片被重建/离屏时立即终止（body.contains 守卫）；播完平滑滚回墙顶 */
function startRubTour(seq) {
  let i = 0;
  const step = () => {
    if (i >= seq.length) {
      const grid = document.querySelector('#boardBody .rubGrid');
      if (!grid || !document.body.contains(grid)) return;   /* 页面已切走：连收束一起放弃 */
      const s9 = document.getElementById('s9');
      s9.classList.remove('wallFinale');
      void s9.offsetWidth;                                  /* 强制 reflow：同页二巡游也能重播 */
      s9.classList.add('wallFinale');                       /* 收束：整页+金边框同闪 1s（仿铸鼎 dingFlash） */
      later(() => {
        s9.classList.remove('wallFinale');
        if (document.body.contains(grid)) grid.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 1000);
      return;
    }
    const { c, ms } = seq[i];
    if (!document.body.contains(c)) return;   /* 页面已切走/重建：巡游终止 */
    c.style.animationDuration = ms + 'ms';    /* 脉冲压缩进槽位：快闪但完整走完 */
    c.classList.add('tour');
    if (c.scrollIntoView) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    later(() => { c.classList.remove('tour'); c.style.animationDuration = ''; i++; step(); }, ms);
  };
  step();
}

/* ---------- 全局绑定与初始化 ---------- */
function bindGlobal() {
  $('btnHome').onclick = () => { go(P_COVER); };
  $('soundBtn').onclick = () => toggleSound();
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
}
function init() {
  loadDB();
  DB.rubBy = DB.rubBy || {};
  DB.seenBy = DB.seenBy || {};
  DB.ach = DB.ach || {};
  DB.eggRec = (DB.eggRec && typeof DB.eggRec === 'object') ? DB.eggRec : {};   /* V3.6 彩蛋成绩兜底（勾选=内存态，不在 DB） */
  try { if (localStorage.getItem('dgms_sound') === '0') { soundOn = false; const b = document.getElementById('soundBtn'); if (b) b.textContent = '🔕 音效：关'; } } catch (e) { }
  fxInit();
  setDiff('rookie'); CUR.diff = 'rookie';
  bindGlobal();
  go(P_COVER);
}
init();

/* 测试钩子（真机断言直接读取，不改变任何行为） */
window.__DG = {
  get S() { return S; }, get PK() { return PK; }, get CUR() { return CUR; },
  get DB() { return DB; }, get page() { return CUR_PAGE; },
  get LAST_DUO() { return LAST_DUO; },

  go, startSolo, pickTraceSet, judgeScore, autoSegs, timeOf, timeRangeOf,
  CHARS, DZINFO, SIMILAR, TRACE_POOL, DIFF, CAST_PASS, PK_ROUNDS, PK_GAIN, QUIZ_LIM
};
