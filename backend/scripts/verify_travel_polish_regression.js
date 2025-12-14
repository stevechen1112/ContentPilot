const ArticleService = require('../src/services/articleService');
const ContentQualityReportService = require('../src/services/contentQualityReportService');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mustNotInclude(text, forbidden, label) {
  const s = String(text || '');
  for (const f of forbidden) {
    if (s.includes(f)) {
      throw new Error(`${label} still contains forbidden token: ${f} | value=${JSON.stringify(s)}`);
    }
  }
}

function main() {
  console.log('=== Verify travel polish regression ===');

  // 1) meta_description sanitization: no strong CTA, no lead-gen/download, no trailing "開始規劃"
  const metaSamples = [
    {
      in: '立即下載行程規劃表，開始規劃！',
      forbidden: ['立即', '下載', '行程表下載', '開始規劃', '開始計畫', '開始安排行程', '！']
    },
    {
      in: '快來查看東京自由行 5天4夜行程，馬上出發！',
      forbidden: ['快來', '馬上', '！']
    },
    {
      in: '東京自由行 5天4夜｜行程快覽、交通票券與住宿區域整理，可直接參考',
      forbidden: ['下載']
    }
  ];

  for (const s of metaSamples) {
    const out = ArticleService.sanitizeMetaDescription(s.in, {
      contentDomain: 'travel',
      keyword: '東京自由行 5天4夜 行程規劃'
    });

    assert(typeof out === 'string' && out.trim().length > 0, `sanitizeMetaDescription should return non-empty string for: ${s.in}`);
    mustNotInclude(out, s.forbidden, 'meta_description');
  }

  console.log('✅ meta_description sanitization ok');

  // 2) quality report: travel should flag finance-residue phrases
  const travelWithFinanceResidue = {
    title: '東京自由行 5天4夜行程規劃',
    meta_description: '整理行程快覽與交通重點。',
    content: {
      introduction: { html: '<p>先給你一份可直接照做的行程快覽。</p>', plain_text: '先給你一份可直接照做的行程快覽。' },
      sections: [
        { heading: 'Day 1', html: '<p>Day 1 ...</p>', plain_text: 'Day 1 ...' },
        { heading: 'Day 2', html: '<p>Day 2 ...</p>', plain_text: 'Day 2 ...' },
        { heading: 'Day 3', html: '<p>Day 3 ...</p>', plain_text: 'Day 3 ...' }
      ],
      conclusion: {
        html: '<p>最後做一次收支盤點，再決定預算。</p>',
        plain_text: '最後做一次收支盤點，再決定預算。'
      }
    }
  };

  const reportBad = ContentQualityReportService.generateReport(travelWithFinanceResidue, { domain: 'travel' });
  const hit = (reportBad.findings || []).find((f) => f.rule_id === 'travel.avoid_finance_residue');
  assert(hit && hit.total_count > 0, 'Expected travel.avoid_finance_residue to be reported for finance residue in travel content');

  const travelClean = JSON.parse(JSON.stringify(travelWithFinanceResidue));
  travelClean.content.conclusion.html = '<p>最後把住宿區域定下來，Day1～Day5 依區域打包，行程就會順很多。</p>';
  travelClean.content.conclusion.plain_text = '最後把住宿區域定下來，Day1～Day5 依區域打包，行程就會順很多。';

  const reportOk = ContentQualityReportService.generateReport(travelClean, { domain: 'travel' });
  const hitOk = (reportOk.findings || []).find((f) => f.rule_id === 'travel.avoid_finance_residue');
  assert(!hitOk, 'Did not expect travel.avoid_finance_residue for clean travel content');

  console.log('✅ travel finance-residue rule ok');

  console.log('✅ All travel polish regression checks passed.');
}

try {
  main();
} catch (e) {
  console.error('❌ Verification failed:', e.message);
  process.exitCode = 1;
}
