const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const OUTPUT_DIR = path.join(__dirname, '..', 'generated_articles');

// Input configuration
const keyword = '新手投資理財入門';
const tone = '務實、不誇大收益、重視風險管理';
const target_audience = '社會新鮮人、25-35歲上班族，月薪3-6萬，想開始理財但不知從何下手';
const author_bio = '認證理財規劃師（CFP），8年財務顧問經驗，專長小資族資產配置';
const author_values = '反對投機炒作、重視長期穩健增值、強調風險分散、拒絕推銷金融商品';
const unique_angle = '從每月3000元開始的理財計畫，不推薦高風險商品，只談實際可執行的分配策略';
const expected_outline = '理財前的心理建設、緊急預備金規劃、基礎投資工具介紹、資產配置原則、常見錯誤避坑';
const personal_experience = '輔導案例：月薪35K上班族，透過532分配法則，2年存到第一桶金50萬';

async function main() {
  try {
    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Step 1: SERP analysis
    console.log('Step 1: analyze keyword...');
    const serpRes = await axios.post(`${API_BASE}/research/analyze-keyword`, { keyword });
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
      provider: 'openai'
    });
    const outline = outlineRes.data.data;

    // Step 3: generate full article
    console.log('Step 3: generate full article...');
    const articleRes = await axios.post(`${API_BASE}/articles/generate`, {
      outline,
      serp_data,
      tone,
      target_audience,
      author_bio,
      author_values,
      unique_angle,
      expected_outline,
      personal_experience,
      provider: 'openai'
    }, { timeout: 240000 });
    const article = articleRes.data.data;

    // Save JSON to file
    const safeKeyword = keyword.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, '_').slice(0, 50) || 'article';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(OUTPUT_DIR, `${timestamp}_${safeKeyword}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(article, null, 2), 'utf8');

    console.log('✅ Article generated and saved to:', jsonPath);

    // Generate HTML file
    const htmlPath = path.join(OUTPUT_DIR, `${timestamp}_${safeKeyword}.html`);
    const draft = article.content_draft || article.content;
    
    let html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${article.meta_description || ''}">
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
    </style>
</head>
<body>
    <article>
        <h1>${draft.title}</h1>\n\n`;
    
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
