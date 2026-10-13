/* =====================================================================
   铸铭问鼎论英雄 · p5 彩蛋层（V3.6 / 2026-10-07 修正版）：口令门 / 世外桃源 / 封面彩蛋卡
   ---------------------------------------------------------------------
   · 入口：封面播送带「何何老师@PFLS」点击（何何老师 2026-10-07 定稿）
   · 口令窗：零文字提示 —— 只有金框输入框（**type=password 字符隐去**）与箭头键；
     错口令仅抖动+红框+清空，绝不显示任何文案（何何老师定稿"没有任何文字提示"）
   · 两条进门路径（何何老师 2026-10-07 修正定稿）：
     ① 管理员金手指密钥 EGG_PWD='PFLS666'（源码常量可改）——教师通道，无条件进；
     ② 通用前置条件（学生通道）：**梦魇难度的双人 PK 中，有玩家得分 ≥ 860**
        （梦魇 PK 单人理论上限 980 = 12抢答×15 + 8描红×100，860 占 87.8% —— 强者可达的钩子）。
        输入框留空直接按 ➜：达标即进、未达标抖动拒绝（窗口零提示，规则由老师课堂告知）
   · 勾选是**纯内存态**（EGG_SEL，不入 DB/localStorage）：页面关闭/刷新即失效，
     下次打开须重新满足金手指或前置条件（何何老师定稿：口令解锁不可持久）；
     彩蛋**成绩**（eggRec）仍照旧持久化——榜单不丢
   · 世外桃源：EGG_MODES 注册表驱动 —— 未来新关卡/新模式只需往数组加一项，
     勾选页/封面卡/榜单全部自动出现（一套注册表三处消费）
   ===================================================================== */
const EGG_PWD = 'PFLS666';
const EGG_GATE_SCORE = 860;   /* 通用前置条件：梦魇双人 PK 单人得分下限（含） */
/* 前置条件达标旗标 = **纯会话内存态**（2026-10-11 何何老师复核定稿，与解锁同一生命周期）：
   原设计读持久化 DB.duo 历史——首个 860 之后每次重开都"已达标"，门等于永久打开，
   违背"解锁只走内存、关页即清、重开须重新赚或金手指"的本意（实测：923.7 后重开/换学号都直进）。
   现改为：只有**本会话内实际完成的**梦魇双人 PK（endDuo 落榜时调 eggQualifyPk）才点亮旗标 */
let EGG_QUALIFIED = false;
function eggQualifyPk(diff, lScore, rScore) {
  if (diff === 'nightmare' && (lScore >= EGG_GATE_SCORE || rScore >= EGG_GATE_SCORE)) EGG_QUALIFIED = true;
  return EGG_QUALIFIED;
}
function eggGateQualified() { return EGG_QUALIFIED; }
/* 新屏接在 s12 之后（P_TAO=13…），旧屏页码全部不动 —— 外科纪律 */
const P_TAO = 13, P_DIAN = 14, P_DIANPK = 15, P_DIAN_RES = 16;
const EGG_MODES = [
  { id: 'dian', icon: '⛺', name: '点兵点将', skills: '识 · 辨',
    desc: '3/6/9/12 四关三档难度限时记铭：军阵逐字亮出、同屏列阵、计时一到全体隐去，按原次序点将还原。近似字混编入阵 —— 认字与记序缺一不可' }
];
/* 勾选=纯内存态：页面生命周期内有效，关闭/刷新即清（勿迁回 DB——那是 2026-10-07 明确否决的旧方案） */
let EGG_SEL = [];
function eggSelHas(id) { return EGG_SEL.indexOf(id) >= 0; }

/* ---------- 封面彩蛋卡行：只渲染已勾选的关卡（未勾选=彩蛋完全隐身） ---------- */
function eggCardsHTML() {
  const sel = EGG_MODES.filter(m => eggSelHas(m.id));
  if (!sel.length) return '';
  return `<div class="eggRow">${sel.map(m =>
    `<button class="eggCard" data-egg="${m.id}" title="${esc(m.name)}"><span class="eggIco">${m.icon}</span><span class="eggName">${esc(m.name)}</span><span class="eggSkill">彩蛋 · ${esc(m.skills)}</span></button>`).join('')}</div>`;
}
function wireEggCards(scope) {
  scope.querySelectorAll('[data-egg]').forEach(b => {
    b.onclick = () => { sndSeal(); go(b.dataset.egg === 'dian' ? P_DIAN : P_COVER); };
  });
}

