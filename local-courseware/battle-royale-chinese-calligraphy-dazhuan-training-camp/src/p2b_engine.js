/* 本课件当前主书体：金文（大篆主体）。提取块的默认脚本统一指向它。 */
const SCRIPT = 'bronze';

/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 35~46 行 [L1 常量与限时参数] ▼▼▼ */
/* =====================================================================
   L1 常量与配置
   ===================================================================== */
const L = 400;                           /* 逻辑坐标 400×400（字形路径自带 ~10px 内边距，全链路统一用此坐标系） */
const LOGIC2PX = (L) / L;                /* 逻辑→逻辑，画布尺寸由 CSS 决定 */
const MIN_CHAIN = 18;                    /* 骨架链长度 < 18 视为细化毛刺，不计入"笔画" */
const DONE_COV = 0.80;                   /* 笔画完成度 < 80% → 判为「这一笔没写完」 */
/* 「这一笔到底描没描到」用一个【与难度无关的宽松容差】来衡量，
   与「描得准不准」解耦 —— 手抖不该被判成"没写完"，只有真的没落笔才算。
   否则梦魇难度（容差最窄）会把正常的 ±9px 手抖误判为"缺笔 → 整字 0 分"。 */
const DONE_TOL = 12, DONE_CEN = 20, DONE_WID = 4.0, DONE_ZERO = 40;
const LUT_DONE = new Float32Array(L + 1);
/* ▲▲▲ 提取块结束 [L1 常量与限时参数] ▲▲▲ */

/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 75~146 行 [DIFF 三档 + 限时模型 + 计分权重] ▼▼▼ */
const DIFF = {
  rookie: { key: 'rookie', name: '菜鸟', icon: '🪶', T_IN: 12, band: '容差 12px', TL: 6,
    CEN: 24, WID: 10, ZERO: 54, R_IN: 14, RCEN: 22, RWID: 9, RZERO: 52,
    WORST: 0.35, ELO: 1.15, EHI: 2.4, EMIN: 0.20, OTOL: 30, OK: 2.0, OMAX: 0.60,
    count: 10, pick: { 1: 9, 2: 1, 3: 0 }, wholeZero: false,
    desc: '容差带最宽；带内仍有微差，认真与更认真分得开' },
  hard: { key: 'hard', name: '困难', icon: '⚔️', T_IN: 7, band: '容差 7px', TL: 8,
    CEN: 17, WID: 8, ZERO: 40, R_IN: 8, RCEN: 15, RWID: 7.5, RZERO: 38,
    WORST: 0.40, ELO: 1.10, EHI: 2.2, EMIN: 0.14, OTOL: 22, OK: 2.3, OMAX: 0.68,
    count: 10, pick: { 1: 5, 2: 4, 3: 1 }, wholeZero: false,
    desc: '容差带收窄，带内区分度更大' },
  nightmare: { key: 'nightmare', name: '梦魇', icon: '💀', T_IN: 3, band: '容差 3px', TL: 10,
    CEN: 10, WID: 5.5, ZERO: 26, R_IN: 4, RCEN: 9, RWID: 5, RZERO: 25,
    WORST: 0.45, ELO: 1.05, EHI: 2.0, EMIN: 0.10, OTOL: 16, OK: 2.6, OMAX: 0.75,
    count: 20, pick: { 1: 2, 2: 12, 3: 6 }, wholeZero: true,
    desc: '容差带最窄，带内分毫必较；缺一笔即整字归零' }
};
const DIFF_ORDER = ['rookie', 'hard', 'nightmare'];
/* V3 双人混合赛制（继承 v6.6.618 PK_ROUNDS）：辨铭抢答 d 轮 + 写铭分屏描红 t 轮
   菜鸟 10 轮（6+4）/ 困难 15 轮（9+6）/ 梦魇 20 轮（12+8）—— 轮数随难度加码 */
const PK_ROUNDS = { rookie: { d: 6, t: 4 }, hard: { d: 9, t: 6 }, nightmare: { d: 12, t: 8 } };
/* 辨铭抢答计分（继承 v6.6.618）：先答对 +15、后答对 +10、答错 0；写铭轮按描红得分直接累加 */
const PK_GAIN = { first: 15, second: 10 };
/* 难度阶梯即关卡阶梯：菜鸟 → 困难 → 梦魇；梦魇是最后一关（返回 null，结算页省去「下一关」按钮） */
function nextDiffOf(k) {
  const i = DIFF_ORDER.indexOf(k);
  return (i >= 0 && i < DIFF_ORDER.length - 1) ? DIFF_ORDER[i + 1] : null;
}

/* =====================================================================
   限时挑战：**按字形复杂度逐字给时间**（v2：整体放宽，2026-09-12 何何老师定档）
   ---------------------------------------------------------------------
   由来：统一 6 秒对「一」（1 段 248px）太宽松、对「鱼」（14 段 1896px）
        几乎不可能 —— 实测最简与最复杂的字工作量差近 8 倍。
   模型：C = L + K×(N-1)        等效书写复杂度（单位=像素）
              L = 骨架路径长度，N = 笔画段数（都在 CHARINFO 里实测存好）
         T = T0 + C / V          基础时间（再夹到 [LO, HI]）
   v2 双锚点标定（不再用「全体均值=锚点」）：
         BASE = 最简字「一」(C=248) 正好 10 秒        ← 原统一 6 秒 → 10 秒
         LV3  = 三阶字（好林明家鸟鱼，C₃=2375）均值 16 秒  ← 老师指定
         V = (C₃ - C_min) / (LV3 - BASE) = (2375-248)/6 ≈ 355 px/s
         T0 = BASE - C_min / V ≈ 9.3 秒（保底截距：看字 + 定位起笔 + 复杂度溢价）
   实测结果：一阶 11.6s / 二阶 13.3s / 三阶 16.0s / 全体 12.9s，区间 10~17.5 秒共 14 档
   → 追加新字：重新量该字的 L、N 填进 CHARINFO 即可，公式自动给出合理限时。
   → 想整体调松/调紧：只改 BASE / LV3 两个数，重算 V 与 T0（gen_data.py 有断言把关）。
   ===================================================================== */
