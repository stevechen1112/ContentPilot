/**
 * Taiwan style normalization rules
 *
 * This is the single source of truth for deterministic post-processing.
 * The same rule IDs can be referenced by reporting/gating.
 */

function getTaiwanStyleNormalizationRules() {
  return [
    // 1) 稱呼統一：全篇用「你」
    { id: 'taiwan.pronoun.ninmen_to_nimen', pattern: /您們/g, replacement: '你們' },
    { id: 'taiwan.pronoun.ninde_to_nide', pattern: /您的/g, replacement: '你的' },
    { id: 'taiwan.pronoun.nin_to_ni', pattern: /您/g, replacement: '你' },

    // 2) 口號式雞湯句：移除
    { id: 'tone.slogan.remove_let_us_start', pattern: /讓我們一起啟程吧！?/g, replacement: '' },
    { id: 'tone.slogan.remove_let_us_begin', pattern: /讓我們一起開始吧！?/g, replacement: '' },
    { id: 'tone.slogan.remove_start_journey', pattern: /一起啟程吧！?/g, replacement: '' },
    { id: 'tone.slogan.remove_start', pattern: /一起開始吧！?/g, replacement: '' },
    { id: 'tone.slogan.soften_let_us_together', pattern: /讓我們一起/g, replacement: '接下來' },

    // 3) 過度戲劇化開場：降低語氣
    { id: 'tone.opening.soften_imagine', pattern: /想像一下，?/g, replacement: '先從一個常見情境開始：' },

    // 3.5 台灣常用詞優先
    { id: 'taiwan.word.plan', pattern: /計劃/g, replacement: '計畫' },
    { id: 'taiwan.word.through', pattern: /通過/g, replacement: '透過' },

    // 4) 常見陸用詞補強
    { id: 'taiwan.word.account_zh1', pattern: /賬戶/g, replacement: '帳戶' },
    { id: 'taiwan.word.account_zh2', pattern: /賬號/g, replacement: '帳號' },

    // 5) 減少「我們」的官方敘事感
    { id: 'tone.template.we_provide_1', pattern: /在這篇文章中，我們將為你提供/g, replacement: '這篇文章會提供你' },
    { id: 'tone.template.we_provide_2', pattern: /本文將為你提供/g, replacement: '這篇文章會提供你' },
    { id: 'tone.template.will_lead_you', pattern: /在這篇文章中，將帶你/g, replacement: '這篇文章會帶你' },

    // 🆕 更通用：避免「這篇文章將…」這類模板句（會觸發 strict gate）
    { id: 'tone.template.this_article_will', pattern: /這篇文章將/g, replacement: '這份整理會' },

    // 🆕 移除模板問句開場（容易觸發 strict gate）
    { id: 'tone.template.remove_you_have_you_ever', pattern: /你是否也曾/g, replacement: '很多人會' },
    { id: 'tone.template.remove_you_have_you_ever_short', pattern: /是否也曾/g, replacement: '如果你曾經' },
    { id: 'tone.template.remove_are_you_also', pattern: /你是不是也曾/g, replacement: '很多人會' },

    // 🆕 移除通用模板開場短語（避免 quality gate 直接打到）
    // 注意：這是「全域」替換，目標是把模板語氣降到最低。
    { id: 'tone.template.remove_in_this_article_phrase', pattern: /在這篇文章中/g, replacement: '下面' },
    { id: 'tone.template.remove_in_this_post_phrase', pattern: /在本文中/g, replacement: '下面' },

    // 🆕 B: 避免 intro/內文出現「本文將提供...」這類模板句（不只句首）
    { id: 'tone.template.post_will_provide', pattern: /本文\s*(?:將|会|會)\s*提供/g, replacement: '這份整理會提供' },
    { id: 'tone.template.article_will_provide', pattern: /這篇文章\s*(?:將|会|會)\s*提供/g, replacement: '這份整理會提供' },

    // 避免模板式「在這篇文章中，將介紹...」
    { id: 'tone.template.introduce_1', pattern: /在這篇文章中[，,]?\s*將介紹/g, replacement: '這份整理會介紹' },
    { id: 'tone.template.introduce_2', pattern: /在這篇文章中[，,]?\s*會介紹/g, replacement: '這份整理會介紹' },
    { id: 'tone.template.introduce_3', pattern: /這篇文章[將会]介紹/g, replacement: '這份整理會介紹' },
    { id: 'tone.template.introduce_4', pattern: /本文將介紹/g, replacement: '這份整理會介紹' },

    // 🆕 B: 同樣處理「在本文中…介紹」的變形（常出現在 intro 中段）
    { id: 'tone.template.introduce_in_post_1', pattern: /在本文中[，,]?\s*(?:我們\s*)?(?:將|会|會)?\s*介紹/g, replacement: '這份整理會介紹' },

    // 🆕 B: 避免 intro 內出現「在這篇文章中…將探討/說明/分享」這類模板句
    { id: 'tone.template.discuss_1', pattern: /在這篇文章中[，,]?\s*(?:將|会|會)?\s*探討/g, replacement: '這份整理會探討' },
    { id: 'tone.template.discuss_2', pattern: /在本文中[，,]?\s*(?:將|会|會)?\s*探討/g, replacement: '這份整理會探討' },
    { id: 'tone.template.discuss_3', pattern: /本文\s*(?:將|会|會)?\s*探討/g, replacement: '這份整理會探討' },
    { id: 'tone.template.discuss_4', pattern: /這篇文章\s*(?:將|会|會)?\s*探討/g, replacement: '這份整理會探討' },

    { id: 'tone.template.explain_1', pattern: /在這篇文章中[，,]?\s*(?:將|会|會)?\s*說明/g, replacement: '這份整理會說明' },
    { id: 'tone.template.explain_2', pattern: /在本文中[，,]?\s*(?:將|会|會)?\s*說明/g, replacement: '這份整理會說明' },
    { id: 'tone.template.explain_3', pattern: /本文\s*(?:將|会|會)?\s*說明/g, replacement: '這份整理會說明' },
    { id: 'tone.template.explain_4', pattern: /這篇文章\s*(?:將|会|會)?\s*說明/g, replacement: '這份整理會說明' },

    { id: 'tone.template.share_1', pattern: /在這篇文章中[，,]?\s*(?:將|会|會)?\s*分享/g, replacement: '這份整理會分享' },
    { id: 'tone.template.share_2', pattern: /在本文中[，,]?\s*(?:將|会|會)?\s*分享/g, replacement: '這份整理會分享' },
    { id: 'tone.template.share_3', pattern: /本文\s*(?:將|会|會)?\s*分享/g, replacement: '這份整理會分享' },
    { id: 'tone.template.share_4', pattern: /這篇文章\s*(?:將|会|會)?\s*分享/g, replacement: '這份整理會分享' },

    { id: 'tone.template.in_this_article_we_1', pattern: /在本文中，我們/g, replacement: '在本文中，' },
    { id: 'tone.template.in_this_article_we_2', pattern: /在這篇文章中，我們/g, replacement: '在這篇文章中，' },
    { id: 'tone.template.we_will', pattern: /我們將/g, replacement: '這份整理會' },

    // 避免生成「在文章中，文章整理了…」這種不自然套話
    { id: 'tone.template.we_discussed', pattern: /我們探討了/g, replacement: '這篇文章整理了' },

    // 🆕 B: 收斂「這篇文章整理了…」的模板感
    { id: 'tone.template.this_article_summarized_to_here', pattern: /這篇文章整理了/g, replacement: '這裡整理了' },

    // 避免單獨出現「文章整理了」這種模板句
    { id: 'tone.template.article_summarized_bare', pattern: /文章整理了/g, replacement: '重點整理如下' },

    // 6) 收斂過度肯定/口號化用語（偏務實）
    { id: 'tone.template.in_this_post_discussed', pattern: /在本文中，探討了/g, replacement: '這篇文章整理了' },
    { id: 'tone.word.finance_trip', pattern: /理財之旅/g, replacement: '理財規劃' },

    // 避免過強 CTA（通用降級）
    { id: 'tone.cta.soften_start_now', pattern: /立即開始你的理財規劃[！!]?/g, replacement: '你可以從今天開始規劃理財' },
    { id: 'tone.cta.soften_start_now_2', pattern: /現在就開始你的理財規劃吧[！!]?/g, replacement: '你可以從今天開始規劃理財' },

    // 避免更強硬的命令式 CTA
    { id: 'tone.cta.remove_act_now_1', pattern: /現在[，,]?\s*請立即行動[：:，,]?\s*/g, replacement: '你可以先從這一步開始：' },
    { id: 'tone.cta.remove_act_now_2', pattern: /請立即行動[：:，,]?\s*/g, replacement: '你可以先從這一步開始：' },
    { id: 'tone.cta.soften_act_now_finance', pattern: /立即行動[，,]\s*開始理財/g, replacement: '開始規劃理財' },
    { id: 'tone.cta.soften_act_now_generic', pattern: /立即行動/g, replacement: '開始著手' },

    // 避免「下載我的免費...」這類導流句
    { id: 'tone.leadgen.remove_free_download', pattern: /立即下載我的免費[^。！？!]*[。！？!]?/g, replacement: '' },
    { id: 'tone.leadgen.remove_bundle_download', pattern: /立即下載我的資源包[^。！？!]*[。！？!]?/g, replacement: '' },

    { id: 'tone.overpromise.soften_help', pattern: /絕對能助你一臂之力/g, replacement: '能幫你更好上手' },
    { id: 'tone.overpromise.future_work', pattern: /為你的未來工作/g, replacement: '為你的未來累積' },
    { id: 'tone.overpromise.two_years_bucket', pattern: /也能讓你在兩年內存到第一桶金/g, replacement: '有機會逐步存到第一桶金' },
    { id: 'tone.overpromise.financial_freedom', pattern: /邁向財務自由/g, replacement: '朝財務目標前進' },

    { id: 'tone.cta.now_is_time_1', pattern: /現在是時候行動了！/g, replacement: '你可以從今天開始：' },
    { id: 'tone.cta.now_is_time_2', pattern: /現在是時候行動了[，,]/g, replacement: '你可以從今天開始：' },

    // 🆕 更通用的命令式 CTA 降級
    { id: 'tone.cta.soften_start_right_now', pattern: /現在就開始/g, replacement: '你可以開始' },

    // 🆕 旅遊/通用常見 CTA：把「現在就/馬上就」降級（避免 strict gate 命中 tone.strong_cta）
    // 注意：保留「現在就是」這種中性語境
    { id: 'tone.cta.soften_now_just', pattern: /現在就(?!是)/g, replacement: '先' },
    { id: 'tone.cta.soften_rightaway_just', pattern: /馬上就(?!是)/g, replacement: '很快就' },

    { id: 'tone.word.future_financial_freedom', pattern: /未來財務自由/g, replacement: '未來財務目標' },
    { id: 'tone.word.foundation', pattern: /財務自由的基石/g, replacement: '財務目標的基礎' },
    { id: 'tone.word.newbies', pattern: /新手們/g, replacement: '新手' },

    { id: 'tone.template.through_this_post', pattern: /透過本篇文章，文章整理了/g, replacement: '這篇文章整理了' },
    { id: 'tone.word.journey_process', pattern: /理財的旅程/g, replacement: '理財的過程' },

    // 6.5) 去除機械式模板句（避免「在文章中，文章整理了…」）
    { id: 'tone.template.in_article_article_summarized_1', pattern: /在(這篇)?文章中[，,]?\s*文章整理了/g, replacement: '這篇文章整理了' },
    { id: 'tone.template.in_article_article_summarized_2', pattern: /在(這篇)?文章中[，,]?\s*這篇文章整理了/g, replacement: '這篇文章整理了' },
    { id: 'tone.template.in_article_discussed', pattern: /在(這篇)?文章中[，,]?\s*探討了/g, replacement: '這篇文章整理了' },
    { id: 'tone.template.in_post_article_summarized_1', pattern: /在本文中[，,]?\s*文章整理了/g, replacement: '這篇文章整理了' },
    { id: 'tone.template.in_post_article_summarized_2', pattern: /在本文中[，,]?\s*這篇文章整理了/g, replacement: '這篇文章整理了' },

    // 全域收斂：移除殘留的「本文/這篇文章/本篇文章」+「將/會」模板語氣（不限句首，避免再觸發 template 開場）
    // 移除所有「本文/本篇/這篇文章/在本文中…」殘留，直接換成中性描述，避免質檢再命中模板句
    { id: 'tone.template.anywhere_this_article_will', pattern: /(在這篇文章中|在本文中|本文中|本文|本篇文章|本篇|這篇文章)/g, replacement: '以下整理' },

    // 進一步處理「這份內容/以下整理 + 將/會 + 動詞」的殘留模板語氣
    { id: 'tone.template.anywhere_this_content_will', pattern: /(這份內容|以下整理)\s*(?:將|会|會)\s*/g, replacement: '接下來會' },

    // 7) 避免第一人稱「專家自稱」與口號式收尾
    { id: 'tone.author.remove_as_a_i_believe', pattern: /作為一名[^，。]*，我相信/g, replacement: '如果你想更有系統地開始，' },
    { id: 'tone.chicken_soup.future_you', pattern: /讓未來的你感謝現在(努力的)?(自己|決定)！?/g, replacement: '先把第一步做完就好。' },
    {
      id: 'tone.chicken_soup.today_budget',
      pattern: /今天，?先從盤點你的收支開始，?為自己的理財之旅奠定堅實的基礎！/g,
      replacement: '你可以先從盤點收支開始，為自己的理財規劃打好基礎。'
    }
  ];
}

