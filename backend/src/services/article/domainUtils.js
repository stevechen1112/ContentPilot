/**
 * domainUtils.js
 * 文章領域偵測與來源需求計算工具
 * 從 articleService.js 提取（ARCH-01）
 */

'use strict';

const { validateContentBriefRequiredFields } = require('../contentBrief');

/**
 * 依據主要關鍵字與標題偵測文章領域。
 * @param {object} outline
 * @returns {'finance'|'health'|'travel'|'general'}
 */
function detectDomain(outline) {
  const text = `${outline?.keywords?.primary || ''} ${outline?.title || ''}`;
  const lower = text.toLowerCase();
  const financeTokens = ['理財', '投資', '股票', 'etf', '基金', '債券', '資產配置', '退休', '保險', '貸款', '信用卡'];
  const healthTokens = ['失眠', '睡眠', '健康', '飲食', '疼痛', '上背痛', '運動', '疾病', '症狀'];
  const travelTokens = [
    '旅遊', '旅行', '自由行', '行程', '行程規劃', '行程安排', '景點', '住宿', '交通', '機票', '飯店',
    '5天4夜', '4天3夜', '3天2夜',
    '東京', '大阪', '京都', '沖繩', '札幌', '福岡', '名古屋',
    'jr', 'metro', '地鐵', '新幹線', '一日券'
  ];

  if (financeTokens.some(t => text.includes(t) || lower.includes(t))) return 'finance';
  if (healthTokens.some(t => text.includes(t) || lower.includes(t))) return 'health';
  if (travelTokens.some(t => text.includes(t) || lower.includes(t))) return 'travel';
  return 'general';
}

/**
 * 依域名回傳最低來源數量要求。
 * @param {'finance'|'health'|'travel'|'general'} domain
 * @returns {number}
 */
function minSourcesForDomain(domain) {
  if (domain === 'health') return 2;
  if (domain === 'finance') return 2;
  if (domain === 'travel') return 1;
  return 0;
}

/**
 * 綜合 brief 設定與域名最低要求，計算實際需要的來源數量。
 * @param {object|null} brief
 * @param {string} domain
 * @returns {number}
 */
function computeRequiredSources(brief, domain) {
  const domainMin = minSourcesForDomain(domain);
  const briefRequireSources = brief?.credibility?.requireSources;
  const briefMin = Number.isFinite(Number(brief?.credibility?.minSources))
    ? Number(brief.credibility.minSources)
    : undefined;
  if (briefRequireSources === false) return 0;
  return Math.max(domainMin, briefMin ?? 0);
}

/**
 * 基於 brief 驗證與領域建立 schema 驗證結果。
 * @param {object|null} brief
 * @param {string} keyword
 * @param {string} domain
 * @returns {{ domain: string, passed: boolean, missing: string[] }}
 */
function buildSchemaValidation(brief, keyword, domain) {
  const missing = validateContentBriefRequiredFields(brief || {}, { keyword });
  return { domain, passed: missing.length === 0, missing };
}

/**
 * 構建來源可用性摘要。
 * @param {any[]} verifiedSources
 * @param {number} minRequired
 * @param {string} domain
 */
function buildSourceAvailability(verifiedSources, minRequired, domain) {
  const available = Array.isArray(verifiedSources) ? verifiedSources.length : 0;
  return { domain, required: minRequired, available, passed: available >= minRequired };
}

/**
 * 計算文章段落的來源覆蓋率。
 */
function computeSourceCoverage(article, verifiedSources, domain, minRequired) {
  const sections = Array.isArray(article?.content?.sections) ? article.content.sections : [];
  const available = Array.isArray(verifiedSources) ? verifiedSources.length : 0;
  const coverageCount = Math.min(available, sections.length || available || 0);
  const coverageRatio = sections.length ? coverageCount / sections.length : 1;
  const requiredCoverage = domain === 'health'
    ? Math.min(sections.length || 1, Math.max(minRequired, 2))
    : Math.min(sections.length || 1, Math.max(minRequired, 1));
  const passed = available >= minRequired && coverageCount >= requiredCoverage;
  return { domain, required: minRequired, available, coverageCount, coverageRatio, requiredCoverage, passed };
}

/**
 * 評估文章的行動安全性（是否有行動段落與安全警示）。
 * @param {object} article
 * @param {string} domain
 */
function evaluateActionSafety(article, domain) {
  const { stripHtml } = require('./htmlPurifier');
  const segments = [];
  if (article?.content?.introduction?.html) segments.push(article.content.introduction.html);
  if (Array.isArray(article?.content?.sections)) {
    article.content.sections.forEach((s) => s?.html && segments.push(s.html));
  }
  if (article?.content?.conclusion?.html) segments.push(article.content.conclusion.html);

  const joinedHtml = segments.join('\n');
  const text = stripHtml(joinedHtml);

  const actionHeading = /<h3[^>]*>[^<]{0,40}(行動|步驟|清單|操作|流程|做法|指南)[^<]*<\/h3>/i.test(joinedHtml);
  const actionList = /<(ol|ul)[^>]*>/i.test(joinedHtml);
  const actionKeyword = /(行動|步驟|清單|操作|練習|計畫|流程)/.test(text);
  const action_block = Boolean(actionList && (actionHeading || actionKeyword));

  const safetyHeading = /<h3[^>]*>[^<]{0,40}(風險|安全|禁忌|就醫|注意|副作用|停止|不適)[^<]*<\/h3>/i.test(joinedHtml);
  const safetyKeyword = /(風險|禁忌|就醫|醫師|醫療|安全|停止|不適|副作用)/.test(text);
  const safety_block = domain === 'health' ? Boolean(safetyHeading || safetyKeyword) : true;

  return { domain, action_block, safety_block };
}

