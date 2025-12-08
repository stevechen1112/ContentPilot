require('dotenv').config();
const ArticleService = require('./src/services/articleService');
const OutlineService = require('./src/services/outlineService');
const SerperService = require('./src/services/serperService');
const fs = require('fs');
const path = require('path');

const TOPICS = [
  '上班族長期失眠怎麼辦？5個科學改善睡眠品質的方法',
  '40歲想轉職學程式設計？零基礎上手的學習路線圖',
  '週末輕旅行指南：台北出發2小時內的低碳親子景點推薦',
  '小型電商如何用 AI 客服省下 70% 人力成本？實戰方案與案例分享',
  '2025年台股定期定額推薦清單：高股息 ETF vs 市值型 ETF 怎麼選？投資策略全解析'
];

async function generateBatch() {
  console.log('🚀 開始批量生成文章...');
  console.log(`📋 共有 ${TOPICS.length} 個主題待處理`);

  // 建立輸出資料夾
  const outputDir = path.join(__dirname, 'generated_articles');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (let i = 0; i < TOPICS.length; i++) {
    const topic = TOPICS[i];
    console.log(`\n[${i + 1}/${TOPICS.length}] 正在處理主題：${topic}`);
    
    try {
      // 1. 獲取 SERP 資料 (S2)
      console.log('  🔍 正在分析搜尋結果 (SERP)...');
      let serpData = null;
      try {
        serpData = await SerperService.search(topic, { num: 10, gl: 'tw', hl: 'zh-TW' });
        console.log(`  ✅ 獲取到 ${serpData.organic?.length || 0} 筆搜尋結果`);
      } catch (err) {
        console.warn('  ⚠️ SERP 分析失敗，將使用純 AI 生成:', err.message);
      }

      // 2. 生成大綱 (S4)
      console.log('  📝 正在生成文章大綱...');
      const outline = await OutlineService.generateOutline(topic, {
        serp_data: serpData,
        target_audience: '一般大眾',
        tone: '專業且實用',
        word_count: 2500,
        provider: 'gemini' // 使用 Gemini 生成大綱
      });
      console.log('  ✅ 大綱生成完成');

      // 3. 生成文章 (S5)
      console.log('  ✍️ 正在撰寫全文 (這可能需要幾分鐘)...');
      const article = await ArticleService.generateArticle(outline, { 
        provider: 'gemini', // 使用 Gemini
        style_guide: { tone: '專業且親切' },
        serp_data: serpData
      });

      // 4. 儲存結果
      const safeTitle = article.title.replace(/[\\/:*?"<>|]/g, '_'); // 檔名安全處理
      const outputPath = path.join(outputDir, `generated-${safeTitle}.html`);
      
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
        ${s.html.replace(/<h2[^>]*>.*?<\/h2>/gi, '') /* 移除 AI 可能重複生成的 H2 */}
      </section>
    `).join('\n')}
  </div>

  <div class="conclusion">
    ${article.content.conclusion.html}
  </div>

  <div class="article-footer">
    <p><strong>關於本文：</strong> 本文由 ContentPilot AI 自動生成，內容經過多重事實查核與 SEO 優化。</p>
    <p>生成時間：${new Date().toLocaleString()}</p>
  </div>

</body>
</html>
      `;

      fs.writeFileSync(outputPath, fullHtml);
      console.log(`  ✅ 文章已儲存至: ${outputPath}`);
      
      // 簡單統計
      const urlCount = (fullHtml.match(/<a href=/g) || []).length;
      console.log(`  📊 包含連結數量: ${urlCount}`);

    } catch (error) {
      console.error(`  ❌ 處理主題 "${topic}" 時發生錯誤:`, error);
    }
    
    // 休息一下，避免 API Rate Limit
    if (i < TOPICS.length - 1) {
      console.log('  ⏳ 等待 5 秒後繼續下一個主題...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n🎉 所有任務執行完畢！');
}

generateBatch();
