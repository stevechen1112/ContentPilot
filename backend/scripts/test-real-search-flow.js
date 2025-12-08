require('dotenv').config();
const AuthoritySourceService = require('./src/services/authoritySourceService');
const ArticleService = require('./src/services/articleService');
const AIService = require('./src/services/aiService');

// 🔴 攔截 AI 服務，只為了檢查 Prompt 是否正確接收到資料
const originalGenerate = AIService.generate;
AIService.generate = async (prompt, options) => {
  // console.log('\n🤖 [AI 攔截器] 收到 Prompt...');

  // 1. 處理領域識別請求 (JSON)
  if (prompt.includes('判斷主題所屬領域') && prompt.includes('輸出格式（JSON）')) {
    // console.log('🤖 [AI 攔截器] 檢測到領域識別請求，返回 Mock JSON');
    return {
      content: JSON.stringify({
        domain: "finance",
        domainLabel: "財經投資",
        authorityInstitutions: [
          {
            name: "勞動部勞工保險局",
            shortName: "勞保局",
            searchKeywords: ["勞保局", "勞工退休金"],
            expectedDomain: "gov.tw",
            reason: "勞工退休金主管機關"
          }
        ],
        searchStrategy: "優先搜尋政府法規與官方說明"
      })
    };
  }

  // 2. 處理搜尋模擬請求 (JSON) - 雖然我們現在用真實搜尋，但保留此 Mock 以防萬一
  if (prompt.includes('模擬搜尋結果') && prompt.includes('輸出格式（JSON）')) {
    // console.log('🤖 [AI 攔截器] 檢測到搜尋模擬請求，返回 Mock JSON');
    return {
      content: JSON.stringify([
        {
          title: "勞工退休金 - 勞動部勞工保險局全球資訊網",
          url: "https://www.bli.gov.tw/0000000.html",
          snippet: "勞工退休金條例規定...",
          domain: "bli.gov.tw",
          institutionName: "勞保局",
          institutionType: "government"
        }
      ])
    };
  }
  
  console.log('\n🤖 [AI 攔截器] 檢查 Prompt 中是否包含真實來源...');
  
  // 檢查 Prompt 中是否包含 "參考文獻庫" 區塊
  if (prompt.includes('## 📚 參考文獻庫')) {
    console.log('✅ Prompt 包含「參考文獻庫」區塊');
    
    // 提取參考文獻庫的內容
    const match = prompt.match(/## 📚 參考文獻庫 \(Reference Library\)\n([\s\S]*?)\n\n##/);
    if (match && match[1]) {
      console.log('📄 注入的來源資料預覽：');
      console.log('---------------------------------------------------');
      console.log(match[1].substring(0, 300) + '...'); // 只顯示前300字
      console.log('---------------------------------------------------');
      
      if (match[1].includes('http')) {
        console.log('✅ 成功檢測到 URL 連結！');
      } else {
        console.error('❌ 警告：參考文獻庫中似乎沒有 URL！');
      }
    }
  } else {
    // 寬鬆檢查：有時候 Prompt 格式可能略有不同，檢查關鍵字
    if (prompt.includes('參考資料') || prompt.includes('Reference')) {
        console.log('✅ Prompt 包含參考資料相關關鍵字');
        if (prompt.includes('http')) {
            console.log('✅ 成功檢測到 URL 連結！');
        }
    } else {
        console.error('❌ 失敗：Prompt 中缺少「參考文獻庫」區塊！');
        console.log('Prompt 預覽:', prompt.substring(0, 200));
    }
  }

  // 返回一個假的回應，讓程式能繼續跑完
  return { 
    content: '<h2>測試段落</h2><p>這是一個測試生成的段落，包含引用 [1]。</p>' 
  };
};

async function runRealWorldTest() {
  console.log('🚀 開始真實資料流測試 (Real-World Data Flow Test)...');
  console.log('===================================================');

  const testKeyword = '勞工退休金提繳規定';
  console.log(`\n🔍 步驟 1: 測試 AuthoritySourceService 真實搜尋 (主題: ${testKeyword})`);
  
  try {
    // 1. 執行真實搜尋
    const sources = await AuthoritySourceService.getAuthoritySources(testKeyword);
    
    console.log(`📊 搜尋結果: 找到 ${sources.length} 個來源`);
    if (sources.length > 0) {
      sources.forEach((s, i) => {
        console.log(`   [${i+1}] ${s.title}`);
        console.log(`       🔗 ${s.url}`);
        console.log(`       🏆 可信度: ${s.credibilityScore}`);
      });
    } else {
      console.error('❌ 搜尋失敗：未找到任何來源 (請檢查網路或 API Key)');
      // 即使搜尋失敗，我們也繼續測試步驟 2，看看 fallback 機制
    }

    console.log('\n📝 步驟 2: 測試 ArticleService.generateSection 資料注入');
    
    // 2. 模擬生成段落，看看上面的來源是否會被餵給 AI
    const section = {
      heading: '勞退新制提繳對象與費率',
      key_points: ['雇主提繳率', '勞工自願提繳'],
      estimated_words: 300
    };
    
    const outline = {
      title: '2025 勞工退休金懶人包',
      keywords: { primary: testKeyword }
    };

    // 我們手動傳入剛剛搜尋到的來源，模擬 LibrarianService 的工作
    // 或者讓它自己去搜尋 (這裡我們讓它自己去搜尋，測試完整流程)
    console.log('⏳ 呼叫 generateSection (這會觸發內部搜尋或使用緩存)...');
    
    await ArticleService.generateSection(section, outline, {
      provider: 'mock', // 這裡用 mock provider 沒關係，因為我們已經攔截了 AIService.generate
      // 注意：我們不傳入 verifiedSources，強迫它自己去 call Librarian -> AuthoritySource
    });

    console.log('\n✅ 測試完成！如果上方有顯示「注入的來源資料預覽」且包含網址，則驗證成功。');

  } catch (error) {
    console.error('❌ 測試發生錯誤:', error);
  }
}

runRealWorldTest();