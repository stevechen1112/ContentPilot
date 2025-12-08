# 競爭對手分析模組使用說明

## 🎯 核心價值

### 問題：為什麼需要爬取競爭對手內容？

**當前只有 snippet 的限制：**
```javascript
// Serper API 只給我們 150 字摘要
{
  title: "改善睡眠品質的10個科學方法",
  snippet: "根據研究顯示，規律作息可以顯著改善睡眠品質。專家建議每天固定時間就寢..."
}
```

❌ **無法回答的問題：**
1. 競爭對手寫了幾個段落？（H2 標題有哪些？）
2. 每個段落寫了多深？（字數、列表、案例）
3. 他們如何建立可信度？（引用了幾個來源？）
4. 內容格式如何？（有沒有表格、FAQ？）
5. 我們如何超越他們？

---

## 📊 完整分析後的數據

```javascript
// 爬取並分析後，我們獲得完整情報
{
  url: "https://example.com/sleep-quality",
  
  // 1. 內容結構（了解他們如何組織內容）
  structure: {
    h1: ["改善睡眠品質的10個科學方法"],
    h2: [
      "為什麼睡眠品質很重要？",
      "影響睡眠的5大因素",
      "10個改善睡眠的方法",
      "常見問題解答",
      "總結"
    ],
    h3: [
      "身體健康的影響",
      "心理健康的影響",
      "方法1：建立規律作息",
      "方法2：優化睡眠環境",
      // ...更多子標題
    ]
  },
  
  // 2. 內容深度（了解投入了多少內容）
  depth: {
    total_words: 2500,           // 總字數
    total_paragraphs: 18,        // 段落數
    avg_paragraph_length: 138,   // 平均段落長度
    lists: {
      ul_count: 3,               // 無序列表數量
      ol_count: 2,               // 有序列表數量
      total_items: 25            // 列表項目總數
    },
    media: {
      images: 5,                 // 圖片數量
      videos: 1,                 // 影片數量
      tables: 2                  // 表格數量
    }
  },
  
  // 3. E-E-A-T 信號（了解如何建立可信度）
  eeatSignals: {
    author_info: true,           // 有作者資訊
    publication_date: true,      // 有發布日期
    external_citations: 8,       // 引用了8個外部來源
    internal_links: 12,          // 12個內部連結
    expert_quotes: 5,            // 5次專家引用
    statistics_data: 15,         // 15個數據統計
    credential_keywords: [
      { keyword: "研究顯示", count: 3 },
      { keyword: "專家指出", count: 2 }
    ]
  },
  
  // 4. 用戶體驗元素
  uxElements: {
    has_table_of_contents: true,  // 有目錄
    has_summary_box: false,       // 沒有摘要框
    has_faq_section: true,        // 有FAQ
    has_call_to_action: true,     // 有CTA
    readability_features: {
      bullet_points: 25,
      bold_emphasis: 42,
      headings_used: 14
    }
  }
}
```

---

## 🚀 實際應用場景

### 場景 1：生成更好的大綱

**整合前（只有 snippet）：**
```javascript
// articleController.js - generateOutline()
const serpData = await SerperService.analyzeKeyword(keyword);
// serpData 只有 title + link + snippet

// AI 只能靠自己猜測應該寫哪些段落
```

**整合後（有完整分析）：**
```javascript
// 1. 先分析競爭對手
const competitorAnalyses = await CompetitorAnalysisService.analyzeTopCompetitors(serpData, 3);

// 2. 生成內容策略
const strategy = CompetitorAnalysisService.generateContentStrategy(competitorAnalyses);

// 3. 傳給 AI
const prompt = `
請生成文章大綱。

## 競爭對手分析
排名前3的文章平均：
- 字數：${strategy.target_word_count - 300} 字
- 段落數：${strategy.target_h2_count - 1} 個
- 列表數：${strategy.target_list_count - 1} 個

## 競爭對手覆蓋的主題
${strategy.competitor_topics_covered.join('\n- ')}

## 我們的目標（超越競爭對手）
- 目標字數：${strategy.target_word_count} 字
- 目標段落：${strategy.target_h2_count} 個 H2
- 必須包含：${strategy.target_list_count} 個以上列表
- 外部來源引用：至少 ${strategy.target_citations} 個

## 差異化機會
${strategy.competitive_advantages.join('\n- ')}

請設計一個更全面、更深入的大綱，覆蓋競爭對手的主題，並增加獨特角度。
`;
```

**效果：**
✅ AI 知道要寫多少字
✅ AI 知道要寫幾個段落
✅ AI 知道競爭對手寫了什麼（避免遺漏重要主題）
✅ AI 知道如何差異化（增加競爭對手沒有的內容）

---

### 場景 2：生成更深入的段落內容

**整合前：**
```javascript
const prompt = `
請撰寫段落內容。
標題：${section.heading}
字數：約 300 字
`;
// AI 可能寫得太淺或太深
```

**整合後：**
```javascript
// 找到競爭對手對應的段落
const competitorSection = competitorAnalyses[0].content_analysis.structure.h2.find(
  h2 => h2.includes(section.heading)
);

// 如果競爭對手也寫了這個段落，分析他們的寫法
const competitorDepth = competitorAnalyses[0].content_analysis.depth;

const prompt = `
請撰寫段落內容。
標題：${section.heading}

## 競爭對手的寫法
- 第1名平均段落長度：${competitorDepth.avg_paragraph_length} 字
- 使用了 ${competitorDepth.lists.total_items} 個列表項目
- 包含 ${competitorDepth.media.images} 張圖片
- 引用了 ${competitorAnalyses[0].content_analysis.eeatSignals.expert_quotes} 次專家觀點

