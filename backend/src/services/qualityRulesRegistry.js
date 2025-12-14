/**
 * Quality rules registry (deterministic, reportable)
 *
 * Notes:
 * - This registry is intentionally conservative and small.
 * - It is used for reporting + optional gating, not for rewriting.
 */

const { includesAny, regexAny, requireAtLeast } = require('./qualityRuleMatchers');
const { getTaiwanStyleNormalizationRules } = require('./taiwanStyleNormalizationRules');

function parseChineseDayTokenToNumber(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  // Very small, deterministic converter for common day numbers.
  const map = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  if (raw === '十') return 10;
  if (raw.length === 1 && map[raw] != null) return map[raw];

  // Handle 11-19: 十一, 十二, ...
  if (raw.startsWith('十')) {
    const tail = raw.slice(1);
    if (!tail) return 10;
    if (tail.length === 1 && map[tail] != null) return 10 + map[tail];
  }

  // Handle 20, 21...: 二十, 二十一
  if (raw.length >= 2 && map[raw[0]] != null && raw[1] === '十') {
    const tens = map[raw[0]] * 10;
    const tail = raw.slice(2);
    if (!tail) return tens;
    if (tail.length === 1 && map[tail] != null) return tens + map[tail];
  }

  return null;
}

function travelItineraryConsistencyMatcher() {
  return (text) => {
    const hay = String(text || '');

    // Normalize HTML-ish text into a deterministic, line-friendly format.
    // We intentionally insert newlines at common block boundaries so we can reliably parse Day lines.
    const normalizedHay = hay
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*\/\s*p\s*>/gi, '\n')
      .replace(/<\s*\/\s*li\s*>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\t\f\v ]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim();

    // Extract DayX lines from anywhere in the normalized article text.
    const dayMap = new Map();
    const dayLineRe = /Day\s*([1-9]\d*)\s*[：:]\s*([^\n]+)/gi;
    let m;
    while ((m = dayLineRe.exec(normalizedHay)) !== null) {
      const day = Number(m[1]);
      const desc = String(m[2] || '').trim();
      if (!Number.isFinite(day) || !desc) continue;
      if (!dayMap.has(day)) dayMap.set(day, desc);
      if (m.index === dayLineRe.lastIndex) dayLineRe.lastIndex++;
    }

    // Also support Chinese day lines like "第4天：..." / "第四天：...".
    const dayLineReZh = /第\s*([一二三四五六七八九十\d]{1,3})\s*天\s*[：:]\s*([^\n]+)/g;
    while ((m = dayLineReZh.exec(normalizedHay)) !== null) {
      const day = parseChineseDayTokenToNumber(m[1]);
      const desc = String(m[2] || '').trim();
      if (!Number.isFinite(day) || !desc) continue;
      if (!dayMap.has(day)) dayMap.set(day, desc);
      if (m.index === dayLineReZh.lastIndex) dayLineReZh.lastIndex++;
    }

    if (dayMap.size === 0) return { count: 0, samples: [] };

    const allDays = Array.from(dayMap.keys()).sort((a, b) => a - b);
    const maxDay = allDays[allDays.length - 1];

    const placeSynonyms = {
      '迪士尼': ['迪士尼', '東京迪士尼'],
      '淺草': ['淺草', '淺草寺'],
      '上野': ['上野', '上野公園'],
      '秋葉原': ['秋葉原'],
      '新宿': ['新宿'],
      '原宿': ['原宿'],
      '表參道': ['表參道'],
      '東京塔': ['東京塔'],
      '晴空塔': ['晴空塔'],
      '吉祥寺': ['吉祥寺'],
    };

    const skipHintRe = /(備案|可選|選配|如果|視情況|也可以|或改去|替換|改成|改為)/;
    const issues = [];
    const issueSet = new Set();

    const pushIssue = (sample) => {
      const s = String(sample || '').trim();
      if (!s) return;
      if (issueSet.has(s)) return;
      issueSet.add(s);
      issues.push(s);
    };

    const dayMarkerReGlobal = /(第\s*([一二三四五六七八九十\d]{1,3})\s*天|Day\s*([1-9]\d*))/gi;
    const placeReGlobal = /(東京迪士尼|迪士尼|淺草寺|淺草|上野公園|上野|秋葉原|新宿|原宿|表參道|東京塔|晴空塔|吉祥寺)/g;

    const normalizePlaceKey = (rawPlace) => {
      const p = String(rawPlace || '').trim();
      if (!p) return '';
      if (p === '東京迪士尼') return '迪士尼';
      if (p === '淺草寺') return '淺草';
      if (p === '上野公園') return '上野';
      return p;
    };

    const isPlaceCompatibleWithDay = (dayNum, rawPlace) => {
      const dayDesc = String(dayMap.get(dayNum) || '');
      const placeKey = normalizePlaceKey(rawPlace);
      const synonyms = placeSynonyms[placeKey] || [placeKey];
      return synonyms.some((p) => p && dayDesc.includes(p));
    };

    // Work sentence-by-sentence to avoid cross-day leakage like:
    // "第一天...第二天...原宿" accidentally binding 原宿 to 第一天.
    const sentences = normalizedHay.split(/[。！？\n]+/).map((s) => s.trim()).filter(Boolean);
    for (const sentence of sentences) {
      if (issues.length >= 20) break;
      if (!/(Day\s*[1-9]\d*|第\s*[一二三四五六七八九十\d]{1,3}\s*天)/.test(sentence)) continue;

      // Skip explicit optional/backup language at sentence level.
      if (skipHintRe.test(sentence)) continue;

      // Special-case "分別" mapping: "Day1 和 Day2 ... 分別前往 A 和 B".
      // This avoids false positives where A appears after Day2 but is intended for Day1.
      if (sentence.includes('分別')) {
        const dayMatches = [];
        dayMarkerReGlobal.lastIndex = 0;
        let dm;
        while ((dm = dayMarkerReGlobal.exec(sentence)) !== null) {
          const dayNum = dm[3] ? Number(dm[3]) : parseChineseDayTokenToNumber(dm[2]);
          if (dayNum) dayMatches.push({ dayNum, idx: dm.index });
          if (dm.index === dayMarkerReGlobal.lastIndex) dayMarkerReGlobal.lastIndex++;
        }

        const placeMatches = [];
        let pm;
        while ((pm = placeReGlobal.exec(sentence)) !== null) {
          placeMatches.push(String(pm[1] || '').trim());
          if (pm.index === placeReGlobal.lastIndex) placeReGlobal.lastIndex++;
        }
        placeReGlobal.lastIndex = 0;

        if (dayMatches.length === 2 && placeMatches.length === 2) {
          const [d1, d2] = dayMatches;
          const [p1, p2] = placeMatches;

          if (d1.dayNum >= 1 && d1.dayNum <= maxDay && !isPlaceCompatibleWithDay(d1.dayNum, p1)) {
            pushIssue(sentence);
          }
          if (d2.dayNum >= 1 && d2.dayNum <= maxDay && !isPlaceCompatibleWithDay(d2.dayNum, p2)) {
            pushIssue(sentence);
          }
          continue;
        }
      }

      // General case: for each day marker, only validate places in its local clause
      // (until the next day marker or end of sentence).
      const markers = [];
      dayMarkerReGlobal.lastIndex = 0;
      let mm;
      while ((mm = dayMarkerReGlobal.exec(sentence)) !== null) {
        const dayToken = mm[2];
        const dayNum = mm[3] ? Number(mm[3]) : parseChineseDayTokenToNumber(dayToken);
        if (dayNum) markers.push({ dayNum, idx: mm.index, len: String(mm[0] || '').length });
        if (mm.index === dayMarkerReGlobal.lastIndex) dayMarkerReGlobal.lastIndex++;
      }
      if (markers.length === 0) continue;

      for (let i = 0; i < markers.length; i++) {
        if (issues.length >= 20) break;
        const cur = markers[i];
        const next = markers[i + 1];
        const start = Math.min(sentence.length, cur.idx + cur.len);
        const end = next ? next.idx : sentence.length;
        const clause = sentence.slice(start, end);

        // Find places in this clause.
        placeReGlobal.lastIndex = 0;
        let pl;
        while ((pl = placeReGlobal.exec(clause)) !== null) {
          const rawPlace = String(pl[1] || '').trim();
          if (!rawPlace) continue;

          if (cur.dayNum < 1 || cur.dayNum > maxDay) {
            pushIssue(sentence);
            break;
          }

          if (!isPlaceCompatibleWithDay(cur.dayNum, rawPlace)) {
            pushIssue(sentence);
            break;
          }

          if (pl.index === placeReGlobal.lastIndex) placeReGlobal.lastIndex++;
        }
      }
    }

    return { count: issues.length, samples: issues.slice(0, 5) };
  };
}

