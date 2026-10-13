#!/usr/bin/env node
/*
 * build.js — 构建器（SOP v2 §0：源码分片 + 构建即校验，唯一交付物 = 构建产物）
 * 断言全部在构建期执行：构建失败 = 源码有病，禁止带病交付。
 */
const fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, '铸铭问鼎论英雄-大篆训练营-V3.2.html');

const A = (cond, msg) => { if (!cond) { console.error('[构建中止]', msg); process.exit(1); } };

/* 分片顺序：p5/p6（V3.6 彩蛋层/点兵点将）必须排在 p4 之前 —— p4 末尾的 init() 是
   整个脚本的启动点，const 初始化（EGG_MODES/DIAN_SEQS 等）须先于它完成（TDZ） */
const order = ['p1.html', 'p2x_glyphs.js', 'p2c_info.js', 'p2a_utils.js', 'p2b_engine.js', 'p2d_calib.js', 'p3_solo.js', 'p5_egg.js', 'p6_dian.js', 'p4_extra.js'];
const shards = {};
order.forEach(f => {
  const p = path.join(SRC, f);
  A(fs.existsSync(p), '缺少分片 ' + f + (f === 'p2d_calib.js' ? '（先跑 node tools/calibrate.js）' : ''));
  shards[f] = fs.readFileSync(p, 'utf8');
});

/* ---- 断言 1：校准数据与字库一致 ---- */
const mCH = shards['p2d_calib.js'].match(/const CHARS = (\[[^\]]+\]);/);
A(mCH, 'p2d_calib.js 缺少 CHARS');
const CHARS = JSON.parse(mCH[1]);
A(CHARS.length === 35, 'CHARS 应为 35 字，实测 ' + CHARS.length);
let calibRaw;
try { calibRaw = fs.readFileSync('/tmp/dg/calib_dazhuan.json', 'utf8'); }
catch (e) { /* /tmp 跨会话被清 -> 回退项目 docs/ 归档副本 */ }
if (!calibRaw) {
  try { calibRaw = fs.readFileSync(path.join(ROOT, 'docs', '校准证据-calib_dazhuan.json'), 'utf8'); }
  catch (e2) { console.error('[构建中止] 校准证据缺失：请先运行 node tools/calibrate.js'); process.exit(1); }
}
const calib = JSON.parse(calibRaw);
A(JSON.stringify(Object.keys(calib.chars).sort()) === JSON.stringify(CHARS.slice().sort()), 'CHARS 与 calib.json 不一致（改了字形库必须重跑校准）');
CHARS.forEach(ch => A(shards['p2c_info.js'].includes(`"${ch}":{py:`), 'DZINFO 缺字义: ' + ch));
CHARS.forEach(ch => A(shards['p2x_glyphs.js'].includes(`"${ch}":["`), 'GLYPHS4.bronze 缺字形: ' + ch));

/* ---- 断言 2：SCRIPT 一致性（提取块默认脚本=bronze） ---- */
A(shards['p2b_engine.js'].includes("const SCRIPT = 'bronze'"), 'p2b_engine.js 缺少 SCRIPT 声明');
A(!shards['p2b_engine.js'].includes("'seal'"), 'p2b_engine.js 仍残留 seal 硬编码');

/* ---- 断言 3：拼接 JS 语法闸门 ---- */
const jsBody = order.slice(1).map(f => shards[f]).join('\n;\n');
const tmpJs = '/tmp/dg/_combined.js';
fs.writeFileSync(tmpJs, jsBody);
try { execSync(`node --check ${tmpJs}`); } catch (e) { console.error('[构建中止] 拼接 JS 语法错误\n', e.stderr && e.stderr.toString().slice(0, 800)); process.exit(1); }

/* ---- 组装 ---- */
const html = shards['p1.html'].replace('</body>',
  '<script>\n' + jsBody + '\n</script>\n</body>');
A(html.includes('</html>'), '组装后 HTML 不完整');

/* ---- 断言 4：零外链（红线：file:// 双击离线可用） ---- */
const extHits = html.match(/<script src=|<link\s|url\(\s*['"]?https?:|fetch\(['"]https?:|XMLHttpRequest/g) || [];
A(extHits.length === 0, '发现外链资源: ' + extHits.join(','));

/* ---- 断言 5：体积 sanity ---- */
A(html.length < 1500 * 1024, '产物超 1.5MB：' + html.length);

fs.writeFileSync(OUT, html);
const md5 = crypto.createHash('md5').update(html).digest('hex');
const report = { file: OUT, bytes: html.length, md5, shards: order, chars: CHARS.length, ts: new Date().toISOString() };
fs.writeFileSync('/tmp/dg/build_report.json', JSON.stringify(report, null, 2));
console.log(`OK 构建产物: ${OUT}`);
console.log(`   ${(html.length / 1024).toFixed(1)} KB · MD5 ${md5} · 字库 ${CHARS.length} 字 · 分片 ${order.length} 件`);
