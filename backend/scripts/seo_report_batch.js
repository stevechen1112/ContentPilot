/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { batch: null, latest: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--batch') {
      args.batch = argv[i + 1];
      i += 1;
    } else if (a === '--latest') {
      args.latest = true;
    }
  }
  return args;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text, keyword) {
  const t = String(text || '');
  const k = String(keyword || '').trim();
  if (!t || !k) return 0;
  const re = new RegExp(escapeRegExp(k), 'g');
  const m = t.match(re);
  return m ? m.length : 0;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function clamp0_100(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function findLatestBatchSummary(generatedDir) {
  const files = fs.readdirSync(generatedDir)
    .filter((f) => f.endsWith('_batch_summary.json'))
    .sort();
  if (files.length === 0) return null;
  return path.join(generatedDir, files[files.length - 1]);
}

function computeSeoFromHtml(html, keyword) {
  const text = stripHtml(html);
  const textNoWs = text.replace(/\s+/g, '');
  const wordCount = textNoWs.length;
  const kw = String(keyword || '').trim();
  const kwCount = countOccurrences(textNoWs, kw);
  const kwDensity = wordCount > 0 ? ((kwCount * kw.length) / wordCount) * 100 : 0;

  const h2Count = (String(html || '').match(/<h2\b/gi) || []).length;
  const h3Count = (String(html || '').match(/<h3\b/gi) || []).length;
  const externalLinks = (String(html || '').match(/<a\s+[^>]*href="https?:\/\//gi) || []).length;

  const internalLinks = (String(html || '').match(/<a\s+[^>]*href="(?!https?:\/\/)[^"]+/gi) || []).length;

  return {
    word_count: wordCount,
    keyword_count: kwCount,
    keyword_density: round1(kwDensity),
    h2_count: h2Count,
    h3_count: h3Count,
    external_links: externalLinks,
    internal_links: internalLinks
  };
}

function scoreSeo(metrics) {
  // Align with QualityService.checkSEO thresholds:
  // - keyword_density: <0.8% low, >2.5% high
  // - word_count >= 1500
  // - h2_count >= 3
  // - external_links >= 3
  let score = 100;
  const issues = [];
  const warnings = [];

  if (metrics.keyword_density < 0.8) {
    score -= 10;
    issues.push(`keyword_density_low(${metrics.keyword_density}%)`);
  } else if (metrics.keyword_density > 2.5) {
    score -= 20;
    issues.push(`keyword_density_high(${metrics.keyword_density}%)`);
  }

  if (metrics.word_count < 1500) {
    score -= 20;
    issues.push(`word_count_low(${metrics.word_count})`);
  }

  if (metrics.h2_count < 3) {
    score -= 10;
    issues.push(`h2_low(${metrics.h2_count})`);
  }

  if (metrics.external_links < 3) {
    score -= 10;
    issues.push(`external_links_low(${metrics.external_links})`);
  }

  if (metrics.internal_links < 1) {
    warnings.push('internal_links_missing');
  }

  const finalScore = clamp0_100(score);
  return { score: finalScore, passed: finalScore >= 70, issues, warnings };
}

function pickArticleTitle(article) {
  return article?.title || article?.content?.title || article?.content_draft?.title || '';
}

function pickMetaDescription(article) {
  return article?.meta_description || article?.content?.meta_description || article?.content_draft?.meta_description || '';
}

function main() {
  const args = parseArgs(process.argv);
  const generatedDir = path.resolve(__dirname, '..', 'generated_articles');

  let summaryPath = null;
  if (args.batch) {
    summaryPath = path.isAbsolute(args.batch) ? args.batch : path.resolve(process.cwd(), args.batch);
  } else {
    summaryPath = findLatestBatchSummary(generatedDir);
  }

  if (!summaryPath || !fs.existsSync(summaryPath)) {
    console.error('❌ 找不到 batch summary。請用：node backend/scripts/seo_report_batch.js --batch <path> 或 --latest');
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const rows = [];
  const checkTotals = { total: 0, passed: 0 };

  for (const r of (summary.results || [])) {
    const jsonPath = r?.files?.json;
    const htmlPath = r?.files?.html;
    const keyword = r?.keyword || '';

    const article = jsonPath && fs.existsSync(jsonPath)
      ? JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      : {};

    const html = htmlPath && fs.existsSync(htmlPath)
      ? fs.readFileSync(htmlPath, 'utf8')
      : '';

    const title = pickArticleTitle(article);
    const meta = pickMetaDescription(article);

    const metrics = computeSeoFromHtml(html, keyword);
    const seo = scoreSeo(metrics);

    const titleHasKeyword = String(title).includes(String(keyword));
    const metaHasKeyword = String(meta).includes(String(keyword));

    // Compliance percent is based on these 4 hard checks + 2 presence checks.
    const checks = [
      metrics.keyword_density >= 0.8 && metrics.keyword_density <= 2.5,
      metrics.word_count >= 1500,
      metrics.h2_count >= 3,
      metrics.external_links >= 3,
      titleHasKeyword,
      metaHasKeyword
    ];
    const passedChecks = checks.filter(Boolean).length;
    checkTotals.total += checks.length;
    checkTotals.passed += passedChecks;

    const strictPass = article?.quality_report?.pass === true && r?.gateFailed !== true;
    const heuristicKw = article?.quality_report?.heuristics?.checks?.keywordDensity;

    rows.push({
      keyword,
      gate: r?.gateFailed ? 'FAIL' : 'PASS',
      strict_pass: strictPass ? 'Y' : 'N',
      seo_score: seo.score,
      seo_pass: seo.passed ? 'Y' : 'N',
      compliance_pct: `${Math.round((passedChecks / checks.length) * 100)}%`,
      kw_density: `${metrics.keyword_density}%`,
      kw_count: metrics.keyword_count,
      word_count: metrics.word_count,
      h2: metrics.h2_count,
      h3: metrics.h3_count,
      ext: metrics.external_links,
      int: metrics.internal_links,
      title_kw: titleHasKeyword ? 'Y' : 'N',
      meta_kw: metaHasKeyword ? 'Y' : 'N',
      heuristic_kw_density: heuristicKw?.density ? `${heuristicKw.density}%` : ''
    });
  }

  console.log(`\nBatch: ${summaryPath}`);
  console.table(rows);
  const overallPct = checkTotals.total > 0 ? Math.round((checkTotals.passed / checkTotals.total) * 100) : 0;
  console.log(`Overall SEO compliance (6 checks avg): ${overallPct}%`);
}

main();
