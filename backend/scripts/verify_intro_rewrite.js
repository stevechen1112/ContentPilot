const ContentFilterService = require('../src/services/contentFilterService');
const ContentQualityReportService = require('../src/services/contentQualityReportService');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkNoTemplateOpening(text) {
  const forbidden = ['在這篇文章中', '在本文中', '本文將', '這篇文章將', '在文章中', '將介紹'];
  for (const f of forbidden) {
    if (String(text || '').includes(f)) return { ok: false, hit: f };
  }
  return { ok: true };
}

async function main() {
  const samples = [
    {
      topic: '健康｜睡眠品質',
      html: '<p>很多人白天精神不濟。在這篇文章中，將說明提升睡眠品質的三個做法。</p>'
    },
    {
      topic: '旅遊｜東京自由行',
      html: '<p>第一次去東京很容易被行程搞到很累。在本文中，我們會介紹 5 天 4 夜的安排思路。</p>'
    },
    {
      topic: '職涯｜轉職履歷',
      html: '<p>履歷不是堆技能清單而已。本文將分享一個讓 HR 更快看懂你的寫法。</p>'
    },
    {
      topic: '理財｜ETF',
      html: '<p>如果你想用更省心的方式開始投資，這篇文章將探討 ETF 入門要先懂哪些風險。</p>'
    },
    {
      topic: '家庭｜親子溝通',
      html: '<p>吵架不一定是壞事，重點是怎麼收尾。在這篇文章中，將探討親子衝突後的三步修復。</p>'
    }
  ];

  console.log('=== Verify intro template-opening rewrite (B) ===');

  for (const s of samples) {
    const outHtml = ContentFilterService.normalizeTaiwanStyle(s.html, { scope: 'introduction' });
    const outText = outHtml.replace(/<[^>]+>/g, '');

    const htmlCheck = checkNoTemplateOpening(outHtml);
    const textCheck = checkNoTemplateOpening(outText);

    console.log('---');
    console.log('Topic:', s.topic);
    console.log('IN :', s.html);
    console.log('OUT:', outHtml);

    assert(htmlCheck.ok, `Template opening still present in HTML (${htmlCheck.hit}) for topic: ${s.topic}`);
    assert(textCheck.ok, `Template opening still present in text (${textCheck.hit}) for topic: ${s.topic}`);

    const article = {
      title: '測試文章',
      meta_description: '測試用 meta',
      content: {
        introduction: {
          html: outHtml,
          plain_text: outText
        },
        sections: [],
        conclusion: { html: '<p>結尾。</p>', plain_text: '結尾。' }
      }
    };

    const report = ContentQualityReportService.generateReport(article, { domain: 'general' });
    const opening = (report.findings || []).find((f) => f.rule_id === 'tone.template.opening');
    const count = opening ? opening.total_count : 0;

    assert(count === 0, `Quality report still hits tone.template.opening (count=${count}) for topic: ${s.topic}`);
  }

  console.log('✅ All topics passed: intro template openings are rewritten and not reported.');
}

main().catch((e) => {
  console.error('❌ Verification failed:', e.message);
  process.exitCode = 1;
});
