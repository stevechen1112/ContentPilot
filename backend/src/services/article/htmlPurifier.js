/**
 * htmlPurifier.js
 * HTML 清理與內容安全工具：移除連結、URL、Markdown 代碼塊標記、模板頁尾等。
 * 從 articleService.js 提取（ARCH-01）
 */

'use strict';

/**
 * 移除 HTML 字串中所有 <a> 標籤（保留文字）與裸露 URL。
 * @param {string} html
 * @returns {string}
 */
function stripLinksAndUrls(html) {
  if (!html) return html;
  let out = String(html);
  out = out.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  out = out.replace(/https?:\/\/[^\s"'<>]+/gi, '');
  return out;
}

/**
 * 移除所有 HTML 標籤，回傳純文字。
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * 清理 AI 生成內容中的 Markdown 代碼塊標記（``` ）及 [x] 佔位符。
 * @param {string} content
 * @returns {string}
 */
function cleanMarkdownArtifacts(content) {
  if (!content) return '';

  let cleaned = content.trim();

  // 移除開頭的代碼塊標記
  cleaned = cleaned.replace(/^```html\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');

  // 移除結尾的代碼塊標記
  cleaned = cleaned.replace(/\s*```$/i, '');

  // 移除中間可能出現的代碼塊標記（保留內容）
  cleaned = cleaned.replace(/```html\s*/gi, '');
  cleaned = cleaned.replace(/```\s*/g, '');

  // 替換 [x] 佔位符為 [參考文獻]
  cleaned = cleaned.replace(/\s*\[x\]/g, ' [參考文獻]');

  // 清理重複的參考標記
  cleaned = cleaned.replace(/\[參考文獻\]\s*\[參考文獻\]/g, '[參考文獻]');

  // 清理多餘空白
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * 批次移除整篇文章（introduction/sections/conclusion）中的連結與 URL，
 * 並同步重新計算各區塊的 plain_text。
 * @param {object} article
 * @returns {object}
 */
function sanitizeArticleLinks(article) {
  if (!article?.content) return article;

  const sanitizeBlock = (block) => {
    if (!block) return block;
    const next = { ...block };
    if (next.html) next.html = stripLinksAndUrls(next.html);
    if (next.plain_text) next.plain_text = stripLinksAndUrls(next.plain_text);
    if (next.html) next.plain_text = stripHtml(next.html);
    return next;
  };

  const content = article.content;
  if (content.introduction) content.introduction = sanitizeBlock(content.introduction);
  if (Array.isArray(content.sections)) {
    content.sections = content.sections.map((s) => sanitizeBlock(s));
  }
  if (content.conclusion) content.conclusion = sanitizeBlock(content.conclusion);
  return article;
}

/**
 * 移除文章各區塊結尾的模板頁尾 div 與多餘 <hr>。
 * @param {object} article
 * @returns {object}
 */
function stripTemplateFooters(article) {
  const cleanHtml = (html) => {
    if (!html) return html;
    let out = String(html);
    out = out.replace(/<div class="article-footer"(?![^\"]*authority-ledger)[\s\S]*?<\/div>/gi, '');
    out = out.replace(/<hr\s*\/>\s*$/gi, '').trim();
    return out;
  };

  if (article?.content?.introduction?.html) {
    const html = cleanHtml(article.content.introduction.html);
    article.content.introduction.html = html;
    article.content.introduction.plain_text = stripHtml(html);
  }

  if (Array.isArray(article?.content?.sections)) {
    article.content.sections = article.content.sections.map((s) => {
      if (!s?.html) return s;
      const html = cleanHtml(s.html);
      return { ...s, html, plain_text: stripHtml(html) };
    });
  }

  if (article?.content?.conclusion?.html) {
    const html = cleanHtml(article.content.conclusion.html);
    article.content.conclusion.html = html;
    article.content.conclusion.plain_text = stripHtml(html);
  }

  return article;
}

/**
 * 判斷 HTML 是否含有不受支援的統計數字聲明。
 * @param {string} html
 * @returns {boolean}
 */
function hasUnsupportedStatClaims(html) {
  if (!html) return false;
  const text = stripHtml(String(html));
  return /(根據\s*(?:調查|統計)|超過\s*\d+\s*%|\d+\s*%)/.test(text);
}

/**
 * 判斷 HTML 是否含有書單 / 排行榜等 listacle 類用語。
 * @param {string} html
 * @returns {boolean}
 */
function hasListicleOrBooklistCues(html) {
  if (!html) return false;
  const text = stripHtml(String(html));
  return /(書單|推薦|懶人包|排行榜|必看|必讀|top\s*\d+|\d+\s*本)/i.test(text);
}

module.exports = {
  stripLinksAndUrls,
  stripHtml,
  cleanMarkdownArtifacts,
  sanitizeArticleLinks,
  stripTemplateFooters,
  hasUnsupportedStatClaims,
  hasListicleOrBooklistCues,
};
