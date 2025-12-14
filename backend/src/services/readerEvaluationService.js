const fs = require('fs');
const path = require('path');
const AIService = require('./aiService');

let cachedPromptTemplate = null;

function extractPromptBodyFromMarkdown(md) {
  const text = String(md || '');

  // Prefer splitting at the documented header.
  const marker = '## Prompt（直接貼給模型）';
  const idx = text.indexOf(marker);
  const tail = idx >= 0 ? text.slice(idx + marker.length) : text;

  // Drop leading newlines/spaces.
  const trimmed = tail.replace(/^\s+/, '');

  // Heuristic: prompt starts at the first "你是一位".
  const startIdx = trimmed.indexOf('你是一位');
  if (startIdx >= 0) return trimmed.slice(startIdx).trim();

  // Fallback: return the trimmed tail.
  return trimmed.trim();
}

function loadPromptTemplate() {
  if (cachedPromptTemplate) return cachedPromptTemplate;

  const mdPath = path.join(__dirname, '..', '..', 'docs', 'CONTENT_EVALUATION_PROMPT.md');
  const md = fs.readFileSync(mdPath, 'utf8');
  cachedPromptTemplate = extractPromptBodyFromMarkdown(md);
  return cachedPromptTemplate;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAuthorProfile(brief) {
  if (!brief || typeof brief !== 'object') return '';
  const author = brief.author || {};
  const parts = [];
  if (author.identity) parts.push(`作者身分：${author.identity}`);
  if (Array.isArray(author.values) && author.values.length) parts.push(`價值觀：${author.values.join('、')}`);
  if (author.tone) parts.push(`口吻：${author.tone}`);
  return parts.join('；');
}

function parseEvaluationScores(raw) {
  const text = String(raw || '');
  const getScore = (label) => {
    const re = new RegExp(`${label}：\s*(\d{1,3})\s*\/\s*25`);
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };

  const totalRe = /總分：\s*(\d{1,3})\s*\/\s*100/;
  const totalM = text.match(totalRe);

  const recommendRe = /只回答：\s*(會|不會)/;
  const recommendM = text.match(recommendRe);

  return {
    structure_logic: getScore('結構與邏輯'),
    persuasiveness: getScore('說服力'),
    seo: getScore('SEO 友善度'),
    readability: getScore('文風與可讀性'),
    total: totalM ? Number(totalM[1]) : null,
    recommend: recommendM ? recommendM[1] : null
  };
}

class ReaderEvaluationService {
  /**
   * Run the documented reader-evaluation prompt and return raw + parsed results.
   */
  static async evaluateArticle({ keyword, ta, brief, title, contentHtml, provider }) {
    const promptTemplate = loadPromptTemplate();

    const safeKeyword = String(keyword || '').trim();
    const safeTa = String(ta || '').trim();
    const authorProfile = buildAuthorProfile(brief);
    const safeTitle = String(title || '').trim();

    // Send plain text to keep token usage reasonable.
    const content = stripHtml(contentHtml);

    const prompt = promptTemplate
      .replaceAll('{keyword}', safeKeyword)
      .replaceAll('{ta}', safeTa)
      .replaceAll('{author_profile}', authorProfile)
      .replaceAll('{title}', safeTitle)
      .replaceAll('{content}', content);

    const result = await AIService.generate(prompt, {
      provider: provider || process.env.AI_PROVIDER || 'openai',
      // We want a stable rubric output.
      temperature: 0.2,
      max_tokens: 2500
    });

    const raw = result?.content || '';

    return {
      raw,
      parsed: parseEvaluationScores(raw),
      model: result?.model,
      usage: result?.usage,
      generated_at: new Date().toISOString()
    };
  }
}

module.exports = ReaderEvaluationService;
