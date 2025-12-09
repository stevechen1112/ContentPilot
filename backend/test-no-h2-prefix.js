/**
 * 測試移除 H2: 前綴功能
 */

require('dotenv').config();
const OutlineService = require('./src/services/outlineService');
const ArticleService = require('./src/services/articleService');
const fs = require('fs');
const path = require('path');

async function testNoH2Prefix() {
  console.log('========================================');
  console.log('測試移除 H2: 前綴功能');
  console.log('========================================\n');

  const keyword = '腰痛原因';
  
  const authorBio = '擁有 20 年臨床經驗的骨科專科醫師，專注於脊椎與關節疾病的診斷與治療。';
  const authorValues = '核心價值觀：循證醫學、病患安全優先、反對過度醫療、強調預防勝於治療、重視病患教育與溝通。';

  try {
    // Step 1: 生成大綱
    console.log(`📝 步驟 1: 生成文章大綱`);
    const outlineResult = await OutlineService.generateOutline(keyword, {
      author_bio: authorBio,
      author_values: authorValues
    });

    console.log(`✅ 大綱生成成功`);
    console.log(`標題: ${outlineResult.title}\n`);
    
    // 檢查大綱中的標題
    console.log('📋 檢查章節標題格式:');
    outlineResult.sections.forEach((section, idx) => {
      const heading = section.heading || section.title;
      const hasH2Prefix = /^H2[:\s-]/.test(heading);
      console.log(`  ${idx + 1}. ${heading} ${hasH2Prefix ? '❌ 發現H2前綴' : '✅'}`);
      
      if (section.subsections) {
        section.subsections.forEach((sub, subIdx) => {
          const subHeading = typeof sub === 'string' ? sub : (sub.heading || sub.title);
          const hasH3Prefix = /^H3[:\s-]/.test(subHeading);
          console.log(`     ${idx + 1}.${subIdx + 1} ${subHeading} ${hasH3Prefix ? '❌ 發現H3前綴' : '✅'}`);
        });
      }
    });

    // Step 2: 生成完整文章
    console.log(`\n📝 步驟 2: 生成完整文章內容`);
    const articleResult = await ArticleService.generateArticle(outlineResult, {
      provider: 'openai',
      author_bio: authorBio,
      author_values: authorValues,
      tone: '專業但易懂',
      target_audience: '一般民眾'
    });

    console.log(`✅ 文章生成完成\n`);
    
    // 組合完整的 HTML 內容
    let fullHtml = '';
    if (articleResult.content) {
      if (articleResult.content.introduction?.html) {
        fullHtml += articleResult.content.introduction.html + '\n\n';
      }
      
      if (articleResult.content.sections && Array.isArray(articleResult.content.sections)) {
        articleResult.content.sections.forEach(section => {
          if (section.heading) {
            fullHtml += `<h2>${section.heading}</h2>\n`;
          }
          if (section.html) {
            fullHtml += section.html + '\n\n';
          }
        });
      }
      
      if (articleResult.content.conclusion?.html) {
        fullHtml += articleResult.content.conclusion.html;
      }
    }
    
    const plainContent = fullHtml.replace(/<[^>]*>/g, '');
    const wordCount = plainContent.length;
    
    // 檢查是否還有 H2: 或 H3: 前綴
    const h2PrefixPattern = /<h2[^>]*>H2[:：\s-]/gi;
    const h3PrefixPattern = /<h3[^>]*>H3[:：\s-]/gi;
    const h2Prefixes = fullHtml.match(h2PrefixPattern);
    const h3Prefixes = fullHtml.match(h3PrefixPattern);
    
    console.log(`📊 內容檢查`);
    console.log(`總字數: ${wordCount} 字`);
    console.log(`H2前綴數量: ${h2Prefixes ? h2Prefixes.length : 0} 個 ${h2Prefixes ? '❌' : '✅'}`);
    console.log(`H3前綴數量: ${h3Prefixes ? h3Prefixes.length : 0} 個 ${h3Prefixes ? '❌' : '✅'}`);
    
    if (h2Prefixes && h2Prefixes.length > 0) {
      console.log(`\n⚠️ 發現以下H2前綴:`);
      h2Prefixes.forEach(p => console.log(`   ${p}`));
    }
    
    if (h3Prefixes && h3Prefixes.length > 0) {
      console.log(`\n⚠️ 發現以下H3前綴:`);
      h3Prefixes.forEach(p => console.log(`   ${p}`));
    }
    
    if (!h2Prefixes && !h3Prefixes) {
      console.log(`\n✅ 確認：文章中沒有任何 H2: 或 H3: 前綴`);
    }

    // 儲存文章
    const outputDir = path.join(__dirname, 'generated_articles');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `no-h2-prefix-${keyword.replace(/\s+/g, '-')}.html`;
    const filepath = path.join(outputDir, filename);

    const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${articleResult.meta_description || outlineResult.meta_description || ''}">
    <title>${articleResult.title}</title>
    <style>
        body { 
            max-width: 800px; 
            margin: 40px auto; 
            padding: 20px; 
            font-family: 'Microsoft JhengHei', Arial, sans-serif;
            line-height: 1.8;
            color: #333;
        }
        h1 { 
            color: #2c3e50; 
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        h2 { 
            color: #34495e; 
            margin-top: 40px;
            margin-bottom: 20px;
            border-left: 4px solid #3498db;
            padding-left: 15px;
        }
        h3 {
            color: #555;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        p { 
            margin-bottom: 20px; 
            text-align: justify;
        }
        ul, ol {
            margin-bottom: 20px;
            padding-left: 30px;
        }
        li {
            margin-bottom: 10px;
        }
        .meta {
            color: #7f8c8d;
            font-size: 0.9em;
            margin-bottom: 30px;
            padding: 15px;
            background: #ecf0f1;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <h1>${articleResult.title}</h1>
    <div class="meta">
        <p><strong>關鍵字:</strong> ${keyword}</p>
        <p><strong>生成時間:</strong> ${new Date().toLocaleString('zh-TW')}</p>
        <p><strong>AI 模型:</strong> OpenAI gpt-4o-mini</p>
        <p><strong>字數:</strong> ${wordCount} 字</p>
        <p><strong>H2前綴:</strong> ${h2Prefixes ? h2Prefixes.length : 0} 個 ${h2Prefixes ? '❌' : '✅'}</p>
        <p><strong>H3前綴:</strong> ${h3Prefixes ? h3Prefixes.length : 0} 個 ${h3Prefixes ? '❌' : '✅'}</p>
    </div>
    ${fullHtml}
</body>
</html>`;

    fs.writeFileSync(filepath, htmlContent, 'utf8');
    console.log(`\n✅ 文章已儲存: ${filename}`);
    console.log(`📄 檔案大小: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);

    console.log('\n========================================');
    console.log('✅ 測試完成！');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    console.error(error);
  }
}

testNoH2Prefix();
