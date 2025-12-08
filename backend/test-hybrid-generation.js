require('dotenv').config();
const ArticleService = require('./src/services/articleService');
const OutlineService = require('./src/services/outlineService');
const SerperService = require('./src/services/serperService');
const fs = require('fs');
const path = require('path');

const TOPIC = '2025年台股定期定額推薦清單：高股息ETF與市值型ETF的選擇指南';

async function generateSingleArticle() {
  console.log(`🚀 開始測試 Hybrid 模式生成文章...`);
  console.log(`📌 主題：${TOPIC}`);

  const outputDir = path.join(__dirname, 'generated_articles');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // 1. SERP
    console.log('  🔍 正在分析搜尋結果 (SERP)...');
    let serpData = null;
    try {
      serpData = await SerperService.search(TOPIC, { num: 10, gl: 'tw', hl: 'zh-TW' });
      console.log(`  ✅ 獲取到 ${serpData.organic?.length || 0} 筆搜尋結果`);
    } catch (err) {
      console.warn('  ⚠️ SERP 分析失敗，將使用純 AI 生成:', err.message);
    }

    // 2. Outline (Hybrid -> Gemini)
    console.log('  📝 正在生成文章大綱 (Hybrid Mode: Gemini)...');
    const outline = await OutlineService.generateOutline(TOPIC, {
      serp_data: serpData,
      target_audience: '投資新手與小資族',
      tone: '專業且客觀',
      word_count: 2500,
      provider: 'hybrid'
    });
    console.log('  ✅ 大綱生成完成');
    console.log('  📊 大綱結構預覽:', JSON.stringify(outline.sections.map(s => s.heading), null, 2));

    // 3. Article (Hybrid -> Gemini for Intro/Concl, Ollama for Body)
    console.log('  ✍️ 正在撰寫全文 (Hybrid Mode: Gemini + Ollama)...');
    const article = await ArticleService.generateArticle(outline, { 
      provider: 'hybrid',
      style_guide: { tone: '專業且親切' },
      serp_data: serpData
    });

    // 4. Save
    const safeTitle = article.title.replace(/[\\/:*?"<>|]/g, '_');
    const outputPath = path.join(outputDir, `hybrid-test-${safeTitle}.html`);
    
    const fullHtml = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>${article.title}</title>
<meta name="description" content="${article.meta_description}">
<style>
  body { font-family: "Microsoft JhengHei", sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
  h2 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 30px; }
  h3 { color: #34495e; margin-top: 20px; }
  a { color: #3498db; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .citation { font-size: 0.8em; vertical-align: super; color: #7f8c8d; }
  .article-footer { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-top: 40px; }
  .introduction { font-size: 1.1em; color: #555; margin-bottom: 30px; }
  ul, ol { margin-bottom: 20px; }
  li { margin-bottom: 10px; }
</style>
</head>
<body>
  <h1>${article.title}</h1>
  
  <div class="introduction">
    ${article.content.introduction.html}
  </div>

  <div class="sections">
    ${article.content.sections.map((s, index) => `
      <section id="section-${index + 1}">
        <h2>${s.heading}</h2>
        ${s.html.replace(/<h2[^>]*>.*?<\/h2>/gi, '')}
      </section>
    `).join('\n')}
  </div>

  <div class="conclusion">
    <h2>總結</h2>
    ${article.content.conclusion.html}
  </div>

  <div class="article-footer">
    <p><strong>字數統計：</strong> ${article.metadata.word_count} 字</p>
    <p><strong>生成時間：</strong> ${article.metadata.generated_at}</p>
    <p><strong>生成模式：</strong> Hybrid (Gemini + Ollama)</p>
  </div>
</body>
</html>`;

    fs.writeFileSync(outputPath, fullHtml);
    console.log(`\n✅ 文章已生成並儲存至：${outputPath}`);

  } catch (error) {
    console.error('❌ 生成失敗:', error);
  }
}

generateSingleArticle();