const T_LIMIT_T0 = 9.3;      /* 秒：保底截距（压缩前锚点，相对曲线不变） */
const T_LIMIT_K = 80;        /* 像素：一次「提笔—移动—落笔」折算多少书写长度 */
const T_LIMIT_BASE = 10.0;   /* 秒：压缩前保底锚点（历史值，仅作缺数据回退基数） */
const T_LIMIT_LV3 = 16.0;    /* 秒：压缩前三阶字目标（历史值，保留锚点记录） */
const T_LIMIT_LO = 6.0;      /* 秒：下限（压缩后兜底） */
const T_LIMIT_HI = 12.0;     /* 秒：上限 = 「鱼」12 秒（2026-10-07 何何老师定稿：笔画越少给时越少） */
const T_LIMIT_V = 355;       /* px/s：压缩前斜率（相对曲线不变） */
/* v2 等比压缩（2026-10-07 何何老师定稿）：原模型实测区间 10~16.5s（十=10 最短、鱼=16.5 最长），
   对简单字"十几秒与难度不匹配"。整个曲线按 k = 12/16.5 等比压缩（保留 2026-09-12 双锚点
   标定的相对结构，只加一个比例常数）：鱼=12s 封顶，十/一/二=7.5~8s，按复杂度单调非降。
   实测新区间 7.5~12s。调锚点仍按注释头部公式：改 BASE/LV3 → 重算 T0/V → 改 SCALE=12/新max。 */
const T_LIMIT_SCALE = 12 / 16.5;   /* ≈0.727：旧实测 max=16.5（鱼）→ 12 */
function timeOf(ch) {
  const info = DZINFO[ch];
  if (!info || !info.L) return T_LIMIT_BASE * T_LIMIT_SCALE;   /* 缺数据时退回压缩后保底值 */
  const raw = T_LIMIT_T0 + (info.L + T_LIMIT_K * (info.N - 1)) / T_LIMIT_V;
  return Math.min(T_LIMIT_HI, Math.max(T_LIMIT_LO, Math.round(raw * T_LIMIT_SCALE * 2) / 2));
}
/* 一组字的限时区间，用于设置页展示 */
function timeRangeOf(set) {
  if (!set || !set.length) return '';
  const ts = set.map(timeOf);
  const lo = Math.min.apply(null, ts), hi = Math.max.apply(null, ts);
  return lo === hi ? lo + ' 秒' : lo + '~' + hi + ' 秒';
}

/* 计分权重 */
const MARK_DETECT = 2;   /* 识篆 答对得印章 */
const MARK_DISCERN = 3;  /* 辨篆 答对得印章 */

/* v1.9：分数统一保留 1 位小数（何何老师要求「实力相近也要分得开」）
   ---------------------------------------------------------------------
   旧实现 score 走 Math.round 取整 —— 96.6 与 98.8 都会被抹成 97/99，
   甚至在顶部被抹成同一个 100。取整本身不是主因（主因是 LUT 硬平台），
   但它是「小数点差异」的最后一道闸门，必须一并放开。
   r1 同时用于所有累加点，保证 96.6 + 98.8 = 195.4 而不是 195.39999999999998。 */
/* ▲▲▲ 提取块结束 [DIFF 三档 + 限时模型 + 计分权重] ▲▲▲ */

/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 147~201 行 [r1/LUT/buildLUT/setDiff] ▼▼▼ */
function r1(x) { return Math.round(x * 10) / 10; }

/* =====================================================================
   L2 描红判定引擎（v3.2 模型 + 「未完成笔画」规则）
   ---------------------------------------------------------------------
   基准 = 字形【中心线】骨架（不是填充区），与笔画粗细解耦
   笔迹也先取中心线，比较「两条中心线」的距离
   距离→分数用 S 形软映射（预计算查找表），单调无断崖
   得分 = 100 × F1(贴合度, 覆盖度) × 笔墨经济 × 出界折扣
   ===================================================================== */
let P = Object.assign({}, DIFF.rookie);
let DIFF_KEY = 'rookie';
const LUT_P = new Float32Array(L + 1), LUT_R = new Float32Array(L + 1);

