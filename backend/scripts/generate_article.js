const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const axios = require('axios');

const API_BASE = (String(process.env.API_BASE || '').trim() || 'http://localhost:3000/api');
const OUTPUT_DIR = path.join(__dirname, '..', 'generated_articles');
const RESEARCH_MULTIPLIER = Math.max(1, Math.min(4, Number(process.env.RESEARCH_MULTIPLIER || 1)));

const PLACEHOLDER_PATTERNS = [
  { label: '--keyword', re: /--keyword/gi },
  { label: '{keyword}', re: /\{keyword\}/gi },
  { label: '--brief', re: /--brief/gi },
  { label: '--qualityGate', re: /--qualityGate/gi }
];

function stripPlaceholders(text, keyword = '') {
  if (text === null || text === undefined) return text;
  const safeKw = String(keyword || '').trim();
  let out = String(text);
  out = out.replace(/--keyword/gi, safeKw || '');
  out = out.replace(/\{keyword\}/gi, safeKw || '');
  out = out.replace(/--qualityGate/gi, '');
  out = out.replace(/--brief/gi, '');
  out = out.replace(/\s{2,}/g, ' ').trim();
  return out;
}

function stripQaPrefixes(text) {
  if (!text) return text;
  let out = String(text);
  out = out.replace(/^(第\s*[0-9一二兩三四五六七八九十]+\s*步\s*[：:]\s*)[QqＡａＱｑ]\s*[：:]?\s*/, '$1');
  out = out.replace(/^[QＱAaＡａ]\s*[：:]\s*/, '');
  return out.trim();
}

function scrubArticlePlaceholders(article, keyword) {
  const hits = [];

  const walk = (node, pathParts = []) => {
    if (node === null || node === undefined) return node;

    if (typeof node === 'string') {
      const before = node;
      PLACEHOLDER_PATTERNS.forEach(({ label, re }) => {
        re.lastIndex = 0;
        if (re.test(before)) {
          hits.push({
            path: pathParts.join('.'),
            token: label,
            sample: before.slice(0, 120).replace(/\s+/g, ' ')
          });
        }
      });

      let out = stripPlaceholders(before, keyword);
      const lastKey = pathParts[pathParts.length - 1];
      if (['title', 'heading', 'meta_description', 'metaDescription'].includes(lastKey)) {
        out = stripQaPrefixes(out);
      }
      return out;
    }

    if (Array.isArray(node)) {
      return node.map((item, idx) => walk(item, pathParts.concat(String(idx))));
    }

    if (typeof node === 'object') {
      const outObj = {};
      for (const [k, v] of Object.entries(node)) {
        outObj[k] = walk(v, pathParts.concat(k));
      }
      return outObj;
    }

    return node;
  };

  const cleaned = typeof article === 'object' ? walk(article, []) : article;
  const residual = [];
  const serialized = JSON.stringify(cleaned || {});
  PLACEHOLDER_PATTERNS.forEach(({ label, re }) => {
    re.lastIndex = 0;
    if (re.test(serialized)) residual.push(label);
  });

  return { cleaned, hits, residual };
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--brief') {
      args.briefPath = argv[i + 1];
      i++;
      continue;
    }
    args._.push(token);
  }
  return args;
}

function redactFullContentDeep(obj) {
  const visited = new WeakSet();

  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    for (const k of Object.keys(node)) {
      if (k === 'fullContent') {
        delete node[k];
        continue;
      }
      walk(node[k]);
    }
  };

  walk(obj);
  return obj;
}

function detectDomainFromKeyword(kw) {
  const text = String(kw || '').trim();
  const lower = text.toLowerCase();

  const financeTokens = ['理財', '投資', '股票', 'etf', '基金', '債券', '資產配置', '退休', '保險', '貸款', '信用卡'];
  const healthTokens = ['失眠', '睡眠', '健康', '飲食', '疼痛', '上背痛', '運動', '疾病', '症狀'];
  const travelTokens = [
    '旅遊', '旅行', '自由行', '行程', '行程規劃', '行程安排', '景點', '住宿', '交通', '機票', '飯店',
    '5天4夜', '4天3夜', '3天2夜',
    '東京', '大阪', '京都', '沖繩', '札幌', '福岡', '名古屋'
  ];

  if (financeTokens.some((t) => text.includes(t) || lower.includes(t))) return 'finance';
  if (healthTokens.some((t) => text.includes(t) || lower.includes(t))) return 'health';
  if (travelTokens.some((t) => text.includes(t) || lower.includes(t))) return 'travel';
  return 'general';
}

