/* =====================================================================
   鼎铭小史官 · p3 单人玩法层（导航 / 封面 / 字表 / 识铭 / 辨铭 / 写铭 / 铸鼎 / 结算）
   复用：p2b_engine（描红判定/音效/存储/特效/InkBox）、p2a_utils、p2c_info、p2d_calib
   ===================================================================== */

/* ---------- 页面常量与全局状态 ---------- */
const P_COVER = 0, P_BOOK = 1, P_DETECT = 2, P_DISCERN = 3, P_TRACE = 4,
      P_CAST = 5, P_RESULT = 6, P_DUO_PREP = 7, P_DUO = 8, P_BOARD = 9,
      P_ANIM_SOLO = 10, P_ANIM_DUO = 11, P_DUO_RESULT = 12;
const PAGE_N = ['封面', '字表·我的鼎', '识铭', '辨铭', '写铭', '铸鼎仪式', '结算', '双人对决', '对决', '拓片墙·榜单', '单人揭榜', '双人揭榜', '双人结算',
  '世外桃源', '点兵点将', '点将PK', '点将结算'];   /* 13~16 为 V3.6 彩蛋层新增屏（旧屏页码不动） */
const QUIZ_DETECT_N = 6;      /* 识铭题数（不写死判分边界，仅题量常量） */
const QUIZ_DISCERN_N = 4;     /* 辨铭题数 */
const QUIZ_LIM = 3;           /* 限时模式下每题秒数（2026-10-07 何何老师定稿：8→3，认字只花「看」的时间；
                                 PK 辨铭抢答同走此值——原先误用描红模型 timeOf≈10~18s，对认字题过长） */
const CAST_PASS = 60;         /* 铸鼎/拓片合格线（分） */
const CUR = { diff: 'rookie', timed: false };
let S = null;                 /* 单人会话状态 */
/* 拓片墙巡游触发用持久化时间戳：lastCastTs（本关铸鼎时刻）> rubTourSeenTs（上次巡游时刻）
   ⇒ 首次打开拓片墙播金框巡游。放 DB 持久化而非内存标记：玩家完成关卡后即使
   关浏览器/刷新，下次打开拓片墙仍是"首次"（语义完整） */
const TIMERS = [];
function later(fn, ms) { const id = setTimeout(fn, ms); TIMERS.push(id); return id; }
function every(fn, ms) { const id = setInterval(fn, ms); TIMERS.push(id); return id; }
function stopAll() {
  TIMERS.splice(0).forEach(id => { clearTimeout(id); clearInterval(id); });
  stopFx(); closeModal(); stopClimb(); closeEggGate();
  document.getElementById('cdWrap').classList.remove('on');
}
let CUR_PAGE = -1;
function go(n) {
  stopAll();
  const slides = document.querySelectorAll('#deck .slide');
  slides.forEach((s, i) => {
    const on = i === n;
    s.classList.toggle('on', on);
    if (!on && s.innerHTML) s.innerHTML = '';   /* 离屏清空：根除跨屏重复 id（如 #qTimer）隐患 */
  });
  CUR_PAGE = n;
  const R = [renderCover, renderBook, renderDetect, renderDiscern, renderTrace, null, renderResult, renderDuoPrep, renderPkIdle, renderBoard,
    () => renderAnimIdle('soloStage', P_RESULT), () => renderAnimIdle('duoStage', P_DUO_RESULT), renderDuoResult,
    renderTaoyuan, renderDianHome, renderDianPkIdle, renderDianResult];   /* 13~16：V3.6 彩蛋层（p5/p6 提供渲染函数） */
  if (R[n]) R[n]();
  syncBadge();
}
function syncBadge() {
  const d = DIFF[CUR.diff];
  document.getElementById('diffBadge').textContent = (d ? d.icon + ' ' + d.name + '关' : '') + (CUR.timed ? ' · 限时' : '');
}