function buildLUT() {
  const sig = (x, c, w) => 1 / (1 + Math.exp((x - c) / w));
  /* v1.9：容差带【不再削成硬平台】
     ------------------------------------------------------------------
     旧实现 `d <= T_IN ? 1 : …` 把 0~12px 整段钉成 1.0 —— 偏 0px 与偏 12px
     同为满分，实测满分平台宽达 11px。后果：两人描红水平明显有差，
     却都拿 100 分，PK 拉不开差距（何何老师实测反馈）。
     新实现把容差带内的动态范围（原本被 `? 1` 丢弃的 FREE~T_IN 段）线性投放到
     [1-TL/100, 1]：完美描摹仍是 100，描到容差带边缘损失 TL 分。
     带外段整体乘 (1-TL/100) 保证 d=T_IN 处两段【连续无台阶】，
     整条曲线依旧单调递减、无断崖。TL 是本次唯一新增的调参入口。 */
  const lp = Math.max(0, Math.min(0.5, (P.TL || 0) / 100));
  /* FREE：栅格化误差量级的满分微带。笔迹与字形骨架都经过像素栅格化，
     即便「完全沿中心线描」，逐点距离也落在 ~1px 上（实测均值 0.97px）。
     没有这条微带，完美描摹只能拿 99.9 分，「本字满分 100」就成了一句
     缓和的假话。宽度按容差带比例给（并保底 1.2px），梦魇档最窄 = 最较真。 */
  const FREE = Math.max(1.2, 0.12 * P.T_IN);
  const ap = sig(P.T_IN, P.CEN, P.WID), bp = sig(P.ZERO, P.CEN, P.WID);
  const gp = sig(P.R_IN, P.RCEN, P.RWID), gb = sig(P.RZERO, P.RCEN, P.RWID);
  const aF = sig(FREE, P.CEN, P.WID), gF = sig(FREE, P.RCEN, P.RWID);
  const kp = aF > ap ? aF - ap : 0, kg = gF > gp ? gF - gp : 0;
  for (let d = 0; d <= L; d++) {
    const sp = sig(d, P.CEN, P.WID), sg = sig(d, P.RCEN, P.RWID);
    LUT_P[d] = d <= FREE ? 1
      : d <= P.T_IN ? 1 - lp * (kp ? (aF - sp) / kp : 0)
        : Math.max(0, (1 - lp) * (sp - bp) / (ap - bp));
    LUT_R[d] = d <= FREE ? 1
      : d <= P.R_IN ? 1 - lp * (kg ? (gF - sg) / kg : 0)
        : Math.max(0, (1 - lp) * (sg - gb) / (gp - gb));
  }
  /* 完成度查找表固定不变，与难度无关 */
  const ad = sig(DONE_TOL, DONE_CEN, DONE_WID), bd = sig(DONE_ZERO, DONE_CEN, DONE_WID);
  for (let d = 0; d <= L; d++) {
    LUT_DONE[d] = d <= DONE_TOL ? 1 : Math.min(1, Math.max(0, (sig(d, DONE_CEN, DONE_WID) - bd) / (ad - bd)));
  }
}
function setDiff(key) {
  if (!DIFF[key]) return;
  DIFF_KEY = key; P = Object.assign({}, DIFF[key]); buildLUT();
}
setDiff('rookie');
/* ▲▲▲ 提取块结束 [r1/LUT/buildLUT/setDiff] ▲▲▲ */

/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 203~435 行 [描红判定引擎 v3.2] ▼▼▼ */
function glyphPath2D(ch, script) {
  const src = script ? (GLYPHS4[script] || {}) : GLYPHS4[SCRIPT];
  const p = new Path2D();
  ((src[ch]) || []).forEach(d => p.addPath(new Path2D(d)));
  return p;
}
function rasterizeGlyph(ch) {
  const c = document.createElement('canvas'); c.width = L; c.height = L;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fill(glyphPath2D(ch, SCRIPT));
  const d = x.getImageData(0, 0, L, L).data;
  const m = new Uint8Array(L * L);
  for (let i = 0; i < L * L; i++) if (d[i * 4 + 3] > 128) m[i] = 1;
  return m;
}
function rasterizeSegs(segs, lw) {
  const c = document.createElement('canvas'); c.width = L; c.height = L;
  const x = c.getContext('2d');
  x.strokeStyle = '#000'; x.fillStyle = '#000';
  x.lineWidth = lw || 7; x.lineCap = 'round'; x.lineJoin = 'round';
  segs.forEach(sg => {
    if (!sg || !sg.length) return;
    if (sg.length === 1) { x.beginPath(); x.arc(sg[0][0], sg[0][1], (lw || 7) / 2, 0, 7); x.fill(); }
    else { x.beginPath(); x.moveTo(sg[0][0], sg[0][1]); for (let i = 1; i < sg.length; i++) x.lineTo(sg[i][0], sg[i][1]); x.stroke(); }
  });
  const d = x.getImageData(0, 0, L, L).data;
  const m = new Uint8Array(L * L);
  for (let i = 0; i < L * L; i++) if (d[i * 4 + 3] > 64) m[i] = 1;
  return m;
}
/* 双向 Chamfer 距离变换（两趟扫描，误差 ≤2%） */
function distTransform(mask) {
  const INF = 1e9, d = new Float32Array(L * L);
  for (let i = 0; i < L * L; i++) d[i] = mask[i] ? 0 : INF;
  const A = 3, B = 4;
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const i = y * L + x; let v = d[i];
    if (y > 0) { v = Math.min(v, d[i - L] + A); if (x > 0) v = Math.min(v, d[i - L - 1] + B); if (x < L - 1) v = Math.min(v, d[i - L + 1] + B); }
    if (x > 0) v = Math.min(v, d[i - 1] + A); d[i] = v;
  }
  for (let y = L - 1; y >= 0; y--) for (let x = L - 1; x >= 0; x--) {
    const i = y * L + x; let v = d[i];
    if (y < L - 1) { v = Math.min(v, d[i + L] + A); if (x < L - 1) v = Math.min(v, d[i + L + 1] + B); if (x > 0) v = Math.min(v, d[i + L - 1] + B); }
    if (x < L - 1) v = Math.min(v, d[i + 1] + A); d[i] = v;
  }
  for (let i = 0; i < L * L; i++) d[i] /= 3;
  return d;
}
/* Zhang-Suen 细化：任意粗细笔画 → 1px 中心线 */
function skeletonize(mask) {
  const m = Uint8Array.from(mask);
  let changed = true, guard = 0; const rm = [];
  while (changed && guard++ < 60) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      rm.length = 0;
      for (let y = 1; y < L - 1; y++) for (let x = 1; x < L - 1; x++) {
        const i = y * L + x; if (!m[i]) continue;
        const p2 = m[i - L], p3 = m[i - L + 1], p4 = m[i + 1], p5 = m[i + L + 1],
              p6 = m[i + L], p7 = m[i + L - 1], p8 = m[i - 1], p9 = m[i - L - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const A = (p2 === 0 && p3 === 1) + (p3 === 0 && p4 === 1) + (p4 === 0 && p5 === 1) + (p5 === 0 && p6 === 1) +
                  (p6 === 0 && p7 === 1) + (p7 === 0 && p8 === 1) + (p8 === 0 && p9 === 1) + (p9 === 0 && p2 === 1);
        if (A !== 1) continue;
        if (step === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
        else { if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue; }
        rm.push(i);
      }
      if (rm.length) { changed = true; for (const i of rm) m[i] = 0; }
    }
  }
  return m;
}
/* 基准轨迹：沿骨架做 8 邻域链追踪（保证链上相邻，绝不跨空白连线）
   —— 每一条链即本文所说的「一笔」（中心线意义上的笔画） */
