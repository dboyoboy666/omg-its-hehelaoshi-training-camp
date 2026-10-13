#!/usr/bin/env node
/*
 * extract.js — 从篆刻工坊 v6.6.618（只读源）逐字提取可复用块 → 生成本项目的 p2 分片。
 * 纪律（SOP v3）：
 *  - 只读原文件，绝不写入；每次运行后由外部 MD5 复核原文件零改动
 *  - 适配点必须显式声明为补丁（find/replace/期望命中数），命中数不符即中止
 *  - 生成文件头注明来源行区间，便于人工核对
 */
const fs = require('fs'), path = require('path');

const SRC = '/tmp/dg/source.js';               // 已抽取的 v6.6.618 <script> 全文（只读缓存）
const OUT = path.join(__dirname, '..', 'src');

if (!fs.existsSync(SRC)) { console.error('缺少 ' + SRC + '，先跑抽取步骤'); process.exit(1); }
const lines = fs.readFileSync(SRC, 'utf8').split('\n');

/* 按 1-based 行区间取原文（含头尾），每块带来源标注 */
function block(a, b, tag) {
  const body = lines.slice(a - 1, b).join('\n');
  return `/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 ${a}~${b} 行 [${tag}] ▼▼▼ */\n`
    + body + `\n/* ▲▲▲ 提取块结束 [${tag}] ▲▲▲ */\n`;
}