/* ---------- 小工具 ---------- */
function $(id) { return document.getElementById(id); }
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
function toast(msg) {
  const t = el('<div class="toast">' + esc(msg) + '</div>');
  $('toastWrap').appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function openModal(html) { $('modalCard').innerHTML = html; $('modal').classList.add('on'); }
function closeModal() { $('modal').classList.remove('on'); }

/* ---------- 封面 ---------- */
/* 封面播送带（何何老师 2026-10 五次定稿）：环绕接力式循环——
   右端消失多少文字，左端同步出现多少（同一份文案首尾环绕），带内可见量恒等于
   一个完整版「何何老师@PFLS」（主体 + 绕回的尾巴左右相加 = 完整一份），永不出现第二份。
   几何（2026-10-06 收窄定稿）：不再横贯 100vw——播送带与按钮行同包进 .coverActions
   （宽 fit-content = 四张功能卡行内容宽），带 = 「开始铸铭」左缘 ↔「拓片墙·榜单」右缘；
   两个副本各占一带宽，整体 translateX(-50%→0) 即每次平移一带宽循环。
   速度口径不变（≈28.4px/s），时长按 实测带宽÷28.4 写死在 CSS（唯一调参值，注释附换算式）。
   位置不变：tagline 与按钮行之间的空隙带（已加高）。 */
function orbitBar() {
  const item = '<i>何何老师@PFLS</i>';
  return '<div class="coverOrbit" aria-hidden="true"><span class="orbitRun">' + item + item + '</span></div>';
}
function renderCover() {
  const s = $('s0');
  const nRub = rubCountOf(curPlayer());   /* 拓片按玩家归属：首页计数随登录玩家刷新（2026-10-06） */
  s.innerHTML = `
  <div class="cover">
    <div class="orb"><span>铸</span><span>铭</span><span>问</span><span>鼎</span><span>论</span><span>英</span><span>雄</span></div>
    <div class="tagline">西周王庭 · 青铜铸铭 —— <b>大篆</b>识 · 辨 · 写三关训练营</div>
    <div class="coverActions">
      ${orbitBar()}
      <div class="coverBtns">
        <button class="btn" id="btnStartSolo">🖌️ 开始铸铭（单人）</button>
        <button class="btn gold" id="btnStartDuo">⚔️ 双人对决</button>
        <button class="btn ghost" id="btnBook">📜 鼎铭字库</button>
        <button class="btn ghost" id="btnBoard">🏛️ 拓片墙 · 榜单</button>
      </div>
    </div>
    ${eggCardsHTML()}
    <div class="panel setupCard">
      <div class="row"><div class="lab">参 赛 名 字（学号）</div>
        <input id="soloName" class="nameInput" maxlength="8" placeholder="名字或学号" value="${esc(DB.soloName || '')}">
      </div>
      <div class="row"><div class="lab">选 择 你 心 仪 的 难 度</div>
        ${DIFF_ORDER.map(k => `<span class="chip ${CUR.diff === k ? 'on' : ''}" data-diff="${k}">${DIFF[k].icon} ${DIFF[k].name}</span>`).join('')}
      </div>
      <div class="row"><div class="lab">追 加 限 时 挑 战</div>
        <span class="chip ${CUR.timed ? 'on' : ''}" id="timedChip">⏱ 限时挑战：${CUR.timed ? '开' : '关'}</span>
      </div>
      <div class="row sub" id="rubLine">🏛️ 拓片收集 <b id="rubCount" style="color:var(--patina);font-size:17px">${nRub}</b> / ${CHARS.length} · 试试点亮整座拓片墙会发生什么～</div>
    </div>
    <div class="footNote">${CHARS.length}字金文（大篆主体）字库 · 描红引擎 v3.2 · Copyright 2026-forever · V3.6</div>
  </div>`;
  wireEggCards(s);   /* V3.6 彩蛋卡（勾选了才渲染，p5） */
  { const orb = s.querySelector('.coverOrbit'); if (orb) orb.onclick = () => eggEntry(); }   /* 播送带 = 彩蛋入口：达标直进桃源，未达标弹口令窗（p5） */
  s.querySelectorAll('[data-diff]').forEach(c => c.onclick = () => {
    CUR.diff = c.dataset.diff; setDiff(CUR.diff); invalidateBand(); syncBadge(); renderCover();
  });
  /* 登录即刷新：名字输入框每敲一笔，首页拓片计数立即切换为该玩家的历史纪录（新玩家=0） */
  if ($('soloName')) $('soloName').addEventListener('input', () => {
    const nm = ($('soloName').value || '').trim();
    if (nm) { DB.soloName = nm; saveDB(); }   /* 逐笔记住，切难度重渲染不丢；留空=恢复默认玩家 */
    const rc = $('rubCount');
    if (rc) rc.textContent = rubCountOf(nm || curPlayer());
  });
  $('timedChip').onclick = () => { CUR.timed = !CUR.timed; renderCover(); };
  $('btnStartSolo').onclick = () => {   /* 参赛名字=出题不重复与榜单归属的玩家身份（2026-10-06 定稿） */
    CUR.playerName = ($('soloName').value || '').trim().slice(0, 8) || '我';
    if (CUR.playerName !== '我') { DB.soloName = CUR.playerName; saveDB(); }   /* 记住上次名字；留空则维持默认 */
    startSolo();
  };
  $('btnStartDuo').onclick = () => go(P_DUO_PREP);
  $('btnBook').onclick = () => go(P_BOOK);
  $('btnBoard').onclick = () => go(P_BOARD);
}
function setDiffSilent(k) { CUR.diff = k; setDiff(k); invalidateBand(); syncBadge(); }

/* ---------- 字表 · 我的鼎 ---------- */
function renderBook() {
  const s = $('s1');
  const nRub = rubCountOf(curPlayer());
  s.innerHTML = `
  <div class="wrap">
    <div class="h1">📜 鼎铭字库</div>
    <div class="sub">点开任一个字：金文形义 + 四体演变 · 铸鼎合格（≥${CAST_PASS} 分）的字会点亮「拓」</div>
    <div class="progLine"><span>拓片收集</span><div class="bar"><i style="width:${(nRub / CHARS.length * 100).toFixed(1)}%"></i></div><span><b>${nRub}</b> / ${CHARS.length}</span></div>
    <div class="gridChars">${CHARS.map(ch => {
      const info = DZINFO[ch];
      return `<div class="cell ${rubMapOf(curPlayer())[ch] ? 'rubbed' : ''}" data-ch="${ch}">
        <span class="lv">${'一二三'[info.lv - 1] || ''}阶</span>
        ${svgOf(ch)}<div class="kai">${esc(ch)}</div></div>`;
    }).join('')}</div>
  </div>`;
  s.querySelectorAll('.cell').forEach(c => c.onclick = () => showCharDetail(c.dataset.ch));
}
/* 四体卡别名（何何老师 2026-10-06 定稿）：甲骨文无独立「手」字，以三指侧形「又」表手
   （港中大多功能字库「手」字头原文：「『手』甲骨文一般作『又』，只见三指」；汉典/etymology-svg 均无 oracle 手）。
   显示层别名：卡片展示「又」的甲骨文形并如实标注，不写入 GLYPHS4（数据层不把又冒充成手）。
   paths = 汉典 zdic.net jiaguwen/41_EE90（滤角标），又为 35 字外借字形。 */
const EVO_ALIAS = { 手: { oracle: { label: '甲骨文「又」（表手）', paths: ["m106.81 367.01c-.71-3.55-1.49-6.74-1.91-9.98-.12-.91.59-2.15 1.29-2.91 19.26-20.89 34.74-44.33 46.86-69.97 4.87-10.29 8.32-21.09 9.13-32.55.1-1.42-.67-3.3-1.68-4.34-12.84-13.24-26.06-26.12-38.64-39.6-8.19-8.77-14.39-19.07-19.62-30.65 5.36-.31 10.4-.94 15.43-.83 11.13.24 21.68 2.63 30.37 10.19 2.39 2.08 4.5 4.49 6.63 6.84 5.78 6.39 12.06 7.91 20.06 4.61 8.87-3.66 15.4-10.35 21.82-17.15.94-1 1.79-2.08 2.81-3.27-1.83-2.07-3.76-3.99-5.39-6.14-3.11-4.11-3.22-6.52-.38-10.69 3.13-4.62 3.16-9.55 1.69-14.61-.32-1.11-1.31-2.14-2.22-2.96-5.66-5.12-11.4-10.15-17.09-15.25-.86-.77-1.79-1.58-2.3-2.58-8.03-15.63-16.33-31.13-23.84-47.01-4.91-10.39-7.24-21.68-7.88-33.2-.07-1.27.79-3.04 1.81-3.85 7.52-6.01 7.56-5.94 15.97-.85 16.67 10.09 28.87 24.5 38.75 40.93 13.08 21.73 23.12 44.73 27.69 69.88 2.82 15.48 1.88 30.71-1.72 46-2.86 12.14-5.11 24.45-7.02 36.77-1.05 6.76.65 13.45 3.09 19.9 2.34 6.19 7.5 9.97 12.12 14.04 12.16 10.73 24.71 21 37.02 31.56 11.72 10.05 19.56 22.4 22.19 37.84.55 3.24.09 5.42-2.87 7.43-6.01 4.07-5.87 4.26-11.8-.08-25.86-18.87-51.73-37.71-77.54-56.65-1.79-1.32-3.07-1.62-4.57.08-.14.16-.32.28-.5.39-12.72 8.3-22.35 19.32-30.43 32.21-6.84 10.91-14.64 21.36-23.12 31.05-8.69 9.92-20.58 14.49-34.21 15.4z"] } } };
function showCharDetail(ch) {
  const info = DZINFO[ch];
  const evo = ['oracle', 'bronze', 'seal', 'clerical'].map(sc => {
    const t = { oracle: '甲骨文', bronze: '金文（大篆主体）', seal: '小篆', clerical: '隶书' }[sc];
    const alias = EVO_ALIAS[ch] && EVO_ALIAS[ch][sc];
    if (alias) {
      const svg = `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">` + alias.paths.map(d => `<path d="${d}" fill="#241c14"/>`).join('') + `</svg>`;
      return `<div class="evoCell">${svg}<div class="t">${esc(alias.label)}</div></div>`;
    }
    return GLYPHS4[sc] && GLYPHS4[sc][ch] ? `<div class="evoCell">${svgOf(ch, sc)}<div class="t">${t}</div></div>` : '';
  }).join('');
  const rub = rubMapOf(curPlayer())[ch];
  openModal(`
    <div style="text-align:center">
      <div style="display:flex;justify-content:center">${svgOf(ch, 'bronze', '') .replace('<svg ', '<svg width="150" height="150" ')}</div>
      <div class="bigchar" style="font-size:44px">${esc(ch)} <span style="font-size:16px;color:var(--muted)">${esc(info.py)}</span>
        <span class="chip" style="cursor:default;font-size:12px">${esc(info.cat)} · ${'一二三'[info.lv - 1]}阶</span></div>
      <div class="evoRow">${evo}</div>
      <div style="text-align:left;font-size:14px;line-height:1.8"><b>字义：</b>${esc(info.sw)}<br><b>金文讲解：</b>${esc(info.desc)}</div>
      ${rub ? `<div style="margin-top:10px;color:var(--patina);font-weight:800">🏛️ 已铸鼎上拓 · 最佳 ${rub} 分</div>` : ''}
      <div style="margin-top:12px"><button class="btn sm" id="mClose">关 闭</button></div>
    </div>`);
  $('mClose').onclick = closeModal;
}

/* ---------- 单人会话 ---------- */
function pickTraceSet(diff, dry) {
  const d = DIFF[diff];
  const out = [];
  [1, 2, 3].forEach(lv => {
    let pool = TRACE_POOL.filter(c => DZINFO[c].lv === lv);
    if (pool.length < (d.pick[lv] || 0)) pool = pool.concat(CHARS.filter(c => DZINFO[c].lv === lv && !pool.includes(c)));
    out.push(...shuffle(pool).slice(0, d.pick[lv] || 0));
  });
  if (out.length < d.count) { /* 兜底：分层不足时从全体 TRACE_POOL 补齐 */
    out.push(...shuffle(TRACE_POOL.filter(c => !out.includes(c))).slice(0, d.count - out.length));
  }
  const list = shuffle(out).slice(0, d.count);
  return { list, range: timeRangeOf(list.length ? list : CHARS) };
}
function startSolo() {
  const d = DIFF[CUR.diff];
  const tset = pickTraceSet(CUR.diff);
  /* 出题去重（何何老师 2026-10-06 定稿）：去重生命周期=一局——开局建去重集（识铭 6 字 → 辨铭从
     「相似池 − 识铭已用字」选 ⇒ 同局认字零重复），结算即作废，下一位玩家/下一局从头再来（局内存量不落库） */
  const dchars = shuffle(CHARS.slice()).slice(0, QUIZ_DETECT_N);
  const cchars = shuffle(CHARS.filter(c => !dchars.includes(c) && SIMILAR[c] && SIMILAR[c].length >= 3)).slice(0, QUIZ_DISCERN_N);
  if (cchars.length < QUIZ_DISCERN_N) {   /* 兜底：相似池不足时从其余未用字补齐（同局仍不重复） */
    shuffle(CHARS.filter(c => !dchars.includes(c) && !cchars.includes(c)))
      .slice(0, QUIZ_DISCERN_N - cchars.length)
      .forEach(c => cchars.push(c));
  }
  S = {
    diff: CUR.diff, timed: CUR.timed,
    dq: dchars.map(ch => mkQuestion(ch, Math.random() < 0.5 ? 'b2s' : 's2b')),
    di: 0, dmarks: 0,
    cq: cchars.map(ch => ({ ch, options: shuffle([ch].concat(SIMILAR[ch].slice(0, 3))) })),
    ci: 0, cmarks: 0,
    tList: tset.list, ti: 0, tScores: {}, tLeft: 0,
    t0: Date.now(), saved: false,
    streak: 0, maxStreak: 0, wrongChars: [], rLeft: 2
  };
  go(P_DETECT);
  toast(`「识铭」开始 · 共 ${S.dq.length} 题`);
}

/* ---------- 识铭 ---------- */
function renderDetect() {
  const s = $('s2');
  const q = S.dq[S.di];
  const stem = q.dir === 'b2s'
    ? `<div class="glyphCard">${svgOf(q.ch)}</div>`
    : `<div class="glyphCard" style="background:#fff8e6"><div class="bigchar" style="font-size:clamp(80px,14vw,120px)">${esc(q.ch)}</div></div>`;
  const opts = q.options.map(o => q.dir === 'b2s'
    ? `<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`
    : `<button class="opt" data-o="${esc(o)}" style="padding:8px">${svgOf(o)}</button>`).join('');
  s.innerHTML = `
  <div class="qsWrap">
    <div class="qTop"><span class="marks">印章 <b id="qMarks">${S.dmarks}</b></span><span id="streakEl" style="color:#c0392b;font-weight:800;font-size:13px;white-space:nowrap"></span>
      <div class="prog"><i style="width:${(S.di / S.dq.length * 100)}%"></i></div>
      <span class="timer" id="qTimer"></span></div>
    <div class="stemBox">${stem}</div>
    <div class="opts c4" id="qOpts">${opts}</div>
    <div class="qFeed" id="qFeed"></div>
  </div>`;
  setupQuizTimer('识铭');
  s.querySelectorAll('.opt').forEach(b => b.onclick = () => answerQuiz(b, q, 'd'));
  { const se = $('streakEl'); if (se && (S.streak || 0) >= 2) se.textContent = '🔥 连对 ' + S.streak; }
}
/* 识铭/辨铭共用答题逻辑（mode: 'd' | 'c'） */
function compareHTML(q, chosen) {
  const sc = q.stemSc || SCRIPT;
  if (!chosen || chosen === q.ch) return '';
  const one = (c, cap) => '<span style="display:inline-flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.6);border-radius:10px;padding:4px 10px;margin:0 4px;vertical-align:middle">' + svgOf(c, sc) + '<span style="font-size:11px;color:var(--muted)">' + esc(cap) + '</span></span>';
  return '<div style="margin-top:8px">' + one(q.ch, '正确 ' + q.ch) + one(chosen, '你选 ' + chosen) + '</div>';
}
function answerQuiz(btn, q, mode) {
  const feed = $('qFeed');
  const ok = btn.dataset.o === q.ch;
  document.querySelectorAll('#' + (mode === 'd' ? 's2' : 's3') + ' .opt').forEach(b => {
    b.disabled = true;
    if (b.dataset.o === q.ch) b.classList.add('right');
  });
  if (!ok) btn.classList.add('wrong');
  if (mode === 'd') { S.dmarks += ok ? MARK_DETECT : 0; const m = $('qMarks'); if (m) m.textContent = S.dmarks; }
  else { S.cmarks += ok ? MARK_DISCERN : 0; const m = $('qMarks'); if (m) m.textContent = S.cmarks; }
  if (ok) { S.streak = (S.streak || 0) + 1; S.maxStreak = Math.max(S.maxStreak || 0, S.streak); }
  else { S.streak = 0; if ((S.wrongChars || []).indexOf(q.ch) < 0) (S.wrongChars = S.wrongChars || []).push(q.ch); }
  const se = $('streakEl'); if (se) se.textContent = S.streak >= 2 ? '🔥 连对 ' + S.streak : '';
  const info = DZINFO[q.ch];
  if (ok) { feed.className = 'qFeed good'; feed.textContent = '✔ 答对！' + info.sw; sndRight(); floatScore('＋' + (mode === 'd' ? MARK_DETECT : MARK_DISCERN), btn); }
  else { feed.className = 'qFeed bad'; feed.innerHTML = '✘ 正确是「' + q.ch + '」— ' + info.sw + compareHTML(q, btn.dataset.o); sndWrong(); }
  later(() => {
    const idx = mode === 'd' ? ++S.di : ++S.ci;
    const total = mode === 'd' ? S.dq.length : S.cq.length;
    if (idx < total) {
      if (mode === 'd') renderDetect();
      else renderDiscern();
    } else if (mode === 'd') { go(P_DISCERN); toast('「辨铭」开始：长得像的字，考眼力！'); }
    else { go(P_TRACE); toast('「写铭」开始：一笔一画，铸上铜鼎！'); }
  }, 1000);
}
function setupQuizTimer(label) {
  if (!CUR.timed) return;
  S.tLeft = QUIZ_LIM;
  const tEl = $('qTimer');
  tEl.textContent = S.tLeft + 's';
  let dead = false;   /* 闭包标记：跨屏同名元素曾被误标 dead（根因已由 go() 清屏根治，此处双保险） */
  const ivId = every(() => {
    if (dead) { clearInterval(ivId); return; }
    S.tLeft--;
    tEl.textContent = S.tLeft + 's';
    tEl.classList.toggle('urgent', S.tLeft <= 3);
    if (S.tLeft <= 3 && S.tLeft > 0) sndTick();
    if (S.tLeft <= 0) {
      dead = true;
      clearInterval(ivId);
      const opts = document.querySelectorAll((CUR_PAGE === P_DETECT ? '#s2' : '#s3') + ' .opt');
      let hit = null;
      opts.forEach(b => { b.disabled = true; if (b.dataset.o === (CUR_PAGE === P_DETECT ? S.dq[S.di] : S.cq[S.ci]).ch) hit = b; });
      if (hit) hit.classList.add('right');
      const feed = $('qFeed');
      feed.className = 'qFeed bad'; feed.textContent = '⏰ 超时！' + label + '要眼疾手快哦';
      sndWhoops();
      later(() => {
        const idx = CUR_PAGE === P_DETECT ? ++S.di : ++S.ci;
        const total = CUR_PAGE === P_DETECT ? S.dq.length : S.cq.length;
        if (idx < total) (CUR_PAGE === P_DETECT ? renderDetect() : renderDiscern());
        else if (CUR_PAGE === P_DETECT) { go(P_DISCERN); }
        else { go(P_TRACE); }
      }, 1000);
    }
  }, 1000);
}

/* ---------- 辨铭 ---------- */
function renderDiscern() {
  const s = $('s3');
  const q = S.cq[S.ci];
  s.innerHTML = `
  <div class="qsWrap">
    <div class="qTop"><span class="marks">印章 <b id="qMarks">${S.cmarks}</b></span><span id="streakEl" style="color:#c0392b;font-weight:800;font-size:13px;white-space:nowrap"></span>
      <div class="prog"><i style="width:${(S.ci / S.cq.length * 100)}%"></i></div>
      <span class="timer" id="qTimer"></span></div>
    <div class="sub" style="text-align:center">青铜拓片上这个字是谁？四个楷体里选最准的（相似字甄别）</div>
    <div class="stemBox"><div class="glyphCard">${svgOf(q.ch)}</div></div>
    <div class="opts c4" id="qOpts">${q.options.map(o => `<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
    <div class="qFeed" id="qFeed"></div>
  </div>`;
  setupQuizTimer('辨铭');
  s.querySelectorAll('.opt').forEach(b => b.onclick = () => answerQuiz(b, q, 'c'));
  { const se = $('streakEl'); if (se && (S.streak || 0) >= 2) se.textContent = '🔥 连对 ' + S.streak; }
}

/* ---------- 写铭 ---------- */
let INK = null;
function renderTrace() {
  const s = $('s4');
  if (!S || !S.tList || !S.tList.length) {   /* 冷启动/异常路径直跳的空态守卫（go(i) 可独立渲染每一页） */
    s.innerHTML = `<div class="boardEmpty" style="padding:60px 0">写铭还没开始 —— 先回封面点「开始铸铭」。</div>`;
    return;
  }
  const ch = S.tList[S.ti];
  const info = DZINFO[ch];
  s.innerHTML = `
  <div class="wrap">
    <div class="qTop"><span class="marks">第 ${S.ti + 1} / ${S.tList.length} 字</span>
      <div class="prog"><i style="width:${(S.ti / S.tList.length * 100)}%"></i></div>
      <span class="timer" id="qTimer"></span></div>
    <div class="trWrap">
      <div id="trCvHost"></div>
      <div class="panel trPanel">
        <div class="charMeta"><span class="big">${esc(ch)}</span><span class="py">${esc(info.py)} · ${esc(info.cat)} · ${'一二三'[info.lv - 1]}阶</span></div>
        <div class="verdict" id="trVerdict">照着青铜上的灰字描，一笔一笔来。</div>
        <div class="scoreRow" id="trScores" style="display:none"></div>
        <div class="strokeChips" id="trStrokes"></div>
        <div class="trBtns">
          <button class="btn sm ghost" id="btnTrClear">🧹 清 重 写</button>
          <button class="btn sm" id="btnTrSubmit">✅ 提 交 判 定</button>
          <button class="btn sm gold" id="btnTrNext" style="display:none">下一字 ⏭</button>
          <button class="btn sm gold" id="btnTrRetry" style="display:none">💪 再写一次</button>
        </div>
        <div class="bandNote">${DIFF[S.diff].band} · 逐笔中心线被覆盖 &lt;80% 判「未写完」${S.timed ? (S.diff === 'nightmare' ? ' · 梦魇限时：缺一笔整字归零' : ' · 限时下未写完的笔不计分') : ''}<br>提笔即判：松手自动草评，提交后正式计分。</div>
      </div>
    </div>
  </div>`;
  /* InkBox 必须在内层重建：renderTrace 重建了 #trCvHost，旧实例的画布已随旧 DOM 失联 */
  if (INK) INK.el.remove();
  INK = InkBox($('trCvHost'), onInkChange);
  INK.setChar(ch);
  INK.setLock(false);
  S.rLeft = 2;
  $('btnTrClear').onclick = () => { INK.clear(); INK.setLock(false); resetTrPanel(); };
  $('btnTrSubmit').onclick = () => trSubmit(false);
  $('btnTrNext').onclick = () => trNext();
  $('btnTrRetry').onclick = () => {
    if ((S.rLeft || 0) <= 0) return;
    S.rLeft--; INK.clear(); INK.setLock(false); resetTrPanel();
    $('btnTrRetry').style.display = 'none';
    if (S.timed) startTraceTimer();
    toast('再写一次 · 剩 ' + S.rLeft + ' 次机会');
  };
  startTraceTimer();
}
function onInkChange() {
  /* 松手草评（不锁笔、不计分） */
  const ch = S.tList[S.ti];
  const used = INK.used();
  if (!used.length) { resetTrPanel(); return; }
  const r = judgeScore(used, ch);
  const v = $('trVerdict');
  if (v) v.textContent = `草评：贴合 ${Math.round(r.prec * 100)} · 覆盖 ${Math.round(r.recall * 100)} —— 满意就点「提交判定」`;
}
function resetTrPanel() {
  const v = $('trVerdict'); if (v) v.textContent = '照着青铜上的灰字描，一笔一笔来。';
  const sc = $('trScores'); if (sc) { sc.style.display = 'none'; sc.innerHTML = ''; }
  const st = $('trStrokes'); if (st) st.innerHTML = '';
  const bn = $('btnTrSubmit'); if (bn) bn.style.display = '';
  const nx = $('btnTrNext'); if (nx) nx.style.display = 'none';
}
function startTraceTimer() {
  const tEl = $('qTimer');
  if (!S.timed || !tEl) { if (tEl) tEl.textContent = ''; return; }
  S.tLeft = timeOf(S.tList[S.ti]);
  tEl.textContent = S.tLeft + 's';
  every(() => {
    S.tLeft--;
    tEl.textContent = S.tLeft + 's';
    tEl.classList.toggle('urgent', S.tLeft <= 3);
    if (S.tLeft <= 3 && S.tLeft > 0) sndTick();
    if (S.tLeft <= 0) { tEl.textContent = '0s'; sndWhoops(); trSubmit(true); }
  }, 1000);
}
function trSubmit(timedOut) {
  const ch = S.tList[S.ti];
  const used = INK.used();
  TIMERS.splice(0).forEach(id => { clearTimeout(id); clearInterval(id); });
  if (!used.length && !timedOut) { toast('先描几笔再提交哦'); return; }
  const r = judgeScore(used, ch, { timed: !!S.timed, wholeZero: !!(S.timed && S.diff === 'nightmare') });
  S.tScores[ch] = r.score;
  INK.setLock(true);
  const v = $('trVerdict');
  const pass = r.score >= CAST_PASS;
  v.innerHTML = timedOut && !used.length ? '⏰ 超时未交卷 — 0 分'
    : (pass ? `🎉 <b style="color:var(--ok)">${r.score} 分 · 可以铸上铜鼎！</b>` : `💦 <b style="color:var(--cin)">${r.score} 分 · 差一点，这个字先不铸</b>`)
    + (r.zeroed ? ' · 梦魇规则：缺一笔整字归零' : '')
    + (r.unfinished ? ` · 未写完 ${r.unfinished} 笔` : '');
  const sc = $('trScores');
  sc.style.display = '';
  sc.innerHTML = `
    <span class="scoreTag">贴合 <b>${Math.round(r.prec * 100)}</b></span>
    <span class="scoreTag">覆盖 <b>${Math.round(r.recall * 100)}</b></span>
    <span class="scoreTag">出界 <b>${r.offPx}</b>px</span>
    <span class="scoreTag">笔画 <b>${r.totalStrokes}</b></span>
    <span class="scoreTag">判定 <b>${Math.round(r.ms)}ms</b></span>`;
  $('trStrokes').innerHTML = r.strokes.map((st, i) => {
    const cls = st.unfinished ? 'unfinished' : (st.doneR >= 0.8 && st.meanDev <= 10 ? 'ok' : 'bad');
    return `<span class="sChip ${cls}" title="覆盖${Math.round(st.doneR * 100)}% · 偏离${st.meanDev ? st.meanDev.toFixed(1) : '-'}px">${i + 1}</span>`;
  }).join('');
  $('btnTrSubmit').style.display = 'none';
  if (!pass && (S.rLeft || 0) > 0) { const rb = $('btnTrRetry'); if (rb) rb.style.display = ''; }
  $('btnTrNext').style.display = '';
  $('btnTrNext').textContent = S.ti === S.tList.length - 1 ? '去铸鼎 ⏭' : '下一字 ⏭';
  if (pass) { sndJudge(); floatScore(String(r.score), $('trCvHost')); } else sndWrong();
}
function trNext() {
  S.ti++;
  if (S.ti < S.tList.length) renderTrace();
  else { go(P_CAST); renderCast(); }   /* 先 go（清计时器/切屏）再渲染动画 */
}

/* ---------- 铸鼎仪式 ---------- */
const DING_SVG = `
<svg viewBox="0 0 300 268" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bronzeG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a5824a"/><stop offset=".5" stop-color="#7c6134"/><stop offset="1" stop-color="#57431f"/>
    </linearGradient>
    <linearGradient id="bronzeD" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4a3a1c"/><stop offset=".5" stop-color="#6b5427"/><stop offset="1" stop-color="#3c2e13"/>
    </linearGradient>
  </defs>
  <path d="M84 58 C82 26, 134 26, 132 58 L126 58 C126 36, 90 36, 90 58 Z" fill="url(#bronzeD)" stroke="#3a2d13" stroke-width="2"/>
  <path d="M168 58 C166 26, 218 26, 216 58 L210 58 C210 36, 174 36, 174 58 Z" fill="url(#bronzeD)" stroke="#3a2d13" stroke-width="2"/>
  <rect x="46" y="54" width="208" height="122" rx="22" fill="url(#bronzeG)" stroke="#3a2d13" stroke-width="3.5"/>
  <rect x="54" y="88" width="192" height="9" rx="4.5" fill="#4a3a1c" opacity=".6"/>
  <rect x="54" y="134" width="192" height="9" rx="4.5" fill="#4a3a1c" opacity=".6"/>
  <circle cx="78" cy="70" r="5" fill="#3f7d5c" opacity=".5"/><circle cx="222" cy="160" r="6" fill="#3f7d5c" opacity=".45"/>
  <circle cx="140" cy="64" r="4" fill="#3f7d5c" opacity=".4"/><circle cx="244" cy="102" r="4" fill="#3f7d5c" opacity=".45"/>
  <path d="M80 176 L102 176 L96 238 L82 238 Z" fill="url(#bronzeD)" stroke="#3a2d13" stroke-width="2"/>
  <path d="M139 176 L161 176 L155 246 L133 246 Z" fill="url(#bronzeD)" stroke="#3a2d13" stroke-width="2"/>
  <path d="M198 176 L220 176 L218 238 L204 238 Z" fill="url(#bronzeD)" stroke="#3a2d13" stroke-width="2"/>
</svg>`;
function renderCast() {
  const s = $('s5');
  const entries = S.tList.map(ch => ({ ch, score: S.tScores[ch] || 0 }));
  const pass = entries.filter(e => e.score >= CAST_PASS);
  const fail = entries.filter(e => e.score < CAST_PASS);
  s.innerHTML = `
  <div class="castWrap">
    <div class="h1">🔥 铸 鼎 仪 式</div>
    <div class="sub">铸造工匠把写合格的字铸上王鼎 —— 合格线 ${CAST_PASS} 分，今日合格 <b style="color:var(--gold-hi)">${pass.length}</b> 字</div>
    <div class="dingBox">${DING_SVG}<div id="dingSlots">${CHARS.map(() => '<div class="slotChar"></div>').join('')}</div></div>
    <div class="castCaption" id="castCap">铜水已备，史官就位……</div>
    <div style="margin-top:10px"><button class="btn gold" id="btnCastGo" style="display:none">去结算 ➜</button></div>
  </div>`;
  const slots = s.querySelectorAll('.slotChar');
  /* 槽位顺序：按 lv 分层排布（先易后难），写合格的字入槽 */
  const ordered = CHARS.slice();
  let delay = 500;
  if (!pass.length) {
    $('castCap').textContent = '今日无一字合格 —— 西周铸铭，讲究的就是千锤百炼。再来一次！';
    sndWhoops();
    $('btnCastGo').style.display = '';
  } else {
    /* 落字随机化（何何老师 2026-10-06 定稿）：顺序洗牌不按固定次序；来向上下左右随机；
       距离 60~130px + 垂直抖动 ±12px；间隔 200~480ms 随机——各字仍落回自己的铭文槽位 */
    const order = shuffle(pass.slice());
    order.forEach((e, i) => {
      later(() => {
        const slot = Array.from(slots)[ordered.indexOf(e.ch)];
        if (slot) {
          const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
          const [ux, uy] = dirs[(Math.random() * 4) | 0];
          const dist = 60 + Math.random() * 70;
          const px = ux ? 0 : Math.random() * 24 - 12;
          const py = uy ? 0 : Math.random() * 24 - 12;
          slot.style.setProperty('--dx', (ux * dist + px).toFixed(1) + 'px');
          slot.style.setProperty('--dy', (uy * dist + py).toFixed(1) + 'px');
          slot.textContent = e.ch;
          slot.classList.add('in', 'flash');   /* 字带金边落鼎：charDrop（向量由 --dx/--dy 注入）渐亮渐宽 → 落定 charFlash 1s（class 不移除，播完自然回归） */
        }
        $('castCap').innerHTML = `正在浇铸 <b>「${esc(e.ch)}」</b>（${e.score} 分）……`;
        later(sndSeal, 550);   /* 封印音效对齐落定瞬间（charDrop 下落 0.55s），走 TIMERS 离屏自清 */
        if (i === order.length - 1) {
          later(() => {
            $('castCap').innerHTML = `青铜大器告成！今日铸字 <b>${pass.length}</b>，拓片入库 🏛️${fail.length ? ` · 未合格 ${fail.length} 字继续加油` : ''}`;
            const db = s.querySelector('.dingBox');
            if (db) db.classList.add('dingFlash');   /* 全部铸完：整鼎高亮闪烁 2s */
            sndWin(); startFx();
            mergeRubbings(pass);
            $('btnCastGo').style.display = '';
          }, 600);
        }
      }, delay);
      delay += 200 + Math.random() * 280;   /* 间隔随机 200~480ms（原固定 340） */
    });
  }
  $('btnCastGo').onclick = () => {
    stopFx();
    finishSoloSave();   /* 入榜结果在结算页由「刷新个人最佳/未超最佳」标签承载，此处不再弹 toast（会压住结算页标题） */
    go(P_ANIM_SOLO);
    /* playClimb 约定：list[0] = 第 1 名（最佳在前），内部从队尾最差名次开始逐个打飞 */
    const { head } = topForClimb(DB.solo.filter(r => r.diff === S.diff), betterSolo, 8);
    playClimb(head, 'soloStage', 'solo', () => go(P_RESULT));
  };
}
/* 单人成绩入榜（同名同难度去重保最佳），返回 {rec, improved, old}；
   抬杠纪律：入榜动作只发生一次（S.saved 幂等闸门），供铸鼎按钮与结算页共用 */
function finishSoloSave() {
  if (S.saved) return S.savedRec;
  const scores = S.tList.map(ch => S.tScores[ch] || 0);
  const avg = scores.length ? r1(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const rec = {
    name: CUR.playerName || DB.soloName || '我', diff: S.diff, timed: !!S.timed, traceTotal: avg, traceAvg: avg,
    marks: S.dmarks + S.cmarks, words: S.tList.length,
    rows: S.tList.map(ch => ({ ch, score: S.tScores[ch] || 0 })),
    time: Math.round((Date.now() - S.t0) / 1000), ts: Date.now()
  };
  const res = keepBest(DB.solo, rec, betterSolo);
  saveDB();
  lastTs = [res.rec.ts];   /* 本轮铭牌在揭榜动画与榜单里高亮 */
  S.saved = true;
  S.savedRec = { rec: res.rec, improved: res.improved, old: res.old };
  return S.savedRec;
}
function mergeRubbings(pass) {
  const p = curPlayer(), m = (DB.rubBy[p] = DB.rubBy[p] || {});
  pass.forEach(e => { m[e.ch] = Math.max(m[e.ch] || 0, Math.round(e.score)); });
  saveDB();
}

/* ---------- 结算 ---------- */
function renderResult() {
  const s = $('s6');
  const scores = S.tList.map(ch => S.tScores[ch] || 0);
  const avg = scores.length ? r1(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const marks = S.dmarks + S.cmarks;
  const castN = scores.filter(x => x >= CAST_PASS).length;
  const t = titleOf(avg);
  /* V2 学习闭环：错字/低分字复习 + 成就 */
  const wrongSet = [];
  (S.wrongChars || []).forEach(c => { if (wrongSet.indexOf(c) < 0) wrongSet.push(c); });
  const lowSet = S.tList.filter(ch => (S.tScores[ch] || 0) < CAST_PASS);
  const achDefs = [['first', '初试锋芒'], ['perfect', '满分一笔'], ['streak5', '五连破'], ['allpass', '全字合格']];
  const earned = [];
  if (S.tList.some(ch => (S.tScores[ch] || 0) >= CAST_PASS) && !DB.ach.first) { DB.ach.first = 1; earned.push('first'); }
  if (S.tList.some(ch => (S.tScores[ch] || 0) >= 100) && !DB.ach.perfect) { DB.ach.perfect = 1; earned.push('perfect'); }
  if ((S.maxStreak || 0) >= 5 && !DB.ach.streak5) { DB.ach.streak5 = 1; earned.push('streak5'); }
  if (S.tList.length > 0 && S.tList.every(ch => (S.tScores[ch] || 0) >= CAST_PASS) && !DB.ach.allpass) { DB.ach.allpass = 1; earned.push('allpass'); }
  const kaiStyle = 'font-family:\'STKaiti\',\'Kaiti SC\',serif';
  const achHTML = '<div class="scoreTag" style="background:rgba(201,162,39,.18)">🏆 成就：' + (achDefs.filter(d => DB.ach[d[0]]).map(d => (earned.indexOf(d[0]) >= 0 ? '✨' : '✓') + d[1]).join(' · ') || '——') + '</div>';
  const wrongHTML = (wrongSet.length || lowSet.length) ?
    '<div class="scoreTag" style="background:rgba(176,58,46,.14)">📚 本局复习：' +
    wrongSet.map(c => '<b style="' + kaiStyle + '">' + esc(c) + '</b>').join(' ') +
    (lowSet.length ? ' · 低分字 ' + lowSet.map(c => '<b style="' + kaiStyle + '">' + esc(c) + '</b>').join(' ') : '') +
    ' — 去字表点开复习</div>' : '';
  const next = nextDiffOf(S.diff);
  const sv = finishSoloSave();
  const miniBoard = boardTableHTML('solo', 5, S.diff);   /* 结算页内嵌单人榜：只排本局难度（2026-10-08 分档定稿），本轮 lastTs 高亮 */
  const improvedHTML = sv.improved
    ? '<div class="scoreTag" style="background:rgba(201,162,39,.18)">🔥 刷新个人最佳' + (sv.old ? '（原纪录 ' + sv.old.traceTotal + ' 分）' : '（首次入榜）') + '</div>'
    : '<div class="scoreTag">本轮未超个人最佳 ' + (sv.old ? sv.old.traceTotal : avg) + ' 分，榜单保留原纪录</div>';
  s.innerHTML = `
  <div class="resWrap">
    <div class="h1">📜 今日铸铭 · 结算</div>
    <div class="resScore">${avg}</div>
    <div class="sub">写铭平均分（满分 100，保留 1 位小数）</div>
    <div class="resTitle">${esc(t.name)}</div>
    <div class="resWord">${t.word}</div>
    <div class="resStats">
      <div class="resStat"><div class="v">${S.dmarks}</div><div class="k">识铭印章</div></div>
      <div class="resStat"><div class="v">${S.cmarks}</div><div class="k">辨铭印章</div></div>
      <div class="resStat"><div class="v">${castN}/${S.tList.length}</div><div class="k">铸鼎合格</div></div>
      <div class="resStat"><div class="v">${rubCountOf(curPlayer())}</div><div class="k">拓片总藏</div></div>
    </div>
    <div class="scoreRow" style="justify-content:center">${achHTML}${wrongHTML}${improvedHTML}</div>
    <div class="boardMini">
      <div class="bminiT">📜 单人榜 · 本轮成绩已计入</div>
      ${miniBoard.html}
      ${miniBoard.rows ? '<div class="bminiMore" id="btnBoardAll">展开完整榜单 →</div>' : ''}
    </div>
    <div class="resBtns">
      ${next ? `<button class="btn gold" id="btnNextDiff">⬆ 挑战${DIFF[next].name}关</button>` : `<button class="btn gold" disabled>🏆 已是最高关</button>`}
      <button class="btn" id="btnRetry">🔁 再来一次</button>
      <button class="btn ghost" id="btnHome2">⌂ 回封面</button>
      <button class="btn ghost" id="btnBoard2">🏛️ 拓片墙</button>
    </div>
    <div class="resBtns" style="margin-top:10px">
      <button class="btn ghost sm" id="btnExport">⬇ 导出成绩</button>
      <button class="btn ghost sm" id="btnImport">⬆ 导入成绩</button>
      <button class="btn ghost sm" id="btnClearScores">🗑 清空成绩</button>
      <input type="file" id="importFile" accept=".json" style="display:none">
    </div>
  </div>`;
  wireScoreMgmt(() => renderResult());
  if (next) $('btnNextDiff').onclick = () => { setDiffSilent(next); startSolo(); };
  $('btnRetry').onclick = () => startSolo();
  $('btnHome2').onclick = () => go(P_COVER);
  $('btnBoard2').onclick = () => go(P_BOARD);
  if ($('btnBoardAll')) $('btnBoardAll').onclick = () => { BOARD_TAB = 'solo'; BOARD_DIFF = S.diff; go(P_BOARD); };   /* 展开完整榜=直达本局难度子榜 */
  startFx();
}