const NB = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
function chainTrace(skel) {
  const nbrs = i => {
    const x = i % L, y = (i / L) | 0, r = [];
    for (let k = 0; k < 8; k++) {
      const nx = x + NB[k][0], ny = y + NB[k][1];
      if (nx >= 0 && nx < L && ny >= 0 && ny < L) { const j = ny * L + nx; if (skel[j]) r.push(j); }
    }
    return r;
  };
  const visited = new Uint8Array(L * L), ends = [];
  for (let i = 0; i < L * L; i++) if (skel[i] && nbrs(i).length === 1) ends.push(i);
  const seeds = ends.slice();
  for (let i = 0; i < L * L; i++) if (skel[i] && !visited[i] && nbrs(i).length !== 1) seeds.push(i);
  const raw = [];
  seeds.forEach(s => {
    if (visited[s]) return;
    const chain = [s]; visited[s] = 1; let cu = s;
    for (;;) {
      const cand = nbrs(cu).filter(j => !visited[j]);
      if (!cand.length) break;
      const nx = cand[0]; visited[nx] = 1; chain.push(nx); cu = nx;
    }
    if (chain.length >= 2) raw.push(chain);
  });
  for (let i = 0; i < L * L; i++) if (skel[i] && !visited[i]) { visited[i] = 1; raw.push([i]); }
  return raw;
}
const CACHE = {};
function glyphData(ch) {
  const ck = SCRIPT + '|' + ch;
  if (CACHE[ck]) return CACHE[ck];
  const mask = rasterizeGlyph(ch);
  const skel = skeletonize(mask);
  const skelIdx = []; for (let i = 0; i < L * L; i++) if (skel[i]) skelIdx.push(i);
  const allChains = chainTrace(skel);
  /* 只保留长度 ≥ MIN_CHAIN 的链作为「笔画」 */
  const chains = allChains.filter(c => c.length >= MIN_CHAIN);
  const frags = allChains.length - chains.length;
  const dist = distTransform(mask);
  const skelDist = distTransform(skel);
  CACHE[ck] = { mask, skel, skelIdx, chains, frags, dist, skelDist, skelN: skelIdx.length };
  return CACHE[ck];
}
/* 基准描摹轨迹（供标定/自检使用） */
function autoSegs(ch) {
  return glyphData(ch).chains.map(c => c.map(i => [i % L, (i / L) | 0]));
}

/* ---------- 判定主函数 ----------
   judgeScore(segs, ch, opts)
     segs  分段笔迹数组 [[ [x,y], … ], …]（每段一笔，段间绝不连线）
     ch    显式传入当前字（不得依赖全局，否则会出现「用 A 字判 B 字」的假失败）
     opts  { timed: 是否开启了「追加限时挑战」,
             wholeZero: 梦魇规则——只要有一笔没写完，整字 0 分 }
   注意：「未完成笔画」与「梦魇整字归零」两条规则只在【开启限时挑战】时生效
        —— 这是需求原文的语义：规则依附于「超时自动跳字」这一场景。
   ================================================================= */
