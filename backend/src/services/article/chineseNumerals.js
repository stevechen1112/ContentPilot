/**
 * chineseNumerals.js
 * 中文數字解析與標題承諾（Count Promise）相關工具
 * 從 articleService.js 提取（ARCH-01）
 */

'use strict';

/**
 * 將阿拉伯數字字串或中文數字字串轉換為整數，支援 0-99。
 * @param {*} token
 * @returns {number|null}
 */
function parseCountTokenToNumber(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  // Basic Chinese numerals (supports 1-99 for our headline promises)
  const map = {
    '零': 0,
    '一': 1,
    '二': 2,
    '兩': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9
  };

  if (raw === '十') return 10;
  // e.g. 十一, 十二
  if (raw.startsWith('十') && raw.length === 2) {
    const ones = map[raw[1]];
    return ones != null ? 10 + ones : null;
  }
  // e.g. 二十, 二十一
  const tenIdx = raw.indexOf('十');
  if (tenIdx > 0) {
    const tens = map[raw[0]];
    if (tens == null) return null;
    const onesChar = raw.slice(tenIdx + 1);
    if (!onesChar) return tens * 10;
    const ones = map[onesChar];
    return ones != null ? tens * 10 + ones : null;
  }
  return map[raw] ?? null;
}

/**
 * 將數字轉換為對應的中文數字（0-10）。
 * @param {number} n
 * @returns {string}
 */
function numberToChineseNumeral(n) {
  const map = {
    0: '零', 1: '一', 2: '二', 3: '三', 4: '四',
    5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十'
  };
  return map[n] || String(n);
}

/**
 * 解析標題中的「承諾交付數量」，例如「3大陷阱」→ { kind:'trap', label:'陷阱', count:3 }
 * 序位步驟詞（「第一步」）會被忽略並回傳 null。
 * @param {string} heading
 * @returns {{ kind: string, label: string, count: number } | null}
 */
function extractCountPromiseFromHeading(heading) {
  const text = String(heading || '').trim();
  if (!text) return null;

  // 若是「第X步」僅表示序位（不是承諾 X 個步驟），直接跳過
  const ordinalStep = /^第\s*(\d+|[一二兩三四五六七八九十]{1,3})\s*步(?:\b|[：:])?/i;
  if (ordinalStep.test(text)) return null;

  // Patterns like: 3大陷阱 / 5個重點 / 三個方法 / 3步驟
  const m = text.match(/(\d+|[一二兩三四五六七八九十]{1,3})\s*(?:大|個)?\s*(陷阱|迷思|錯誤|誤區|疑問|問題|重點|方法|技巧|步驟|步)/);
  if (!m) return null;

  const count = parseCountTokenToNumber(m[1]);
  const kind = m[2];
  if (!count || count < 2) return null;

  if (kind === '陷阱') return { kind: 'trap', label: '陷阱', count };
  if (kind === '迷思') return { kind: 'myth', label: '迷思', count };
  if (kind === '錯誤') return { kind: 'mistake', label: '錯誤', count };
  if (kind === '誤區') return { kind: 'mistake', label: '誤區', count };
  if (kind === '疑問') return { kind: 'question', label: '疑問', count };
  if (kind === '問題') return { kind: 'question', label: '問題', count };
  if (kind === '步驟') return { kind: 'step', label: '步驟', count };
  if (kind === '步') return { kind: 'step', label: '步驟', count };
  return { kind: 'generic', label: kind, count };
}

/**
 * 統計 HTML 中某標籤的已標號子標題數量（去重）。
 * 例如：countLabeledSubheadings(html, '陷阱') 計算 <h3>陷阱1...</h3> 的種類數
 * @param {string} html
 * @param {string} label
 * @returns {number}
 */
