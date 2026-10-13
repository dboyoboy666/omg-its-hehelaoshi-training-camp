#!/usr/bin/env node
/*
 * calibrate.js — Phase 0 真机校准（PRD §7.3-3 / §12 Phase 0 第①项）
 * 探针 = p2x_glyphs + p2c_info + p2b_engine + 探针脚本，真实 Chrome file:// 运行：
 *   ① bronze 35 字：L/N（骨架链长度与段数）· 自洽分（autoSegs 判 autoSegs）
 *   ② 整体沿法线偏移 4px / 8px 的判分灵敏度（金文肥笔校准的实证）
 *   ③ 全对 mask IoU 矩阵 → SIMILAR 相似字表（辨铭出题依据）
 * 产物：src/p2d_calib.js（CHARS / DZINFO 回填 L,N,lv / SIMILAR / TRACE_POOL）+ 校准报告
 * 纪律：lv 规则沿用 v6.6.18 校准公式 C=L+80×(N-1)；若分档退化则按分位数兜底并如实报告。
 */
const fs = require('fs'), path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'tools', 'node_modules', 'playwright-core'));

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const TMP = '/tmp/dg';
fs.mkdirSync(TMP, { recursive: true });

const glyphs = fs.readFileSync(path.join(SRC, 'p2x_glyphs.js'), 'utf8');
const info = fs.readFileSync(path.join(SRC, 'p2c_info.js'), 'utf8');
const engine = fs.readFileSync(path.join(SRC, 'p2b_engine.js'), 'utf8');

const PROBE = `
;(function () {
  const ALL = Object.keys(GLYPHS4.bronze);
  const out = { chars: {}, iou: {}, time: { min: 99, max: 0 } };
  function chainLen(chain) {
    let s = 0;
    for (let k = 1; k < chain.length; k++) {
      const a = chain[k - 1], b = chain[k];
      s += Math.hypot((b % L) - (a % L), ((b / L) | 0) - ((a / L) | 0));
    }
    return s;
  }
  function offsetChain(chain, d) {
    /* autoSegs 返回的 chain 已是 [x,y] 坐标（非像素索引），直接用法线偏移 */
    const pts = chain;
    const op = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const w = d * (0.8 + 0.4 * Math.abs(Math.sin(k / 7)));
      op.push([p[0] - dy * w, p[1] + dx * w]);
    }
    return op;
  }
  ALL.forEach(ch => {
    const G = glyphData(ch);
    const Lsum = G.chains.reduce((s, c) => s + chainLen(c), 0);
    DZINFO[ch].L = Math.round(Lsum); DZINFO[ch].N = G.chains.length;
    const r0 = judgeScore(autoSegs(ch), ch);
    const r4 = judgeScore(autoSegs(ch).map(c => offsetChain(c, 4)), ch);
    const r8 = judgeScore(autoSegs(ch).map(c => offsetChain(c, 8)), ch);
    const t = timeOf(ch);
    out.time.min = Math.min(out.time.min, t); out.time.max = Math.max(out.time.max, t);
    out.chars[ch] = { L: Math.round(Lsum), N: G.chains.length, frags: G.frags, skelN: G.skelN,
      self: r1(r0.score), off4: r1(r4.score), off8: r1(r8.score),
      strokes: r0.totalStrokes, unfinished4: r4.unfinished, ms: Math.round(r0.ms) };
  });
  const masks = {}; ALL.forEach(ch => masks[ch] = glyphData(ch).mask);
  for (let a = 0; a < ALL.length; a++) {
    const ca = ALL[a]; const best = [];
    for (let b = 0; b < ALL.length; b++) {
      if (a === b) continue;
      const cb = ALL[b];
      let inter = 0, uni = 0; const ma = masks[ca], mb = masks[cb];
      for (let i = 0; i < L * L; i++) { const u = ma[i] | mb[i]; if (u) { uni++; if (ma[i] && mb[i]) inter++; } }
      best.push([cb, inter / uni]);
    }
    best.sort((x, y) => y[1] - x[1]);
    out.iou[ca] = best.slice(0, 4).map(x => [x[0], Math.round(x[1] * 1000) / 1000]);
  }
  window.__CALIB__ = out;
  document.title = 'CALIB_DONE';
})();`;

