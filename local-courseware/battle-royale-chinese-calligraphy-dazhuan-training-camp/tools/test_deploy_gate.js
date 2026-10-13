/* 门禁部署版真机测试：门禁行为 + 内存态不持久 + 课件功能不误伤 */
const { chromium } = require('/Users/dboyoboy666/My-Projects/趣味游戏互动HTML课件集/铸铭问鼎论英雄-大篆训练营/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = (name, ok, d) => console.log((ok ? '  ✅ ' : '  ❌ ') + name + (d ? ' — ' + d : ''));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await page.goto('file:///Users/dboyoboy666/My-Projects/dazhuan-camp-sites/index.html');
  await sleep(600);

  /* A. 门禁行为 */
  const g1 = await page.evaluate(() => ({ on: !document.getElementById('gkGate').classList.contains('off'),
    covered: getComputedStyle(document.getElementById('gkGate')).zIndex,
    type: document.getElementById('gkIn').type, ph: document.getElementById('gkIn').placeholder || '' }));
  T('门禁首屏挡住（z-index 顶层·密码框·无占位文字）', g1.on && +g1.covered >= 99999 && g1.type === 'password' && g1.ph === '', JSON.stringify(g1));
  const blocked = await page.evaluate(() => { document.getElementById('btnHome').click(); return document.getElementById('gkGate').classList.contains('off'); });
  T('未解锁时点击穿透无效（门仍挡）', !blocked, '');
  await page.fill('#gkIn', 'wrong'); await page.click('#gkGo'); await sleep(300);
  const g2 = await page.evaluate(() => ({ on: !document.getElementById('gkGate').classList.contains('off'), bad: document.getElementById('gkIn').classList.contains('bad'), val: document.getElementById('gkIn').value }));
  T('错密钥拒入（门不开·红框）', g2.on && g2.bad, JSON.stringify(g2));
  await page.fill('#gkIn', 'zyywz'); await page.click('#gkGo'); await sleep(300);
  const g3 = await page.evaluate(() => ({ off: document.getElementById('gkGate').classList.contains('off') }));
  T('正确密钥 zyywz 进入课件', g3.off, JSON.stringify(g3));

  /* B. 内存态：无任何持久化痕迹 */
  const g4 = await page.evaluate(() => {
    const ls = Object.keys(localStorage).filter(k => /gk|gate|zyywz|密钥/i.test(k));
    const ss = Object.keys(sessionStorage).filter(k => /gk|gate|zyywz|密钥/i.test(k));
    const ck = document.cookie;
    return { ls, ss, ck: ck || '' };
  });
  T('密钥/解锁态零持久化（无 localStorage/sessionStorage/cookie 残留）', g4.ls.length === 0 && g4.ss.length === 0 && g4.ck === '', JSON.stringify(g4));

  /* C. 课件功能抽查（不误伤）：导航 + 昨晚修复的拓片墙三件套 */
  await page.click('#btnBoard'); await sleep(400);
  await page.click('[data-tab="dian"]'); await sleep(300);
  const f1 = await page.evaluate(() => ({ exp: !!document.getElementById('wallExport'), imp: !!document.getElementById('wallImport'), clr: !!document.getElementById('wallClear'), pg: __DG.page }));
  T('课件功能不误伤：拓片墙点兵榜三件套照常', f1.exp && f1.imp && f1.clr && f1.pg === 9, JSON.stringify(f1));
  const f2 = await page.evaluate(() => ({ chars: __DG.CHARS.length }));
  T('课件内核正常（35 字库）', f2.chars === 35, JSON.stringify(f2));

  /* D. 刷新后必须重输（内存态核心验收） */
  await page.reload(); await sleep(600);
  const g5 = await page.evaluate(() => ({ on: !document.getElementById('gkGate').classList.contains('off'), empty: document.getElementById('gkIn').value === '' }));
  T('刷新后门禁重新挡住（须重输密钥）', g5.on && g5.empty, JSON.stringify(g5));
  await page.fill('#gkIn', 'zyywz'); await page.click('#gkGo'); await sleep(300);
  const g6 = await page.evaluate(() => document.getElementById('gkGate').classList.contains('off'));
  T('刷新后正确密钥可再次进入', g6, '');
  T('全程零 pageerror', errs.length === 0, errs.join('|'));
  await browser.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