## 我們的目標
- 字數：至少 ${competitorDepth.avg_paragraph_length * 1.2} 字（比競爭對手多20%）
- 必須包含列表（至少3個項目）
- 必須引用至少1個外部來源
- 提供更具體的案例或數據

請撰寫更深入、更實用的內容，超越競爭對手。
`;
```

---

### 場景 3：內容質量檢查

**整合到 qualityService.js：**
```javascript
// 檢查我們的內容是否足夠競爭
async checkCompetitiveness(article, competitorAnalyses) {
  const ourWordCount = article.content.split(/\s+/).length;
  const avgCompetitorWords = competitorAnalyses.reduce(...) / 3;
  
  if (ourWordCount < avgCompetitorWords * 0.8) {
    return {
      pass: false,
      message: `內容深度不足。我們的字數 ${ourWordCount}，競爭對手平均 ${avgCompetitorWords}`
    };
  }
  
  // 檢查來源引用數量
  const ourCitations = (article.content.match(/<a[^>]*target="_blank"/g) || []).length;
  const avgCompetitorCitations = ...;
  
  if (ourCitations < avgCompetitorCitations) {
    return {
      pass: false,
      message: `來源引用不足。我們引用 ${ourCitations} 個，競爭對手平均 ${avgCompetitorCitations} 個`
    };
  }
  
  return { pass: true };
}
```

---

## ⚙️ 整合步驟

### Step 1: 安裝依賴
```bash
cd backend
npm install cheerio
```

### Step 2: 修改 articleController.js

```javascript
const CompetitorAnalysisService = require('../services/competitorAnalysisService');

// 在 generateOutline 方法中
async generateOutline(req, res) {
  // ... 現有代碼

  // 1. SERP 分析
  const serpData = await SerperService.analyzeKeyword(keyword);
  
  // 2. 🆕 深度分析競爭對手（新增）
  const competitorAnalyses = await CompetitorAnalysisService.analyzeTopCompetitors(serpData, 3);
  
  // 3. 🆕 生成內容策略（新增）
  const contentStrategy = CompetitorAnalysisService.generateContentStrategy(competitorAnalyses);
  
  // 4. 生成大綱（傳入競爭對手分析）
  const outline = await ArticleService.generateOutline(keyword, {
    serp_data: serpData,
    competitor_analyses: competitorAnalyses,  // 🆕 新增
    content_strategy: contentStrategy          // 🆕 新增
  });
  
  // ...
}
```

### Step 3: 修改 articleService.js

```javascript
// 在 AI prompt 中使用競爭對手數據
static async generateOutline(keyword, options = {}) {
  const { serp_data, competitor_analyses, content_strategy } = options;
  
  // 🆕 競爭對手主題覆蓋
  const competitorTopics = competitor_analyses
    ?.map(c => c.content_analysis?.structure?.h2 || [])
    .flat()
    .join('\n- ') || '';
  
  const prompt = `
  ## 競爭對手內容分析
  排名前3的文章覆蓋的主題：
  ${competitorTopics}
  
  ## 內容策略目標
  - 目標字數：${content_strategy?.target_word_count || 2000} 字
  - 目標段落：${content_strategy?.target_h2_count || 6} 個 H2
  - 列表數量：至少 ${content_strategy?.target_list_count || 3} 個
  - 來源引用：至少 ${content_strategy?.target_citations || 3} 個
  
  ## 差異化機會
  ${content_strategy?.competitive_advantages?.join('\n') || ''}
  
  請設計一個更全面的大綱，覆蓋競爭對手的主題並增加獨特角度。
  `;
  
  // ...
}
```

---

## 📈 預期效果對比

| 指標 | 整合前 | 整合後 |
|-----|-------|-------|
| **內容深度** | AI 隨機決定 | 基於競爭對手+20% |
| **主題覆蓋** | 可能遺漏重要主題 | 覆蓋所有競爭對手主題 |
| **來源引用** | 隨機數量 | 至少等於或超過競爭對手 |
| **內容格式** | 基本 HTML | 參考競爭對手格式（列表、表格） |
| **競爭力** | 不確定 | 明確超越競爭對手指標 |
| **差異化** | 無 | 識別並填補競爭對手的內容缺口 |

---

## ⚠️ 注意事項

1. **爬蟲合規性**：
   - 檢查 robots.txt
   - 設置合理的延遲（2秒）
   - 使用正確的 User-Agent

2. **效能考慮**：
   - 爬取很慢（每個URL 2-3秒）
   - 建議：
     - 只分析前3名
     - 使用快取（24小時內不重複爬）
     - 可選功能（讓用戶決定是否啟用）

3. **錯誤處理**：
   - 部分網站可能阻擋爬蟲
   - 需要 fallback 機制（爬取失敗時仍能生成內容）

---

## 🎯 總結

### 競爭對手定義：
**SERP 前3-5名的排名網站** = 已被 Google 驗證的優質內容

### 爬取目的：
1. **了解競爭標準**（他們寫了多深？多長？多少來源？）
2. **避免內容缺口**（確保覆蓋所有重要主題）
3. **尋找差異化機會**（找到他們沒寫好的地方）
4. **設定超越目標**（字數+20%、來源+1、增加獨特角度）

### 核心價值：
**從「憑感覺創作」變成「基於數據的策略創作」**
- 不再猜測應該寫多少字 → 有明確目標
- 不再擔心遺漏主題 → 覆蓋所有競爭對手主題
- 不再不知道如何超越 → 有具體的超越指標