// Input configuration
// Usage:
//   node backend/scripts/generate_article.js "你的關鍵字"
//   node backend/scripts/generate_article.js "你的關鍵字" --brief backend/scripts/briefs/finance_beginner.json
// Or:
//   set KEYWORD=你的關鍵字; node backend/scripts/generate_article.js
const parsed = parseArgs(process.argv.slice(2));
const rawKeyword = parsed._.join(' ').trim() || String(process.env.KEYWORD || '').trim();
const keyword = rawKeyword.trim();

if (!keyword) {
  console.error('❌ keyword is required. Provide via CLI argument or KEYWORD env.');
  process.exit(1);
}

const domainConfigs = {
  general: {
    tone: '務實、避免空話、聚焦可執行',
    target_audience: '一般讀者，追求可落地的解法',
    author_bio: 'ContentPilot 編輯團隊',
    author_values: '重視可操作步驟與決策依據，避免誇大',
    unique_angle: '先講決策框架，再給可行清單，避免空泛套路',
    expected_outline: '',
    personal_experience: ''
  },
  finance: {
    tone: '務實、不誇大收益、重視風險管理',
    target_audience: '社會新鮮人、25-35歲上班族，月薪3-6萬，想開始理財但不知從何下手',
    author_bio: '認證理財規劃師（CFP），8年財務顧問經驗，專長小資族資產配置',
    author_values: '反對投機炒作、重視長期穩健增值、強調風險分散、拒絕推銷金融商品',
    unique_angle: '從每月3000元開始的理財計畫，不推薦高風險商品，只談實際可執行的分配策略',
    expected_outline: '理財前的心理建設、緊急預備金規劃、基礎投資工具介紹、資產配置原則、常見錯誤避坑',
    personal_experience: '輔導案例：月薪35K上班族，透過532分配法則，2年存到第一桶金50萬'
  },
  travel: {
    tone: '務實、少口號、以「可照做的行程」為主',
    target_audience: '第一次規劃日本自由行的新手；時間有限、希望交通順、少踩雷',
    author_bio: '旅遊內容編輯，重視動線、時間成本與備案設計',
    author_values: '少講形容詞、多交付可直接照做的安排；把假設講清楚、提供備案',
    unique_angle: '先給 Day1～Day5 行程快覽，再解釋為什麼這樣排（區域/交通/人潮/體力）',
    expected_outline: '行程快覽（Day1～Day5）、住宿區域建議、交通票券決策、每日路線與時間分配、雨天/人潮備案、預算拆解',
    personal_experience: '常見踩雷：把景點排太滿、跨區移動太多、沒有雨天備案；本文用「區域打包」與「一日動線」來避免。'
  },
  health: {
    tone: '可靠、中立、少神奇療效，強調安全與循證',
    target_audience: '關注健康管理的一般讀者',
    author_bio: '健康內容編輯，重視可靠來源與安全性提示',
    author_values: '不誇大療效，提供可行且安全的做法，來源透明',
    unique_angle: '用風險—收益—可行性來拆解建議，先安全再效率',
    expected_outline: '',
    personal_experience: ''
  }
};

const briefPath = String(parsed.briefPath || process.env.BRIEF_PATH || '').trim();
let brief = null;
if (briefPath) {
  try {
    const abs = path.isAbsolute(briefPath) ? briefPath : path.join(process.cwd(), briefPath);
    brief = JSON.parse(fs.readFileSync(abs, 'utf8'));
    console.log('Loaded brief:', abs);
  } catch (e) {
    console.warn('⚠️  Failed to load brief JSON, continuing without brief.');
    console.warn('   Message:', e.message);
  }
}

const BRIEF_STRICT = String(process.env.BRIEF_STRICT || '').trim().toLowerCase() === 'true';
const ENABLE_READER_EVALUATION = String(process.env.ENABLE_READER_EVALUATION || '').trim().toLowerCase() === 'true';

const domain = detectDomainFromKeyword(keyword);
const appliedConfig = domainConfigs[domain] || domainConfigs.general;
const mergedConfig = { ...domainConfigs.general, ...appliedConfig };

let {
  tone,
  target_audience,
  author_bio,
  author_values,
  unique_angle,
  expected_outline,
  personal_experience
} = mergedConfig;

// If a brief is provided, prefer brief as the single source of truth.
// Avoid passing conflicting persona fields (e.g., CFP/8-year consultant) that can cause title/content mismatch.
if (brief && typeof brief === 'object') {
  tone = undefined;
  target_audience = undefined;
  author_bio = undefined;
  author_values = undefined;
  unique_angle = undefined;
  expected_outline = undefined;
  personal_experience = undefined;
}

