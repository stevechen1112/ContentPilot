const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const axios = require('axios');

const API_BASE = (String(process.env.API_BASE || '').trim() || 'http://localhost:3000/api');
const OUTPUT_DIR = path.join(__dirname, '..', 'generated_articles');

async function postJsonWithRetry(url, body, config = {}, options = {}) {
  const {
    retries = 4,
    baseDelayMs = 600,
    retryOnStatuses = [429, 500, 502, 503, 504],
    retryOnCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND']
  } = options;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await axios.post(url, body, config);
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const code = err?.code;
      const shouldRetry =
        (status != null && retryOnStatuses.includes(status)) ||
        (code && retryOnCodes.includes(code));

      if (!shouldRetry || attempt >= retries) break;
      const backoff = Math.min(8000, baseDelayMs * Math.pow(2, attempt)) + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  throw lastErr;
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

function buildPersonaForKeyword(keyword) {
  const domain = detectDomainFromKeyword(keyword);

  let tone = '務實、直接、少空話';
  let target_audience = '一般讀者';
  let author_bio = 'ContentPilot 編輯';
  let author_values = '提供可直接照做的建議，避免誇大與空泛';
  let unique_angle = '把讀者真正卡住的決策點講清楚，給出可執行步驟';
  let expected_outline = '';
  let personal_experience = '';

  if (domain === 'finance') {
    tone = '務實、不誇大收益、重視風險管理';
    target_audience = '社會新鮮人、25-35歲上班族，月薪3-6萬，想開始理財但不知從何下手';
    author_bio = '認證理財規劃師（CFP），8年財務顧問經驗，專長小資族資產配置';
    author_values = '反對投機炒作、重視長期穩健增值、強調風險分散、拒絕推銷金融商品';
    unique_angle = '從每月3000元開始的理財計畫，不推薦高風險商品，只談實際可執行的分配策略';
    expected_outline = '理財前的心理建設、緊急預備金規劃、基礎投資工具介紹、資產配置原則、常見錯誤避坑';
    personal_experience = '輔導案例：月薪35K上班族，透過532分配法則，2年存到第一桶金50萬';
  }

  if (domain === 'travel') {
    tone = '務實、少口號、以「可照做的行程」為主';
    target_audience = '第一次規劃日本自由行的新手；時間有限、希望交通順、少踩雷';
    author_bio = '旅遊內容編輯，重視動線、時間成本與備案設計';
    author_values = '少講形容詞、多交付可直接照做的安排；把假設講清楚、提供備案';
    unique_angle = '先給 Day1～Day5 行程快覽，再解釋為什麼這樣排（區域/交通/人潮/體力）';
    expected_outline = '行程快覽（Day1～Day5）、住宿區域建議、交通票券決策、每日路線與時間分配、雨天/人潮備案、預算拆解';
    personal_experience = '常見踩雷：把景點排太滿、跨區移動太多、沒有雨天備案；本文用「區域打包」與「一日動線」來避免。';
  }

  if (domain === 'health') {
    tone = '務實、非醫療建議、強調可持續的生活調整';
    target_audience = '長期睡不好、白天精神差、想先用生活方式改善的人';
    author_bio = '健康內容編輯，擅長把研究結論轉成可執行的小步驟';
    author_values = '避免誇大療效、提供可追蹤的行為改變策略、尊重專業醫療';
    unique_angle = '用「可追蹤、可迭代」的方式改善睡眠：先找可控因子，再逐週調整';
    expected_outline = '失眠常見原因盤點、睡眠衛生的可做/不可做、白天行為如何影響夜晚、建立可追蹤的睡眠實驗、何時該就醫';
    personal_experience = '';
  }

  return {
    domain,
    tone,
    target_audience,
    author_bio,
    author_values,
    unique_angle,
    expected_outline,
    personal_experience
  };
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

  if (normalized === 'strict') {
    if (report.pass === false) return true;
    if (warnCount > 0) return true;

    if (heuristics) {
      if (heuristicsPassed === false || heuristicsErrors > 0) return true;
      if (heuristicsPassedWithWarnings === true || heuristicsWarnings > 0) return true;
    }

    const findings = Array.isArray(report.findings) ? report.findings : [];
    const hasTemplateOpening = findings.some((f) => f?.rule_id === 'tone.template.opening' && Number(f.total_count || 0) > 0);
    return hasTemplateOpening;
  }

  return false;
}

function safeSlug(keyword) {
  return String(keyword || '')
    .trim()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, '_')
    .slice(0, 50) || 'article';
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

  if (raw) return raw.replace(/\s+/g, ' ').slice(0, 160);

  const title = (draft?.title || article?.title || '').toString().trim();
  const kw = (article?.keywords?.primary || '').toString().trim();
  const fallback = [title, kw ? `重點整理與實作建議（${kw}）` : '重點整理與實作建議']
    .filter(Boolean)
    .join('｜');
  return fallback.replace(/\s+/g, ' ').slice(0, 160);
}