function judgeScore(segs, ch, opts) {
  opts = opts || {};
  const TIMED = !!opts.timed, WHOLE_ZERO = !!opts.wholeZero;
  ch = ch || '一';
  if (segs && segs.length && typeof segs[0][0] === 'number') segs = [segs];
  const t0 = performance.now();
  const G = glyphData(ch);
  const um = rasterizeSegs(segs);
  let un = 0; for (let i = 0; i < L * L; i++) if (um[i]) un++;
  const blank = {
    prec: 0, recall: 0, f1: 0, score: 0, un: 0, skelN: G.skelN, meanDev: 0, econ: 1, ratio: 0,
    offPx: 0, offRate: 0, offPen: 1, uSkelN: 0, ms: 0, strokes: [], unfinished: 0, totalStrokes: G.chains.length,
    zeroed: false, frags: G.frags, timed: TIMED
  };
  if (!un) { blank.ms = performance.now() - t0; return blank; }

  const dU = distTransform(um);

  /* A. 覆盖度（带「未完成笔画」规则）
        逐【笔画】计算：该笔的中心线被笔迹覆盖的比例 cov（用难度对应的严格容差）
        另算 doneR（用与难度无关的宽松容差）判断「这一笔到底描没描到」
        限时挑战下：doneR < DONE_COV → 这一笔判为「没写完」→ 整笔按 0 分计（不是按比例给分）
        梦魇难度：只要存在「没写完」的笔画 → 整字 0 分 */
  let covAcc = 0, totPoints = 0;
  const strokes = [];
  for (const chain of G.chains) {
    let acc = 0, accDone = 0, sumCov = 0;
    for (const i of chain) {
      const d = dU[i] | 0;
      acc += LUT_R[Math.min(L, d)];
      accDone += LUT_DONE[Math.min(L, d)];
      sumCov += d;
    }
    const n = chain.length;
    const cov = n ? acc / n : 0;
    const doneR = n ? accDone / n : 0;
    const unfinished = TIMED && (doneR < DONE_COV);
    strokes.push({ len: n, cov, doneR, unfinished, meanDev: n ? sumCov / n : 0 });
    covAcc += unfinished ? 0 : acc;
    totPoints += n;
  }
  const recall = totPoints ? covAcc / totPoints : 0;
  const unfinished = strokes.filter(s => s.unfinished).length;

  /* B. 贴合度：均值 + 最差 15% 双轨（木桶效应，专抓「个别笔画飞出字外」） */
  const usk = skeletonize(um);
  const uIdx = []; for (let i = 0; i < L * L; i++) if (usk[i]) uIdx.push(i);
  const softs = []; let sumd = 0, offPx = 0;
  for (const i of uIdx) {
    const d = G.skelDist[i];
    sumd += d;
    if (d > P.OTOL) offPx++;
    softs.push(LUT_P[Math.min(L, d | 0)]);
  }
  softs.sort((a, b) => a - b);
  const worst15 = softs.length ? softs[Math.floor(softs.length * 0.15)] : 0;
  const meanSoft = softs.length ? softs.reduce((a, b) => a + b, 0) / softs.length : 0;
  const prec = (1 - P.WORST) * meanSoft + P.WORST * worst15;
  const meanDev = uIdx.length ? sumd / uIdx.length : 0;

  /* C. 笔墨经济：笔迹中心线长度 / 字形中心线长度（防涂满、乱画、错位重复） */
  const ratio = G.skelN ? uIdx.length / G.skelN : 0;
  let econ = 1;
  if (ratio > P.ELO) econ = Math.max(P.EMIN, 1 - (ratio - P.ELO) / (P.EHI - P.ELO) * (1 - P.EMIN));

  /* D. 出界折扣 */
  const offRate = uIdx.length ? offPx / uIdx.length : 0;
  const offPen = 1 - Math.min(P.OMAX, offRate * P.OK);

  const f1 = (prec + recall) ? 2 * prec * recall / (prec + recall) : 0;
  /* v1.9：保留 1 位小数（原 Math.round 会把实力相近者抹成同一个整数） */
  let score = Math.max(0, Math.min(100, r1(100 * f1 * econ * offPen)));
  let zeroed = false;
  if (WHOLE_ZERO && unfinished > 0) { score = 0; zeroed = true; }

  return {
    prec, recall, f1, score, un, skelN: G.skelN, meanDev, econ, ratio, offPx, offRate, offPen,
    uSkelN: uIdx.length, ms: performance.now() - t0, strokes, unfinished,
    totalStrokes: G.chains.length, zeroed, frags: G.frags, timed: TIMED
  };
}
/* 生成「容差带」可视化：绿 = 不扣分带（≤T_IN），黄 = 衰减带（T_IN~OTOL） */
let BAND = { key: '', cv: null };
function invalidateBand() { BAND.key = ''; BAND.cv = null; }
function bandCanvas(ch) {
  const key = [ch, P.T_IN, P.CEN, P.ZERO, P.OTOL].join('|');
  if (BAND.key === key && BAND.cv) return BAND.cv;
  const G = glyphData(ch);
  const c = document.createElement('canvas'); c.width = L; c.height = L;
  const x = c.getContext('2d'), img = x.createImageData(L, L), dd = img.data;
  for (let i = 0; i < L * L; i++) {
    const v = G.skelDist[i];
    if (v > P.OTOL) continue;
    const o = i * 4;
    if (v <= P.T_IN) { dd[o] = 29; dd[o + 1] = 158; dd[o + 2] = 117; dd[o + 3] = 88; }
    else { dd[o] = 239; dd[o + 1] = 159; dd[o + 2] = 39; dd[o + 3] = 50; }
  }
  x.putImageData(img, 0, 0);
  BAND = { key, cv: c };
  return c;
}
/* ▲▲▲ 提取块结束 [描红判定引擎 v3.2] ▲▲▲ */

/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 440~509 行 [L3 Web Audio 音效] ▼▼▼ */
let actx = null, soundOn = true;
function ensureAudio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type, vol, when) {
  const c = ensureAudio(); if (!c || !soundOn) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime + (when || 0);
  o.start(t); g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.stop(t + dur + 0.02);
}
function noise(dur, vol, when, filt) {
  const c = ensureAudio(); if (!c || !soundOn) return;
  const n = Math.floor(c.sampleRate * dur);
  const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const s = c.createBufferSource(); s.buffer = b;
  const g = c.createGain(); g.gain.value = vol;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt || 1800;
  s.connect(f); f.connect(g); g.connect(c.destination);
  s.start(c.currentTime + (when || 0));
}
/* 五声音阶：宫 商 角 徵 羽（C D E G A） */
const PENTA = [261.63, 293.66, 329.63, 392.00, 440.00];
const PENTA_H = [523.25, 587.33, 659.25, 783.99, 880.00];