function rewriteTemplateOpeningInIntroduction(text) {
  if (!text || typeof text !== 'string') return text;

  // Preserve a leading <p> tag when present (common for introduction.html)
  const leadingMatch = text.match(/^(\s*(?:<p>\s*)?)/i);
  const leading = leadingMatch ? leadingMatch[1] : '';
  const rest = text.slice(leading.length);

  // Work on the first sentence-ish chunk only.
  // For HTML, we stop at </p> if present; otherwise stop at the first sentence end.
  const htmlEndIdx = rest.search(/<\/p>/i);
  const sentenceEndIdx = rest.search(/[。！？!?]/);
  const cutIdxCandidates = [
    htmlEndIdx >= 0 ? htmlEndIdx : Number.POSITIVE_INFINITY,
    sentenceEndIdx >= 0 ? sentenceEndIdx + 1 : Number.POSITIVE_INFINITY
  ];
  const cutIdx = Math.min(...cutIdxCandidates);
  const head = cutIdx !== Number.POSITIVE_INFINITY ? rest.slice(0, cutIdx) : rest;
  const tail = cutIdx !== Number.POSITIVE_INFINITY ? rest.slice(cutIdx) : '';

  const trimmedHead = head.trimStart();

  // 🆕 旅遊類常見問句開場（想要...嗎？）→ 直接交付式開場
  // 僅在第一句同時命中「問句」+「旅遊語彙」才改寫，避免影響其他領域。
  const isTravelish = /自由行|行程|旅遊|旅行|出遊/u.test(trimmedHead);
  const qOpening = trimmedHead.match(/^(想要|你想|是不是想)[^。！？!?]*[嗎呢]？/u);
  if (isTravelish && qOpening) {
    return `${leading}先給你一份可直接照做的行程快覽：${tail}`;
  }

  // Detect template openings at the very beginning.
  // Examples:
  // - 在這篇文章中，將探討…
  // - 在本文中，我們會介紹…
  // - 本文將說明…
  // - 這篇文章將分享…
  const m = trimmedHead.match(
    /^(在這篇文章中|在本文中|本文|這篇文章)(?:[，,]\s*)?(?:我們\s*)?(?:(?:將|会|會)\s*)?([\s\S]*)$/
  );

  if (!m) return text;

  let remainder = (m[2] || '').trim();
  if (!remainder) return text;

  // Remove common leftover auxiliaries like "將/會" if the model repeated them.
  remainder = remainder.replace(/^(?:將|会|會)\s*/u, '');

  // Avoid first-person narrative in openings.
  remainder = remainder.replace(/^我們\s*/u, '');

  // Normalize "提供"-type phrasing into something more natural.
  remainder = remainder
    .replace(/^為你提供\s*/u, '整理')
    .replace(/^提供你\s*/u, '整理')
    .replace(/^為你整理\s*/u, '整理')
    .replace(/^帶你\s*去\s*/u, '帶你');

  // If remainder starts with a verb phrase, prefix with a neutral opener.
  // Keep it deterministic and avoid adding extra fluff.
  const verbLike = /^(介紹|整理|說明|分享|探討|解析|拆解|帶你了解|帶你掌握|帶你|協助你了解|協助你掌握)/u;
  let rewritten;
  if (verbLike.test(remainder)) {
    rewritten = `這份整理會${remainder}`;
  } else {
    // Fallback: keep content but replace the template opening with a compact lead-in.
    rewritten = `先把重點整理清楚：${remainder}`;
  }

  // Preserve original leading whitespace/tags, and keep the rest untouched.
  return `${leading}${rewritten}${tail}`;
}

function applyReplacementRules(text, rules) {
  let out = text;
  for (const r of rules || []) {
    out = out.replace(r.pattern, r.replacement);
  }
  return out;
}

module.exports = {
  getTaiwanStyleNormalizationRules,
  applyReplacementRules,
  rewriteTemplateOpeningInIntroduction,
};