(async () => {
  const probeHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>probe</title></head><body>
<script>\n${glyphs}\n${info}\n${engine}\n${PROBE}\n</script></body></html>`;
  const probePath = path.join(TMP, 'probe_dazhuan.html');
  fs.writeFileSync(probePath, probeHtml);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + probePath);
  try {
    await page.waitForFunction(() => document.title === 'CALIB_DONE', null, { timeout: 60000 });
  } catch (e) {
    console.error('[中止] 探针未完成。pageerror:', errs.slice(0, 5));
    process.exit(1);
  }
  const calib = await page.evaluate(() => window.__CALIB__);
  await browser.close();
  if (errs.length) console.error('[警告] 探针报错:', errs.slice(0, 5));
  const calibJson = JSON.stringify(calib);
  fs.writeFileSync(path.join(TMP, 'calib_dazhuan.json'), calibJson);
  /* 校准证据同时归档到项目 docs/：/tmp 跨会话会被清，构建可从此回拷（根治缓存丢失坑） */
  fs.writeFileSync(path.join(ROOT, 'docs', '校准证据-calib_dazhuan.json'), calibJson);

  /* ---------- 生成 p2d_calib.js ---------- */
  const CHARS = Object.keys(calib.chars);
  const assert = (cond, msg) => { if (!cond) { console.error('[中止]', msg); process.exit(1); } };
  assert(CHARS.length === 35, 'bronze 字数应为 35，实测 ' + CHARS.length);

  /* lv 分档：规则优先，退化则分位数兜底（如实记录用了哪条路） */
  const C = ch => calib.chars[ch].L + 80 * (calib.chars[ch].N - 1);
  let lvMap = {}, lvMode = 'rule';
  CHARS.forEach(ch => {
    const c = C(ch), n = calib.chars[ch].N;
    lvMap[ch] = (c >= 1900 || (n >= 4 && c >= 1100 && c < 1900)) ? (c >= 1900 ? 3 : (n >= 4 && c >= 1100 ? 2 : 1)) : 1;
  });
  lvMap = {}; // 上面表达式写得绕，重写清晰版
  CHARS.forEach(ch => {
    const c = C(ch), n = calib.chars[ch].N;
    lvMap[ch] = c >= 1900 ? 3 : (n >= 4 && c >= 1100 ? 2 : 1);
  });
  const byLv = lv => CHARS.filter(ch => lvMap[ch] === lv);
  if (!byLv(1).length || !byLv(2).length || !byLv(3).length) {
    lvMode = 'quantile(17/12/6)';
    const sorted = CHARS.slice().sort((a, b) => C(a) - C(b));
    sorted.forEach((ch, i) => { lvMap[ch] = i < 17 ? 1 : (i < 29 ? 2 : 3); });
  }

  /* TRACE_POOL：自洽分 ≥95 且 4px 偏移分 ≥90（rookie 带）→ 可放心进描红 */
  const TRACE_POOL = CHARS.filter(ch => calib.chars[ch].self >= 95 && calib.chars[ch].off4 >= 90);
  const EXCLUDED = CHARS.filter(ch => !TRACE_POOL.includes(ch));

  const SIMILAR = {};
  CHARS.forEach(ch => { SIMILAR[ch] = calib.iou[ch].slice(0, 3).map(x => x[0]); });
  CHARS.forEach(ch => assert(SIMILAR[ch].length === 3 && !SIMILAR[ch].includes(ch) && SIMILAR[ch].every(c => CHARS.includes(c)), 'SIMILAR 异常: ' + ch));

  const infoAssign = CHARS.map(ch => {
    const c = calib.chars[ch];
    /* 逐字段 merge：绝不能整对象替换（会覆盖 p2c_info 的 py/cat/sw/desc —— 抬杠环节抓到的 P0） */
    return `Object.assign(DZINFO["${ch}"], {L:${c.L},N:${c.N},lv:${lvMap[ch]},self:${c.self}});`;
  }).join('\n');
  const out = `/* =====================================================================
   p2d_calib.js —— 【真机校准产物】由 tools/calibrate.js 生成于 ${new Date().toLocaleString()}
   证据：/tmp/dg/calib.json（真实 Chrome file:// 探针，勿手改）
   · L/N：bronze 字形骨架实测（描红判定与限时模型 timeOf 的数据源）
   · lv：规则 C=L+80×(N-1)（${lvMode}）
   · TRACE_POOL：自洽分≥95 且 4px 偏移分≥90 的字才进描红池（排除 ${EXCLUDED.length} 字）
   · SIMILAR：全对 mask IoU Top-3（辨铭出题依据）
   ===================================================================== */
const CHARS = ${JSON.stringify(CHARS)};
${infoAssign}
const SIMILAR = ${JSON.stringify(SIMILAR)};
const TRACE_POOL = ${JSON.stringify(TRACE_POOL)};
`;
  fs.writeFileSync(path.join(SRC, 'p2d_calib.js'), out);

  /* ---------- 校准报告 ---------- */
  console.log('════ bronze 35 字真机校准报告（Chrome 真机探针）════');
  console.log('字 | L(骨架px) | N(笔段) | C | 阶 | 自洽分 | 4px偏移 | 8px偏移 | 碎链 | 未完成(4px)');
  CHARS.forEach(ch => {
    const c = calib.chars[ch];
    console.log(`${ch} | ${c.L} | ${c.N} | ${C(ch)} | ${lvMap[ch]} | ${c.self} | ${c.off4} | ${c.off8} | ${c.frags} | ${c.unfinished4}`);
  });
  console.log('lv 分档方式:', lvMode, '| 一阶:', byLv(1).length, '二阶:', byLv(2).length, '三阶:', byLv(3).length);
  console.log('限时模型区间:', calib.time.min, '~', calib.time.max, '秒（模型锚点 10~18）');
  console.log('描红池 TRACE_POOL:', TRACE_POOL.length, '字', TRACE_POOL.join(''));
  if (EXCLUDED.length) console.log('描红排除（兜底）:', EXCLUDED.join(''), '→ 这些字只进识铭/辨铭，不进写铭');
  const s4 = CHARS.map(ch => calib.chars[ch].off4), s8 = CHARS.map(ch => calib.chars[ch].off8);
  const stat = a => ({ min: Math.min(...a), med: a.slice().sort((x, y) => x - y)[(a.length >> 1)], max: Math.max(...a) });
  console.log('4px 偏移分:', JSON.stringify(stat(s4)), '| 8px 偏移分:', JSON.stringify(stat(s8)));
  console.log('IOU 最相似对（Top6）:');
  const pairs = [];
  CHARS.forEach(ch => calib.iou[ch].slice(0, 1).forEach(x => pairs.push([ch, x[0], x[1]])));
  pairs.sort((a, b) => b[2] - a[2]).slice(0, 6).forEach(p => console.log(`  ${p[0]}↔${p[1]} IoU=${p[2]}`));
})();
