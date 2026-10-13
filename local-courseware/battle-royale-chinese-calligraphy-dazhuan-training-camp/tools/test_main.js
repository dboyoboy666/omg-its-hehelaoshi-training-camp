#!/usr/bin/env node
/*
 * test_main.js — 真机测试金字塔 V3（Playwright + 系统 Chrome，打构建产物 = 交付同一字节）
 * 黑盒优先：交互一律走真实 DOM 事件（点击 / PointerEvent 笔迹），白盒只读不写（断言状态）。
 * V3 新增专项：PK 混合赛（辨铭抢答+写铭分屏描红）/ 揭榜爬榜动画 / 成绩导出导入清空 / 名单抽人
 * 纪律：轮数/字数断言读运行时数据，不写死（PK_ROUNDS 随难度）。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'tools', 'node_modules', 'playwright-core'));

const OUT = path.join(__dirname, '..', '铸铭问鼎论英雄-大篆训练营-V3.2.html');
const results = [];
const T = (name, pass, detail) => { results.push({ name, pass, detail }); console.log((pass ? '  ✅ ' : '  ❌ ') + name + (detail ? ` — ${detail}` : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cssEsc = s => String(s).replace(/["\\]/g, '\\$&');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  const url = 'file://' + OUT;

  /* 在页面里描摹：把 autoSegs 坐标经真实 PointerEvent 打进 InkBox 画布
     __drawSegs   → 单人写铭画布 #trCvHost
     __drawSegsPK → PK 分屏画布 #pkCvL / #pkCvR */
  const DRAW_FN = `(() => {
    const drawInto = (hostSel, segs) => {
      const host = document.querySelector(hostSel);
      if (!host) return 'NO_HOST';
      const cv = [...host.querySelectorAll('canvas')].pop();
      if (!cv) return 'NO_CANVAS';
      const r = cv.getBoundingClientRect();
      const px = p => [r.left + p[0] / 400 * r.width, r.top + p[1] / 400 * r.height];
      let id = 7;
      segs.forEach(sg => {
        if (!sg || !sg.length) return;
        const [x0, y0] = px(sg[0]);
        cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, clientX: x0, clientY: y0, bubbles: true }));
        sg.slice(1).forEach(p => { const [x, y] = px(p); cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, clientX: x, clientY: y, bubbles: true })); });
        const [xe, ye] = px(sg[sg.length - 1]);
        cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: xe, clientY: ye, bubbles: true }));
        id++;
      });
      return 'OK';
    };
    window.__drawSegs = segs => drawInto('#trCvHost', segs);
    window.__drawSegsPK = (side, segs) => drawInto('#pkCv' + side, segs);
  })()`;

  async function quizAnswerAll(getState, pageSel, want) {
    /* 逐题作答直至离开该页；want='right'|'wrong'|'mixed' */
    for (let guard = 0; guard < 30; guard++) {
      const st = await page.evaluate(getState);
      if (!st || st.idx >= st.total) break;
      const ch = st.ch;
      const pickWrong = want === 'wrong' || (want === 'mixed' && st.idx === 1);
      const opts = await page.$$eval(pageSel + ' .opt', els => els.map(e => e.dataset.o));
      let target;
      if (pickWrong) { target = opts.find(o => o !== ch) || opts[0]; }
      else target = ch;
      await page.click(`${pageSel} .opt[data-o="${cssEsc(target)}"]`).catch(async () => {
        /* SVG 选项没有 data-o 匹配时兜底按序点击 */
        await page.click(pageSel + ' .opt');
      });
      await sleep(1150);
      const st2 = await page.evaluate(getState);
      if (st2 && st2.idx === st.idx && st2.page === st.page) { /* 未推进则再等 */ await sleep(900); }
    }
  }

  /* ============ T0 烟雾 ============ */
  console.log('▶ T0 烟雾测试');
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.evaluate(DRAW_FN);
  await sleep(400);
  T('零 pageerror', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  const slides = await page.$$eval('#deck .slide', els => els.length);
  T('17 屏 deck 存在（V3.6 彩蛋层新增 s13~s16）', slides === 17, '实际 ' + slides);
  const ext = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /^https?:/.test(r.name)).length);
  T('零外部请求', ext === 0, '外部 ' + ext + ' 个');
  const chars = await page.evaluate(() => __DG.CHARS.length);
  T('字库 35 字', chars === 35, '实际 ' + chars);
  /* 金文字形存在性 + 两两互异（防"两个字共用同一形"的错换/复制，增量㉑ 七/十 教训） */
  const glyphAudit = await page.evaluate(() => {
    const ds = CHARS.map(c => GLYPHS4.bronze[c] ? JSON.stringify(GLYPHS4.bronze[c]) : null);
    return { missing: ds.filter(x => !x).length, uniq: new Set(ds).size, total: ds.length };
  });
  T('金文字形 35 形俱在且两两互异', glyphAudit.missing === 0 && glyphAudit.uniq === glyphAudit.total, JSON.stringify(glyphAudit));
  const coverBtns = await page.$$eval('#s0 button', els => els.map(e => e.id || e.textContent.trim()));
  T('封面四按钮+设置', coverBtns.includes('btnStartSolo') && coverBtns.includes('btnStartDuo') && coverBtns.includes('btnBook') && coverBtns.includes('btnBoard'), coverBtns.join(','));
  T('封面播送带', !!(await page.$('#s0 .coverOrbit .orbitRun')), 'orbitBar 注入');
  const orbitStyle = await page.$eval('#s0 .orbitRun', t => {
    const c = getComputedStyle(t);
    return { color: c.color, weight: c.fontWeight, op: getComputedStyle(t.closest('.coverOrbit')).opacity };
  });
  T('播送文字=大篆同款（亮金纯色·粗体·不透明）',
    orbitStyle.color === 'rgb(232, 201, 106)' && orbitStyle.weight === '700' && orbitStyle.op === '1',
    JSON.stringify(orbitStyle));
  const orbitTxt = await page.$eval('#s0 .orbitRun', t => t.textContent);
  const repN = (orbitTxt.match(/何何老师@PFLS/g) || []).length;
  const iW = await page.$$eval('#s0 .orbitRun i', els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  const bandW = await page.$eval('#s0 .coverOrbit', t => Math.round(t.getBoundingClientRect().width));
  T('环绕接力结构=双副本各占一带宽（带=卡行宽，2026-10-06 收窄）', repN === 2 && iW.length === 2 && iW.every(w => Math.abs(w - bandW) < 2), `副本×${repN} 宽=${iW.join(',')} 带宽=${bandW}`);
  const orbitAnim = await page.$eval('#s0 .orbitRun', t => {
    const s = getComputedStyle(t);
    return { anim: s.animationName + '/' + s.animationDirection + '/' + s.animationIterationCount + '/' + s.animationTimingFunction,
      durS: parseFloat(s.animationDuration) };
  });
  /* 速度口径 28.4px/s（带宽/时长），时长随带宽换算，不写死具体秒数 */
  T('单向匀速循环（linear·infinite·速度≈28.4px/s）', orbitAnim.anim.startsWith('orbitSweep/normal/infinite') && orbitAnim.anim.includes('linear') && Math.abs(orbitAnim.durS - bandW / 28.4) < 1.5, `${orbitAnim.anim} ${orbitAnim.durS}s 带宽=${bandW}`);
  const coverTxt = await page.$eval('#s0 .setupCard', el => el.textContent);
  T('封面新文案+冗余参数行已删', coverTxt.includes('试试点亮整座拓片墙会发生什么～') && !coverTxt.includes('容差带最宽') && !coverTxt.includes('铸满一面墙'), coverTxt.slice(-45));
  const footTxt = await page.$eval('#s0 .footNote', el => el.textContent);
  T('封面版权脚注（2026-10-06 定稿）', footTxt.includes('Copyright 2026-forever') && !footTxt.includes('零联网'), footTxt);
  /* 核心硬约束：任一相位带内可见文字总量 ≤ 一份文案宽（右端消失多少左端同步补多少，
     左右相加=完整一份，绝不重复）——采 9 个相位量双副本的带内可见文字宽度之和
     （裁切窗口=播送带本体矩形，不再用视口；时长动态读取，不写死） */
  const vis = await page.evaluate(() => {
    const band = document.querySelector('#s0 .coverOrbit').getBoundingClientRect();
    const L = band.left, R = band.right;
    const a = document.getAnimations().find(x => x.animationName === 'orbitSweep');
    const durMs = parseFloat(getComputedStyle(document.querySelector('#s0 .orbitRun')).animationDuration) * 1000;
    const textW = (() => {
      const i = document.querySelector('#s0 .orbitRun i');
      const r = document.createRange(); r.selectNodeContents(i);
      return r.getBoundingClientRect().width;
    })();
    const phases = [0.05, 0.15, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 0.95];
    const totals = phases.map(f => {
      a.pause(); a.currentTime = f * durMs;
      let sum = 0;
      document.querySelectorAll('#s0 .orbitRun i').forEach(i => {
        const r = document.createRange(); r.selectNodeContents(i);
        const b = r.getBoundingClientRect();
        sum += Math.max(0, Math.min(b.right, R) - Math.max(b.left, L));
      });
      return Math.round(sum);
    });
    a.play();
    return { textW: Math.round(textW), totals, max: Math.max(...totals) };
  });
  T('带内可见量恒≤一份文案（左右相加=完整，不重复）',
    vis.max <= vis.textW + 2 && vis.totals.some(v => Math.abs(v - vis.textW) <= 2),
    `字宽=${vis.textW} 各相位可见=${vis.totals.join(',')} 峰值=${vis.max}`);
  /* 播送带位于 tagline 与按钮行之间的空隙内，且空隙加高不拥挤 */
  const bandPos = await page.evaluate(() => {
    const band = document.querySelector('#s0 .coverOrbit').getBoundingClientRect();
    const tag = document.querySelector('#s0 .tagline').getBoundingClientRect();
    const btns = document.querySelector('#s0 .coverBtns').getBoundingClientRect();
    return { belowTag: band.top >= tag.bottom - 1, aboveBtns: band.bottom <= btns.top + 1, gap: Math.round(btns.top - tag.bottom) };
  });
  T('播送带在小字与按钮之间空隙内', bandPos.belowTag && bandPos.aboveBtns,
    `gap=${bandPos.gap}px`);
  /* 滚动范围收窄定稿（何何老师 2026-10-06）：带左右缘 = 首卡「开始铸铭」左缘 / 尾卡「拓片墙·榜单」右缘 */
  const bandEdge = await page.evaluate(() => {
    const band = document.querySelector('#s0 .coverOrbit').getBoundingClientRect();
    const first = document.getElementById('btnStartSolo').getBoundingClientRect();
    const last = document.getElementById('btnBoard').getBoundingClientRect();
    return { alignL: Math.round(Math.abs(band.left - first.left)), alignR: Math.round(Math.abs(band.right - last.right)) };
  });
  T('播送带左右缘=首尾功能卡左右缘（滚动范围收窄）', bandEdge.alignL <= 1 && bandEdge.alignR <= 1,
    `左缘差=${bandEdge.alignL}px 右缘差=${bandEdge.alignR}px`);
  const duoCfg = await page.evaluate(() => { go(7); return document.getElementById('s7').textContent; });
  T('双人准备页显示赛制构成', /辨铭抢答\s*6/.test(duoCfg) && /写铭描红\s*4/.test(duoCfg), '菜鸟=6+4');
  await page.evaluate(() => go(0));

  /* 增量㉛ 出题去重规则（何何老师定稿）：去重生命周期=一局——同局认字（识铭∪辨铭）零重复，
     结算即作废；**不落库**（局内存量，无 quizHist 持久化字段） */
  const quizChk = await page.evaluate(() => {
    const run = () => { __DG.startSolo('rookie');
      return __DG.S.dq.map(q => q.ch).concat(__DG.S.cq.map(q => q.ch)); };
    const r1 = run(), r2 = run();
    const uniq = a => new Set(a).size === a.length;
    return { r1u: uniq(r1), r2u: uniq(r2), noDBField: !('quizHist' in __DG.DB) };
  });
  T('同局认字零重复（识铭∪辨铭 10 字互异·两局各自成立）',
    quizChk.r1u && quizChk.r2u, JSON.stringify({ r1u: quizChk.r1u, r2u: quizChk.r2u }));
  T('去重不落库（规则生命周期=一局，结算即作废）', quizChk.noDBField, 'quizHist 字段已撤销');
  await page.evaluate(() => go(0));

  /* ============ T1 导航与设置 ============ */
  console.log('▶ T1 导航/设置');
  await page.click('#s0 [data-diff="hard"]');
  const badge = await page.textContent('#diffBadge');
  T('难度切换到困难', badge.includes('困难'), badge);
  const hardCount = await page.evaluate(() => __DG.pickTraceSet('hard').list.length);
  T('困难关写铭字数=10', hardCount === 10, '实际 ' + hardCount);
  const hardCfg = await page.evaluate(() => __DG.PK_ROUNDS.hard);
  T('困难 PK=9+6 轮', hardCfg.d === 9 && hardCfg.t === 6, JSON.stringify(hardCfg));
  await page.click('#s0 [data-diff="rookie"]');
  await page.click('#btnBook');
  const cells = await page.$$eval('#s1 .cell', els => els.length);
  T('字表 35 格', cells === 35, '实际 ' + cells);
  await page.click('#s1 .cell');
  const evoN = await page.$$eval('#modal .evoCell', els => els.length);
  T('字详情四体演变', evoN >= 3, '演变体 ' + evoN);
  await page.click('#mClose');
  /* 增量㉔ 手·甲骨文别名卡：显示「又」形并如实标注（四体卡齐全） */
  const shouEvo = await page.evaluate(() => {
    const cell = [...document.querySelectorAll('#s1 .cell')].find(c => c.dataset.ch === '手');
    cell.click();
    const cs = [...document.querySelectorAll('#modal .evoCell')];
    const r = { n: cs.length, first: cs[0] ? cs[0].textContent.trim() : '' };
    document.getElementById('mClose').click();
    return r;
  });
  T('手·甲骨文别名卡=「又」（表手）', shouEvo.n === 4 && /甲骨文「又」（表手）/.test(shouEvo.first), JSON.stringify(shouEvo));
  T('弹层可关闭', !(await page.$eval('#modal', m => m.classList.contains('on'))));
  /* 冷启动直跳守卫（go(i) 唯一入口纪律：写铭页/揭榜页/PK页不能白屏或崩） */
  const cold = await page.evaluate(() => {
    const errs = [];
    window.addEventListener('pageerror', e => errs.push(String(e)));
    try { go(4); } catch (e) { errs.push('go4:' + e); }
    try { go(10); } catch (e) { errs.push('go10:' + e); }
    try { go(8); } catch (e) { errs.push('go8:' + e); }
    return { errs, hasExit: !!document.getElementById('btnPkIdleGo'), page: __DG.page };
  });
  T('冷启动直跳 4/10/8 不崩且有出口', cold.errs.length === 0 && cold.hasExit, JSON.stringify(cold));
  await page.evaluate(() => go(0));

  /* ============ T2 判分引擎差分边界（白盒直调，黑盒行为在 T3） ============ */
  console.log('▶ T2 判分差分');
  const diffR = await page.evaluate(() => {
    const off = (chain, d) => chain.map(p => [p[0] + d, p[1] + d * 0.3]);
    const auto = __DG.autoSegs('王');
    const r0 = __DG.judgeScore(auto, '王');
    const r12 = __DG.judgeScore(auto.map(c => off(c, 12)), '王');
    const r30 = __DG.judgeScore(auto.map(c => off(c, 30)), '王');
    return { self: r0.score, off12: r12.score, off30: r30.score };
  });
  T('自洽描摹 = 满分级', diffR.self >= 97, JSON.stringify(diffR));
  T('rookie 带内 12px 仍高分（不误伤）', diffR.off12 >= 90, 'off12=' + diffR.off12);
  T('出界 30px 显著降分（拉开差距）', diffR.off30 < diffR.off12 - 5, 'off30=' + diffR.off30);
  const wz = await page.evaluate(() => {
    const auto = __DG.autoSegs('三');
    const partial = [auto[0]];
    const r = __DG.judgeScore(partial, '三', { timed: true, wholeZero: true });
    const r2 = __DG.judgeScore(auto, '三', { timed: true, wholeZero: true });
    return { zeroed: r.zeroed, score: r.score, full: r2.score, strokes: r2.totalStrokes };
  });
  T('梦魇缺笔整字归零', wz.zeroed === true && wz.score === 0, JSON.stringify(wz));
  T('完整笔迹不受归零误伤', wz.full >= 95, 'full=' + wz.full);

  /* ============ T3 单人全流程闭环（rookie·不限时）：三关 → 铸鼎 → 揭榜动画 → 结算 ============ */
  console.log('▶ T3 单人闭环');
  await page.click('#btnHome');
  await page.evaluate(() => { document.getElementById('soloName').value = '测试生甲'; });   /* 参赛名字贯通：输入→榜单 */
  await page.click('#btnStartSolo');
  await sleep(300);
  let st = await page.evaluate(() => ({ page: __DG.page, di: __DG.S.di, total: __DG.S.dq.length, ch: __DG.S.dq[__DG.S.di].ch }));
  T('进入识铭 6 题', st.page === 2 && st.total === 6, JSON.stringify(st));
  const wrongOpt = await page.$eval('#s2 .opts .opt:nth-child(1)', e => e.dataset.o);
  const isWrong1 = wrongOpt !== st.ch;
  await page.click(`#s2 .opt[data-o="${cssEsc(wrongOpt)}"]`);
  await sleep(1150);
  const marksAfterWrong = await page.evaluate(() => __DG.S.dmarks);
  T('答错不加分', isWrong1 ? marksAfterWrong === 0 : true, `首题${isWrong1 ? '确为错误项' : '首题即正确项'}`);
  await quizAnswerAll(() => ({ idx: __DG.S.di, total: __DG.S.dq.length, ch: __DG.S.dq[__DG.S.di] && __DG.S.dq[__DG.S.di].ch, page: __DG.page }), '#s2', 'right');
  st = await page.evaluate(() => ({ page: __DG.page, ci: __DG.S.ci, total: __DG.S.cq.length }));
  T('自动进入辨铭 4 题', st.page === 3 && st.total === 4, JSON.stringify(st));
  const dqMarks = await page.evaluate(() => __DG.S.dmarks);
  const expectMarks = isWrong1 ? 10 : 12;
  T('识铭印章符合对题数', dqMarks === expectMarks, `实际 ${dqMarks} 预期 ${expectMarks}`);
  await quizAnswerAll(() => ({ idx: __DG.S.ci, total: __DG.S.cq.length, ch: __DG.S.cq[__DG.S.ci] && __DG.S.cq[__DG.S.ci].ch, page: __DG.page }), '#s3', 'right');
  const discernUnique = await page.evaluate(() => __DG.S.cq.every(q => new Set(q.options).size === 4));
  T('辨铭选项无重复', discernUnique);
  st = await page.evaluate(() => ({ page: __DG.page, ti: __DG.S.ti, total: __DG.S.tList.length }));
  T('进入写铭 10 字', st.page === 4 && st.total === 10, JSON.stringify(st));

  const traceScores = [];
  for (let i = 0; i < 10; i++) {
    const ch = await page.evaluate(() => __DG.S.tList[__DG.S.ti]);
    const draw = await page.evaluate(ch => { const segs = __DG.autoSegs(ch); return window.__drawSegs(segs); }, ch);
    if (draw !== 'OK') { T('写铭画布可用', false, draw); break; }
    await sleep(120);
    await page.click('#btnTrSubmit');
    await sleep(250);
    const sc = await page.evaluate(() => ({ s: __DG.S.tScores[__DG.S.tList[__DG.S.ti]], verdict: document.getElementById('trVerdict').textContent }));
    traceScores.push(sc.s);
    if (sc.s < 90) { T('自洽描摹得分', false, ch + '=' + sc.s); }
    const last = i === 9;
    await page.click('#btnTrNext');
    if (!last) await sleep(350);
  }
  T('写铭 10 字自洽描摹全 ≥90 分', traceScores.length === 10 && Math.min(...traceScores) >= 90, traceScores.join(','));

  await page.waitForFunction(() => document.getElementById('btnCastGo') && document.getElementById('btnCastGo').style.display !== 'none', null, { timeout: 25000 });
  const castState = await page.evaluate(() => ({
    page: __DG.page,
    cast: document.querySelectorAll('#s5 .slotChar.in').length,
    goShown: document.getElementById('btnCastGo') && document.getElementById('btnCastGo').style.display !== 'none'
  }));
  T('进入铸鼎且合格字上鼎', castState.page === 5 && castState.cast === traceScores.filter(s => s >= 60).length, JSON.stringify(castState));
  T('铸鼎完成出按钮', castState.goShown);
  const fx = await page.evaluate(() => ({
    flashN: document.querySelectorAll('#s5 .slotChar.in.flash').length,
    dingFlash: !!document.querySelector('#s5 .dingBox.dingFlash'),
    anim: getComputedStyle(document.querySelector('#s5 .dingBox')).animationName
  }));
  T('落鼎字闪烁+整鼎高亮特效就位', fx.flashN === castState.cast && fx.dingFlash && fx.anim === 'dingFlash', JSON.stringify(fx));
  /* 增量⑲ 落字改版：金球移除，字带金边下落（charDrop）→ 落定带金边闪烁 1s（charFlash）
     ——关键帧直接读构建产物样式表（CSSOM），不依赖动画是否正在播放，零竞态 */
  const drop = await page.evaluate(() => {
    const rules = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } });
    const kf = name => {
      const r = rules.find(x => x.type === 7 && x.name === name);   /* 7 = WEBKIT_KEYFRAMES_RULE（Chrome 实报 type 值） */
      return r ? [...r.cssRules].map(k => k.style.cssText) : null;
    };
    const slot = document.querySelector('#s5 .slotChar.in.flash');
    const cs = slot ? getComputedStyle(slot) : {};
    return { moltenN: document.querySelectorAll('.molten').length,
      names: cs.animationName || '', durs: cs.animationDuration || '', delays: cs.animationDelay || '',
      drop: kf('charDrop'), flash: kf('charFlash') };
  });
  const px1 = (arr, re) => (arr || []).map(s => { const m = s.match(re); return m ? +m[1] : NaN; });
  const dStroke = px1(drop.drop, /text-stroke:\s*([\d.]+)px/);   /* Chrome cssText 序列化为 -webkit-text-stroke 简写 */
  const dBright = px1(drop.drop, /brightness\(([\d.]+)\)/);
  const fStroke = px1(drop.flash, /text-stroke:\s*([\d.]+)px/);
  const dFall = (drop.drop || []).some(s => s.includes('var(--dx') && s.includes('-84px'));   /* 落点向量钩子（增量㉙ 随机四向）+ 缺省落距 */
  T('落字=字带金边下落（金球已移除·双动画接棒）',
    drop.moltenN === 0 && /charDrop/.test(drop.names) && /charFlash/.test(drop.names) &&
    drop.durs === '0.55s, 1s' && drop.delays === '0s, 0.55s',
    JSON.stringify({ moltenN: drop.moltenN, names: drop.names, durs: drop.durs, delays: drop.delays }));
  T('下落中金边渐亮渐宽（描边/亮度逐帧单调增·随机落向钩子可见）',
    dStroke.length === 3 && dStroke.every((v, i) => i === 0 || v > dStroke[i - 1]) &&
    dBright.length === 3 && dBright.every((v, i) => i === 0 || v > dBright[i - 1]) && dFall,
    JSON.stringify({ dStroke, dBright, dFall }));
  /* 增量㉙ 落字随机化：每槽带随机落点向量（四向至少 2 向出现、主距 60~130px+抖动） */
  const dropRand = await page.evaluate(() => {
    const slots = [...document.querySelectorAll('#s5 .slotChar.in')];
    const dirs = new Set(), dists = [];
    slots.forEach(s => {
      const dx = parseFloat(s.style.getPropertyValue('--dx')) || 0;
      const dy = parseFloat(s.style.getPropertyValue('--dy')) || 0;
      if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) dirs.add(dx < 0 ? '左' : '右');
      else if (dy !== 0) dirs.add(dy < 0 ? '上' : '下');
      dists.push(Math.round(Math.hypot(dx, dy)));
    });
    return { n: slots.length, dirs: [...dirs], dMin: Math.min(...dists), dMax: Math.max(...dists) };
  });
  T('落字方向/距离随机化（≥2 向·距离 60~136px）',
    dropRand.n >= 3 && dropRand.dirs.length >= 2 && dropRand.dMin >= 60 && dropRand.dMax <= 136, JSON.stringify(dropRand));
  T('落定闪烁1s且金边随行（接棒2px→峰值2.5px→播完回归常态0px）',
    drop.durs === '0.55s, 1s' && fStroke.length === 4 && fStroke[0] === 2 && Math.max(...fStroke) === 2.5 && fStroke[fStroke.length - 1] === 0,
    JSON.stringify({ fStroke }));
  const rubAfter = await page.evaluate(() => Object.keys(__DG.DB.rubBy['测试生甲'] || {}).length);
  T('拓片入库', rubAfter === traceScores.filter(s => s >= 60).length, '入库 ' + rubAfter);

  /* 揭榜爬榜动画（V3 新流程）：铸鼎 → 入榜 → 动画页 → 跳过 → 结算
     注意：铭牌自动爬升 850ms 后会自行收尾进结算，断言与跳过必须抢在它前面 */
  await page.click('#btnCastGo');
  await page.waitForFunction(() => __DG.page === 10, null, { timeout: 6000 });
  /* 抓铭牌状态（此刻 climb 运行中，cur/hero 至少其一在台）；不点跳过，走自然播完路径
     —— 跳过路径在 T5 双人揭榜处覆盖；两条路径都会 go(结算)，离屏铭牌被 go() 清屏属预期 */
  const animState = await page.evaluate(() => ({
    plates: document.querySelectorAll('#soloStage .plate').length,
    heroOrCur: document.querySelectorAll('#soloStage .plate.hero, #soloStage .plate.cur').length,
    rank1: document.querySelector('#soloStage .np-rank') && document.querySelector('#soloStage .np-rank').textContent,
    soloRec: __DG.DB.solo.length
  }));
  T('单人揭榜动画出铭牌', animState.plates >= 1 && animState.heroOrCur >= 1, JSON.stringify(animState));
  T('铭牌带名次', /第 1 名/.test(animState.rank1 || '') || animState.plates > 1, animState.rank1);
  T('铸鼎按钮即入榜', animState.soloRec === 1, '条数 ' + animState.soloRec);
  await page.waitForFunction(() => __DG.page === 6, null, { timeout: 15000 });   /* 动画自然播完自动进结算 */
  const res = await page.evaluate(() => ({
    page: __DG.page, scores: __DG.S.tList.map(c => __DG.S.tScores[c]),
    marks: __DG.S.dmarks + __DG.S.cmarks, title: document.querySelector('.resTitle') && document.querySelector('.resTitle').textContent
  }));
  T('跳过后到单人结算', res.page === 6, 'page=' + res.page);
  const expectAvg = Math.round(res.scores.reduce((a, b) => a + b, 0) / res.scores.length * 10) / 10;
  const shownAvg = await page.evaluate(() => parseFloat(document.querySelector('.resScore').textContent));
  T('结算平均分一致', Math.abs(shownAvg - expectAvg) < 0.05, `显示${shownAvg} 预期${expectAvg}`);
  T('称号已生成', !!res.title, res.title);
  const improvedTag = await page.$eval('.scoreRow', el => el.textContent).catch(() => '');
  T('首次入榜提示', /首次入榜/.test(improvedTag), improvedTag.slice(0, 60));
  /* 增量㉗ 结算页内嵌榜单：通关即见榜（本轮 me 高亮 + 榜单底缘≤视口高=首屏免滚动） */
  const boardChk = await page.evaluate(() => {
    const tb = document.querySelector('#s6 table.rk');
    if (!tb) return { have: false };
    const r = tb.getBoundingClientRect();
    return { have: true, rows: tb.querySelectorAll('tr').length - 1, me: tb.querySelectorAll('tr.me').length,
      bottom: Math.round(r.bottom), vh: innerHeight, fit: r.bottom <= innerHeight };
  });
  T('单人结算页内嵌榜单（本轮高亮·首屏免滚动）',
    boardChk.have && boardChk.rows >= 1 && boardChk.me >= 1 && boardChk.fit, JSON.stringify(boardChk));
  /* 增量㉛ 参赛名字贯通：输入框名字 → 榜单记录（不再人人都是"我"） */
  const soloNameChk = await page.evaluate(() => {
    const rec = __DG.DB.solo[__DG.DB.solo.length - 1];
    return { name: rec && rec.name, onBoard: document.querySelector('#s6 table.rk').textContent.includes(rec ? rec.name : '') };
  });
  T('单人榜记录=输入的参赛名字', soloNameChk.name === '测试生甲' && soloNameChk.onBoard, JSON.stringify(soloNameChk));
  const mgmtBtns = await page.evaluate(() => ['btnExport', 'btnImport', 'btnClearScores'].map(id => !!document.getElementById(id)));
  T('结算页成绩管理三件套', mgmtBtns.every(Boolean), mgmtBtns.join(','));

  /* 封面拓片计数实时性：点亮 N 字后回封面，0 必须变成 N */
  await page.click('#btnHome');
  await sleep(300);
  const rubCount = await page.$eval('#rubCount', el => parseInt(el.textContent, 10));
  const rubReal = await page.evaluate(() => Object.keys(__DG.DB.rubBy['测试生甲'] || {}).length);
  T('封面拓片计数实时点亮', rubCount === rubReal && rubCount === traceScores.filter(x => x >= 60).length,
    `显示=${rubCount} 实际=${rubReal}`);

  /* ============ T4 存储持久化 ============ */
  console.log('▶ T4 持久化');
  await page.reload();
  await page.evaluate(DRAW_FN);
  await sleep(300);
  const persist = await page.evaluate(() => ({ rub: Object.keys(__DG.DB.rubBy['测试生甲'] || {}).length, solo: __DG.DB.solo.length }));
  T('刷新后拓片/战绩仍在', persist.rub === traceScores.filter(s => s >= 60).length && persist.solo === 1, JSON.stringify(persist));
  await page.click('#btnBook');
  const rubbed2 = await page.$$eval('#s1 .cell.rubbed', els => els.length);
  T('字表点亮拓片标记', rubbed2 === persist.rub, '标记 ' + rubbed2);
  await page.click('#btnHome');
  await page.click('#btnBoard');
  const rubCards = await page.$$eval('#s9 .rubCard:not(.empty)', els => els.length);
  T('拓片墙非空卡片', rubCards === persist.rub, '卡片 ' + rubCards);
  /* 巡游专项：本关铸鼎后（含跨刷新）首次打开拓片墙 → 第一张已拓卡立即进入金框巡游，
     时间戳持久化消费（再切走切回不重播） */
  const tour1 = await page.evaluate(() => ({
    first: document.querySelector('#s9 .rubCard:not(.empty)').classList.contains('tour'),
    n: document.querySelectorAll('#s9 .rubCard.tour').length,
    nRub: Object.keys(__DG.DB.rubBy['测试生甲'] || {}).length, seenN: (__DG.DB.seenBy['测试生甲'] || 0)
  }));
  T('有未展示的已解锁字→进入即金框巡游', tour1.first && tour1.n === 1 && tour1.seenN === tour1.nRub, JSON.stringify(tour1));
  await page.click('#s9 [data-tab="duo"]'); await page.click('#s9 [data-tab="rub"]');
  const tour2 = await page.$$eval('#s9 .rubCard.tour', els => els.length);
  T('巡游只播一次（首次语义，切走切回不重播）', tour2 === 0, '残留 ' + tour2);
  /* 增量㉖ 巡游节奏=每秒 1 行：重置 seenN 触发新巡游，MutationObserver 实测各卡点亮时刻，
     断言「全部已拓卡依次点亮 + 总时长≈行数×1 秒」（旧行为=卡片数×1 秒，可甄别） */
  const tourTiming = await page.evaluate(() => new Promise(res => {
    __DG.DB.seenBy['测试生甲'] = 0;
    document.querySelector('#s9 [data-tab="duo"]').click();
    const rec = new Map();
    const t0 = performance.now();
    const mo = new MutationObserver(() => {
      document.querySelectorAll('#s9 .rubCard:not(.empty)').forEach(c => {
        const on = c.classList.contains('tour');
        if (on && !rec.has(c)) rec.set(c, { on: performance.now() - t0 });
        if (!on && rec.has(c) && rec.get(c).off === undefined) rec.get(c).off = performance.now() - t0;
      });
      const all = document.querySelectorAll('#s9 .rubCard:not(.empty)').length;
      if (rec.size === all && [...rec.values()].every(v => v.off !== undefined)) {
        mo.disconnect();
        setTimeout(() => res({ vals: [...rec.values()], finale: document.getElementById('s9').classList.contains('wallFinale') }), 150);
      }
    });
    mo.observe(document.getElementById('s9'), { subtree: true, attributes: true, attributeFilter: ['class'] });
    document.querySelector('#s9 [data-tab="rub"]').click();
    setTimeout(() => { mo.disconnect(); res({ vals: [...rec.values()], finale: document.getElementById('s9').classList.contains('wallFinale') }); }, 8000);
  }));
  const rowsN = await page.$$eval('#s9 .rubCard:not(.empty)', els => new Set(els.map(e => Math.round(e.offsetTop))).size);
  const toured = tourTiming.vals.filter(v => v.on !== undefined).length;
  const total = tourTiming.vals.length ? Math.max(...tourTiming.vals.map(v => v.off || 0)) : 0;
  T('巡游节奏=每秒 1 行（全部依次点亮，总时长≈行数×1s 而非卡数×1s）',
    toured === tourTiming.vals.length && tourTiming.vals.length > 0 && total >= rowsN * 700 && total <= rowsN * 1400,
    `卡=${tourTiming.vals.length} 行=${rowsN} 总时长=${Math.round(total)}ms`);
  T('末卡闪完触发整页金光收束（wallFinale）', tourTiming.finale === true, 'finale=' + tourTiming.finale);
  /* 增量㉘ 金色脉冲断言（CSSOM）：快闪峰值无白光（亮度≤1.3+饱和金边），收束峰值≥1.8 */
  const kf = await page.evaluate(() => {
    const rules = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } });
    const get = name => { const r = rules.find(x => x.type === 7 && x.name === name); return r ? [...r.cssRules].map(k => k.style.cssText) : null; };
    const peak = (arr, re) => { const f = (arr || []).map(s => s.match(re)).filter(Boolean).map(m => +m[1]); return f.length ? Math.max(...f) : null; };
    const tour = get('rubTour'), fin = get('wallFinale'), finCard = get('wallFinaleCard');
    return { tourPeakBright: peak(tour, /brightness\(([\d.]+)\)/),
      tourGold: (tour || []).some(s => s.includes('240, 185') || s.includes('f0b93c')),
      finPeakBright: peak(fin, /brightness\(([\d.]+)\)/), finExists: !!fin, finCardExists: !!finCard };
  });
  T('快闪=金色脉冲（峰值亮度≤1.3·饱和金边·无白光）',
    kf.tourPeakBright !== null && kf.tourPeakBright <= 1.3 && kf.tourGold, JSON.stringify(kf));
  T('收束=整页金光 1s（仿 dingFlash：峰值亮度≥1.8·卡片金边联动）',
    kf.finExists && kf.finCardExists && kf.finPeakBright >= 1.8, JSON.stringify(kf));

  /* ============ T5 双人混合对决闭环（辨铭抢答 + 写铭分屏描红，V3 核心） ============ */
  console.log('▶ T5 双人混合赛');
  await page.click('#btnHome');
  await page.click('#btnStartDuo');
  /* 名单抽人：粘贴 → 乱序 → 随机抽两人 */
  await page.fill('#rosterArea', '大孟\n小颂\n史墙\n散氏\n毛公\n克鼎');
  await page.click('#btnShuffleRoster');
  const shuffled = await page.$eval('#rosterArea', ta => ta.value);
  T('名单乱序生效', shuffled.split('\n').length === 6 && shuffled !== '大孟\n小颂\n史墙\n散氏\n毛公\n克鼎', shuffled.replace(/\n/g, '/'));
  /* 学号序列起止（复刻 v6.6.618）：预填姓名 → prompt 首=5/末=8 → 姓名行保留在前 + 连续学号 5~8 */
  await page.fill('#rosterArea', '张三\n李四\n王五');
  const prompts = ['5', '8'];
  const onDlg = async d => { if (d.type() === 'prompt') await d.accept(prompts.shift()); };
  page.on('dialog', onDlg);
  await page.click('#btnSeqRoster');
  await sleep(600);
  page.off('dialog', onDlg);
  const seqVal = await page.$eval('#rosterArea', ta => ta.value);
  T('学号序列起止生成连续学号（姓名在前）',
    seqVal === '张三\n李四\n王五\n5\n6\n7\n8', JSON.stringify(seqVal));
  await page.click('#btnDraw');
  const drawn = await page.evaluate(() => [document.getElementById('duoA').value, document.getElementById('duoB').value]);
  T('随机抽两人且不重复', drawn[0] && drawn[1] && drawn[0] !== drawn[1], drawn.join(' VS '));
  const cfgShown = await page.$eval('#s7 .duoCfgLine', el => el.textContent.replace(/\s/g, ''));
  T('准备页赛制与难度联动', /菜鸟/.test(cfgShown) && /共10轮/.test(cfgShown), cfgShown.slice(0, 50));

  await page.click('#btnPkGo');
  await sleep(300);
  const plan0 = await page.evaluate(() => ({ kinds: __DG.PK.plan.map(r => r.kind), d: __DG.PK.plan.filter(r => r.kind === 'discern').length, t: __DG.PK.plan.filter(r => r.kind === 'trace').length }));
  T('混合赛制 6 抢答 + 4 描红', plan0.d === 6 && plan0.t === 4, JSON.stringify(plan0));
  T('题面顺序=先抢答后描红', plan0.kinds.slice(0, 6).every(k => k === 'discern') && plan0.kinds.slice(6).every(k => k === 'trace'), plan0.kinds.join(''));

  let roundLog = [];
  for (let guard = 0; guard < 14; guard++) {
    const rd = await page.evaluate(() => ({ ri: __DG.PK.ri, over: __DG.PK.over, page: __DG.page, kind: __DG.PK.plan[__DG.PK.ri] ? __DG.PK.plan[__DG.PK.ri].kind : null, ch: __DG.PK.plan[__DG.PK.ri] ? (__DG.PK.plan[__DG.PK.ri].q ? __DG.PK.plan[__DG.PK.ri].q.ch : __DG.PK.plan[__DG.PK.ri].ch) : null }));
    if (rd.over || rd.page !== 8) break;
    if (rd.kind === 'discern') {
      /* 第 1 抢答轮做不对称：L 对 R 错 → 触发爆闪/呼吸特效；其余轮双方都对 */
      const r1asym = rd.ri === 0;
      const optsL = await page.$$eval('#pkOptL .opt', els => els.map(e => e.dataset.o));
      const optsR = await page.$$eval('#pkOptR .opt', els => els.map(e => e.dataset.o));
      if (rd.ri === 0) {
        /* 独立洗牌保证集合相同；顺序大概率不同但不排除巧合（1/24），只断言集合相等 */
        T('两侧选项集合相同（防抄位置由独立洗牌保证）', JSON.stringify(optsL.slice().sort()) === JSON.stringify(optsR.slice().sort()), '集合比对');
      }
      const pickL = rd.ch;
      const pickR = r1asym ? (optsR.find(o => o !== rd.ch) || optsR[0]) : rd.ch;
      await page.click(`#pkOptL .opt[data-o="${cssEsc(pickL)}"]`).catch(() => {});
      await page.click(`#pkOptR .opt[data-o="${cssEsc(pickR)}"]`).catch(() => {});
      if (r1asym) {
        await sleep(250);
        const hpFx = await page.evaluate(() => ({
          dom: !!document.querySelector('#s8 .hp i.dominant'),
          sparks: document.querySelectorAll('#s8 .boltwrap .spark').length,
          boltAtSplit: !!document.querySelector('#s8 .boltwrap')
        }));
        T('领先方爆闪特效', hpFx.dom, JSON.stringify(hpFx));
        T('分割点闪电 + 8 颗粒子', hpFx.sparks === 8 && hpFx.boltAtSplit, 'sparks=' + hpFx.sparks);
        const ta = await page.$eval('#s8', el => getComputedStyle(el).touchAction);
  T('PK 页整页禁浏览器手势（防双人触屏被 pinch 吞触点）', ta === 'none', 'touch-action=' + ta);
  const boltFx = await page.$eval('#s8 .boltwrap .bolt', el => {
          const c = getComputedStyle(el);
          return { clip: c.clipPath.slice(0, 24), anim: c.animationName };
        });
        T('闪电=参考版轮廓+快闪动画', boltFx.clip.startsWith('polygon') && boltFx.anim === 'boltFlick', JSON.stringify(boltFx));
      }
      roundLog.push('d' + rd.ri);
      await sleep(1500);
    } else {
      const segs = await page.evaluate(ch => __DG.autoSegs(ch), rd.ch);
      const dL = await page.evaluate(sg => window.__drawSegsPK('L', sg), segs);
      await sleep(150);
      const liveL = await page.$eval('#pkScoreL', el => el.textContent);
      if (rd.ri === plan0.kinds.indexOf('trace')) {
        T('描红轮实时刷分', dL === 'OK' && liveL !== '—' && parseFloat(liveL) >= 85, 'L=' + liveL);
        const detail = await page.evaluate(() => ({
          prec: document.getElementById('pkPrecL').textContent,
          rec: document.getElementById('pkRecL').textContent,
          stk: document.getElementById('pkStkL').textContent,
          chips: document.querySelectorAll('#pkChipsL .sChip').length
        }));
        T('描红轮四维面板+笔段芯片', /%/.test(detail.prec) && /%/.test(detail.rec) && /\//.test(detail.stk) && detail.chips > 0, JSON.stringify(detail));
      }
      await page.evaluate(sg => window.__drawSegsPK('R', sg), segs);
      await sleep(150);
      await page.click('#pkDoneL');
      await page.click('#pkDoneR');
      roundLog.push('t' + rd.ri);
      await sleep(1900);
    }
  }
  const duoDone = await page.evaluate(() => ({ over: __DG.PK.over, L: __DG.PK.L.score, R: __DG.PK.R.score, page: __DG.page }));
  T('混合赛跑满 10 轮出结果', duoDone.over && roundLog.length === 10, `轮次 ${roundLog.length} L=${duoDone.L} R=${duoDone.R}`);
  T('分数制对局：描红轮得分累加', duoDone.L > 0 || duoDone.R > 0, JSON.stringify(duoDone));
  /* 双人揭榜动画 → 双人结算 */
  await page.waitForFunction(() => __DG.page === 11, null, { timeout: 6000 });
  await sleep(700);
  const duoAnim = await page.evaluate(() => ({ plates: document.querySelectorAll('#duoStage .plate').length }));
  T('双人揭榜动画出铭牌', duoAnim.plates >= 1, JSON.stringify(duoAnim));
  await page.evaluate(() => { const b = document.getElementById('skip_duoStage'); if (b) b.click(); });
  await sleep(400);
  const duoRes = await page.evaluate(() => ({
    page: __DG.page, win: __DG.LAST_DUO && __DG.LAST_DUO.win,
    cols: document.querySelectorAll('#s12 .pkcol').length,
    titles: [...document.querySelectorAll('#s12 .pkcol')].map(c => (c.textContent.match(/「[^」]+」/) || [''])[0]),
    speech: document.querySelectorAll('#s12 [style*="grid-template-columns:1fr 1fr"] > div').length
  }));
  T('跳过后到双人结算（分栏对位）', duoRes.page === 12 && duoRes.cols === 2 && duoRes.speech === 2, JSON.stringify(duoRes));
  T('冠亚军头衔已授予', duoRes.titles.filter(t => t.length > 2).length === 2, duoRes.titles.join(' / '));
  /* 增量㉗ 双人结算页内嵌对决榜（本轮双方 me 高亮 + 首屏免滚动） */
  const duoBoardChk = await page.evaluate(() => {
    const tb = document.querySelector('#s12 table.rk');
    if (!tb) return { have: false };
    const r = tb.getBoundingClientRect();
    return { have: true, rows: tb.querySelectorAll('tr').length - 1, me: tb.querySelectorAll('tr.me').length,
      bottom: Math.round(r.bottom), vh: innerHeight, fit: r.bottom <= innerHeight };
  });
  T('双人结算页内嵌对决榜（双方高亮·首屏免滚动）',
    duoBoardChk.have && duoBoardChk.rows >= 2 && duoBoardChk.me >= 2 && duoBoardChk.fit, JSON.stringify(duoBoardChk));
  /* 增量㉕ 结语金句池：按分数分档随机取预案，不再写死（数据驱动断言，不固化具体句子） */
  const goldChk = await page.evaluate(() => {
    const check = sc => {
      const t = TIERS.find(x => sc >= x.min);
      const set = new Set();
      for (let i = 0; i < 20; i++) {
        const g = goldLineOf(sc).replace(/^<br><b>/, '').replace(/<\/b>$/, '');
        const hit = t.gold.some(tpl => {
          const seg = tpl.split('{m}');
          if (seg.length === 1) return g === seg[0];
          return g.startsWith(seg[0]) && g.endsWith(seg[seg.length - 1]);
        });
        if (!hit) return { fail: sc + ':' + g };
        set.add(g);
      }
      return { sc, distinct: set.size };
    };
    const a = check(95), b = check(30);
    return { a, b, fail: a.fail || b.fail };
  });
  T('结语金句池=按分档随机+针对（95/30 两档各 20 连抽：池内命中且多变）',
    !goldChk.fail && goldChk.a.distinct >= 2 && goldChk.b.distinct >= 2, JSON.stringify(goldChk));
  const duoRecs = await page.evaluate(() => __DG.DB.duo.map(r => ({ name: r.name, rival: r.rival, win: r.win, score: r.score })));
  T('双方战绩入库含对手字段', duoRecs.length === 2 && duoRecs.every(r => r.rival), JSON.stringify(duoRecs));
  const boardMe = await page.evaluate(() => {
    go(9); __DG; document.querySelector('#s9 [data-tab="duo"]').click();
    return { rows: document.querySelectorAll('#s9 table.rk tr').length, head: document.querySelector('#s9 table.rk').textContent };
  });
  T('对决榜列=对手/胜负/奖牌', boardMe.rows >= 3 && /对手/.test(boardMe.head) && /胜负/.test(boardMe.head), 'rows=' + boardMe.rows);

  /* ============ T6 限时模式闭环 ============ */
  console.log('▶ T6 限时');
  /* 描红限时重标定（2026-10-07 何何老师定稿）：鱼=12s 封顶，一/十等简单字不再"十几秒"，全表按复杂度单调 */
  const toProbe = await page.evaluate(() => {
    const rows = __DG.CHARS.map(c => ({ c, t: __DG.timeOf(c), C: __DG.DZINFO[c].L + 80 * (__DG.DZINFO[c].N - 1) }));
    const sorted = rows.slice().sort((a, b) => a.C - b.C);
    let mono = true;
    for (let i = 1; i < sorted.length; i++) if (sorted[i].t < sorted[i - 1].t) mono = false;
    return { max: Math.max(...rows.map(r => r.t)), min: Math.min(...rows.map(r => r.t)),
      yu: __DG.timeOf('鱼'), yi: __DG.timeOf('一'), shi: __DG.timeOf('十'), mono };
  });
  T('描红限时重标定：鱼=12s 封顶 · 一/十≤8s · 全表落 [6,12] · 按复杂度单调',
    toProbe.max === 12 && toProbe.yu === 12 && toProbe.mono && toProbe.min >= 6 && toProbe.yi <= 8 && toProbe.shi <= 8, JSON.stringify(toProbe));
  await page.click('#btnHome');
  await page.click('#timedChip');
  const timedOn = await page.evaluate(() => __DG.CUR.timed);
  T('限时开关生效', timedOn === true);
  T('抢答限时=每题 3 秒（QUIZ_LIM，何何老师定稿）', await page.evaluate(() => __DG.QUIZ_LIM) === 3, '');
  await page.click('#btnStartSolo');
  await sleep(300);
  const hasTimer = await page.$('#s2 #qTimer');
  const t0 = await page.evaluate(() => __DG.S.tLeft);
  await sleep(1300);
  const t1 = await page.evaluate(() => __DG.S.tLeft);
  T('问答倒计时在走', !!hasTimer && t1 === t0 - 1, `${t0}→${t1}`);
  await page.evaluate(() => { __DG.S.dq = __DG.S.dq.slice(0, Math.max(1, __DG.S.di + 1)); __DG.S.cq = __DG.S.cq.slice(0, 1); __DG.S.tList = __DG.S.tList.slice(0, 1); });
  let pg = await page.evaluate(() => __DG.page);
  for (let g = 0; g < 6 && pg !== 4; g++) {
    await page.evaluate(() => { __DG.S.tLeft = 1; });
    await sleep(1500);
    pg = await page.evaluate(() => __DG.page);
  }
  T('超时自动推进到写铭', pg === 4, 'page=' + pg);
  await page.evaluate(() => { __DG.S.tLeft = 1; });
  await sleep(1600);
  const verdictT = await page.textContent('#trVerdict');
  T('写铭超时自动提交', /超时|0 分/.test(verdictT), verdictT.slice(0, 30));
  await page.click('#btnTrNext');
  await page.waitForFunction(() => __DG.page === 5, null, { timeout: 8000 });
  await page.waitForFunction(() => document.getElementById('btnCastGo') && document.getElementById('btnCastGo').style.display !== 'none', null, { timeout: 20000 });
  await page.click('#btnCastGo');
  await page.waitForFunction(() => __DG.page === 10, null, { timeout: 8000 });
  await page.evaluate(() => { const b = document.getElementById('skip_soloStage'); if (b) b.click(); });
  await sleep(300);
  const resTimed = await page.evaluate(() => ({ page: __DG.page, avg: parseFloat(document.querySelector('.resScore').textContent) }));
  T('限时局闭环到结算', resTimed.page === 6 && resTimed.avg === 0, JSON.stringify(resTimed));
  const improved2 = await page.$eval('.scoreRow', el => el.textContent).catch(() => '');
  T('未超最佳提示（榜单保留原纪录）', /未超个人最佳/.test(improved2) || /刷新个人最佳/.test(improved2), improved2.slice(0, 60));
  /* PK 辨铭抢答限时同走 QUIZ_LIM=3（原先误用描红模型 timeOf≈10~18s——何何老师截图指出的 12 秒根源） */
  await page.click('#btnHome'); await sleep(300);
  await page.click('#btnStartDuo'); await sleep(300);
  await page.evaluate(() => { document.getElementById('duoA').value = '时测甲'; document.getElementById('duoB').value = '时测乙'; });
  await page.click('#btnPkGo'); await sleep(400);
  const pkTimed = await page.evaluate(() => ({ timed: __DG.PK.timed, tLeft: __DG.PK.tLeft, page: __DG.page, diff: __DG.PK.diff }));
  T('PK 辨铭抢答限时=3 秒（不再误用描红模型）', pkTimed.timed && pkTimed.tLeft === 3 && pkTimed.page === 8, JSON.stringify(pkTimed));
  await page.click('#btnHome'); await sleep(250);   /* 弃局回封面（未完成的 PK 不落榜） */
  await page.click('#timedChip');
  const timedOff = await page.evaluate(() => __DG.CUR.timed);
  T('限时可关闭', timedOff === false);

  /* ============ T7 榜单完整性 ============ */
  console.log('▶ T7 榜单');
  await page.click('#btnBoard');
  await page.click('#s9 [data-tab="rub"]');   /* BOARD_TAB 会话内记忆（T5 点过对决榜），显式切回拓片墙再断言 */
  T('拓片墙标签可切回', !!(await page.$('#s9 .rubGrid')), 'rubGrid 存在');
  await page.click('#s9 [data-tab="solo"]');
  /* 难度子榜（2026-10-08 何何老师定稿：菜鸟/困难/梦魇分列独立榜单页内切换，不混排） */
  const diffTabChk = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('#s9 .diffTabs [data-diff]')].map(c => c.dataset.diff),
    nOrder: Object.keys(__DG.DIFF).length
  }));
  T('单人榜难度子榜=三档页内切换（档位动态生成）', diffTabChk.chips.length === diffTabChk.nOrder && diffTabChk.chips.join(',') === 'rookie,hard,nightmare', JSON.stringify(diffTabChk));
  const soloRows = await page.$$eval('#s9 table.rk tr', els => els.length);
  T('单人榜同名同难度只留最佳（设计行为）', soloRows === 2, '行 ' + soloRows);
  const soloHead = await page.$eval('#s9 table.rk', el => el.textContent);
  T('单人榜列=写铭总分/印章', /写铭总分/.test(soloHead) && /印章/.test(soloHead), soloHead.slice(0, 40));
  /* 增量㉜ 榜单新增「点亮拓片数」列 + 拓片按玩家隔离 */
  const rubCol = await page.evaluate(() => {
    const tb = document.querySelector('#s9 table.rk');
    const heads = [...tb.querySelectorAll('tr:first-child th')].map(t => t.textContent);
    const col = heads.indexOf('点亮拓片数');   /* 列号从表头动态解析，不写死 */
    const myRow = [...tb.querySelectorAll('tr')].find(r => r.textContent.includes('测试生甲'));
    const cell = myRow ? myRow.children[col].textContent : '';
    const real = Object.keys((__DG.DB.rubBy || {})['测试生甲'] || {}).length;
    return { hasCol: col >= 0, cell: +cell, real,
      isoNew: (() => { __DG.CUR.playerName = '新同学'; const n = rubCountOf(curPlayer()); __DG.CUR.playerName = '测试生甲'; return { fresh: n, back: rubCountOf(curPlayer()) }; })() };
  });
  T('榜单新增「点亮拓片数」列（数值=该玩家实拓数）',
    rubCol.hasCol && rubCol.cell === rubCol.real && rubCol.real > 0, JSON.stringify(rubCol));
  T('拓片按玩家隔离（新玩家 0·切回原玩家恢复）',
    rubCol.isoNew.fresh === 0 && rubCol.isoNew.back === rubCol.real, JSON.stringify(rubCol.isoNew));
  /* 增量㉜ 首页计数随登录即时刷新：输入新玩家名→立即显示其纪录（首次=0），切回老玩家恢复 */
  const loginRefresh = await page.evaluate(() => {
    go(0);
    const inp = document.getElementById('soloName');
    const set = v => { inp.value = v; inp.dispatchEvent(new Event('input')); };
    set('新同学');
    const fresh = document.getElementById('rubCount').textContent;
    set('测试生甲');
    const back = document.getElementById('rubCount').textContent;
    set('');
    return { fresh, back };
  });
  T('首页拓片计数随登录刷新（新玩家输入即 0·老玩家恢复纪录）',
    loginRefresh.fresh === '0' && loginRefresh.back === String(rubCol.real), JSON.stringify(loginRefresh));
  /* 分档隔离核心断言（何何老师截图 bug 的看门人）：同一难度子榜内不得混入他档记录，
     且跨档切换真的换数据（菜鸟榜无梦魇行、梦魇榜无菜鸟行，两榜行集互斥） */
  const sepChk = await page.evaluate(() => {
    const grab = () => [...document.querySelectorAll('#s9 table.rk tr')].slice(1).map(r => r.textContent);
    go(9); document.querySelector('#s9 [data-tab="solo"]').click();
    const rookieRows = grab();
    document.querySelector('#s9 .diffTabs [data-diff="nightmare"]').click();
    const nmRows = grab();
    const names = rows => rows.map(t => t.trim()).join('|');
    return { rookieN: rookieRows.length, nmN: nmRows.length,
              disjoint: rookieRows.length === 0 || nmRows.length === 0 ||
                        rookieRows.every(r => !nmRows.includes(r)) };
  });
  T('难度子榜互斥：菜鸟榜与梦魇榜行集无交集（混排 bug 永不复现）', sepChk.disjoint && (sepChk.rookieN > 0 || sepChk.nmN > 0), JSON.stringify(sepChk));

  /* ============ T8 成绩导出 / 导入 / 清空（V3 新增） ============ */
  console.log('▶ T8 成绩管理');
  await page.click('#btnHome');
  /* 在单人结算页测（需有一局成绩；限时局刚打完 page 6，先回封面再走一遍到结算太长 —— 直接借揭榜页空态无导出按钮，改在双人结算页测） */
  await page.evaluate(() => go(12));   /* 双人结算页（LAST_DUO 仍在） */
  const duoMgmt = await page.evaluate(() => ['btnExport', 'btnImport', 'btnClearScores'].map(id => !!document.getElementById(id)));
  T('双人结算页也有成绩管理三件套', duoMgmt.every(Boolean), duoMgmt.join(','));
  /* 导出：显式关掉 showSaveFilePicker，逼出 file:// 兜底 data: URL 下载路径（可确定性断言） */
  await page.evaluate(() => { delete window.showSaveFilePicker; });
  const dlPromise = page.waitForEvent('download', { timeout: 8000 });
  await page.click('#btnExport');
  const dl = await dlPromise;
  T('导出触发下载（data: URL 兜底）', /^鼎铭小史官-成绩_\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  /* 导入：注入一份合法 JSON，字段须与本项目 DB 合并（含 rubbings/ach） */
  const importPath = '/tmp/dg/test_import.json';
  fs.mkdirSync('/tmp/dg', { recursive: true });
  fs.writeFileSync(importPath, JSON.stringify({
    solo: [{ name: '测试生', diff: 'hard', traceTotal: 88.5, traceAvg: 88.5, marks: 7, words: 10, time: 99, ts: Date.now() }],
    duo: [], roster: ['甲', '乙'], rubbings: { '王': 90 }, ach: { first: 1 }
  }));
  await page.setInputFiles('#importFile', importPath);
  await sleep(600);
  const afterImport = await page.evaluate(() => ({
    soloN: __DG.DB.solo.length, hasTest: __DG.DB.solo.some(r => r.name === '测试生'),
    rub: (__DG.DB.rubBy['我'] || {})['王'], ach: __DG.DB.ach.first, roster: __DG.DB.roster.length
  }));
  T('导入成功且字段齐全（旧版拓片迁入「我」名下）', afterImport.hasTest && afterImport.rub === 90 && afterImport.ach === 1 && afterImport.roster === 2, JSON.stringify(afterImport));
  /* 清空对决成绩（confirm 对话框接受） */
  page.once('dialog', d => d.accept());
  await page.click('#btnClearScores');
  await sleep(500);
  const afterClear = await page.evaluate(() => ({ duoN: __DG.DB.duo.length, soloN: __DG.DB.solo.length, rubN: Object.keys(__DG.DB.rubBy['测试生甲'] || {}).length }));
  T('清空只动对决成绩（拓片/单人保留）', afterClear.duoN === 0 && afterClear.soloN >= 1 && afterClear.rubN > 0, JSON.stringify(afterClear));

  /* ============ T9 彩蛋系统（2026-10-07 修正：字符隐去 / 勾选纯内存 / 梦魇PK≥860 前置条件） ============ */
  console.log('▶ T9 彩蛋系统');
  await page.click('#btnHome'); await sleep(300);
  const noEgg = await page.evaluate(() => ({ cards: document.querySelectorAll('#s0 [data-egg]').length, gate: document.getElementById('eggGate').classList.contains('on') }));
  T('未解锁时封面无彩蛋卡、口令门关闭', noEgg.cards === 0 && !noEgg.gate, JSON.stringify(noEgg));
  /* 播送带是动画元素：Playwright 可点性检查会等"稳定"，用真实 DOM click 事件触发（与真人点击同一处理器） */
  await page.evaluate(() => document.querySelector('#s0 .coverOrbit').click());
  await sleep(200);
  const gateOpen = await page.evaluate(() => ({ on: document.getElementById('eggGate').classList.contains('on'),
    ph: document.getElementById('eggIn').placeholder || '',
    masked: document.getElementById('eggIn').type === 'password',
    cjk: /[\u4e00-\u9fff]/.test(document.getElementById('eggGate').textContent) }));
  T('播送带点击弹出口令窗', gateOpen.on, '');
  T('口令窗零文字提示且输入字符隐去（无占位符/无中文/type=password）', gateOpen.ph === '' && !gateOpen.cjk && gateOpen.masked, JSON.stringify(gateOpen));
  await page.fill('#eggIn', 'WRONG1');
  await page.click('#eggGo'); await sleep(300);
  const badGate = await page.evaluate(() => ({ on: document.getElementById('eggGate').classList.contains('on'),
    bad: document.getElementById('eggIn').classList.contains('bad'), cleared: document.getElementById('eggIn').value === '', pg: __DG.page }));
  T('错口令拒入（门不开·红框抖动·清空重输）', badGate.on && badGate.bad && badGate.cleared && badGate.pg === 0, JSON.stringify(badGate));
  /* 管理员金手指通道 */
  await page.fill('#eggIn', 'PFLS666');
  await page.click('#eggGo'); await sleep(300);
  const tao = await page.evaluate(() => ({ pg: __DG.page, items: document.querySelectorAll('#s13 input[data-mode]').length, modes: __DGE.EGG_MODES.length }));
  T('管理员金手指进世外桃源（注册表罗列勾选项）', tao.pg === 13 && tao.items === tao.modes, JSON.stringify(tao));
  await page.click('#taoAll'); await sleep(120);
  const allChecked = await page.evaluate(() => [...document.querySelectorAll('#s13 input[data-mode]')].every(b => b.checked));
  T('桃源「全选」生效', allChecked, '');
  await page.click('#taoOk'); await sleep(500);
  const afterOk = await page.evaluate(() => ({ pg: __DG.page, sel: __DGE.EGG_SEL.slice(), cards: document.querySelectorAll('#s0 [data-egg]').length,
    stored: Object.keys(JSON.parse(localStorage.getItem('dgms_dazhuan_v1') || '{}')).includes('eggSel') }));
  T('确定后自动回封面·内存勾选·封面出卡·localStorage 不落勾选', afterOk.pg === 0 && afterOk.sel.length === 1 && afterOk.cards === 1 && !afterOk.stored, JSON.stringify(afterOk));
  /* 勾选=纯内存态：刷新即失效（2026-10-07 修正定稿，替代旧的"持久化"语义） */
  await page.reload(); await page.evaluate(DRAW_FN); await sleep(400);
  const memOnly = await page.evaluate(() => ({ sel: __DGE.EGG_SEL.length, cards: document.querySelectorAll('#s0 [data-egg]').length, dbField: 'eggSel' in __DG.DB }));
  T('勾选只存内存：刷新即失效（卡片消失·内存清空·DB 无该字段）', memOnly.sel === 0 && memOnly.cards === 0 && !memOnly.dbField, JSON.stringify(memOnly));
  /* 学生通道：通用前置条件=**本会话内**实打的梦魇双人 PK 有人 ≥860（内存旗标，2026-10-11 修正——
     原读持久化对决榜历史，首个 860 后门永久打开，违背"解锁走内存"本意） */
  await page.evaluate(() => document.querySelector('#s0 .coverOrbit').click()); await sleep(200);
  await page.click('#eggGo'); await sleep(300);
  const rej1 = await page.evaluate(() => ({ on: document.getElementById('eggGate').classList.contains('on'), pg: __DG.page,
    bad: document.getElementById('eggIn').classList.contains('bad'), qualified: __DGE.eggGateQualified() }));
  T('未达标留空按 ➜：拒绝（零提示，仅抖动）', rej1.on && rej1.pg === 0 && rej1.bad && !rej1.qualified, JSON.stringify(rej1));
  const qualify = (diff, l, r) => page.evaluate(([d, a, b]) => __DGE.eggQualifyPk(d, a, b), [diff, l, r]);   /* 与 endDuo 同一函数 */
  T('困难局 870 分不算（前置条件限定梦魇难度）', await qualify('hard', 870, 0) === false, '');
  await page.evaluate(() => document.getElementById('eggIn').classList.remove('bad'));
  await page.click('#eggGo'); await sleep(300);
  const rej2 = await page.evaluate(() => ({ on: document.getElementById('eggGate').classList.contains('on'), pg: __DG.page }));
  T('困难 870 后留空仍拒（门未开）', rej2.on && rej2.pg === 0, JSON.stringify(rej2));
  T('梦魇 859 分不算（下限含 860）', await qualify('nightmare', 859, 0) === false, '');
  await page.click('#eggGo'); await sleep(300);
  const rej3 = await page.evaluate(() => ({ on: document.getElementById('eggGate').classList.contains('on'), pg: __DG.page }));
  T('梦魇 859 后留空仍拒（门未开）', rej3.on && rej3.pg === 0, JSON.stringify(rej3));
  T('梦魇 860 分达标（边界含入）', await qualify('nightmare', 860, 0) === true, '');
  await page.click('#eggGo'); await sleep(300);
  const ok2 = await page.evaluate(() => ({ pg: __DG.page, items: document.querySelectorAll('#s13 input[data-mode]').length, modes: __DGE.EGG_MODES.length }));
  T('前置条件达成：留空按 ➜ 进世外桃源', ok2.pg === 13 && ok2.items === ok2.modes, JSON.stringify(ok2));
  await page.click('#taoAll'); await sleep(100);
  await page.click('#taoOk'); await sleep(500);
  T('前置条件通道勾选后封面出卡', await page.evaluate(() => document.querySelectorAll('#s0 [data-egg]').length) === 1, '');
  /* 修复回归（2026-10-11 何何老师实测"达标了却解锁不了"）：原设计达标后仍弹口令窗、靠不可见的
     "留空按 ➜"仪式进门 —— 现达标后点播送带免口令窗直进桃源 */
  await page.evaluate(() => document.querySelector('#s0 .coverOrbit').click()); await sleep(300);
  const directEgg = await page.evaluate(() => ({ pg: __DG.page, gate: document.getElementById('eggGate').classList.contains('on') }));
  T('达标后点播送带免口令窗直进桃源（解锁可见化）', directEgg.pg === 13 && !directEgg.gate, JSON.stringify(directEgg));
  await page.click('#taoOk'); await sleep(500);   /* 直进时勾选框带着本会话内存态（已勾），确定即原样带回 */
  T('直进桃源后勾选仍生效（封面出卡，供后续流程）', await page.evaluate(() => document.querySelectorAll('#s0 [data-egg]').length) === 1, '');
  /* 达标旗标=会话内存态回归（2026-10-11 何何老师实测 bug：重开仍直进）：reload 即清零，须重新赚或金手指 */
  await page.reload(); await page.evaluate(DRAW_FN); await sleep(400);
  const resetChk = await page.evaluate(() => ({ q: __DGE.eggGateQualified(), sel: __DGE.EGG_SEL.length, cards: document.querySelectorAll('#s0 [data-egg]').length }));
  T('达标旗标重开即清（内存态：旗标/勾选/封面卡全消失）', resetChk.q === false && resetChk.sel === 0 && resetChk.cards === 0, JSON.stringify(resetChk));
  await page.evaluate(() => document.querySelector('#s0 .coverOrbit').click()); await sleep(200);
  const gateAgain = await page.evaluate(() => ({ on: document.getElementById('eggGate').classList.contains('on'), pg: __DG.page }));
  T('重开后点播送带弹口令窗（不再直进；持久榜 923.7 不再顶门）', gateAgain.on && gateAgain.pg === 0, JSON.stringify(gateAgain));
  await page.fill('#eggIn', 'PFLS666'); await page.click('#eggGo'); await sleep(300);
  await page.click('#taoAll'); await sleep(80); await page.click('#taoOk'); await sleep(500);
  T('金手指通道重进并勾选（封面出卡，供后续流程）', await page.evaluate(() => document.querySelectorAll('#s0 [data-egg]').length) === 1, '');

  /* ============ T13 点兵点将三档模型（V3.2 数据驱动，规格常量=需求本身，允许写死） ============ */
  console.log('▶ T13 点兵三档模型');
  await page.click('#s0 [data-egg="dian"]'); await sleep(300);
  const tierChk = await page.evaluate(() => {
    const T = __DGE.DIAN_TIERS, P = __DGE.DIAN_PT;
    const chips = [...document.querySelectorAll('#s14 [data-tier]')].map(c => c.dataset.tier);
    return { P, chips,
      rookie: { rounds: T.rookie.rounds, cdn: T.rookie.cdn, cdnMs: T.rookie.cdnMs, limits: T.rookie.limits },
      hard: { rounds: T.hard.rounds, cdn: T.hard.cdn, cdnMs: T.hard.cdnMs, limits: T.hard.limits },
      nightmare: { rounds: T.nightmare.rounds, cdn: T.nightmare.cdn, cdnMs: T.nightmare.cdnMs, limits: T.nightmare.limits } };
  });
  T('三档模型=何何老师定稿（菜鸟3/6/9不限时·困难6/9/12限8/12/16秒·梦魇6/9/12限6/9/12秒·每字10分）',
    tierChk.P === 10
    && JSON.stringify(tierChk.rookie.rounds) === '[3,6,9]' && tierChk.rookie.limits === null && tierChk.rookie.cdnMs === 1000
    && JSON.stringify(tierChk.hard.rounds) === '[6,9,12]' && tierChk.hard.cdnMs === 600
    && JSON.stringify(tierChk.hard.limits) === '{"6":8,"9":12,"12":16}'
    && JSON.stringify(tierChk.nightmare.rounds) === '[6,9,12]' && tierChk.nightmare.cdnMs === 1000
    && JSON.stringify(tierChk.nightmare.limits) === '{"6":6,"9":9,"12":12}',
    JSON.stringify(tierChk));
  T('倒计时特效序列=Ready→3→2→1→Go（菜鸟/困难）· Go! Go! Go!（梦魇）',
    JSON.stringify(tierChk.rookie.cdn) === JSON.stringify(['Ready...', '3', '2', '1', 'Go!'])
    && JSON.stringify(tierChk.hard.cdn) === JSON.stringify(['Ready...', '3', '2', '1', 'Go!'])
    && JSON.stringify(tierChk.nightmare.cdn) === JSON.stringify(['Go! Go! Go!']), JSON.stringify(tierChk));
  T('落地页难度芯片=三档', JSON.stringify(tierChk.chips) === JSON.stringify(['rookie', 'hard', 'nightmare']), JSON.stringify(tierChk.chips));
  await page.click('#s14 [data-tier="hard"]'); await sleep(200);
  const hardDesc = await page.evaluate(() => ({ key: __DGE.DIAN_DIFF_KEY, desc: document.getElementById('dianTierDesc').textContent }));
  T('困难档芯片切换生效（规则文案随档更新）', hardDesc.key === 'hard' && /6\/9\/12/.test(hardDesc.desc) && /8\/12\/16/.test(hardDesc.desc), JSON.stringify(hardDesc));
  await page.click('#s14 [data-tier="rookie"]'); await sleep(200);
  T('切回菜鸟档（恢复默认，供 T10 流程）', await page.evaluate(() => __DGE.DIAN_DIFF_KEY) === 'rookie', '');
  T('世外桃源文案=四关三档（何何老师定稿）', await page.evaluate(() => __DGE.EGG_MODES[0].desc.includes('3/6/9/12 四关三档难度限时记铭')), '');
  await page.click('#btnHome'); await sleep(250);   /* 回封面（T10 要填参赛名字） */
  /* 爬榜探针：捕获此后每次 playClimb 的铭牌名单（验"新王只踢同档"） */
  await page.evaluate(() => {
    const orig = window.playClimb;
    window.__climbs = [];
    window.playClimb = (list, a, b, c) => { window.__climbs.push(list.map(r => ({ d: r.diff || 'rookie', s: r.score }))); return orig(list, a, b, c); };
  });

  /* ============ T10 点兵点将 · 单人三关（V3.2：菜鸟档 + 倒计时特效 + 10 分/字） ============ */
  console.log('▶ T10 点兵点将 · 单人');
  await page.fill('#soloName', '测试将军'); await sleep(150);
  await page.click('#s0 [data-egg="dian"]'); await sleep(300);
  await page.click('#btnDianSolo'); await sleep(800);
  const mem1 = await page.evaluate(() => ({ pg: __DG.page, cells: document.querySelectorAll('#dh_M .dcell').length,
    lit: document.querySelectorAll('#dh_M .dcell.lit').length, n: __DGE.DIAN.rounds[0].n, tier: __DGE.DIAN.tier }));
  T('第一关列阵：3 槽军阵 · 逐字亮出（菜鸟档）', mem1.pg === 14 && mem1.cells === 3 && mem1.lit >= 1 && mem1.n === 3 && mem1.tier === 'rookie', JSON.stringify(mem1));
  /* 字消瞬间 → Ready/3/2/1/Go 倒计时特效（菜鸟共 5 秒）→ 换位军阵现身 */
  await page.waitForFunction(() => document.querySelector('#dh_M .dianCdnNum'), null, { timeout: 9000 });
  const cdn1 = await page.evaluate(() => {
    const cdn = __DGE.DIAN_TIERS.rookie.cdn;
    const t = document.querySelector('#dh_M .dianCdnNum').textContent;
    return { t, inSeq: cdn.indexOf(t) >= 0 };
  });
  T('字消瞬间跳出倒计时特效（火焰大字，序列内文案）', cdn1.inSeq, JSON.stringify(cdn1));
  await page.waitForFunction(() => __DGE.DIAN && __DGE.DIAN.phase === 'recall', null, { timeout: 15000 });
  const cdnDone = await page.evaluate(() => ({ gone: !document.querySelector('#dh_M .dianCdnNum'), noBar: !document.querySelector('#dh_M .dianBar') }));
  T('Go 后军阵现身：菜鸟档无答题倒计时条（不限时）', cdnDone.gone && cdnDone.noBar, JSON.stringify(cdnDone));
  const rec1 = await page.evaluate(() => {
    const st = __DGE.DIAN, seq = st.rounds[0].seq, off = st.rounds[0].off;
    const cellChars = [...document.querySelectorAll('#dh_M .dcell')].map(c => c.dataset.ch);
    return { same: off.every((c, i) => c === seq[i]), setEq: JSON.stringify(cellChars.slice().sort()) === JSON.stringify(off.slice().sort()) && JSON.stringify(off.slice().sort()) === JSON.stringify(seq.slice().sort()) };
  });
  T('隐去后换位重排（强制非原序 · 同字集）', !rec1.same && rec1.setEq, JSON.stringify(rec1));
  const seq1 = await page.evaluate(() => __DGE.DIAN.rounds[0].seq.slice());
  for (const ch of seq1) { await page.click(`#dh_M .dcell[data-ch="${ch}"]`); await sleep(70); }
  const stamps1 = await page.evaluate(() => [...document.querySelectorAll('#dh_M .dstamp')].map(x => +x.textContent).join(','));
  await page.click('#dh_M .dianOk'); await sleep(300);
  const feed1 = await page.evaluate(() => ({ hits: __DGE.DIAN.lastHits, score: __DGE.DIAN.score, per: __DGE.DIAN.per.slice() }));
  T('完美还原第一关 3/3 · +30 分（10 分/字，序号 1,2,3）', feed1.hits === 3 && feed1.score === 3 * 10 && feed1.per[0] === 3, `stamps=${stamps1} score=${feed1.score}`);
  await page.click('#dh_M .dianOk'); await sleep(300);   /* 下一关 */
  await page.waitForFunction(() => __DGE.DIAN.phase === 'recall', null, { timeout: 16000 });
  /* 第二关：轮转一位点将（rotation 对任意 n 都 0 命中，确定性成立）→ 部分答对得 0 分路径 */
  const rot2 = await page.evaluate(() => { const a = __DGE.DIAN.rounds[1].seq.slice(); return a.slice(1).concat(a[0]); });
  for (const ch of rot2) { await page.click(`#dh_M .dcell[data-ch="${ch}"]`); await sleep(60); }
  await page.click('#dh_M .dianOk'); await sleep(300);
  const feed2 = await page.evaluate(() => ({ hits: __DGE.DIAN.lastHits, score: __DGE.DIAN.score, n: __DGE.DIAN.rounds[1].n }));
  T('第二关轮转点将 0/6 · 加 0 分（位置语义判定）', feed2.hits === 0 && feed2.score === 30 && feed2.n === 6, JSON.stringify(feed2));
  await page.click('#dh_M .dianOk'); await sleep(300);
  await page.waitForFunction(() => __DGE.DIAN.phase === 'recall', null, { timeout: 18000 });
  const seq3 = await page.evaluate(() => __DGE.DIAN.rounds[2].seq.slice());
  for (const ch of seq3) { await page.click(`#dh_M .dcell[data-ch="${ch}"]`); await sleep(55); }
  await page.click('#dh_M .dianOk'); await sleep(300);
  const feed3 = await page.evaluate(() => ({ hits: __DGE.DIAN.lastHits, score: __DGE.DIAN.score, per: __DGE.DIAN.per.slice() }));
  T('第三关 9/9 · 总分 120（30+0+90，10 分/位）', feed3.hits === 9 && feed3.score === 120 && JSON.stringify(feed3.per) === '[3,0,9]', JSON.stringify(feed3));
  await page.click('#dh_M .dianOk'); await sleep(500);   /* 去结算 → 爬榜 */
  await page.waitForFunction(() => __DG.page === 10, null, { timeout: 6000 });
  await page.click('#skip_soloStage'); await sleep(600);
  const res1 = await page.evaluate(() => {
    const rec = __DG.DB.eggRec.dian.solo[0];
    return { pg: __DG.page, n: __DG.DB.eggRec.dian.solo.length, score: rec && rec.score, name: rec && rec.name, diff: rec && rec.diff,
      title: (document.querySelector('#s16 .resTitle') || {}).textContent || '', board: !!document.querySelector('#s16 table.rk') };
  });
  T('结算页：记录按名字+难度入库 · 随机头衔 · 内嵌菜鸟档点兵榜', res1.pg === 16 && res1.n === 1 && res1.score === 120 && res1.name === '测试将军' && res1.diff === 'rookie' && !!res1.title && res1.board, JSON.stringify(res1));
  const nwFirst = await page.evaluate(() => ({ fx: !!document.getElementById('nwFx'), nw: __DGE.DIAN_LAST.newWinner }));
  T('New Winner 首榜播报出现（首次成绩必新进前三）', nwFirst.fx && nwFirst.nw.indexOf('测试将军') >= 0, JSON.stringify(nwFirst));
  /* 花瓣动态飘落修复（何何老师 2026-10-08）：原 0.28~0.83px/帧 近乎静止 → 1.0~2.4px/帧 可见飘落 */
  const petalChk = await page.evaluate(async () => {
    const fx = __DGE.FX;
    if (!fx.fxOn || !fx.petals.length) return { have: false };
    const idx = fx.petals.map((p, i) => i).filter(i => fx.petals[i].y < 600);   /* 底部片 600ms 内会重生，剔除防假位移 */
    const ys0 = idx.map(i => fx.petals[i].y);
    await new Promise(r => setTimeout(r, 600));
    const deltas = idx.map((i, k) => fx.petals[i].y - ys0[k]);
    const vys = fx.petals.map(p => p.vy);
    return { have: true, n: fx.petals.length, maxD: Math.round(Math.max(...deltas)), vyMin: +Math.min(...vys).toFixed(2), vyMax: +Math.max(...vys).toFixed(2) };
  });
  T('结算页花瓣动态飘落修复（600ms 可见位移≥40px · 速度 1.0~2.4px/帧）',
    petalChk.have && petalChk.maxD >= 40 && petalChk.vyMin >= 1.0 && petalChk.vyMax <= 2.4, JSON.stringify(petalChk));

  /* ============ T11 点兵点将 · 双人真分屏 PK（V3.6） ============ */
  console.log('▶ T11 点兵点将 · 双人真分屏');
  await page.click('#btnHome'); await sleep(300);
  await page.click('#s0 [data-egg="dian"]'); await sleep(300);
  await page.fill('#dianA', '将军甲'); await page.fill('#dianB', '将军乙');
  await page.click('#btnDianDuo'); await sleep(500);
  const duoTop = await page.evaluate(() => ({ pg: __DG.page,
    halves: ['L', 'R'].map(sd => !!document.getElementById('dh_' + sd)),
    oks: ['L', 'R'].map(sd => !!document.querySelector('#dh_' + sd + ' .dianOk')) }));
  T('双人分屏：两半就位 · 确认键各自就位', duoTop.pg === 15 && duoTop.halves.every(Boolean) && duoTop.oks.every(Boolean), JSON.stringify(duoTop));
  /* 确认键几何（何何老师定稿位置）：分立中缝两侧 + 垂直居中 + 首屏可见（不在屏幕底部） */
  const geo = await page.evaluate(() => {
    const probe = sd => {
      const hr = document.getElementById('dh_' + sd).getBoundingClientRect();
      const or = document.querySelector('#dh_' + sd + ' .dianOk').getBoundingClientRect();
      const cx = or.left + or.width / 2, cy = or.top + or.height / 2;
      return { edgeGap: sd === 'L' ? hr.right - or.right : or.left - hr.left, sideRatio: sd === 'L' ? (hr.right - cx) / hr.width : (cx - hr.left) / hr.width,
        cyRatio: (cy - hr.top) / hr.height, bottom: or.bottom };
    };
    return { L: probe('L'), R: probe('R'), vh: innerHeight };
  });
  T('确认键贴答题区相邻侧（L 右缘 / R 左缘，环抱中缝；≤16px=dSide 列贴边+按钮列内居中）',
    geo.L.edgeGap <= 16 && geo.R.edgeGap <= 16 && geo.L.sideRatio < 0.3 && geo.R.sideRatio < 0.3,
    JSON.stringify(geo));
  T('确认键垂直居中且首屏可见（不在屏幕底部）',
    geo.L.cyRatio > 0.25 && geo.L.cyRatio < 0.75 && geo.R.cyRatio > 0.25 && geo.R.cyRatio < 0.75 && geo.L.bottom <= geo.vh && geo.R.bottom <= geo.vh,
    JSON.stringify(geo));
  await page.waitForFunction(() => __DGE.DIAN2 && __DGE.DIAN2.L.phase === 'recall', null, { timeout: 9000 });
  const boardEq = await page.evaluate(() => {
    const off = __DGE.DIAN2.rounds[0].off;
    const grab = sd => [...document.querySelectorAll('#dh_' + sd + ' .dcell')].map(c => c.dataset.ch);
    return { L: JSON.stringify(grab('L')) === JSON.stringify(off), R: JSON.stringify(grab('R')) === JSON.stringify(off) };
  });
  T('双方同题同字同乱序（公平性）', boardEq.L && boardEq.R, JSON.stringify(boardEq));
  const seqL1 = await page.evaluate(() => __DGE.DIAN2.rounds[0].seq.slice());
  for (const ch of seqL1) { await page.click(`#dh_L .dcell[data-ch="${ch}"]`); await sleep(50); }
  await page.click('#dh_L .dianOk'); await sleep(250);
  await page.click('#dh_L .dianOk'); await sleep(400);   /* 甲确认 → 立即进第二关 */
  const split = await page.evaluate(() => ({ L: { ri: __DGE.DIAN2.L.ri, ph: __DGE.DIAN2.L.phase }, R: { ri: __DGE.DIAN2.R.ri, ph: __DGE.DIAN2.R.phase } }));
  T('真分屏：甲确认后立即独进第二关，乙仍留在第一关作答', split.L.ri === 1 && split.L.ph === 'mem' && split.R.ri === 0 && split.R.ph === 'recall', JSON.stringify(split));
  /* 甲全程完美（菜鸟档满分 180 = (3+6+9)×10），乙全程轮转点将（0 分）—— 两侧独立推进直至双方完成 */
  async function dianPlaySide(sd, perfect) {
    for (let g = 0; g < 3; g++) {
      await page.waitForFunction(([s]) => __DGE.DIAN2 && __DGE.DIAN2[s] && (__DGE.DIAN2[s].phase === 'recall' || __DGE.DIAN2[s].done), sd, { timeout: 30000 });
      const done = await page.evaluate(s => __DGE.DIAN2[s].done, sd);
      if (done) return;
      const clicks = await page.evaluate(([s, p]) => {
        const a = __DGE.DIAN2[s].rounds[__DGE.DIAN2[s].ri].seq.slice();
        return p ? a : a.slice(1).concat(a[0]);
      }, [sd, perfect]);
      for (const ch of clicks) { await page.click(`#dh_${sd} .dcell[data-ch="${ch}"]`); await sleep(45); }
      await page.click(`#dh_${sd} .dianOk`); await sleep(220);
      await page.click(`#dh_${sd} .dianOk`); await sleep(260);   /* 下一关 / 完成 */
    }
  }
  await dianPlaySide('L', true);
  await dianPlaySide('R', false);
  await page.waitForFunction(() => __DG.page === 11, null, { timeout: 8000 });
  await page.click('#skip_duoStage'); await sleep(600);
  const duoResDian = await page.evaluate(() => ({ pg: __DG.page, n: __DG.DB.eggRec.dian.duo.length,
    scores: __DG.DB.eggRec.dian.duo.map(r => r.score).sort((a, b) => b - a),
    names: __DG.DB.eggRec.dian.duo.map(r => r.name).sort(),
    diffs: __DG.DB.eggRec.dian.duo.map(r => r.diff),
    hasWin: __DG.DB.eggRec.dian.duo.some(r => r.win === 'W') && __DG.DB.eggRec.dian.duo.some(r => r.win === 'L'),
    banner: (document.querySelector('#s16').textContent || '').includes('胜出'),
    cols: document.querySelectorAll('#s16 .pkcol').length }));
  T('双人结算：双方各自入库（名字非空防 undefined 同名互吞）· 胜负标记 · 180/0（10 分/字）· 头衔颁奖词',
    duoResDian.pg === 16 && duoResDian.n === 2 && duoResDian.scores[0] === 180 && duoResDian.scores[1] === 0
    && duoResDian.diffs.every(x => x === 'rookie')
    && duoResDian.names.every(x => x && x.length > 0) && duoResDian.hasWin && duoResDian.banner && duoResDian.cols === 2, JSON.stringify(duoResDian));
  await page.click('#btnHome'); await sleep(250);
  await page.click('#btnBoard'); await sleep(400);
  await page.click('[data-tab="dian"]'); await sleep(300);
  const dianTab = await page.evaluate(() => {
    const rows = document.querySelectorAll('#boardBody table.rk tr');
    return { tabs: [...document.querySelectorAll('#s9 [data-tab]')].map(c => c.dataset.tab),
      sub: [...document.querySelectorAll('#boardBody .diffTabs [data-diff]')].map(c => c.dataset.diff),
      rows: rows.length - 1 };
  });
  T('拓片墙「⛺ 点兵榜」页签+难度子榜（菜鸟档战报齐上）', dianTab.tabs.indexOf('dian') >= 0 && dianTab.sub.join(',') === 'rookie,hard,nightmare' && dianTab.rows >= 3, JSON.stringify(dianTab));

  /* ============ T14 点兵点将 · 梦魇档全流程（V3.2：Go! Go! Go! / 限时条 / 超时判定 / 12 字关 / New Winner） ============ */
  console.log('▶ T14 点兵点将 · 梦魇全流程+New Winner');
  await page.click('#btnHome'); await sleep(250);
  /* 预埋同档旧榜前三（250/200/150）—— 本局 180 分进前三挤掉 150，触发 New Winner */
  await page.evaluate(() => {
    const mk = (nm, score, ts) => keepBest(__DG.DB.eggRec.dian.duo,
      { name: nm, rival: '陪练', mode: 'duo', diff: 'nightmare', score, hits: Math.round(score / 10), slots: 27, win: 'W', time: 100, ts }, betterDian);
    mk('旧霸主甲', 250, Date.now() + 101);
    mk('旧霸主乙', 200, Date.now() + 102);
    mk('旧霸主丙', 150, Date.now() + 103);
    saveDB();
    return __DGE.dianTop3Names('nightmare');
  });
  await page.fill('#soloName', '梦魇测将'); await sleep(150);
  await page.click('#s0 [data-egg="dian"]'); await sleep(300);
  await page.click('#s14 [data-tier="nightmare"]'); await sleep(200);
  T('梦魇档选中（落地页芯片）', await page.evaluate(() => __DGE.DIAN_DIFF_KEY) === 'nightmare', '');
  await page.click('#btnDianSolo'); await sleep(600);
  await page.waitForFunction(() => __DGE.DIAN && __DGE.DIAN.phase === 'recall', null, { timeout: 30000 });   /* 第一关 Go（6.3s 记阵 + 1s 倒计时特效 ≈ 8 秒后，距上次 New Winner 播报已远超 3 秒生存期） */
  T('New Winner 特效无跨页残留（3 秒自毁独立于导航，body 级防泄漏）', (await page.evaluate(() => document.getElementById('nwFx'))) === null, '');
  /* 梦魇三关：Go! Go! Go! 1 秒后即开；6/9/12 字限时 6/9/12 秒；第二关故意 0 点选等超时，验证"严格按限时内实际点选" */
  async function dianNmRound(mode) {   /* mode: 'perfect' | 'timeout' */
    await page.waitForFunction(() => __DGE.DIAN && __DGE.DIAN.phase === 'recall', null, { timeout: 30000 });
    if (await page.evaluate(() => __DGE.DIAN.done)) return;
    if (mode === 'perfect') {
      const barChk = await page.evaluate(() => ({ bar: !!document.querySelector('#dh_M .dianMain .dianBar'),
        wrongSide: !!document.querySelector('#dh_M .dSide .dianBar'), lim: __DGE.DIAN.rounds[__DGE.DIAN.ri].n }));
      if (!dianNmRound.barSeen) dianNmRound.barSeen = barChk.bar && !barChk.wrongSide;
      const seq = await page.evaluate(() => __DGE.DIAN.rounds[__DGE.DIAN.ri].seq.slice());
      for (const ch of seq) { await page.click(`#dh_M .dcell[data-ch="${ch}"]`); await sleep(45); }
      await page.click('#dh_M .dianOk'); await sleep(220);
    } else {
      /* 不点任何字，等倒计时走完 → 超时自动判定 0 分 */
      await page.waitForFunction(() => __DGE.DIAN && __DGE.DIAN.phase === 'feed', null, { timeout: 20000 });
    }
    await page.click('#dh_M .dianOk'); await sleep(240);   /* 下一关 / 去结算 */
  }
  await dianNmRound('perfect');   /* 第一关 6 字限时 6 秒 */
  await dianNmRound('timeout');   /* 第二关 9 字限时 9 秒：超时 0 分 */
  await dianNmRound('perfect');   /* 第三关 12 字限时 12 秒（新增四关之末关） */
  await page.waitForFunction(() => __DG.page === 10, null, { timeout: 8000 });
  await page.click('#skip_soloStage'); await sleep(600);
  const nmRes = await page.evaluate(() => ({
    pg: __DG.page, score: __DG.DB.eggRec.dian.solo.find(r => r.name === '梦魇测将') ? __DG.DB.eggRec.dian.solo.find(r => r.name === '梦魇测将').score : null,
    diff: (__DG.DB.eggRec.dian.solo.find(r => r.name === '梦魇测将') || {}).diff,
    slots: (__DG.DB.eggRec.dian.solo.find(r => r.name === '梦魇测将') || {}).slots,
    newWinner: __DGE.DIAN_LAST.newWinner, per: __DGE.DIAN_LAST.per,
    nwFx: !!document.getElementById('nwFx'),
    nwText: (document.querySelector('#nwFx .nwText') || {}).textContent || '',
    petals: document.querySelectorAll('#nwFx .nwPetals i').length,
    tierLabel: (document.querySelector('#s16 .sub') || {}).textContent || ''
  }));
  T('梦魇档记录入库：180 分（60+0+120）· 27 槽 · diff=nightmare',
    nmRes.score === 180 && nmRes.diff === 'nightmare' && nmRes.slots === 27 && JSON.stringify(nmRes.per) === '[6,0,12]', JSON.stringify(nmRes));
  T('限时条在 Go 后出现（梦魇档答题计时）', dianNmRound.barSeen === true, '');
  T('New Winner 判定：梦魇测将 180 分新进前三挤掉 150 的旧霸主丙', nmRes.newWinner && nmRes.newWinner.indexOf('梦魇测将') >= 0, JSON.stringify(nmRes.newWinner));
  T('New Winner 特效：火焰大字 + 玫瑰花瓣 3 秒', nmRes.nwFx && nmRes.nwText === 'New Winner' && nmRes.petals >= 20, `petals=${nmRes.petals}`);
  await sleep(3200);
  const nwGone = await page.evaluate(() => ({ gone: !document.getElementById('nwFx'), tierLabel: (document.querySelector('#s16 .sub') || {}).textContent || '' }));
  T('New Winner 特效 3 秒后自动收场 · 结算页标注梦魇档', nwGone.gone && /梦魇/.test(nwGone.tierLabel), JSON.stringify(nwGone));
  const climbChk = await page.evaluate(() => window.__climbs || []);
  T('爬榜=本难度子榜（新王只踢同档铭牌，跨难度越界修复）',
    climbChk.length >= 3 && climbChk[1].every(x => x.d === 'rookie') && climbChk[2].every(x => x.d === 'nightmare')
    && climbChk[2].some(x => x.s === 180), JSON.stringify(climbChk));

  /* ============ T12 点兵成绩语义：同名保最佳 / 导入白名单（V3.6） ============ */
  console.log('▶ T12 点兵成绩语义');
  const kb = await page.evaluate(() => {
    const list = __DG.DB.eggRec.dian.solo;
    const best = list.slice().sort((a, b) => b.score - a.score)[0];
    keepBest(__DG.DB.eggRec.dian.solo, { name: best.name, mode: 'solo', diff: best.diff, score: 1, hits: 0, slots: best.slots, per: [0, 0, 0], time: 99, ts: Date.now() + 500 }, betterDian);
    const kept = __DG.DB.eggRec.dian.solo.find(r => r.name === best.name && r.diff === best.diff);
    return { n: __DG.DB.eggRec.dian.solo.length, kept: kept.score, bestScore: best.score, keptDiff: kept.diff };
  });
  T('同名保最佳（低分不覆盖高分，同档内比较）', kb.n === 2 && kb.kept === kb.bestScore, JSON.stringify(kb));
  const impKeep = await page.evaluate(() => new Promise(res => {
    const f = new File([JSON.stringify({ solo: [] })], 'x.json', { type: 'application/json' });
    importDB(f, () => res({ soloN: __DG.DB.solo.length, dianN: __DG.DB.eggRec.dian.solo.length,
      dbHasEggSel: 'eggSel' in __DG.DB, memSel: __DGE.EGG_SEL.slice() }));
  }));
  T('导入缺省件=合并语义：本地单人/点兵成绩原样保留·勾选是内存态不受导入影响且不入 DB', impKeep.soloN >= 1 && impKeep.dianN === 2 && !impKeep.dbHasEggSel && impKeep.memSel.length === 1, JSON.stringify(impKeep));
  const impEgg = await page.evaluate(() => new Promise(res => {
    const f = new File([JSON.stringify({ solo: [],
      eggRec: { dian: { solo: [{ name: '导入生', mode: 'solo', score: 99, hits: 3, slots: 18, per: [3, 0, 0], time: 9, ts: 123 }], duo: [] } } })], 'y.json', { type: 'application/json' });
    importDB(f, () => res({ n: __DG.DB.eggRec.dian.solo.length, hasImp: __DG.DB.eggRec.dian.solo.some(r => r.name === '导入生' && r.score === 99),
      localsKept: __DG.DB.eggRec.dian.solo.filter(r => r.name !== '导入生').length }));
  }));
  T('导入件 eggRec=合并不整替（旧档导入不再抹本机点兵历史——2026-10-11 何何老师实测事故根治）', impEgg.n === 3 && impEgg.hasImp && impEgg.localsKept === 2, JSON.stringify(impEgg));

  /* ============ T15 拓片墙榜单三件套 + 刷新持久看门（2026-10-11 增量㊶） ============ */
  console.log('▶ T15 拓片墙榜单管理');
  /* a) 刷新持久看门（补覆盖缺口：拓片墙点兵榜此前只在同会话内验过——"记录应存于 localStorage"的看门断言） */
  await page.reload(); await sleep(500);
  const dianPersist = await page.evaluate(() => ({ n: __DG.DB.eggRec.dian.solo.length, duoN: __DG.DB.eggRec.dian.duo.length }));
  T('刷新后点兵成绩仍在 localStorage（loadDB 白名单保留）', dianPersist.n === 3 && dianPersist.duoN >= 1, JSON.stringify(dianPersist));
  await page.click('#btnBoard'); await sleep(400);
  await page.click('[data-tab="dian"]'); await sleep(300);
  const wallDian = await page.evaluate(() => {
    const t = document.querySelector('#boardBody table.rk');
    const expect = __DG.DB.eggRec.dian.solo.concat(__DG.DB.eggRec.dian.duo).filter(r => (r.diff || 'rookie') === 'rookie').length;
    return { rows: t ? t.querySelectorAll('tr').length - 1 : 0, expect,
      exp: !!document.getElementById('wallExport'), imp: !!document.getElementById('wallImport'), clr: !!document.getElementById('wallClear') };
  });
  T('拓片墙·点兵榜：刷新后历史成绩可见（行数=菜鸟档记录数，动态不写死）+ 三件套常驻',
    wallDian.rows === wallDian.expect && wallDian.exp && wallDian.imp && wallDian.clr, JSON.stringify(wallDian));
  /* b) 三张榜三件套存在性 + 拓片墙页签不设（收藏墙非排行榜） */
  for (const tab of ['solo', 'duo']) {
    await page.click('[data-tab="' + tab + '"]'); await sleep(250);
    const chk = await page.evaluate(() => ({ exp: !!document.getElementById('wallExport'), imp: !!document.getElementById('wallImport'), clr: !!document.getElementById('wallClear') }));
    T('拓片墙·' + (tab === 'solo' ? '单人榜' : '对决榜') + '三件套常驻（空榜也在）', chk.exp && chk.imp && chk.clr, JSON.stringify(chk));
  }
  await page.click('[data-tab="rub"]'); await sleep(250);
  const rubNoMgmt = await page.evaluate(() => ({ exp: !!document.getElementById('wallExport'), imp: !!document.getElementById('wallImport'), clr: !!document.getElementById('wallClear') }));
  T('拓片墙页签（收藏墙）不设三件套（设计口径：非排行榜）', !rubNoMgmt.exp && !rubNoMgmt.imp && !rubNoMgmt.clr, JSON.stringify(rubNoMgmt));
  /* c) wall 清空点兵：只动点兵榜，主榜/拓片不误伤 */
  await page.click('[data-tab="dian"]'); await sleep(250);
  const preCounts = await page.evaluate(() => ({ solo: __DG.DB.solo.length, duo: __DG.DB.duo.length, rub: Object.keys(__DG.DB.rubBy['我'] || {}).length }));
  page.once('dialog', d => d.accept());
  await page.click('#wallClear'); await sleep(400);
  const afterWallClear = await page.evaluate(() => ({ dianS: __DG.DB.eggRec.dian.solo.length, dianD: __DG.DB.eggRec.dian.duo.length,
    soloN: __DG.DB.solo.length, duoN: __DG.DB.duo.length, rubN: Object.keys(__DG.DB.rubBy['我'] || {}).length }));
  T('wall 清空只动点兵榜（主榜/拓片不误伤）', afterWallClear.dianS === 0 && afterWallClear.dianD === 0
    && afterWallClear.soloN === preCounts.solo && afterWallClear.duoN === preCounts.duo && afterWallClear.rubN === preCounts.rub, JSON.stringify({ preCounts, afterWallClear }));
  /* d) wall 导出 → 内容断言（与结算页同一套 exportDB：全档） */
  await page.evaluate(() => { delete window.showSaveFilePicker; });   /* 逼出 file:// 兜底 data: URL 下载路径（可确定性断言） */
  await page.evaluate(() => {
    keepBest(__DG.DB.eggRec.dian.solo, { name: '往返将', mode: 'solo', diff: 'hard', score: 77, hits: 7, slots: 12, per: [7, 0, 0], time: 30, ts: Date.now() }, betterDian);
    saveDB();
  });
  const dl2Promise = page.waitForEvent('download', { timeout: 8000 });
  await page.click('#wallExport');
  const dl2 = await dl2Promise;
  T('wall 导出触发下载（与结算页同名全档）', /^鼎铭小史官-成绩_\d{4}-\d{2}-\d{2}\.json$/.test(dl2.suggestedFilename()), dl2.suggestedFilename());
  const dlPath = await dl2.path();
  const exported = JSON.parse(fs.readFileSync(dlPath, 'utf8'));
  T('导出内容含全档成绩（solo/duo/eggRec.dian 齐全）', exported.solo.length === preCounts.solo && exported.duo.length === preCounts.duo
    && !!(exported.eggRec && exported.eggRec.dian) && exported.eggRec.dian.solo.some(r => r.name === '往返将'),
    'solo=' + exported.solo.length + ' duo=' + exported.duo.length);
  /* e) 合并导入墓碑断言：导入"旧档形状"（显式空 eggRec + 空榜单——当年会抹数据的文件形状）不丢任何本机成绩 */
  const tombPath = '/tmp/dg/tomb_old_archive.json';
  fs.writeFileSync(tombPath, JSON.stringify({ ver: 1, solo: [], duo: [], roster: [], rubBy: {}, seenBy: {}, eggRec: {} }));
  await page.setInputFiles('#wallImportFile', tombPath);
  await sleep(600);
  const tomb = await page.evaluate(() => ({ dianS: __DG.DB.eggRec.dian.solo.length, soloN: __DG.DB.solo.length, duoN: __DG.DB.duo.length,
    hasWf: __DG.DB.eggRec.dian.solo.some(r => r.name === '往返将') }));
  T('导入旧档形状=合并不整替（2026-10-11 点兵历史丢失事故的墓碑断言）', tomb.dianS >= 1 && tomb.hasWf && tomb.soloN === preCounts.solo && tomb.duoN === preCounts.duo, JSON.stringify(tomb));
  /* f) round-trip：清空点兵 → 导入刚才导出的全档 → 点兵成绩恢复 */
  page.once('dialog', d => d.accept());
  await page.click('#wallClear'); await sleep(400);
  const clearedN = await page.evaluate(() => __DG.DB.eggRec.dian.solo.length);
  await page.setInputFiles('#wallImportFile', dlPath);
  await sleep(600);
  const rt = await page.evaluate(() => ({ n: __DG.DB.eggRec.dian.solo.length, hasWf: __DG.DB.eggRec.dian.solo.some(r => r.name === '往返将' && r.score === 77) }));
  T('清空后导入全档=点兵成绩恢复（round-trip）', clearedN === 0 && rt.n >= 1 && rt.hasWf, JSON.stringify({ clearedN, rt }));

  T('全程零 pageerror（收尾）', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));

  await browser.close();
  const fail = results.filter(r => !r.pass);
  console.log(`\n════ 结果: ${results.length - fail.length}/${results.length} 通过 ════`);
  if (fail.length) { console.log('失败项:'); fail.forEach(f => console.log('  ❌', f.name, f.detail || '')); process.exit(1); }
})().catch(e => { console.error('[套件异常]', e); process.exit(2); });