function rule(id, severity, message, matcher, options = {}) {
  const out = { id, severity, message, matcher };
  if (options && Array.isArray(options.domains) && options.domains.length > 0) out.domains = options.domains;
  if (options && options.scope) out.scope = options.scope;
  return out;
}

function getQualityRules() {
  const derivedToneRules = [];
  try {
    const normalizationRules = getTaiwanStyleNormalizationRules();
    for (const r of normalizationRules) {
      const id = String(r.id || '');
      if (!id.startsWith('tone.')) continue;

      // Skip purely stylistic word swaps if any are ever added.
      if (id.startsWith('tone.word.')) continue;

      const severity =
        id.startsWith('tone.cta.') || id.startsWith('tone.template.') || id.startsWith('tone.leadgen.')
          ? 'warn'
          : 'info';

      const message = id.startsWith('tone.cta.')
        ? '避免過強或命令式 CTA。'
        : id.startsWith('tone.template.')
          ? '避免模板化套話與機械式敘事。'
          : '避免不自然的口號/雞湯/過度承諾語氣。';

      // Ensure global regex to count multiple matches.
      const base = r.pattern instanceof RegExp ? r.pattern : new RegExp(String(r.pattern), 'g');
      const flags = base.flags.includes('g') ? base.flags : `${base.flags}g`;
      const global = new RegExp(base.source, flags);

      derivedToneRules.push(rule(`derived.${id}`, severity, message, regexAny([global])));
    }
  } catch (e) {
    // If derived rules fail, fall back to static rules below.
  }

  // Taiwan Traditional Chinese + tone regressions we explicitly want to prevent.
  return [
    rule(
      'taiwan.pronoun.avoid_nin',
      'warn',
      '避免使用「您／您的」，請統一使用「你／你的」。',
      includesAny(['您', '您的'])
    ),
    rule(
      'tone.template.opening',
      'warn',
      '避免模板開場（例如「在這篇文章中…」「本文將…」）。',
      includesAny([
        '在這篇文章中',
        '在本篇文章中',
        '在這篇《',
        '在本文中',
        '本文將',
        '這篇文章將',
        '本篇文章將',
        '在文章中',
        '文章整理了',
        '將介紹',
        '你是否也曾',
        '你是否曾',
        '你是不是也曾',
        '你是不是也',
        '是否也曾'
      ])
    ),
    rule(
      'tone.strong_cta',
      'warn',
      '避免過強 CTA（例如「立即行動」「現在就…」）。',
      includesAny(['立即行動', '現在，請立即行動', '現在就', '馬上就'])
    ),
    rule(
      'tone.chicken_soup',
      'info',
      '避免雞湯口號式句子。',
      includesAny(['讓未來的你感謝現在', '從今天開始', '你值得', '勇敢踏出第一步'])
    ),
    rule(
      'format.no_anchor_tags',
      'error',
      '禁止出現 <a> 連結（外部/內部連結都不允許）。',
      regexAny([/<a\b[^>]*>/gi])
    ),
    rule(
      'format.no_raw_urls',
      'error',
      '禁止出現完整 URL。',
      regexAny([/https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/gi])
    ),
    rule(
      'style.ai_filler',
      'info',
      '避免 AI 慣用空泛詞（可接受少量，但建議降低）。',
      includesAny(['深入探討', '不容忽視', '值得注意的是', '眾所周知', '毋庸置疑', '顯而易見'])
    ),

    // Deliverable gating (domain-aware)
    rule(
      'travel.deliverable.itinerary_days',
      'warn',
      '旅遊文章需要提供可直接照做的行程拆解（至少 3 天的 Day/第X天）。',
      requireAtLeast(/(?:Day\s*\d+|D\s*\d+|第\s*\d+\s*天)/gi, 3, '缺少 Day1/Day2/Day3（或「第1天/第2天/第3天」）等行程拆解'),
      { domains: ['travel'], scope: 'article' }
    ),

    rule(
      'travel.avoid_finance_residue',
      'warn',
      '旅遊文章避免出現理財語境殘留（例如「收支盤點」「ETF」「報酬率」等）。',
      includesAny([
        '收支盤點',
        '資產配置',
        '投資報酬',
        '報酬率',
        '年化',
        'ETF',
        '基金',
        '股票'
      ]),
      { domains: ['travel'] }
    ),

    rule(
      'travel.itinerary_consistency',
      'warn',
      '旅遊文章的行程快覽與內文敘述需一致（避免第X天/DayX/景點安排互相矛盾）。',
      travelItineraryConsistencyMatcher(),
      { domains: ['travel'], scope: 'article' }
    ),

    // Derived from normalization rules (keeps rewrite/report in sync)
    ...derivedToneRules
  ];
}

module.exports = {
  getQualityRules,
};