/* 补丁表：每条适配都要在预期位置精确命中 expect 次，否则中止 */
const patches = [
  { tag: 'rasterizeGlyph 默认脚本参数化', find: "const x = c.getContext('2d'); x.fillStyle = '#000'; x.fill(glyphPath2D(ch, 'seal'));",
    replace: "const x = c.getContext('2d'); x.fillStyle = '#000'; x.fill(glyphPath2D(ch, SCRIPT));", expect: 1 },
  { tag: 'renderGuide 灰字脚本参数化', find: "const p = glyphPath2D(st.ch, 'seal');",
    replace: "const p = glyphPath2D(st.ch, SCRIPT);", expect: 1 },
  { tag: 'glyphPath2D 默认表参数化', find: "const src = script ? (GLYPHS4[script] || {}) : GLYPHS4.seal;\n  const p = new Path2D();",
    replace: "const src = script ? (GLYPHS4[script] || {}) : GLYPHS4[SCRIPT];\n  const p = new Path2D();", expect: 1 },
  { tag: 'svgOf 默认表参数化', find: "function svgOf(ch, script, cls) {\n  const src = script ? (GLYPHS4[script] || {}) : GLYPHS4.seal;",
    replace: "function svgOf(ch, script, cls) {\n  const src = script ? (GLYPHS4[script] || {}) : GLYPHS4[SCRIPT];", expect: 1 },
  { tag: 'glyphData 缓存键带脚本', find: "function glyphData(ch) {\n  if (CACHE[ch]) return CACHE[ch];",
    replace: "function glyphData(ch) {\n  const ck = SCRIPT + '|' + ch;\n  if (CACHE[ck]) return CACHE[ck];", expect: 1 },
  { tag: 'glyphData 缓存写键带脚本', find: "CACHE[ch] = { mask, skel, skelIdx, chains, frags, dist, skelDist, skelN: skelIdx.length };\n  return CACHE[ch];",
    replace: "CACHE[ck] = { mask, skel, skelIdx, chains, frags, dist, skelDist, skelN: skelIdx.length };\n  return CACHE[ck];", expect: 1 },
  { tag: '判分数据源改名 CHARINFO→DZINFO', find: "const info = CHARINFO[ch];", replace: "const info = DZINFO[ch];", expect: 1 },
  { tag: '干扰项数据源改名 CHARINFO→DZINFO', find: "const info = CHARINFO[ans];", replace: "const info = DZINFO[ans];", expect: 1 },
  { tag: '干扰项池改名 CHARINFO→DZINFO', find: "const a = shuffle(pool.filter(c => CHARINFO[c].cat === info.cat));\n  const b = shuffle(pool.filter(c => CHARINFO[c].cat !== info.cat && CHARINFO[c].lv === info.lv));\n  const c = shuffle(pool.filter(c => CHARINFO[c].cat !== info.cat && CHARINFO[c].lv !== info.lv));",
    replace: "const a = shuffle(pool.filter(c => DZINFO[c].cat === info.cat));\n  const b = shuffle(pool.filter(c => DZINFO[c].cat !== info.cat && DZINFO[c].lv === info.lv));\n  const c = shuffle(pool.filter(c => DZINFO[c].cat !== info.cat && DZINFO[c].lv !== info.lv));", expect: 1 },
  { tag: '存储命名空间独立', find: "const STORE_KEY = 'zkgf_xiaozhuan_v1';", replace: "const STORE_KEY = 'dgms_dazhuan_v1';", expect: 1 },
  { tag: 'saveDB 去 writeHandle 依赖（文件导出机制不在本项目提取范围）', find: "function saveDB() { try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { } writeHandle(); }",
    replace: "function saveDB() { try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { } }", expect: 1 },
  { tag: 'coalesced 事件为空时回退当前事件（合成事件/部分触屏驱动返回空数组会导致不录点）',
    find: "const raw = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];",
    replace: "const raw = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];", expect: 1 },
  { tag: 'DB 初始形状保留拓片库（本课新增字段，原 loadDB 重建时会丢弃）',
    find: "let DB = { ver: 1, solo: [], duo: [], roster: [], lib: null };",
    replace: "let DB = { ver: 1, solo: [], duo: [], roster: [], lib: null, rubbings: {} };", expect: 1 },
  { tag: 'renderGuide 起笔编号点（每条骨架链起点 = 落笔端点提示，教学用）',
    find: "function renderGuide() {\n    gx.clearRect(0, 0, L, L);\n    const p = glyphPath2D(st.ch, SCRIPT);\n    gx.fillStyle = '#e6e3dc'; gx.fill(p);\n    gx.strokeStyle = '#c9c5bb'; gx.lineWidth = 1.6; gx.stroke(p);\n  }",
    replace: "function renderGuide() {\n    gx.clearRect(0, 0, L, L);\n    const p = glyphPath2D(st.ch, SCRIPT);\n    gx.fillStyle = '#e6e3dc'; gx.fill(p);\n    gx.strokeStyle = '#c9c5bb'; gx.lineWidth = 1.6; gx.stroke(p);\n    try {\n      const G = glyphData(st.ch);\n      gx.font = 'bold 15px sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle';\n      G.chains.forEach((c, i) => {\n        const x = c[0] % L, y = (c[0] / L) | 0;\n        gx.beginPath(); gx.arc(x, y, 9, 0, 7);\n        gx.fillStyle = 'rgba(176,58,46,.18)'; gx.fill();\n        gx.fillStyle = 'rgba(142,43,33,.6)'; gx.fillText(String(i + 1), x, y);\n      });\n    } catch (err) { /* 编号提示失败不影响描红 */ }\n  }", expect: 1 },
  { tag: 'loadDB 重建形状保留拓片库',
    find: "DB = { ver: 1, solo: d.solo || [], duo: d.duo || [], roster: d.roster || [], lib: d.lib || null };",
    replace: "DB = { ver: 1, solo: d.solo || [], duo: d.duo || [], roster: d.roster || [], lib: d.lib || null, rubbings: d.rubbings || {} };", expect: 1 },
  { tag: 'V2 DB 初始形状保留成就库',
    find: "let DB = { ver: 1, solo: [], duo: [], roster: [], lib: null, rubbings: {} };",
    replace: "let DB = { ver: 1, solo: [], duo: [], roster: [], lib: null, rubbings: {}, ach: {} };", expect: 1 },
  { tag: 'V2 loadDB 保留成就库',
    find: "DB = { ver: 1, solo: d.solo || [], duo: d.duo || [], roster: d.roster || [], lib: d.lib || null, rubbings: d.rubbings || {} };",
    replace: "DB = { ver: 1, solo: d.solo || [], duo: d.duo || [], roster: d.roster || [], lib: d.lib || null, rubbings: d.rubbings || {}, ach: d.ach || {} };", expect: 1 },
  { tag: 'V2 音效开关持久化',
    find: "function toggleSound() {\n  soundOn = !soundOn;\n  const b = document.getElementById('soundBtn');\n  if (b) b.textContent = soundOn ? '🔔 音效：开' : '🔕 音效：关';\n  if (soundOn) { ensureAudio(); sndTick(); }\n}",
    replace: "function toggleSound() {\n  soundOn = !soundOn;\n  const b = document.getElementById('soundBtn');\n  if (b) b.textContent = soundOn ? '🔔 音效：开' : '🔕 音效：关';\n  try { localStorage.setItem('dgms_sound', soundOn ? '1' : '0'); } catch (e) { }\n  if (soundOn) { ensureAudio(); sndTick(); }\n}", expect: 1 },
];

