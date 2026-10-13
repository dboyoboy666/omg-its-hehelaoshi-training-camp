#!/usr/bin/env node
/* shot.js — 全流程截图（抬杠审查用，V3 版：含揭榜动画/描红分屏/双人结算） */
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', 'tools', 'node_modules', 'playwright-core'));
const OUT = path.join(__dirname, '..', '铸铭问鼎论英雄-大篆训练营-V3.2.html');
const DIR = '/tmp/dg/shots';
fs.mkdirSync(DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('file://' + OUT);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await sleep(500);
  const shot = n => page.screenshot({ path: `${DIR}/${n}.png` });

  await page.evaluate(() => { __DG.CUR.diff = 'rookie'; __DG.go(0); document.querySelector('#s0 .setupCard').scrollIntoView(); });
  await sleep(1400); await shot('01-cover');          /* 等巡游文字转半圈 */

  await page.click('#btnBook'); await sleep(400); await shot('02-book');
  await page.click('#s1 .cell:nth-child(15)'); await sleep(400); await shot('03-detail');
  await page.click('#mClose');

  await page.click('#btnHome');
  await page.click('#btnStartSolo'); await sleep(400);
  await shot('04-detect');
  const ch1 = await page.evaluate(() => __DG.S.dq[0].ch);
  await page.click(`#s2 .opt[data-o="${ch1}"]`); await sleep(400); await shot('05-detect-feedback');
  await sleep(900);
  await page.evaluate(() => { __DG.S.di = __DG.S.dq.length; __DG.go(3); }); await sleep(400);
  await shot('06-discern');
  await page.evaluate(() => { __DG.S.ci = __DG.S.cq.length; __DG.go(4); }); await sleep(500);
  await shot('07-trace');
  await page.evaluate(() => {
    const cv = [...document.querySelectorAll('#trCvHost canvas')].pop();
    const r = cv.getBoundingClientRect();
    const px = p => [r.left + p[0] / 400 * r.width, r.top + p[1] / 400 * r.height];
    const segs = __DG.autoSegs(__DG.S.tList[0]);
    let id = 7;
    segs.forEach((sg, ci) => {
      if (ci === 2) return; /* 留一笔不描，看未完成提示 */
      const [x0, y0] = px(sg[0]);
      cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, clientX: x0, clientY: y0, bubbles: true }));
      sg.slice(1).forEach(q => { const [x, y] = px(q); cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, clientX: x, clientY: y, bubbles: true })); });
      cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: x0, clientY: y0, bubbles: true }));
      id++;
    });
  });
  await sleep(300); await shot('08-trace-drawn');
  await page.click('#btnTrSubmit'); await sleep(400); await shot('09-trace-verdict');
  await page.click('#btnTrNext');
  for (let i = 0; i < 9; i++) {
    await page.evaluate(() => {
      const cv = [...document.querySelectorAll('#trCvHost canvas')].pop();
      const r = cv.getBoundingClientRect();
      const px = p => [r.left + p[0] / 400 * r.width, r.top + p[1] / 400 * r.height];
      const segs = __DG.autoSegs(__DG.S.tList[__DG.S.ti]);
      let id = 7;
      segs.forEach(sg => {
        const [x0, y0] = px(sg[0]);
        cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, clientX: x0, clientY: y0, bubbles: true }));
        sg.slice(1).forEach(q => { const [x, y] = px(q); cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, clientX: x, clientY: y, bubbles: true })); });
        cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: x0, clientY: y0, bubbles: true }));
        id++;
      });
    });
    await sleep(120);
    await page.click('#btnTrSubmit'); await sleep(200);
    await page.click('#btnTrNext'); await sleep(250);
  }
  await page.waitForFunction(() => document.getElementById('btnCastGo') && document.getElementById('btnCastGo').style.display !== 'none', null, { timeout: 25000 });
  await shot('10-cast-done');
  /* 铸鼎 → 揭榜动画（抓爬榜中间帧：cur 铭牌）→ 跳过 → 结算 */
  await page.click('#btnCastGo');
  await page.waitForFunction(() => __DG.page === 10, null, { timeout: 8000 });
  await sleep(1200); await shot('11-anim-solo');
  await page.waitForFunction(() => __DG.page === 6, null, { timeout: 20000 });
  await shot('12-result');

  /* 双人混合赛：准备页名单 → 开战 → 抢答轮不对称作答 → 描红分屏轮 */
  await page.click('#btnHome');
  await page.click('#btnStartDuo'); await sleep(300);
  await page.fill('#rosterArea', '大孟\n小颂\n史墙\n散氏\n毛公\n克鼎');
  await page.click('#btnShuffleRoster');
  await page.click('#btnDraw');
  await shot('13-duo-prep');
  await page.click('#btnPkGo'); await sleep(400);
  const q0 = await page.evaluate(() => __DG.PK.plan[__DG.PK.ri].q.ch);
  await page.click(`#pkOptL .opt[data-o="${q0}"]`).catch(() => {});
  await sleep(300); await shot('14-pk-discern');
  await sleep(1300);
  /* 跳到首个描红轮 */
  await page.evaluate(() => { __DG.PK.ri = __DG.PK.plan.findIndex(r => r.kind === 'trace'); __DG.PK.over = false; __DG.go(8); });
  await sleep(600);
  const tch = await page.evaluate(() => __DG.PK.plan[__DG.PK.ri].ch);
  await page.evaluate(ch => {
    const segs = __DG.autoSegs(ch);
    const draw = side => {
      const host = document.getElementById('pkCv' + side);
      const cv = [...host.querySelectorAll('canvas')].pop();
      const r = cv.getBoundingClientRect();
      const px = p => [r.left + p[0] / 400 * r.width, r.top + p[1] / 400 * r.height];
      let id = 7;
      segs.forEach(sg => {
        const [x0, y0] = px(sg[0]);
        cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, clientX: x0, clientY: y0, bubbles: true }));
        sg.slice(1).forEach(q => { const [x, y] = px(q); cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, clientX: x, clientY: y, bubbles: true })); });
        cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: x0, clientY: y0, bubbles: true }));
        id++;
      });
    };
    draw('L'); draw('R');
  }, tch);
  await sleep(500); await shot('15-pk-trace-dual');
  await page.click('#pkDoneL'); await page.click('#pkDoneR'); await sleep(600); await shot('16-pk-trace-settled');
  /* 快进到双人揭榜与结算 */
  await page.evaluate(() => { __DG.PK.ri = __DG.PK.plan.length; __DG.go(8); });
  await page.waitForFunction(() => __DG.page === 11, null, { timeout: 8000 });
  await sleep(700); await shot('17-anim-duo');
  await page.waitForFunction(() => __DG.page === 12, null, { timeout: 25000 });
  await shot('18-duo-result');

  await page.click('#btnDuoBoard'); await sleep(400); await shot('19-board-duo');
  await page.click('#s9 [data-tab="rub"]'); await sleep(300); await shot('20-board-rub');

  await browser.close();
  console.log('shots saved:', fs.readdirSync(DIR).join(', '));
})().catch(e => { console.error(e); process.exit(1); });
