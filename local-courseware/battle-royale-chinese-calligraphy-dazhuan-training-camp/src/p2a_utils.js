/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 1116~1124 行 [shuffle/esc/svgOf] ▼▼▼ */
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function svgOf(ch, script, cls) {
  const src = script ? (GLYPHS4[script] || {}) : GLYPHS4[SCRIPT];
  const ds = src[ch];
  if (!ds) return '<span class="bigchar">' + esc(ch) + '</span>';
  return '<svg viewBox="0 0 400 400" class="' + (cls || '') + '" preserveAspectRatio="xMidYMid meet">' +
    ds.map(d => '<path d="' + d + '" fill="#241c14"/>').join('') + '</svg>';
}
/* ▲▲▲ 提取块结束 [shuffle/esc/svgOf] ▲▲▲ */

/* ▼▼▼ 逐字提取自 篆刻工坊-小篆训练营v6.6.618.html <script> 第 1125~1138 行 [干扰项 + 出题器] ▼▼▼ */
/* 干扰项：同义类优先 → 同难度阶 → 其余补足（与正确项绝不重复）
   同义类的干扰项更「像」，才考得出辨识力，而不是随便塞三个 */
function distractors(ans, n) {
  const info = DZINFO[ans];
  const pool = CHARS.filter(c => c !== ans);
  const a = shuffle(pool.filter(c => DZINFO[c].cat === info.cat));
  const b = shuffle(pool.filter(c => DZINFO[c].cat !== info.cat && DZINFO[c].lv === info.lv));
  const c = shuffle(pool.filter(c => DZINFO[c].cat !== info.cat && DZINFO[c].lv !== info.lv));
  return a.concat(b, c).slice(0, n);
}
function mkQuestion(ch, dir) {
  const opts = shuffle([ch].concat(distractors(ch, 3)));
  return { ch, dir, options: opts };
}
/* ▲▲▲ 提取块结束 [干扰项 + 出题器] ▲▲▲ */
/* 出题去重规则（何何老师 2026-10-06 定稿）：去重生命周期=一局——开局建去重集，结算即作废，
   下一位玩家从头再来；不做跨局持久化（曾试 DB.quizHist 按玩家记忆，同日按此口径撤销） */