function sndSeal() {           /* 盖印：木质短促 + 金石泛音 */
  noise(0.07, 0.16, 0, 2600); tone(196, 0.10, 'square', 0.10); tone(392, 0.16, 'triangle', 0.07);
}
function sndRight() {          /* 答对：编钟五声上行 */
  [0, 1, 2, 4, 5].forEach((k, i) => {
    const f = (k < 5 ? PENTA[k] : PENTA_H[0]);
    tone(f, 0.42, 'sine', 0.16, i * 0.075); tone(f * 2.01, 0.26, 'sine', 0.05, i * 0.075);
  });
}
function sndWrong() {          /* 答错：低沉鼓声 */
  tone(110, 0.22, 'sine', 0.20); tone(73.4, 0.34, 'sine', 0.15, 0.02); noise(0.12, 0.07, 0, 500);
}
function sndTick() { tone(1180, 0.035, 'square', 0.06); }
function sndPen() { noise(0.045, 0.035, 0, 900); }
function sndJudge() {          /* 单字结算：磬声 */
  tone(659.25, 0.55, 'sine', 0.14); tone(1318.5, 0.34, 'sine', 0.05, 0.01);
}
function sndWhack() {          /* 打飞：编钟撞击下滑 */
  tone(523.25, 0.06, 'square', 0.18); tone(392.0, 0.09, 'triangle', 0.15, 0.05);
  tone(293.66, 0.16, 'triangle', 0.12, 0.10);
}
function sndDizzy() {          /* 晕头：高音铃铛五连 */
  [0, 1, 2, 3, 4].forEach(i => tone(PENTA_H[i], 0.16, 'sine', 0.09, i * 0.08));
}
function sndWhoops() {         /* 搞笑失败：拖长下滑 */
  tone(330, 0.62, 'triangle', 0.13); tone(147, 0.66, 'triangle', 0.10, 0.07);
}
function sndWin() {            /* 胜利：编钟五声大琶音 + 铜锣 */
  [0, 2, 4, 5, 7].forEach((k, i) => {
    const f = k < 5 ? PENTA[k] : PENTA_H[k - 5];
    tone(f, 0.85, 'sine', 0.15, i * 0.11); tone(f * 2.0, 0.5, 'sine', 0.05, i * 0.11);
  });
  noise(0.7, 0.10, 0, 3200);
}
function toggleSound() {
  soundOn = !soundOn;
  const b = document.getElementById('soundBtn');
  if (b) b.textContent = soundOn ? '🔔 音效：开' : '🔕 音效：关';
  try { localStorage.setItem('dgms_sound', soundOn ? '1' : '0'); } catch (e) { }
  if (soundOn) { ensureAudio(); sndTick(); }
}
/* ▲▲▲ 提取块结束 [L3 Web Audio 音效] ▲▲▲ */