function countLabeledSubheadings(html, label) {
  const out = String(html || '');
  const lbl = String(label || '').trim();
  if (!out || !lbl) return 0;

  const hits = new Set();
  const re = new RegExp(`<h3>\\s*${lbl}\\s*([0-9]+|[一二三四五六七八九十]+)\\s*(?:[：:]|\\s)`, 'gi');
  let m;
  while ((m = re.exec(out)) !== null) {
    const token = String(m[1] || '').trim();
    const num = parseCountTokenToNumber(token);
    if (num != null) hits.add(String(num));
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return hits.size;
}

/**
 * 提取 HTML 中某標籤的已標號序號集合（Set<number>），用於判斷缺口。
 * @param {string} html
 * @param {string} label
 * @returns {Set<number>}
 */
function extractLabeledOrdinalSet(html, label) {
  const out = String(html || '');
  const lbl = String(label || '').trim();
  const hits = new Set();
  if (!out || !lbl) return hits;

  const re = new RegExp(`<h3>\\s*${lbl}\\s*([0-9]+|[一二三四五六七八九十]+)\\s*(?:[：:]|\\s)`, 'gi');
  let m;
  while ((m = re.exec(out)) !== null) {
    const token = String(m[1] || '').trim();
    const num = parseCountTokenToNumber(token);
    if (num != null) hits.add(num);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return hits;
}

/**
 * 根據承諾類型，為 AI prompt 附加「硬規則」提醒段落。
 * @param {string} sectionHeading
 * @param {{ kind: string, label: string, count: number } | null} promise
 * @returns {string}
 */
function buildPromiseGuardForPrompt(sectionHeading, promise) {
  if (!promise) return '';
  if (promise.kind === 'trap') {
    return `\n## ✅ 承諾交付（硬規則）\n- 你的段落標題包含「${promise.count} 大陷阱」。你必須交付 **剛好 ${promise.count} 個**陷阱，並用 <h3> 子標題標示：\n  - <h3>陷阱一：…</h3>\n  - <h3>陷阱二：…</h3>\n  - …直到 <h3>陷阱${promise.count}：…</h3>\n- 禁止只寫 2 個就收尾，也不要把陷阱塞進段落裡不做子標題。\n`;
  }
  if (promise.kind === 'myth') {
    return `\n## ✅ 承諾交付（硬規則）\n- 你的段落標題包含「${promise.count} 大迷思」。你必須交付 **剛好 ${promise.count} 個**迷思，並用 <h3> 子標題標示：\n  - <h3>迷思一：…</h3> 直到 <h3>迷思${promise.count}：…</h3>\n`;
  }
  if (promise.kind === 'mistake') {
    return `\n## ✅ 承諾交付（硬規則）\n- 你的段落標題包含「${promise.count} ${promise.label}」。你必須交付 **剛好 ${promise.count} 個**${promise.label}，並用 <h3> 子標題標示：\n  - <h3>${promise.label}一：…</h3> 直到 <h3>${promise.label}${promise.count}：…</h3>\n`;
  }
  if (promise.kind === 'question') {
    return `\n## ✅ 承諾交付（硬規則）\n- 你的段落標題包含「${promise.count} 大${promise.label}」。你必須交付 **剛好 ${promise.count} 個**${promise.label}，並用 <h3> 子標題標示：\n  - <h3>${promise.label}一：…</h3>\n  - <h3>${promise.label}二：…</h3>\n  - …直到 <h3>${promise.label}${promise.count}：…</h3>\n- 禁止只寫 2 個就收尾，也不要把第 ${promise.count} 個藏在段落裡不做子標題。\n`;
  }
  if (promise.kind === 'step') {
    return `\n## ✅ 承諾交付（硬規則）\n- 你的段落標題包含「${promise.count} 步驟」。你必須交付 **剛好 ${promise.count} 個**步驟，並用 <h3> 子標題標示：\n  - <h3>步驟1：…</h3> 直到 <h3>步驟${promise.count}：…</h3>\n`;
  }
  return `\n## ✅ 承諾交付（提醒）\n- 你的段落標題包含「${promise.count} ${promise.label}」。請確保內容真的交付 ${promise.count} 個要點，避免「說 ${promise.count} 個但只寫 2 個」。\n`;
}

module.exports = {
  parseCountTokenToNumber,
  numberToChineseNumeral,
  extractCountPromiseFromHeading,
  countLabeledSubheadings,
  extractLabeledOrdinalSet,
  buildPromiseGuardForPrompt,
};
