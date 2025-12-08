require('dotenv').config();
const ArticleService = require('./src/services/articleService');
const fs = require('fs');
const path = require('path');

async function generate() {
  const topic = '2025年新手如何開始投資美股';
  console.log(`🚀 開始生成文章：${topic}`);
  console.log('⏳ 這可能需要幾分鐘...');

  const outline = {
    title: topic,
    keywords: { primary: '美股投資', secondary: ['ETF', '開戶', '手續費'] },
    introduction: { 
      structure: '介紹美股市場優勢，為什麼2025年適合進場，以及新手常見的擔憂。' 
    },
    sections: [
      { 
        heading: '第一步：選擇適合的美股券商', 
        description: '比較複委託與海外券商（Firstrade, IB, Schwab）的優缺點。',
        key_points: ['手續費比較', '開戶難易度', '資金安全保障'],
        estimated_words: 400
      },
      { 
        heading: '第二步：新手必備的投資工具', 
        description: '介紹 ETF 與個股的差異，推薦適合新手的標的。',
        key_points: ['指數型 ETF (VOO, QQQ)', '定期定額策略', '風險分散'],
        estimated_words: 400
      },
      { 
        heading: '第三步：稅務與匯款須知', 
        description: '解釋股息稅（30%）與匯款成本。',
        key_points: ['W-8BEN 表格', '海外匯款流程', '股息再投入'],
        estimated_words: 300
      }
    ],
    conclusion: { 
      structure: '總結投資美股的長期價值，鼓勵讀者跨出第一步。' 
    }
  };

  try {
    const article = await ArticleService.generateArticle(outline, { 
      provider: 'gemini',
      style_guide: { tone: '專業且鼓勵人心' }
    });

    // 建立輸出資料夾
    const outputDir = path.join(__dirname, 'generated_articles');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `generated-${topic}.html`);
    
    // 組合完整 HTML
    const fullHtml = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>${article.title}</title>
<meta name="description" content="${article.meta_description}">
<style>
  body { font-family: "Microsoft JhengHei", sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
  h2 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
  h3 { color: #34495e; }
  a { color: #3498db; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .citation { font-size: 0.8em; vertical-align: super; }
  .article-footer { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-top: 40px; }
</style>
</head>
<body>
  <h1>${article.title}</h1>
  
  <div class="introduction">
    ${article.content.introduction.html}
  </div>

  <div class="sections">
    ${article.content.sections.map(s => `
      <section id="section-${article.content.sections.indexOf(s) + 1}">
        <h2>${s.heading}</h2>
        ${s.html.replace(/<h2[^>]*>.*?<\/h2>/gi, '') /* 移除 AI 可能重複生成的 H2 */}
      </section>
    `).join('\n')}
  </div>

  <div class="conclusion">
    ${article.content.conclusion.html}
  </div>

</body>
</html>
    `;

    fs.writeFileSync(outputPath, fullHtml);
    console.log(`\n✅ 文章已生成並儲存至: ${outputPath}`);
    
    // 簡單驗證
    const urlCount = (fullHtml.match(/<a href=/g) || []).length;
    console.log(`📊 包含連結數量: ${urlCount}`);

    // 提取並列出所有引用的網域，以驗證多元性
    const urlMatches = fullHtml.match(/href="([^"]+)"/g);
    if (urlMatches) {
      console.log('\n🔍 引用來源網域分析:');
      const domains = urlMatches.map(match => {
        const url = match.replace('href="', '').replace('"', '');
        try {
          return new URL(url).hostname;
        } catch { return 'invalid-url'; }
      });
      
      const domainCounts = {};
      domains.forEach(d => domainCounts[d] = (domainCounts[d] || 0) + 1);
      
      Object.entries(domainCounts).forEach(([domain, count]) => {
        console.log(`   - ${domain}: ${count} 次`);
      });
    }
    
  } catch (error) {
    console.error('❌ 生成失敗:', error);
  }
}

generate();