/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 514~594 行 [L4 粒子特效 + floatScore + toast] ▼▼▼ */
let fxc, fxCtx, fxOn = false, fxRAF = 0, petals = [], sparks = [];
function fxInit() {
  fxc = document.getElementById('fx');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  fxc.width = innerWidth * dpr; fxc.height = innerHeight * dpr;
  fxc.style.width = innerWidth + 'px'; fxc.style.height = innerHeight + 'px';
  fxCtx = fxc.getContext('2d'); fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function startFx() {
  if (fxOn) return; fxOn = true; fxInit();
  if (!petals.length) for (let i = 0; i < 40; i++) petals.push(mkPetal(true));
  sndWin(); loopFx();
}
function stopFx() {
  fxOn = false; if (fxRAF) cancelAnimationFrame(fxRAF); fxRAF = 0;
  if (fxCtx) fxCtx.clearRect(0, 0, innerWidth, innerHeight);
  petals = []; sparks = [];
}
function mkPetal(scatter) {
  return {
    x: Math.random() * innerWidth, y: scatter ? Math.random() * innerHeight : -20,
    r: 3 + Math.random() * 5, vy: 1.0 + Math.random() * 1.4, vx: (Math.random() - 0.5) * 0.4,
    a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.03, al: 0.35 + Math.random() * 0.45,
    col: Math.random() < 0.6 ? '#d9b44a' : (Math.random() < 0.5 ? '#c0392b' : '#2e6b5e')
  };
}
/* 花瓣速度（2026-10-08 何何老师修复定稿）：原 0.28~0.83 px/帧 ≈ 17~50 px/s，视觉近乎静止
   像"卡住的静态纸屑"——提速到 1.0~2.4 px/帧 ≈ 60~144 px/s（60fps），可见的轻柔飘落 */
/* 朱砂扩散环：盖印 / 答对时的定点反馈 */
function sealBurst(x, y, col) {
  if (!fxCtx) fxInit();
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * 6.28, sp = 1.1 + Math.random() * 3.4;
    sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 1, r: 2 + Math.random() * 3,
      col: col || (Math.random() < 0.65 ? '#c0392b' : '#d9b44a') });
  }
  if (!fxOn) { fxOn = true; loopFx(); }
}
function loopFx() {
  /* 修复（2026-10-08 何何老师实测"花瓣不飘落"）：原 `if (!fxRAF)` 守卫使循环只调度一帧——
     首帧后 fxRAF 恒为真、不再续帧，花瓣/火花全部冻结成静态点（maxD=0 实证）。
     改为无条件自续帧，停止分支 cancel 掉当帧调度即干净收尾 */
  fxRAF = requestAnimationFrame(loopFx);
  if (!fxCtx) return;
  fxCtx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = petals.length - 1; i >= 0; i--) {
    const p = petals[i];
    p.y += p.vy; p.x += p.vx + Math.sin(p.a) * 0.35; p.a += p.va;
    if (p.y > innerHeight + 24) { if (fxOn) { petals[i] = mkPetal(false); continue; } else { petals.splice(i, 1); continue; } }
    fxCtx.save(); fxCtx.globalAlpha = p.al; fxCtx.fillStyle = p.col;
    fxCtx.translate(p.x, p.y); fxCtx.rotate(p.a);
    fxCtx.beginPath(); fxCtx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, 6.28); fxCtx.fill(); fxCtx.restore();
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.x += s.vx; s.y += s.vy; s.vy += 0.12; s.vx *= 0.985; s.life -= 0.022;
    if (s.life <= 0) { sparks.splice(i, 1); continue; }
    fxCtx.save(); fxCtx.globalAlpha = Math.max(0, s.life); fxCtx.fillStyle = s.col;
    fxCtx.beginPath(); fxCtx.arc(s.x, s.y, s.r * s.life, 0, 6.28); fxCtx.fill(); fxCtx.restore();
  }
  if (!fxOn && !sparks.length) { cancelAnimationFrame(fxRAF); fxRAF = 0; fxCtx.clearRect(0, 0, innerWidth, innerHeight); }
}
/* 飘分：反馈出现在视线焦点处 */
function floatScore(anchor, txt, color) {
  const r = (anchor && anchor.getBoundingClientRect) ? anchor.getBoundingClientRect() : null;
  const el = document.createElement('div');
  el.className = 'floatscore';
  el.textContent = txt;
  el.style.color = color || '#2e6b5e';
  el.style.left = (r ? r.left + r.width / 2 : innerWidth / 2) + 'px';
  el.style.top = (r ? r.top + 6 : innerHeight / 2) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function toast(msg, warn, ms) {
  const w = document.getElementById('toastWrap');
  const d = document.createElement('div');
  d.className = 'toast' + (warn ? ' warn' : '');
  d.textContent = msg;
  w.appendChild(d);
  setTimeout(() => { d.style.transition = 'opacity .3s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 320); }, ms || 2400);
}

/* =====================================================================
   L5 数据层：三级存储 + 榜单（同名去重保最佳）
   ===================================================================== */
/* ▲▲▲ 提取块结束 [L4 粒子特效 + floatScore + toast] ▲▲▲ */

/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 595~661 行 [L4.1 三级存储（本地 best 去重）] ▼▼▼ */
const STORE_KEY = 'dgms_dazhuan_v1';
let DB = { ver: 1, solo: [], duo: [], roster: [], lib: null, rubbings: {}, ach: {}, soloName: '',
  rubBy: {}, seenBy: {},   /* rubBy[玩家名]={字:最高分}：拓片按玩家归属（2026-10-06 何何老师定稿）；seenBy[玩家名]=巡游已展示数；rubbings/rubTourSeenN 为旧版全机字段（loadDB 迁移后弃用） */
  eggRec: {} };   /* V3.6 彩蛋层：eggRec[模式id]={solo:[],duo:[]} 各模式成绩（同名保最佳）——加/撤字段必须同步 loadDB 与 importDB 两处白名单（SOP A3，此坑踩过三次）。
     ⚠️ 彩蛋勾选（原 eggSel）2026-10-07 起改为**纯内存态**（p5 的 EGG_SEL），不入 DB/localStorage：勾选只活当前页面生命周期（何何老师定稿：口令解锁不可持久） */
let lastTs = [];
let fileHandle = null;

/* 拓片按玩家归属迁移（2026-10-06）：旧版全机 rubbings/rubTourSeenN → 默认玩家「我」名下 */
function migrateRubBy(v, legacy) {
  const out = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  if (legacy && Object.keys(legacy).length && !Object.keys(out).length) out['我'] = legacy;
  return out;
}
function migrateSeenBy(v, legacyN) {
  const out = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  if (legacyN && !out['我']) out['我'] = legacyN;
  return out;
}
/* 当前玩家=本局参赛名字（CUR.playerName）→ 上次单人名字 → 默认「我」；rubMapOf 纯读不建键 */
function curPlayer() { return CUR.playerName || DB.soloName || '我'; }
function rubMapOf(p) { return (DB.rubBy && DB.rubBy[p]) || {}; }
function rubCountOf(p) { return Object.keys(rubMapOf(p)).length; }
function loadDB() {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v) { const d = JSON.parse(v); DB = { ver: 1, solo: d.solo || [], duo: d.duo || [], roster: d.roster || [], lib: d.lib || null, ach: d.ach || {},
      rubTourSeenN: d.rubTourSeenN || 0, soloName: d.soloName || '',
      rubBy: migrateRubBy(d.rubBy, d.rubbings), seenBy: migrateSeenBy(d.seenBy, d.rubTourSeenN),
      eggRec: (d.eggRec && typeof d.eggRec === 'object' && !Array.isArray(d.eggRec)) ? d.eggRec : {} }; }   /* eggSel 已撤出 DB（勾选=内存态），旧存档里的残留字段随重建自然丢弃 */
  } catch (e) { }
  /* 旧数据净化：清理同名同难度的重复条目，只留最佳 */
  DIFF_ORDER.forEach(k => { DB.solo = dedupeList(DB.solo, k); DB.duo = dedupeList(DB.duo, k); });
  saveDB();
}
function saveDB() { try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { } }
/* 「同名 + 同难度」只保留一条最佳：单人按描红总分，双人按 PK 总分 */
function betterSolo(a, b) {
  return a.traceTotal > b.traceTotal ||
    (a.traceTotal === b.traceTotal && (a.marks > b.marks ||
      (a.marks === b.marks && a.time < b.time)));
}
function betterDuo(a, b) {
  return a.score > b.score || (a.score === b.score && a.time < b.time);
}
function dedupeList(list, diff) {
  const best = {};
  list.forEach(r => {
    if (r.diff !== diff) return;
    const k = r.name;
    if (!(k in best) || (list === DB.duo ? betterDuo(r, best[k]) : betterSolo(r, best[k]))) best[k] = r;
  });
  const out = [], seen = {};
  list.forEach(r => {
    if (r.diff !== diff) { out.push(r); return; }
    if (seen[r.name]) return;
    seen[r.name] = 1; out.push(best[r.name]);
  });
  return out;
}
/* 录入层：同名同难度去重，保最佳（含清理历史遗留重复） */
function keepBest(list, r, better) {
  let best = null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].name === r.name && list[i].diff === r.diff) {
      if (!best || better(list[i], best)) best = list[i];
      list.splice(i, 1);
    }
  }
  if (best) {
    const improved = better(r, best);
    if (improved) { list.push(r); return { rec: r, improved: true, old: best }; }
    list.push(best); return { rec: best, improved: false, old: best };
  }
  list.push(r); return { rec: r, improved: true, old: null };
}
/* 显示层兜底：同名只留最佳（防旧数据） */
function dedupeByName(sorted, better) {
  const best = {}, out = [];
  sorted.forEach(r => {
    if (!(r.name in best)) { best[r.name] = r; out.push(r); }
    else if (better(r, best[r.name])) { best[r.name] = r; }
  });
  return out;
}
/* 通用小文件下载：data: URL 而非 blob:。
   file:// 双击打开时 Chrome 会把 blob:file:// 下载转交给 macOS Launch Services，
   弹「未设定用来打开 URL」错误且文件不落盘；data: URL 由浏览器内部下载，无此问题。 */