function renderHtmlFromDraft(article) {
  const draft = article?.content_draft || article?.content;
  const metaDescription = buildMetaDescription(article, draft);

  let html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${metaDescription.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}">
    <title>${(draft?.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
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
        .article-footer { background: #f9f9f9; padding: 20px; margin-top: 40px; border-radius: 8px; }
        .disclaimer { font-size: 0.9em; color: #666; margin-top: 15px; }
    </style>
</head>
<body>
    <article>
        <h1>${draft?.title || ''}</h1>\n\n`;

  if (draft?.content?.introduction?.html) {
    html += `        <div class="introduction">\n${draft.content.introduction.html}\n        </div>\n\n`;
  }

  if (Array.isArray(draft?.content?.sections)) {
    draft.content.sections.forEach((section, index) => {
      html += `        <div class="section" id="section-${index + 1}">\n`;
      html += `            <h2>${section.heading || ''}</h2>\n`;
      html += `            ${section.html || ''}\n`;
      html += `        </div>\n\n`;
    });
  }

  if (draft?.content?.conclusion?.html) {
    html += `        <div class="conclusion">\n${draft.content.conclusion.html}\n        </div>\n`;
  }

  html += `    </article>\n</body>\n</html>`;
  return html;
}

function parseTopicsFromArgsOrEnv() {
  const args = process.argv.slice(2).map((s) => String(s || '').trim()).filter(Boolean);
  if (args.length > 0) return args;

  const envList = String(process.env.KEYWORDS || '').trim();
  if (envList) {
    return envList
      .split(/\r?\n|\s*,\s*/)
      .map((s) => String(s || '').trim())
      .filter(Boolean);
  }

  return [
    '東京自由行 5天4夜 行程規劃',
    '新手投資理財入門',
    '失眠 怎麼改善',
    '面試自我介紹 範例與架構',
    'iPhone 備份到電腦 怎麼做'
  ];
}

async function generateOne(keyword, gate, batchId, index) {
  const persona = buildPersonaForKeyword(keyword);

  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = `${batchId}_${String(index + 1).padStart(2, '0')}_${runTimestamp}_${safeSlug(keyword)}`;

  const summary = {
    keyword,
    domain: persona.domain,
    files: {},
    quality: null,
    gate,
    gateFailed: false,
    error: null
  };

  try {
    // Step 1: SERP analysis
    console.log(`\n[${index + 1}] Step 1: analyze keyword... (${keyword})`);
    const serpRes = await postJsonWithRetry(
      `${API_BASE}/research/analyze-keyword`,
      { keyword },
      {},
      { retries: 5, baseDelayMs: 700 }
    );
    const serp_data = serpRes.data.data;

    // Step 2: generate outline
    console.log(`[${index + 1}] Step 2: generate outline...`);
    const outlineRes = await postJsonWithRetry(`${API_BASE}/articles/generate-outline`, {
      keyword,
      serp_data,
      ...persona,
      provider: 'openai'
    }, {}, { retries: 4, baseDelayMs: 700 });
    const outline = outlineRes.data.data;

    // Step 3: generate full article
    console.log(`[${index + 1}] Step 3: generate full article...`);
    const articleRes = await postJsonWithRetry(`${API_BASE}/articles/generate`, {
      outline,
      serp_data,
      ...persona,
      provider: 'openai'
    }, { timeout: 240000 }, { retries: 2, baseDelayMs: 1000 });
    const article = articleRes.data.data;

    const report = article?.quality_report || article?.content_draft?.quality_report || article?.content?.quality_report || null;
    const gateFailed = shouldFailByGate(gate, report);

    summary.quality = report?.summary || null;
    summary.gateFailed = gateFailed;

    // Persist outputs
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const suffix = gateFailed ? `_GATE_FAILED_${gate}` : '';
    const jsonPath = path.join(OUTPUT_DIR, `${prefix}${suffix}.json`);
    const redactedArticle = redactFullContentDeep(JSON.parse(JSON.stringify(article)));
    fs.writeFileSync(jsonPath, JSON.stringify(redactedArticle, null, 2), 'utf8');
    summary.files.json = jsonPath;

    const htmlPath = path.join(OUTPUT_DIR, `${prefix}.html`);
    fs.writeFileSync(htmlPath, renderHtmlFromDraft(article), 'utf8');
    summary.files.html = htmlPath;

    console.log(`[${index + 1}] ✅ saved: ${path.basename(jsonPath)}`);
    if (gateFailed) {
      console.log(`[${index + 1}] ⚠️  QUALITY_GATE=${gate} failed (output kept for inspection)`);
    }
  } catch (error) {
    const status = error?.response?.status;
    const code = error?.code;
    const data = error?.response?.data;
    const dataMessage = (data && typeof data === 'object') ? (data.message || data.error) : undefined;
    const message = (error?.message && String(error.message).trim()) || (dataMessage && String(dataMessage).trim()) || String(error);

    summary.error = {
      message,
      code,
      status,
      data
    };

    console.error(`[${index + 1}] ❌ failed: ${message}`);
    if (code) console.error(`[${index + 1}] code: ${code}`);
    if (status) console.error(`[${index + 1}] status: ${status}`);
    if (data) {
      const preview = (() => {
        try {
          const s = typeof data === 'string' ? data : JSON.stringify(data);
          return s.length > 800 ? `${s.slice(0, 800)}...` : s;
        } catch {
          return '[unserializable response data]';
        }
      })();
      console.error(`[${index + 1}] response: ${preview}`);
    }
  }

  return summary;
}

async function main() {
  const keywords = parseTopicsFromArgsOrEnv();
  const gate = String(process.env.QUALITY_GATE || 'strict').trim().toLowerCase();
  const failFast = String(process.env.FAIL_FAST || '').trim().toLowerCase() === 'true';

  const batchId = new Date().toISOString().replace(/[:.]/g, '-');
  console.log('API_BASE:', API_BASE);
  console.log('QUALITY_GATE:', gate);
  console.log('BATCH_ID:', batchId);
  console.log('KEYWORDS:', keywords);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = [];
  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    const r = await generateOne(kw, gate, batchId, i);
    results.push(r);

    const fatal = r.gateFailed || r.error;
    if (failFast && fatal) break;

    // Small gap to reduce rate-limit spikes when running back-to-back.
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  const summary = {
    batchId,
    apiBase: API_BASE,
    qualityGate: gate,
    ranAt: new Date().toISOString(),
    counts: {
      total: results.length,
      success: results.filter((r) => !r.error && !r.gateFailed).length,
      gateFailed: results.filter((r) => r.gateFailed).length,
      error: results.filter((r) => !!r.error).length
    },
    results
  };

  const summaryPath = path.join(OUTPUT_DIR, `${batchId}_batch_summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('\n=== Batch Summary ===');
  console.log('Saved summary:', summaryPath);
  console.log('Total:', summary.counts.total);
  console.log('Success:', summary.counts.success);
  console.log('Gate failed:', summary.counts.gateFailed);
  console.log('Errors:', summary.counts.error);

  const anyFailures = summary.counts.gateFailed > 0 || summary.counts.error > 0;
  if (anyFailures) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('❌ Batch runner crashed:', err?.message || err);
  process.exitCode = 1;
});