/**
 * 依據標題字串偵測文章領域（title-based legacy helper）。
 * @param {string|null} title
 * @returns {'health'|'finance'|'tech'|'education'|'lifestyle'|'general'}
 */
function determineDomain(title) {
  if (!title || typeof title !== 'string') return 'general';
  const healthKeywords = ['健康', '醫療', '睡眠', '失眠', '飲食', '營養', '運動', '疾病', '症狀', '治療'];
  const financeKeywords = ['投資', '理財', '股票', 'ETF', '基金', '保險', '貸款', '儲蓄', '退休', '財務'];
  const techKeywords = ['AI', '人工智慧', '科技', '軟體', '程式', '網路', '雲端', '數據', '演算法'];
  const educationKeywords = ['學習', '教育', '課程', '培訓', '技能', '證照', '轉職', '職涯', '效率'];
  const lifestyleKeywords = ['旅遊', '親子', '生活', '休閒', '美食', '購物', '居家', '寵物'];
  if (healthKeywords.some(kw => title.includes(kw))) return 'health';
  if (financeKeywords.some(kw => title.includes(kw))) return 'finance';
  if (techKeywords.some(kw => title.includes(kw))) return 'tech';
  if (educationKeywords.some(kw => title.includes(kw))) return 'education';
  if (lifestyleKeywords.some(kw => title.includes(kw))) return 'lifestyle';
  return 'general';
}

/**
 * 生成領域感知的 HTML 免責聲明。
 * @param {string} domain
 * @param {any[]} usedSources
 * @returns {string}
 */
function generateDomainAwareDisclaimer(domain, usedSources = [], options = {}) {
  const disclaimers = {
    health: { title: '醫療免責聲明', content: '以下資訊僅供參考，不能替代專業醫療建議、診斷或治療。如有任何健康疑慮，請務必諮詢合格的醫療專業人員。' },
    finance: { title: '投資免責聲明', content: '以下資訊僅供參考，不構成任何投資建議。投資有風險，過去績效不代表未來表現。在進行任何投資決策前，請諮詢合格的財務顧問。' },
    tech: { title: '技術免責聲明', content: '以下技術資訊僅供參考，實際應用時可能因環境差異而有所不同。在實施任何技術方案前，建議諮詢專業技術顧問。' },
    education: { title: '教育免責聲明', content: '以下教育與職涯資訊僅供參考，實際情況可能因個人條件與市場環境而異。建議在做出重大決定前，諮詢專業職涯顧問。' },
    lifestyle: { title: '內容免責聲明', content: '以下生活資訊僅供參考，實際體驗可能因個人喜好與環境而異。文中提及的產品或服務不代表本站推薦或背書。' },
    general: { title: '免責聲明', content: '以下資訊僅供參考，實際情況可能因個人條件與環境而異。在做出任何重大決定前，建議諮詢相關領域的專業人士。' },
  };
  const disclaimer = disclaimers[domain] || disclaimers.general;
  const authorBio = String(options?.authorBio || '').trim();
  const authorValues = String(options?.authorValues || '').trim();
  const keyword = String(options?.keyword || '').trim();
  const safeHost = (url) => { try { return new URL(String(url)).hostname; } catch { return ''; } };
  let sourcesText = '多方公開資料';
  if (Array.isArray(usedSources) && usedSources.length > 0) {
    const hosts = usedSources.map(s => safeHost(s?.url)).filter(Boolean);
    const unique = [...new Set(hosts)].slice(0, 3);
    if (unique.length) sourcesText = `多方公開資料（包含：${unique.join('、')}）`;
  }

  const sourceItems = Array.isArray(usedSources)
    ? usedSources.slice(0, 5).map((source, idx) => {
      const institution = source?.institutionName || source?.publisher || source?.title || '權威機構';
      const topic = source?.title || source?.query || keyword || '相關主題';
      const year = String(source?.publishedAt || '').match(/\d{4}/)?.[0] || '';
      return `<li>${idx + 1}. <strong>${institution}</strong>${year ? `（${year}）` : ''}：${String(topic).slice(0, 80)}</li>`;
    })
    : [];

  const authorBlock = authorBio
    ? `
        <h4>作者與審校資訊</h4>
        <p><strong>${authorBio}</strong></p>
        ${authorValues ? `<p>內容原則：${authorValues}</p>` : ''}
      `
    : `
        <h4>作者與審校資訊</h4>
        <p><strong>ContentPilot 編輯團隊</strong></p>
        <p>內容由編輯流程與一致性規則審校後發布。</p>
      `;

  const ledgerBlock = sourceItems.length > 0
    ? `
        <h4>來源依據（機構與主題對照）</h4>
        <ul>
          ${sourceItems.join('')}
        </ul>
      `
    : `
        <h4>來源依據</h4>
        <p>本文未引用可公開列示的機構來源，建議讀者交叉查證後再採納。</p>
      `;

  return `
      <hr />
      <div class="article-footer" style="background-color: #f9f9f9; padding: 20px; margin-top: 30px; border-radius: 8px;">
        ${authorBlock}
        <p>我們致力於提供經過整理與一致性檢查的內容。這裡的整理參考${sourcesText}，旨在為讀者提供實用且可靠的資訊。</p>
        ${ledgerBlock}
        <div class="disclaimer" style="font-size: 0.9em; color: #666; margin-top: 15px;">
          <strong>${disclaimer.title}：</strong>${disclaimer.content}
        </div>
      </div>
    `;
}

module.exports = {
  detectDomain,
  minSourcesForDomain,
  computeRequiredSources,
  buildSchemaValidation,
  buildSourceAvailability,
  computeSourceCoverage,
  evaluateActionSafety,
  determineDomain,
  generateDomainAwareDisclaimer,
};
