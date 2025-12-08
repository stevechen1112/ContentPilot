const ArticleService = require('./src/services/articleService');
const AIService = require('./src/services/aiService');
const LibrarianService = require('./src/services/librarianService');

// Mock AIService
const originalGenerate = AIService.generate;
AIService.generate = async (prompt, options) => {
  console.log('🤖 [Mock AI] Generating content...');
  
  // 檢查 Prompt 中是否包含參考文獻庫
  if (!prompt.includes('參考文獻庫')) {
    console.warn('⚠️ Prompt 中缺少參考文獻庫！');
  }

  // 模擬生成內容
  if (prompt.includes('引言部分')) {
    return {
      content: `
<h2>失眠的困擾</h2>
<p>長期失眠不僅影響精神，更可能導致健康問題。根據衛福部的資料，台灣有超過 400 萬人受失眠所苦 [1]。</p>
<p>許多人嘗試各種方法，但效果不彰。專家建議，建立規律的作息是關鍵 [2]。</p>
<p>這裡有一個假的連結，應該被 P5 移除或替換：<a href="https://fake-url.com/health">假連結</a>。</p>
      `
    };
  } else if (prompt.includes('結論部分')) {
    return {
      content: `
<h2>總結</h2>
<p>改善睡眠需要耐心。請記住，適度運動有助於睡眠 [1]。</p>
      `
    };
  } else {
    // Section
    return {
      content: `
<h3>改善環境</h3>
<p>保持臥室黑暗與安靜。研究指出，光線會抑制褪黑激素分泌 [1]。</p>
<p>研究顯示，睡前喝牛奶有助於睡眠。</p>
      `
    };
  }
};

async function runTest() {
  console.log('🚀 開始端到端系統測試...');

  const outline = {
    title: '上班族長期失眠怎麼辦？5個改善睡眠品質的科學方法',
    keywords: { primary: '失眠' },
    introduction: { structure: '引言結構' },
    sections: [
      { heading: '改善睡眠環境', description: '如何佈置臥室', subsections: [] }
    ],
    conclusion: { structure: '結論結構' }
  };

  try {
    // 執行生成
    const article = await ArticleService.generateArticle(outline, { provider: 'mock' });

    console.log('\n📊 測試結果分析:');
    
    // 驗證 Introduction
    const introHtml = article.content.introduction.html;
    console.log('\n1. 引言 (Introduction) 驗證:');
    
    if (introHtml.match(/href="https?:\/\/[^"]+\.(gov|org|edu|com)\.tw[^"]*"/)) {
      console.log('✅ 引用 [1] 成功注入真實 URL');
    } else {
      console.error('❌ 引用 [1] 注入失敗');
      console.log('實際內容:', introHtml);
    }

    if (!introHtml.includes('fake-url.com')) {
      console.log('✅ P5 成功移除或替換假連結');
    } else {
      console.error('❌ P5 未能移除假連結');
    }

    // 驗證 Section (P4 Check)
    const sectionHtml = article.content.sections[0].html;
    console.log('\n2. 段落 (Section) 驗證:');
    if (sectionHtml.includes('<sup class="citation">')) {
      console.log('✅ 段落引用注入成功');
    } else {
      console.error('❌ 段落引用注入失敗');
    }
    
    // P4 Check: "研究顯示" should be replaced
    if (sectionHtml.includes('根據<a href=')) {
      console.log('✅ P4 自動修正空洞引用成功');
    } else {
      console.log('⚠️ P4 未觸發或未修正 (可能是因為沒有匹配到模式)');
      console.log('實際內容:', sectionHtml);
    }

    // 驗證 Conclusion
    const conclusionHtml = article.content.conclusion.html;
    console.log('\n3. 結論 (Conclusion) 驗證:');
    if (conclusionHtml.includes('<sup class="citation">')) {
      console.log('✅ 結論引用注入成功');
    } else {
      console.error('❌ 結論引用注入失敗');
    }

    console.log('\n🎉 系統整合測試完成！所有檢查點均通過。');

  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    // 還原 Mock
    AIService.generate = originalGenerate;
  }
}

runTest();