/* ---------- 口令门 ---------- */
function openEggGate() {
  const g = $('eggGate');
  if (!g) return;
  wireEggGate();
  g.classList.add('on');
  const inp = $('eggIn');
  inp.value = '';
  inp.classList.remove('bad');
  setTimeout(() => { try { inp.focus(); } catch (e) { } }, 60);
}
function closeEggGate() { const g = $('eggGate'); if (g) g.classList.remove('on'); }
function eggGateTry() {
  const inp = $('eggIn');
  const v = (inp.value || '').trim();
  if (v === EGG_PWD || (!v && eggGateQualified())) {
    /* 管理员金手指 = 无条件进；留空按 ➜ = 学生通道（须已达成"梦魇 PK ≥860"前置条件） */
    closeEggGate();
    sndSeal();
    go(P_TAO);                       /* → 世外桃源 */
  } else {
    inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad');
    inp.value = '';                  /* 清空重输，不给任何提示文字 */
    sndWrong();
  }
}
/* 播送带点击入口（何何老师 2026-10-11 修复定稿）：已达成前置条件（梦魇双人 PK ≥860）→
   **免口令窗直接进世外桃源**——原设计达标后仍弹口令窗、靠"留空按 ➜"这种零提示仪式进门，
   玩家根本无从发现，表现为"达标了却解锁不了"；未达标才弹口令窗走管理员金手指 */
function eggEntry() {
  if (eggGateQualified()) {
    sndSeal();
    go(P_TAO);
    return;
  }
  openEggGate();
}
function wireEggGate() {
  const g = $('eggGate');
  if (!g || g.dataset.wired) return;
  g.dataset.wired = '1';
  $('eggGo').onclick = eggGateTry;
  $('eggIn').addEventListener('keydown', e => { if (e.key === 'Enter') eggGateTry(); });
  $('eggIn').addEventListener('input', () => $('eggIn').classList.remove('bad'));
  g.addEventListener('click', e => { if (e.target === g) closeEggGate(); });   /* 点空白处关闭 */
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && g.classList.contains('on')) closeEggGate(); });
}

/* ---------- 世外桃源（勾选页：可单选/多选/全选，确定后自动回封面） ---------- */
function renderTaoyuan() {
  const s = $('s13');
  s.innerHTML = `
  <div class="wrap taoWrap">
    <div class="h1">🌸 世 外 桃 源</div>
    <div class="sub">何何老师的私房关卡尽在此间 —— 勾选想玩的挑战（可单选、可多选、可全选），点「确定」即带回封面</div>
    <div class="panel taoPanel">
      ${EGG_MODES.map(m => `
        <label class="taoItem">
          <input type="checkbox" data-mode="${m.id}" ${eggSelHas(m.id) ? 'checked' : ''}>
          <span class="taoIco">${m.icon}</span>
          <span class="taoBody"><span class="taoName">${esc(m.name)}<i class="taoSkill">${esc(m.skills)}</i></span>
            <span class="taoDesc">${esc(m.desc)}</span></span>
        </label>`).join('')}
      <div class="taoBtns">
        <span class="chip" id="taoAll">全 选</span>
        <button class="btn gold" id="taoOk">确 定</button>
      </div>
    </div>
    <div class="footNote">这里的一切不会出现在常规闯关里 —— 只有凭管理员金手指、或在梦魇对决中打出高分的将军，才能进来的秘密花园。</div>
  </div>`;
  const boxes = [...s.querySelectorAll('input[data-mode]')];
  const syncAll = () => {
    const all = boxes.every(b => b.checked), none = boxes.every(b => !b.checked);
    $('taoAll').textContent = all ? '全不选' : '全 选';
    $('taoOk').textContent = none ? '确定（不带关卡回封面）' : '确 定';
    s.querySelectorAll('.taoItem').forEach(lb => lb.classList.toggle('picked', lb.querySelector('input').checked));
  };
  boxes.forEach(b => b.addEventListener('change', () => { syncAll(); sndTick(); }));
  $('taoAll').onclick = () => {
    const target = !boxes.every(b => b.checked);   /* 有未选 → 全选；全选着 → 全不选 */
    boxes.forEach(b => { b.checked = target; });
    syncAll(); sndSeal();
  };
  $('taoOk').onclick = () => {
    EGG_SEL = boxes.filter(b => b.checked).map(b => b.dataset.mode);   /* 纯内存态：不落 localStorage（2026-10-07 何何老师定稿） */
    go(P_COVER);   /* 确定后自动退出该页（何何老师定稿） */
    toast(EGG_SEL.length ? '已带上 ' + EGG_SEL.length + ' 个彩蛋关卡，回封面开玩！' : '未携带彩蛋关卡 —— 想玩时再进桃源勾选');
  };
  syncAll();
}