function printQualityReport(report) {
  if (!report) {
    console.log('ℹ️  No quality report returned.');
    return;
  }

  const summary = report.summary || {};
  console.log('--- Quality Report ---');
  console.log('Pass:', report.pass);
  console.log('Rules hit:', summary.total_rules_hit || 0);
  console.log('Errors:', summary.error_rules_hit || 0);
  console.log('Warnings:', summary.warn_rules_hit || 0);
  console.log('Info:', summary.info_rules_hit || 0);

  const findings = Array.isArray(report.findings) ? report.findings : [];
  if (findings.length) {
    console.log('Top findings:');
    findings.slice(0, 5).forEach((f) => {
      console.log(`- [${f.severity}] ${f.rule_id}: ${f.message} (count=${f.total_count})`);
    });
  }
}

function shouldFailByGate(gate, report) {
  if (!report) return false;

  const normalized = String(gate || 'warn').trim().toLowerCase();
  const summary = report.summary || {};
  const warnCount = Number(summary.warn_rules_hit || 0);

  const heuristics = report.heuristics || null;
  const heuristicsErrors = Number(heuristics?.summary?.errors || 0);
  const heuristicsWarnings = Number(heuristics?.summary?.warnings || 0);
  const heuristicsPassed = heuristics?.passed;
  const heuristicsPassedWithWarnings = heuristics?.passedWithWarnings;

  if (normalized === 'fail') {
    if (report.pass === false) return true;
    if (heuristics && (heuristicsPassed === false || heuristicsErrors > 0)) return true;
    return false;
  }

  // Strict: treat errors and certain warnings as failures.
  // We allow passedWithWarnings because soft warnings (e.g., unique_angle_missing) are
  // acceptable as long as heuristics.passed=true and there are no blocking errors/warnings.
  if (normalized === 'strict') {
    if (report.pass === false) return true;
    if (warnCount > 0) return true;

    // Deterministic heuristics: treat errors as failures.
    // passedWithWarnings is acceptable (soft warnings like unique_angle_missing don't block).
    if (heuristics) {
      if (heuristicsErrors > 0) return true;
      // Only fail if heuristics explicitly failed (passed=false and NOT passedWithWarnings).
      if (heuristicsPassed === false && heuristicsPassedWithWarnings !== true) return true;
    }

    // Extra guard: block known blocking patterns (template openings).
    const findings = Array.isArray(report.findings) ? report.findings : [];
    const hasTemplateOpening = findings.some((f) => f?.rule_id === 'tone.template.opening' && Number(f.total_count || 0) > 0);
    return hasTemplateOpening;
  }

  // Default: warn-only (do not fail generation)
  return false;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMetaDescription(article, draft) {
  const raw = (
    draft?.meta_description ||
    draft?.metaDescription ||
    article?.meta_description ||
    article?.metaDescription ||
    ''
  )
    .toString()
    .trim();

  if (raw) return escapeHtml(raw.replace(/\s+/g, ' ').slice(0, 160));

  const title = (draft?.title || article?.title || '').toString().trim();
  const kw = (article?.keywords?.primary || '').toString().trim();
  const fallback = [title, kw ? `重點整理與實作建議（${kw}）` : '重點整理與實作建議']
    .filter(Boolean)
    .join('｜');
  return escapeHtml(fallback.replace(/\s+/g, ' ').slice(0, 160));
}

async function main() {
  try {
    console.log('API_BASE:', API_BASE);

    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Step 1: SERP analysis
    console.log('Step 1: analyze keyword...');
    const serpRes = await axios.post(`${API_BASE}/research/analyze-keyword`, { keyword, research_multiplier: RESEARCH_MULTIPLIER });
    const serp_data = serpRes.data.data;

    // Step 2: generate outline
    console.log('Step 2: generate outline...');
    const outlineRes = await axios.post(`${API_BASE}/articles/generate-outline`, {
      keyword,
      serp_data,
      tone,
      target_audience,
      author_bio,
      author_values,
      unique_angle,
      expected_outline,
      personal_experience,
      brief,
      provider: 'openai',
      brief_strict: BRIEF_STRICT
    });
    const outline = outlineRes.data.data;

    // Step 3: generate full article
    console.log('Step 3: generate full article...');
    const articleRes = await axios.post(`${API_BASE}/articles/generate`, {
      keyword,
      outline,
      serp_data,
      tone,
      target_audience,
      author_bio,
      author_values,
      unique_angle,
      expected_outline,
      personal_experience,
      brief,
      provider: 'openai',
      brief_strict: BRIEF_STRICT,
      enable_reader_evaluation: ENABLE_READER_EVALUATION
    }, { timeout: 240000 });
    let article = articleRes.data.data;

    const scrubResult = scrubArticlePlaceholders(article, keyword);
    article = scrubResult.cleaned;

    if (scrubResult.hits.length) {
      console.log('⚠️  Detected placeholder tokens (scrubbed):');
      scrubResult.hits.slice(0, 8).forEach((h) => {
        console.log(`   - [${h.token}] ${h.path}: ${h.sample}`);
      });
      if (scrubResult.hits.length > 8) {
        console.log(`   ...and ${scrubResult.hits.length - 8} more`);
      }
    }

    const placeholderLeak = scrubResult.residual.length > 0;
    if (placeholderLeak) {
      console.warn('❌ Placeholder tokens remain after scrub:', scrubResult.residual.join(', '));
    }

    // Step 3.1: quality report (optional gating)
    const gate = String(process.env.QUALITY_GATE || 'warn').trim().toLowerCase();
    const report = article.quality_report || article.content_draft?.quality_report || article.content?.quality_report || null;
    printQualityReport(report);
    const gateFailedByReport = shouldFailByGate(gate, report);
    const gateFailed = gateFailedByReport || placeholderLeak;

    // Save JSON to file (even if gate fails, for debugging)
    const safeKeyword = keyword.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, '_').slice(0, 50) || 'article';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffixParts = [];
    if (gateFailedByReport) suffixParts.push(`GATE_FAILED_${gate}`);
    if (placeholderLeak) suffixParts.push('PLACEHOLDER_LEAK');
    const suffix = suffixParts.length ? `_${suffixParts.join('_')}` : '';
    const jsonPath = path.join(OUTPUT_DIR, `${timestamp}_${safeKeyword}${suffix}.json`);
    const redactedArticle = redactFullContentDeep(JSON.parse(JSON.stringify(article)));
    fs.writeFileSync(jsonPath, JSON.stringify(redactedArticle, null, 2), 'utf8');

    console.log('✅ Article generated and saved to:', jsonPath);

    // Generate HTML file
    const htmlPath = path.join(OUTPUT_DIR, `${timestamp}_${safeKeyword}.html`);
    const draft = article.content_draft || article.content;
    const metaDescription = buildMetaDescription(article, draft);
    
    let html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${metaDescription}">
    <title>${draft.title}</title>
    <style>
        body { max-width: 800px; margin: 40px auto; padding: 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.8; color: #333; }
        h1 { font-size: 2em; margin-bottom: 0.5em; color: #2c3e50; }
        h2 { font-size: 1.5em; margin-top: 1.5em; margin-bottom: 0.8em; color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 0.3em; }
        h3 { font-size: 1.2em; margin-top: 1.2em; color: #555; }
        p { margin-bottom: 1em; }
        .introduction, .conclusion { background: #f8f9fa; padding: 20px; border-left: 4px solid #3498db; margin: 20px 0; }
        .section { margin: 30px 0; }
        ol, ul { padding-left: 1.5em; }
        li { margin-bottom: 0.5em; }
        a { color: #3498db; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .article-footer { background: #f9f9f9; padding: 20px; margin-top: 40px; border-radius: 8px; }
        .disclaimer { font-size: 0.9em; color: #666; margin-top: 15px; }
        .meta-box { background: #e8f4f8; padding: 15px; border-radius: 6px; margin-bottom: 25px; border-left: 4px solid #2980b9; color: #555; font-size: 0.95em; }
        .meta-label { font-weight: bold; color: #2980b9; display: block; margin-bottom: 5px; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; }
    </style>
</head>
<body>
    <article>
        <h1>${draft.title}</h1>

        <div class="meta-box">
            <span class="meta-label">SEO Meta Description</span>
            ${metaDescription}
        </div>

`;
    
    if (draft.content && draft.content.introduction && draft.content.introduction.html) {
        html += `        <div class="introduction">\n${draft.content.introduction.html}\n        </div>\n\n`;
    }
    
    if (draft.content && draft.content.sections) {
        draft.content.sections.forEach((section, index) => {
            html += `        <div class="section" id="section-${index + 1}">\n`;
            html += `            <h2>${section.heading}</h2>\n`;
            html += `            ${section.html}\n`;
            html += `        </div>\n\n`;
        });
    }
    
    if (draft.content && draft.content.conclusion && draft.content.conclusion.html) {
        html += `        <div class="conclusion">\n${draft.content.conclusion.html}\n        </div>\n`;
    }
    
    html += `    </article>
</body>
</html>`;
    
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('✅ HTML file generated:', htmlPath);

    if (gateFailed) {
      const reasons = [];
      if (gateFailedByReport) reasons.push(`QUALITY_GATE=${gate}`);
      if (placeholderLeak) reasons.push('placeholder tokens detected');
      throw new Error(`${reasons.join(' + ')} (saved output for inspection)`);
    }
  } catch (error) {
    console.error('❌ Generation failed:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    console.error('Stack:', error.stack);
  }
}

main();