function applyPatches(name, text, patchIdx) {
  patchIdx.forEach(i => {
    const p = patches[i];
    const n = text.split(p.find).length - 1;
    if (n !== p.expect) { console.error(`[中止] 补丁「${p.tag}」命中 ${n} 次，期望 ${p.expect}`); process.exit(1); }
    text = text.split(p.find).join(p.replace);
  });
  return text;
}

/* 补丁索引映射（哪些补丁作用于哪些块） */
const P_ENGINE = [0, 2, 4, 5, 6];          // 引擎块（含 timeOf 的 DZINFO 改名）
const P_INKBOX = [1];                       // InkBox 灰字
const P_SVGOF = [3, 8];                     // svgOf + distractors（在 utils 块）
const P_STORE = [9];                        // 存储 key
const P_DISTR = [7, 8];                     // distractors（在 utils 块）

/* ---- p2b_engine.js ---- */
let eng = [
  block(35, 46, 'L1 常量与限时参数'),
  block(75, 146, 'DIFF 三档 + 限时模型 + 计分权重'),
  block(147, 201, 'r1/LUT/buildLUT/setDiff'),
  block(203, 435, '描红判定引擎 v3.2'),
  block(440, 509, 'L3 Web Audio 音效'),
  block(514, 594, 'L4 粒子特效 + floatScore + toast'),
  block(595, 661, 'L4.1 三级存储（本地 best 去重）'),
  block(2032, 2100, 'InkBox 描红画布（闭包工厂）'),
].join('\n');
eng = applyPatches('p2b_engine.js', eng, [...P_ENGINE, P_INKBOX, P_STORE, 10, 11, 12, 13, 14, 15, 16, 17]);
/* SCRIPT 声明插到最前（默认大篆金文） */
eng = `/* 本课件当前主书体：金文（大篆主体）。提取块的默认脚本统一指向它。 */\nconst SCRIPT = 'bronze';\n\n` + eng;

/* ---- p2a_utils.js（工具 + 出题器，供 p3/p4 引用） ---- */
let util = [
  block(1116, 1124, 'shuffle/esc/svgOf'),
  block(1125, 1138, '干扰项 + 出题器'),
].join('\n');
util = applyPatches('p2a_utils.js', util, [...new Set([...P_SVGOF, ...P_DISTR])]);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'p2b_engine.js'), eng);
fs.writeFileSync(path.join(OUT, 'p2a_utils.js'), util);

/* ---- p2x_glyphs.js：GLYPHS4 四体字库整体提取（字形数据零改动） ---- */
const glyphs = `/* ▼▼▼ GLYPHS4 四体字库：逐字提取自 v6.6.618 第 7 行（oracle/bronze/seal/clerical 四表，SVG path，400×400 viewBox）▼▼▼ */
` + lines[6] + `
/* ▲▲▲ GLYPHS4 提取块结束（来源 etymology-svg 开源字库，见原文件头注） ▲▲▲ */
`;
fs.writeFileSync(path.join(OUT, 'p2x_glyphs.js'), glyphs);
console.log('OK p2b_engine.js', eng.length, 'bytes; p2a_utils.js', util.length, 'bytes; p2x_glyphs.js', glyphs.length, 'bytes');

/* 自检：确认关键符号都齐了 */
const need = ['function judgeScore', 'function glyphData', 'function skeletonize', 'function chainTrace',
  'function distTransform', 'function bandCanvas', 'function InkBox', 'function judgeScore',
  'function setDiff', "setDiff('rookie')", 'const SCRIPT', 'function svgOf', 'function distractors',
  'function mkQuestion', 'function loadDB', 'function saveDB', 'function keepBest', 'function sndWin',
  'function toast', 'function floatScore', 'const STORE_KEY', 'dgms_dazhuan_v1'];
const missing = need.filter(k => !eng.includes(k) && !util.includes(k));
if (missing.length) { console.error('[中止] 生成块缺少符号:', missing); process.exit(1); }
console.log('符号自检通过:', need.length, '项');