function downloadText(filename, text, mime) {
  const a = document.createElement('a');
  a.href = 'data:' + (mime || 'text/plain') + ';charset=utf-8,' + encodeURIComponent(text);
  a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
}
/* ▲▲▲ 提取块结束 [L4.1 三级存储（本地 best 去重）] ▲▲▲ */

/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 2032~2100 行 [InkBox 描红画布（闭包工厂）] ▼▼▼ */
function InkBox(host, onChange) {
  const box = document.createElement('div'); box.className = 'cvbox';
  const g = document.createElement('canvas'); g.width = L; g.height = L;
  const k = document.createElement('canvas'); k.width = L; k.height = L;
  box.appendChild(g); box.appendChild(k); host.appendChild(box);
  const gx = g.getContext('2d'), ix = k.getContext('2d');
  const st = { strokes: [], cur: null, drawing: false, activeId: null, lastPt: null, ch: '一', lock: false };

  /* 【坐标系唯一事实源】屏幕坐标 → 字形坐标（0..400），**不偏移**。
     灰字用 glyphPath2D 原生坐标绘制，笔迹也存同一坐标系，
     判定 judgeScore 里的 rasterizeSegs 才与字形严格重合。
     v1.8 修正：旧版此处 `- PAD`、renderInk 里 `+ PAD`，而判定侧不加回，
     导致判定用的笔迹比屏幕所见整体偏 (-10,-10)px ——「完全描在灰字上」只得 55 分。 */
  function px(e) {
    const r = k.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * L, (e.clientY - r.top) / r.height * L];
  }
  function renderGuide() {
    gx.clearRect(0, 0, L, L);
    const p = glyphPath2D(st.ch, SCRIPT);
    gx.fillStyle = '#e6e3dc'; gx.fill(p);
    gx.strokeStyle = '#c9c5bb'; gx.lineWidth = 1.6; gx.stroke(p);
    try {
      const G = glyphData(st.ch);
      gx.font = 'bold 15px sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle';
      G.chains.forEach((c, i) => {
        const x = c[0] % L, y = (c[0] / L) | 0;
        gx.beginPath(); gx.arc(x, y, 9, 0, 7);
        gx.fillStyle = 'rgba(176,58,46,.18)'; gx.fill();
        gx.fillStyle = 'rgba(142,43,33,.6)'; gx.fillText(String(i + 1), x, y);
      });
    } catch (err) { /* 编号提示失败不影响描红 */ }
  }
  function renderInk() {
    ix.clearRect(0, 0, L, L);
    ix.strokeStyle = '#c0392b'; ix.fillStyle = '#c0392b';
    ix.lineWidth = 7; ix.lineCap = 'round'; ix.lineJoin = 'round';
    st.strokes.forEach(sg => {
      if (!sg.length) return;
      if (sg.length === 1) { ix.beginPath(); ix.arc(sg[0][0], sg[0][1], 3.5, 0, 7); ix.fill(); return; }
      ix.beginPath(); ix.moveTo(sg[0][0], sg[0][1]);
      for (let i = 1; i < sg.length; i++) ix.lineTo(sg[i][0], sg[i][1]);
      ix.stroke();
    });
  }
  k.addEventListener('pointerdown', e => {
    if (st.lock) return;
    try { k.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件/异常指针下可能抛错，忽略即可 */ }
    st.drawing = true; st.activeId = e.pointerId; st.lastPt = px(e);
    st.cur = [st.lastPt]; st.strokes.push(st.cur);
    sndPen(); renderInk();
  });
  k.addEventListener('pointermove', e => {
    if (!st.drawing || e.pointerId !== st.activeId || !st.cur) return;
    const raw = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    raw.forEach(ev => {
      const p = px(ev);
      if (st.lastPt && Math.hypot(p[0] - st.lastPt[0], p[1] - st.lastPt[1]) < 1.0) return;
      st.cur.push(p); st.lastPt = p;
    });
    renderInk();
  });
  function end(e) {
    if (e.pointerId !== st.activeId) return;
    st.drawing = false; st.activeId = null; st.lastPt = null; st.cur = null;
    if (onChange) onChange(st.strokes);
  }
  k.addEventListener('pointerup', end);
  k.addEventListener('pointercancel', end);
  renderGuide();
  return {
    el: box, st,
    setChar(ch) { st.ch = ch; st.strokes = []; st.cur = null; renderGuide(); renderInk(); },
    clear() { st.strokes = []; st.cur = null; renderInk(); },
    render: renderInk,
    used() { return st.strokes.filter(s => s.length); },
    setLock(v) { st.lock = !!v; }
  };
}
/* ▲▲▲ 提取块结束 [InkBox 描红画布（闭包工厂）] ▲▲▲ */
