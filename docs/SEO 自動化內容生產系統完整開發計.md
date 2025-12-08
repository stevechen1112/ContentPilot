# SEO 自動化內容生產系統完整開發計畫

## 一、產品定位與核心價值

### 產品名稱
**SEO ContentForge**（內容鍛造廠）

### 產品定位
85分內容自動化生產系統 + 人工精修工作流，實現「AI骨架 + 人類靈魂」的高效內容產出模式

### 核心價值主張
- 將人工 8 小時的 SEO 文章創作壓縮至 20 分鐘（AI 生成 5分鐘 + 人工經驗補充 15分鐘）
- AI 先產出 85 分基礎內容，人類專注補充「真實經驗」提升至 90+ 分
- 確保符合 Google E-E-A-T 標準，真正實現「AI 骨架 + 人類靈魂」
- 可規模化生產，同時保持內容品質與獨特性

### 核心設計理念
**從「素材整合工具」到「內容加速器」**

傳統錯誤假設：使用者願意在看到成果前，先投入大量時間準備素材

**正確流程**：
1. 使用者只需輸入主題（5分鐘）
2. AI 全自動生成 85 分基礎內容（基於 SERP + 真實資訊搜尋）
3. 系統智能標記「建議補充經驗」的位置
4. 使用者在關鍵處補充個人觀點、照片、數據（15分鐘）
5. AI 自動調整銜接，完成 90+ 分內容

**真正價值**：AI 處理「通用資訊整理」(80%)，人類專注「獨特經驗補充」(20%)

---

## 二、系統架構設計

### 2.1 核心流程架構（8大模組）

```
S0: 專案管理層
S1: 內容策劃輸入（極簡化，快速啟動）
S2: 智能資訊採集
S3: 風格知識庫
S4: 內容大綱生成
S5: AI 寫作引擎（自動生成 85 分內容）
S6: 品質檢核與優化
S7: 格式化輸出
S8: 智能二修工作台（核心價值：引導補充真實經驗）
```

**新流程邏輯**
```
使用者只輸入主題（S1）
    ↓
AI 全自動生成 85 分內容（S2-S6）
    ↓
S8 智能標記「經驗缺口」
    ↓
使用者在關鍵處補充個人觀點/照片/數據（15分鐘）
    ↓
AI 自動重寫銜接
    ↓
完成 90+ 分內容
```

---

### 2.2 各模組詳細規劃

#### **S0: 專案管理層**

**功能定義**
- 多專案管理（支援不同網站、不同主題的內容計畫）
- 關鍵字庫管理
- 內容行事曆
- 團隊協作分派

**核心功能點**
1. **專案建立**
   - 設定網站基本資訊（網域、產業、目標受眾）
   - 匯入關鍵字清單（支援 CSV/Excel）
   - 設定內容產出頻率

2. **關鍵字管理**
   - 關鍵字難度評估（整合 Ahrefs/Semrush API）
   - 搜尋量與趨勢分析
   - 關鍵字分組與優先級排序
   - 自動建議相關長尾關鍵字

3. **內容排程**
   - 月曆視圖拖拉排程
   - 狀態追蹤（待生產→AI生成中→待審核→已發布）
   - 團隊成員分派（作者/編輯/SEO審核）

4. **數據儀表板**
   - 已生產文章數量
   - 平均品質分數
   - 發布後流量追蹤（整合 GA4）

**技術需求**
- 前端：React + TypeScript
- 狀態管理：Redux Toolkit
- 資料庫：PostgreSQL（關聯式資料）+ MongoDB（文件草稿）

---

#### **S1: 內容策劃輸入**（極簡化設計）

**功能定義**
- 使用者定義文章主題與基本需求
- **不需要**前期準備素材（經驗素材移至 S8 補充）
- 快速啟動內容生產流程

**設計理念**
降低使用者啟動門檻，讓 AI 先生成 85 分基礎內容，使用者再決定如何補強。

**核心功能點**

1. **必填欄位**（最小化輸入）
   - 主關鍵字（必填）
   - 文章類型選擇（必填）：
     - 教學指南（How-to）
     - 產品評測（Review）
     - 比較分析（Comparison）
     - 資訊整理（Listicle）
     - 問題解答（Q&A）

2. **選填欄位**（快速優化）
   - 次要關鍵字（最多5個）
   - 目標受眾描述（簡短描述即可）
   - 目標字數（1000/1500/2000/2500+，預設 2000）
   - 語氣風格（專業/友善/輕鬆/嚴謹，預設「友善」）
   - 是否包含常見問題（FAQ）
   - CTA 類型（訂閱/購買/下載/聯絡/無）

3. **快速模板**
   - 預設常用組合（如「3C評測標準流程」）
   - 一鍵套用，減少重複設定

**移除功能**（延後至 S8）
- ❌ 圖片上傳（改為 S8 智能建議補充）
- ❌ 個人觀點輸入（改為 S8 關鍵位置補充）
- ❌ 引用來源預填（由 S2 自動搜尋）

**輸出**
- 結構化 JSON 資料包，傳遞給 S2

**技術需求**
- 圖片處理：Sharp.js（壓縮）+ AWS S3（儲存）
- 圖片 AI 辨識：Google Cloud Vision API / OpenAI GPT-4V

---

#### **S2: 智能資訊採集**

**功能定義**
- 分析 SERP 競品
- 搜尋真實資訊與案例
- 建立可信來源資料庫

**核心功能點**

**S2-1: SERP 競品分析**
1. **抓取前10名搜尋結果**
   - 標題、Meta Description、URL
   - 字數統計
   - H2/H3 標題結構提取
   - 關鍵字密度分析

2. **People Also Ask (PAA) 擷取**
   - 列出所有相關問題
   - 優先處理前5個高頻問題

3. **相關搜尋建議**
   - Google Suggest API
   - 長尾關鍵字推薦

**S2-2: 真實資訊搜尋 (Deep Reading Engine)**
1. **多源資訊採集**
   - **[NEW] 深度閱讀 (Deep Reading)**: 針對每個搜尋結果，抓取前 1500 字內文，而非僅依賴搜尋摘要。
   - 學術來源：Google Scholar API
   - 新聞來源：News API / Google News
   - 統計數據：政府開放資料平台
   - 社群討論：Reddit API / PTT 爬蟲
   - 購物評論：Amazon API / momo 爬蟲（合法範圍）

2. **資訊結構化處理**
   - 擷取關鍵數據（數字、百分比、日期）
   - 提取真實案例（使用者評論精華）
   - 記錄來源 URL 與發布日期

3. **時效性檢查**
   - 優先使用近 1 年內的資訊
   - 標記過時資料（超過 3 年）

**S2-3: 來源可信度評分 (Blacklist Strategy)**
- **[NEW] 黑名單機制**: 
  - 預設信任所有來源，但嚴格排除「內容農場」與「非原創百科」(如 Wikipedia, Baidu Baike)。
  - 允許引用商業網站 (如券商官網) 與專家部落格，以增加內容多樣性。
- 自動評分機制（0-100分）
  - .gov / .edu：90-100分
  - 知名媒體（白名單）：80-90分
  - 學術期刊：85-95分
  - 一般網站：50-70分
  - 內容農場（黑名單）：0分，直接過濾

**S2-4: 資訊去重與整合**
- 辨識重複資訊（語意相似度分析）
- 合併相同來源的多筆資料
- 建立「引用資料池」供後續使用

**輸出**
```json
{
  "serp_analysis": {
    "top_10_structure": [...],
    "paa_questions": [...],
    "average_word_count": 2300
  },
  "real_data_pool": [
    {
      "type": "statistic",
      "content": "根據 2024 年台灣網路資訊中心調查，85% 的企業...",
      "source": "TWNIC 2024 報告",
      "url": "https://...",
      "credibility_score": 95,
      "date": "2024-03"
    },
    {
      "type": "case_study",
      "content": "Reddit 使用者 @john 分享：使用 3 個月後...",
      "source": "Reddit r/SEO",
      "credibility_score": 70
    }
  ]
}
```

**技術需求**
- Web Scraping：Playwright / Puppeteer
- API 整合：
  - Serper API / SerpAPI（SERP 資料）
  - News API（新聞）
  - Exa AI（語意搜尋）
- 去重演算法：MinHash / Simhash
- 資料庫：Elasticsearch（快速檢索）

---

#### **S3: 風格知識庫**

**功能定義**
- 儲存並學習特定網站/作者的寫作風格
- 確保 AI 產出內容符合品牌調性

**核心功能點**

1. **風格訓練**
   - 使用者上傳 5-10 篇自己網站的代表文章
   - 系統自動分析：
     - 句長分佈
     - 常用詞彙
     - 語氣特徵（正式/口語/專業術語密度）
     - 段落結構偏好

2. **風格模板庫**
   - 預設風格：
     - 專業商務（Business Professional）
     - 友善親民（Conversational）
     - 技術極客（Tech Geek）
     - 新聞報導（Journalistic）
   - 自訂風格（基於上傳文章訓練）

3. **禁用詞庫**
   - 使用者可設定不希望出現的詞彙
   - 自動檢查並替換

4. **品牌術語庫**
   - 公司特定術語（如產品名稱）
   - 確保一致性使用

**輸出**
- 風格 Prompt 指令集，注入 S5 寫作引擎

**技術需求**
- NLP 分析：spaCy / NLTK
- 風格向量化：Sentence Transformers
- 資料庫：PostgreSQL（JSON 欄位儲存風格特徵）

---

#### **S4: 內容大綱生成**

**功能定義**
- 根據 S1 + S2 的資料，自動生成文章大綱
- 確保邏輯清晰、結構完整

**核心功能點**

1. **智能大綱生成**
   - 輸入：
     - 主關鍵字
     - SERP 前 10 名的 H2/H3 結構
     - PAA 問題
     - 真實資料池
   - 輸出：
     - 建議的 H1（標題）
     - 3-8 個 H2 主章節
     - 每個 H2 下 2-4 個 H3 子標題
     - 每個段落的寫作要點提示

2. **大綱模板系統**
   - 根據文章類型自動套用：
     - **評測型**：簡介 → 外觀設計 → 功能測試 → 優缺點 → 結論
     - **教學型**：問題背景 → 準備工作 → 步驟詳解 → 常見錯誤 → 總結
     - **比較型**：產品A介紹 → 產品B介紹 → 功能對比表 → 價格分析 → 推薦

3. **人工編輯介面**
   - 拖拉調整章節順序
   - 新增/刪除/合併段落
   - 為每個段落標記「必須引用真實資料」

4. **大綱評分系統**
   - 檢查是否回答了所有 PAA 問題
   - 檢查是否涵蓋競品的核心要點
   - 建議補充遺漏的主題

**輸出**
```json
{
  "h1": "2024 最完整 iPhone 15 評測：值得升級嗎？",
  "outline": [
    {
      "h2": "iPhone 15 外觀與設計",
      "h3_list": ["Dynamic Island 的實用性", "新配色選擇"],
      "writing_notes": "必須包含實拍照片，描述握持手感",
      "data_required": true
    },
    {
      "h2": "效能與電池續航實測",
      "h3_list": ["A16 晶片跑分", "實際使用 8 小時測試"],
      "writing_notes": "引用 S2 的真實評測數據",
      "data_required": true
    }
  ]
}
```

**技術需求**
- AI 模型：GPT-4 / Claude 3.5 Sonnet
- Prompt Engineering：Chain-of-Thought 推理
- 前端：React DnD（拖拉功能）

---

#### **S5: AI 寫作引擎 (Two-Pass Generation)**

**功能定義**
- 根據大綱與資料池，生成完整文章內容
- 確保符合 SEO 標準與 E-E-A-T 原則
- **[NEW] 雙重生成機制**: 採用「初稿 -> 修潤」的兩階段流程，確保品質。

**核心功能點**

1. **段落逐一生成 (Pass 1: Drafting)**
   - 不一次生成全文，而是逐段生成（避免 token 超限）
   - 每段生成時注入：
     - 當前段落的大綱要點
     - 相關的真實資料（從 S2 資料池抽取）
     - 風格指令（從 S3 載入）
     - **Scope Control**: 嚴格限制 AI 寫作範圍，防止段落間內容重複。

2. **深度修潤 (Pass 2: Deep Refinement)**
   - **嚴格主編模式**: 啟動第二個 AI 角色，審核初稿。
   - **去蕪存菁**: 刪除重複語句與無意義廢話。
   - **結構修復**: 確保沒有多餘的 H1/H2 標題。
   - **語氣潤飾**: 確保符合「專業權威」風格。

3. **結構強制 (Code-Level SEO)**
   - **H2 標題注入**: 由系統代碼強制插入 `<h2>`，不依賴 AI 生成。
   - **防呆機制**: 自動移除 AI 可能重複生成的標題。

4. **E-E-A-T 增強注入**
   - 自動插入「根據 XX 報告」、「實測結果顯示」
   - 將使用者上傳的「個人觀點」自然融入文章
   - 在適當位置插入「經驗描述詞」（如「使用後發現」、「實際操作時」）

5. **多樣性控制**
   - Temperature 參數調整（0.7-0.9）
   - 每段開頭刻意使用不同句型
   - 避免重複使用相同轉折詞

6. **即時預覽**
   - 前端即時顯示生成進度
   - 逐段顯示，使用者可中途暫停修改

**輸出**
- Markdown 格式的完整文章
- 包含所有 H 標籤、粗體、連結標記

**技術需求**
- AI 模型：
  - 主力：Claude 3.5 Sonnet（推理能力強）
  - 備援：GPT-4o（速度快）
- Token 管理：LangChain（處理長文本）
- 串流輸出：Server-Sent Events (SSE)

---

#### **S6: 品質檢核與優化**

**功能定義**
- 自動檢查內容是否符合 SEO 與 E-E-A-T 標準
- 提供優化建議

**核心功能點**

1. **E-E-A-T 檢核清單**
   - ✅ 是否包含至少 1 處第一人稱敘述？
   - ✅ 是否引用至少 2 個高可信度來源？
   - ✅ 是否包含實拍圖片或原創數據？
   - ✅ 是否回答了所有 PAA 問題？

2. **SEO 技術檢查**
   - 關鍵字密度（建議 0.5%-2%）
   - H 標籤層級是否正確
   - Meta Description 長度（120-158字）
   - 內部連結數量（建議 3-5 個）
   - 圖片 Alt Text 完整性

3. **可讀性分析**
   - Flesch Reading Ease 評分
   - 平均句長（建議 15-25 字）
   - 段落長度（建議 3-5 句）
   - 過長句子標記（超過 40 字）

4. **原創性檢查**
   - 與 SERP 前 10 名的相似度分析
   - 標記疑似抄襲段落
   - 建議重寫高相似度區塊

5. **外部連結健康度**
   - 檢查所有外連是否有效（HTTP status）
   - 警告低可信度網站連結

**輸出**
```json
{
  "overall_score": 87,
  "eeat_score": 82,
  "seo_score": 91,
  "readability_score": 88,
  "issues": [
    {
      "level": "warning",
      "message": "缺少第一人稱經驗描述",
      "location": "第 3 段",
      "suggestion": "加入「根據我的實測...」"
    }
  ],
  "optimization_tips": [...]
}
```

**技術需求**
- 相似度檢測：Sentence Transformers + Cosine Similarity
- 可讀性計算：TextStat Library
- URL 驗證：Axios + Retry 機制

---

#### **S7: 格式化輸出**

**功能定義**
- 將內容轉換為多種可用格式
- 生成 SEO 技術代碼

**核心功能點**

1. **多格式匯出**
   - Markdown（預設）
   - HTML（帶完整標籤）
   - WordPress XML（直接匯入）
   - Google Docs（API 推送）
   - Notion（API 推送）

2. **SEO 技術代碼生成**
   - **Schema Markup（JSON-LD）**
     - Article Schema
     - FAQ Schema（如果有 Q&A）
     - HowTo Schema（如果是教學）
   - **Meta Tags**
     - Title
     - Description
     - Open Graph（社群分享）
     - Twitter Card
   - **Alt Text 完整版**

3. **內部連結自動匹配**
   - 掃描網站既有文章資料庫
   - 根據關鍵字相似度推薦內部連結
   - 自動插入錨文本

4. **圖片處理**
   - 壓縮至適當大小（< 200KB）
   - 生成 WebP 格式
   - 自動加上 lazy loading 屬性

5. **CTA 插入**
   - 根據 S1 設定的 CTA 類型
   - 自動生成按鈕 HTML 代碼

**輸出範例**
```html
<!-- Schema Markup -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "2024 最完整 iPhone 15 評測",
  "author": {
    "@type": "Person",
    "name": "技術編輯團隊"
  },
  "datePublished": "2024-12-07"
}
</script>

<!-- 文章內容 -->
<article>
  <h1>2024 最完整 iPhone 15 評測</h1>
  ...
</article>
```

**技術需求**
- 格式轉換：Pandoc Library
- HTML 處理：Cheerio (Node.js)
- 圖片處理：Sharp.js
- CMS API 整合：WordPress REST API / Notion API

---

#### **S8: 智能二修工作台**（核心價值模組）

**功能定義**
- 提供友善的人工審核與編輯環境
- **AI 智能標記「經驗缺口」，引導高效補強**
- 自動重寫銜接，確保補充內容自然融入
- 追蹤修改歷程與 E-E-A-T 分數提升

**設計理念**
這是系統的核心價值所在：AI 已完成 85 分基礎內容，S8 引導使用者用最少時間（15分鐘）補充「人類獨有的真實經驗」，提升至 90+ 分。

**核心功能點**

**S8-1: 經驗缺口智能檢測**
- AI 自動分析文章，標記「經驗弱點」位置
- 分級標示：
  - 🔴 嚴重缺口（影響可信度）：缺少實測數據、第一人稱敘述
  - 🟡 建議補充（提升品質）：可加入照片、個人觀點
  - 🟢 已充足（無需補充）
- 每個缺口顯示：
  - 問題描述：「這段缺少個人經驗」
  - 補充建議：「加入 1 張實拍照 + 20 字手感描述」
  - 預估提升：「E-E-A-T +12 分」

**S8-2: 一鍵補充介面**
```
┌─────────────────────────────────┐
│ 🎯 段落 3：建議加入個人經驗      │
│                                  │
│ 原文：                            │
│ 「根據官方數據，電池可用 20 小時」│
│                                  │
│ 💬 快速補充文字（選填）：          │
│ ┌────────────────────────────┐  │
│ │ 我實測只有 16 小時，可能是因為...││
│ └────────────────────────────┘  │
│                                  │
│ 📸 上傳照片（選填，拖拉或點擊）：  │
│ [圖片上傳區]                      │
│ • 自動生成 Alt Text              │
│ • 自動壓縮至 < 200KB             │
│                                  │
│ 📊 補充數據（選填）：              │
│ ┌────────────────────────────┐  │
│ │ 實測數值：___  單位：___      ││
│ └────────────────────────────┘  │
│                                  │
│ ✅ 套用並自動重寫  ⏭️ 跳過      │
└─────────────────────────────────┘
```

**S8-3: 自動銜接重寫**
- 使用者補充內容後，AI 自動調整前後文
- 確保補充內容自然融入，不顯突兀
- 範例：
  - **原文**：「根據官方數據，iPhone 15 電池可用 20 小時。」
  - **使用者補充**：「我實測只有 16 小時」
  - **AI 重寫**：「官方宣稱 iPhone 15 電池可用 20 小時，但根據我實際測試，**在中度使用情境下，實際續航約 16 小時**。這個落差可能來自個人使用習慣...」

**S8-4: 即時品質追蹤**
- E-E-A-T 分數即時更新
- 視覺化顯示：
  - 補充前：E-E-A-T 82 分
  - 補充後：E-E-A-T 94 分 ⬆️ +12
- 達成清單：
  ✅ 包含第一人稱敘述（3 處）
  ✅ 實拍照片（2 張）
  ✅ 真實測試數據（1 筆）
  ⚠️ 建議再補充 1 處個人觀點

**S8-5: 傳統編輯功能**
1. **並排比對模式**
   - 左側：AI 原始版本
   - 右側：人工編輯版本
   - 高亮顯示差異

2. **快速修正工具**
   - 段落重寫按鈕（針對單段重新生成）
   - 語氣調整滑桿（正式 ←→ 輕鬆）
   - 擴寫/縮寫按鈕

3. **協作批註系統**
   - 編輯可在特定段落留言
   - 標記「需要補充真實數據」
   - @提及團隊成員

4. **版本控制**
   - 自動儲存每次修改
   - 可還原至任一歷史版本
   - 比較不同版本差異

5. **審核流程**
   - 狀態標記：待審核 → 審核中 → 通過 → 已發布
   - 審核檢查表（Checklist）
   - 批准/退回按鈕

**技術需求**
- 富文本編輯器：Slate.js / TipTap
- 版本控制：類 Git 的 diff 演算法
- 即時協作：WebSocket / Yjs (CRDT)

---

## 三、技術架構

### 3.1 系統架構圖

```
┌─────────────────────────────────────────────┐
│          前端 (Frontend)                     │
│  React + TypeScript + Redux                 │
│  - 專案管理介面                              │
│  - 內容編輯器                                │
│  - 品質檢核儀表板                            │
└──────────────┬──────────────────────────────┘
               │ REST API / GraphQL
┌──────────────▼──────────────────────────────┐
│          後端 (Backend)                      │
│  Node.js + Express / FastAPI (Python)       │
│  - API Gateway                              │
│  - 工作流編排引擎                            │
│  - 任務佇列管理                              │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼─────┐  ┌──────▼─────────┐
│ 核心服務層  │  │  AI 服務層      │
│            │  │                │
│ • S0-S2    │  │ • S3-S6        │
│ • S7-S8    │  │ • LLM 調用     │
│            │  │ • NLP 處理     │
└──────┬─────┘  └────────────────┘
       │
┌──────▼──────────────────────────┐
│      外部服務整合                 │
│ • Serper API (SERP)             │
│ • OpenAI / Anthropic API        │
│ • News API                      │
│ • Google Cloud Vision           │
│ • AWS S3 (儲存)                 │
└──────┬──────────────────────────┘
       │
┌──────▼──────────────────────────┐
│      資料層                       │
│ • PostgreSQL (結構化資料)        │
│ • MongoDB (文件草稿)             │
│ • Redis (快取/佇列)              │
│ • Elasticsearch (搜尋)          │
└─────────────────────────────────┘
```

### 3.2 技術堆疊選擇

#### 前端
- **框架**：React 18 + TypeScript
- **狀態管理**：Redux Toolkit + RTK Query
- **UI 組件**：Ant Design / shadcn/ui
- **編輯器**：Slate.js（富文本）
- **圖表**：Recharts（數據視覺化）

#### 後端
- **主框架**：Node.js + Express（API 層）
- **AI 處理**：Python FastAPI（AI 相關運算）
- **任務佇列**：Bull (Redis-based)
- **工作流**：Temporal.io（複雜流程編排）

#### AI 模型
- **主力寫作**：Claude 3.5 Sonnet (Anthropic)
- **備援/快速任務**：GPT-4o (OpenAI)
- **嵌入向量**：OpenAI text-embedding-3-large
- **視覺辨識**：GPT-4V / Google Cloud Vision

#### 資料庫
- **關聯式**：PostgreSQL 15+（專案、使用者、文章元資料）
- **文件庫**：MongoDB（文章草稿、風格知識庫）
- **快取**：Redis（API 快取、任務佇列）
- **搜尋引擎**：Elasticsearch（全文檢索）

#### 雲端服務
- **運算**：AWS EC2 / Google Cloud Run
- **儲存**：AWS S3（圖片、文件）
- **CDN**：CloudFlare
- **監控**：Sentry（錯誤追蹤）+ Datadog（效能監控）

---

## 四、資料模型設計

### 4.1 核心資料表

#### 1. Projects（專案表）
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  domain VARCHAR(255),
  industry VARCHAR(100),
  target_audience TEXT,
  style_template_id UUID REFERENCES style_templates(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### 2. Keywords（關鍵字表）
```sql
CREATE TABLE keywords (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  keyword TEXT,
  search_volume INTEGER,
  difficulty_score INTEGER, -- 0-100
  priority VARCHAR(20), -- high/medium/low
  status VARCHAR(20), -- pending/in_progress/completed
  created_at TIMESTAMP
);
```

#### 3. Articles（文章表）
```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  keyword_id UUID REFERENCES keywords(id),
  title TEXT,
  slug VARCHAR(255),
  content_draft JSONB, -- MongoDB reference or full content
  content_final TEXT,
  status VARCHAR(50), -- draft/ai_generated/under_review/approved/published
  quality_score INTEGER, -- 0-100
  eeat_score INTEGER,
  seo_score INTEGER,
  assigned_to UUID REFERENCES users(id),
  published_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### 4. ContentAssets（內容素材表）
```sql
CREATE TABLE content_assets (
  id UUID PRIMARY KEY,
  article_id UUID REFERENCES articles(id),
  type VARCHAR(50), -- image/video/data/citation
  file_url TEXT, -- S3 URL
  alt_text TEXT,
  caption TEXT,
  source_url TEXT,
  credibility_score INTEGER,
  created_at TIMESTAMP
);
```

#### 5. StyleTemplates（風格模板表）
```sql
CREATE TABLE style_templates (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name VARCHAR(255),
  tone VARCHAR(50), -- professional/casual/technical
  sentence_length_avg INTEGER,
  paragraph_structure JSONB,
  forbidden_words TEXT[],
  brand_terms JSONB,
  sample_articles TEXT[], -- URLs
  created_at TIMESTAMP
);
```

#### 6. DataPool（真實資料池）
```sql
CREATE TABLE data_pool (
  id UUID PRIMARY KEY,
  article_id UUID REFERENCES articles(id),
  data_type VARCHAR(50), -- statistic/case_study/quote/news
  content TEXT,
  source_name VARCHAR(255),
  source_url TEXT,
  credibility_score INTEGER,
  publish_date DATE,
  fetched_at TIMESTAMP
);
```

### 4.2 MongoDB 文件結構

#### ArticleDraft（文章草稿）
```json
{
  "_id": "article_uuid",
  "outline": {
    "h1": "標題",
    "sections": [
      {
        "h2": "章節標題",
        "h3_list": ["子標題1", "子標題2"],
        "writing_notes": "寫作提示",
        "content": "段落內容",
        "citations": [
          {
            "text": "引用內容",
            "source_id": "data_pool_id"
          }
        ]
      }
    ]
  },
  "metadata": {
    "word_count": 2300,
    "generation_time": "2024-12-07T10:30:00Z",
    "model_used": "claude-3.5-sonnet"
  },
  "versions": [
    {
      "version": 1,
      "content": "...",
      "modified_by": "user_id",
      "modified_at": "timestamp"
    }
  ]


}
```

---

## 五、API 設計

### 5.1 核心 API 端點

#### 專案管理
```
POST   /api/projects                  # 建立專案
GET    /api/projects/:id              # 取得專案詳情
PUT    /api/projects/:id              # 更新專案
DELETE /api/projects/:id              # 刪除專案
GET    /api/projects/:id/dashboard    # 專案儀表板數據
```

#### 關鍵字管理
```
POST   /api/keywords                  # 批次匯入關鍵字
GET    /api/keywords?project_id=xxx   # 取得關鍵字列表
PUT    /api/keywords/:id/priority     # 更新優先級
GET    /api/keywords/:id/analysis     # 關鍵字深度分析
```

#### 文章生產流程
```
POST   /api/articles                  # 建立文章任務
POST   /api/articles/:id/analyze      # S2: 執行 SERP 分析
GET    /api/articles/:id/data-pool    # 取得真實資料池
POST   /api/articles/:id/outline      # S4: 生成大綱
PUT    /api/articles/:id/outline      # 編輯大綱
POST   /api/articles/:id/generate     # S5: 開始 AI 寫作
GET    /api/articles/:id/stream       # SSE: 串流輸出寫作進度
POST   /api/articles/:id/check        # S6: 品質檢核
GET    /api/articles/:id/export       # S7: 匯出多格式
PUT    /api/articles/:id/review       # S8: 提交審核
```

#### AI 相關
```
POST   /api/ai/rewrite                # 重寫特定段落
POST   /api/ai/expand                 # 擴寫內容
POST   /api/ai/style-adjust           # 調整語氣風格
POST   /api/ai/generate-title         # 生成標題候選
```

#### 風格管理
```
POST   /api/styles                    # 上傳範例文章訓練風格
GET    /api/styles/:id                # 取得風格模板
PUT    /api/styles/:id                # 更新風格設定
```

### 5.2 WebSocket 事件

#### 即時協作
```javascript
// 連線
ws://api.domain.com/ws/articles/:id

// 事件
{
  "event": "paragraph_update",
  "data": {
    "section_index": 2,
    "new_content": "...",
    "user_id": "xxx"
  }
}

// AI 生成進度
{
  "event": "generation_progress",
  "data": {
    "section": "H2-3",
    "percentage": 65,
    "eta_seconds": 45
  }
}
```

---

## 六、工作流程引擎設計

### 6.1 完整流程狀態機

```
[使用者極簡輸入] （5分鐘）
    ↓
[S1: 內容策劃] → 僅輸入主題與關鍵字
    ↓
[AI 全自動生成階段] （無需使用者介入）
    ↓
[S2: 資訊採集] 
    ├→ SERP 分析 (非同步)
    ├→ 真實資料搜尋 (非同步)
    └→ 可信度評分
    ↓
[S4: 大綱生成] → AI 自動生成（可選：使用者快速確認）
    ↓
[S5: AI 寫作]
    ├→ 段落 1 生成
    ├→ 段落 2 生成
    ├→ ...
    └→ 結論生成
    ↓
[S6: 品質檢核] 
    ├→ E-E-A-T 檢查（基礎分數約 82-85）
    ├→ SEO 檢查
    └→ 可讀性檢查
    ↓
[生成檢核報告 + 經驗缺口分析]
    ↓
[S8: 智能二修工作台] ⭐ 核心價值階段（15分鐘）
    ├→ AI 標記「經驗缺口」（3-5 處關鍵位置）
    ├→ 使用者補充：
    │   • 個人觀點（20-50 字）
    │   • 實拍照片（1-3 張）
    │   • 真實測試數據（選填）
    ├→ AI 自動重寫銜接
    └→ E-E-A-T 分數提升至 90+
    ↓
[使用者確認完成]
    ↓
[S7: 格式化輸出]
    ├→ 生成 Schema
    ├→ 處理圖片（壓縮、Alt Text）
    ├→ 匯出多格式
    └→ 推送至 CMS（選配）
    ↓
[完成並發布]
```

### 6.2 任務優先級設計

```javascript
// 使用 Bull Queue
const taskQueue = {
  priority: {
    critical: 1,    // SERP 分析、大綱生成
    high: 2,        // AI 寫作
    medium: 3,      // 品質檢核
    low: 4          // 格式化輸出
  },
  concurrency: {
    serp_analysis: 5,      // 同時處理 5 個 SERP 分析
    ai_writing: 3,         // 同時寫作 3 篇（避免 API 超限）
    quality_check: 10      // 可大量並行
  }
};
```

### 6.3 錯誤處理與重試機制

```javascript
const retryPolicy = {
  serp_fetch: {
    maxRetries: 3,
    backoff: 'exponential', // 1s, 2s, 4s
    fallback: '使用快取資料'
  },
  ai_generation: {
    maxRetries: 2,
    onError: '降級至備援模型 (GPT-4o)',
    timeout: 120000 // 2 分鐘
  },
  external_api: {
    maxRetries: 5,
    circuit_breaker: true // 連續失敗 5 次後暫停 10 分鐘
  }
};
```

---

## 七、AI Prompt 工程設計

### 7.1 分層 Prompt 架構

#### System Prompt（系統層，不變）
```
你是一位專業的 SEO 內容寫作專家，擅長創作符合 Google E-E-A-T 標準的高品質文章。

你的寫作原則：
1. 永遠以「幫助讀者解決問題」為核心目標
2. 內容必須基於真實資料，嚴禁虛構數據
3. 保持客觀中立，避免過度行銷
4. 使用清晰易懂的語言，避免冗長句子
5. 適當引用權威來源，增加可信度
```

#### Task Prompt（任務層，動態）
```
## 寫作任務
撰寫關於「{主關鍵字}」的 {文章類型}，目標受眾是 {目標讀者}。

## 大綱結構
{從 S4 傳入的 JSON 大綱}

## 真實資料池
{從 S2 傳入的資料}
- 統計數據：{data}
- 真實案例：{case}
- 權威引用：{citation}

## 寫作要求
- 目標字數：{word_count} 字
- 語氣風格：{style}（從 S3 載入）
- 必須回答的問題：{PAA 列表}
- 必須自然融入使用者提供的個人觀點：「{user_insight}」
```

#### Example Prompt（範例層，Few-shot）
```
## 優秀範例
以下是符合標準的段落範例：

【範例 1：數據引用】
根據台灣網路資訊中心 2024 年調查，目前有 85% 的中小企業已經開始...（來源：TWNIC 2024 報告）

【範例 2：經驗融入】
在實際測試中，我發現這款工具的回應速度比官方宣稱的快了約 20%...

現在請按照相同風格撰寫「{當前段落標題}」。
```

### 7.2 關鍵 Prompt 範本

#### S4: 大綱生成 Prompt
```
根據以下資訊生成文章大綱：

主關鍵字：{keyword}
文章類型：{type}
目標受眾：{audience}

競品分析（前 10 名文章的共同結構）：
{serp_common_structure}

使用者最關心的問題（PAA）：
{paa_questions}

要求：
1. H1 標題必須包含主關鍵字，且具吸引力
2. 規劃 5-8 個 H2 章節
3. 每個 H2 下至少 2 個 H3
4. 確保涵蓋所有 PAA 問題
5. 標記哪些段落需要引用真實數據

請以 JSON 格式輸出大綱結構。
```

#### S5: 段落寫作 Prompt
```
撰寫以下段落：

## 段落資訊
- 章節：{h2_title}
- 子標題：{h3_title}
- 寫作提示：{writing_notes}

## 可用資料
{filtered_data_pool}

## 前文內容（供銜接參考）
{previous_paragraph_last_sentence}

## 要求
1. 段落長度：150-250 字
2. 第一句必須呼應子標題
3. 必須自然融入至少 1 個真實資料
4. 引用資料時格式：「根據 {來源名稱}，{數據或觀點}」
5. 結尾留伏筆，自然過渡到下一段
6. 禁止使用：「總而言之」、「如上所述」等陳腔濫調

開始寫作：
```

#### S6: 品質檢核 Prompt
```
評估以下文章是否符合 E-E-A-T 標準：

{完整文章內容}

檢查項目：
1. Experience（經驗）：
   - 是否包含第一人稱敘述？
   - 是否有實拍圖片或原創數據？
   
2. Expertise（專業）：
   - 內容深度是否足夠？
   - 是否有明顯錯誤或誤導資訊？
   
3. Authoritativeness（權威）：
   - 是否引用權威來源？
   - 引用來源的可信度如何？
   
4. Trustworthiness（可信）：
   - 資訊是否準確？
   - 是否過度行銷或偏頗？

請給出：
1. 各項評分（0-100）
2. 具體問題列表
3. 優化建議

以 JSON 格式輸出。
```

---

## 八、安全性與合規設計

### 8.1 資料安全

1. **加密**
   - 傳輸：全站 HTTPS (TLS 1.3)
   - 儲存：敏感欄位 AES-256 加密
   - API Key：使用 Vault 或 AWS Secrets Manager

2. **權限控制**
   - RBAC（角色型存取控制）
     - Admin：所有權限
     - Editor：審核與發布
     - Writer：建立與編輯自己的文章
   - 專案層級隔離（使用者只能看到自己的專案）

3. **API 安全**
   - Rate Limiting：每使用者 100 req/min
   - JWT Token 認證（15 分鐘過期 + Refresh Token）
   - CORS 白名單

### 8.2 內容合規

1. **版權檢查**
   - 自動檢測與 SERP 內容的相似度
   - 警告超過 30% 相似度的段落
   - 禁止直接複製貼上外部內容

2. **AI 生成標示**
   - 在文章 Metadata 標記「AI 輔助生成」
   - 符合 Google 的 AI 內容揭露要求

3. **隱私保護**
   - 使用者上傳的圖片自動移除 EXIF 資訊
   - 不儲存使用者的 API Key（僅儲存加密後的 hash）

---

## 九、監控與優化

### 9.1 效能指標

**系統效能 KPI**
- SERP 分析時間：< 30 秒
- 大綱生成時間：< 15 秒
- 單篇文章完整生成：< 5 分鐘
- API 回應時間：P95 < 500ms

**業務指標**
- 文章平均品質分數：> 85 分
- 人工修改幅度：< 20%
- 使用者滿意度：> 4.5/5
- 生成文章的 Google 收錄率：> 90%

### 9.2 監控方案

1. **應用層監控**
   - Sentry：錯誤追蹤與警報
   - Datadog：效能 APM
   - Custom Dashboard：業務指標視覺化

2. **AI 模型監控**
   - Token 使用量追蹤（成本控制）
   - 平均生成時間
   - 錯誤率（如 API 超時、內容被拒絕）

3. **使用者行為分析**
   - Mixpanel / Amplitude
   - 追蹤：
     - 最常使用的功能
     - 使用者卡關的步驟
     - 平均文章完成時間

### 9.3 A/B 測試計畫

**測試項目**
1. 不同 AI 模型的輸出品質比較
2. 大綱生成邏輯優化
3. Prompt 模板迭代
4. UI/UX 流程優化

---

## 十、擴充性設計

### 10.1 多語言支援（未來）

- 繁體中文（首發）
- 英文
- 日文
- 其他語言（依需求）

**技術準備**
- i18n 架構（react-i18next）
- 多語言 Prompt 模板庫
- 語言特定的 SEO 規則引擎

### 10.2 進階功能（Roadmap）

**Phase 2**
- 影片腳本生成
- Podcast 大綱生成
- 社群媒體貼文自動生成
- 內容再利用（一篇文章衍生多個格式）

**Phase 3**
- 自動發布排程
- SEO 效果追蹤（整合 Google Analytics / Search Console）
- 競品內容監控（自動追蹤競爭對手新文章）
- AI 自動優化舊文章（根據流量數據）

**Phase 4**
- 多模態內容生成（圖片 + 文字協同）
- 知識圖譜建立（網站內容自動建立關聯）
- 個人化推薦引擎（為不同受眾生成客製內容）

### 10.3 企業版功能

- 多團隊管理
- 白標（White-label）方案
- 私有部署（On-premise）
- API 開放（讓客戶整合到自己的系統）
- 客製化 AI 模型 Fine-tuning

---

## 十一、產品開發里程碑

### Phase 1: MVP（最小可行產品）
**核心功能**
- S1: 內容策劃輸入
- S2: SERP 分析 + 基礎資訊搜尋
- S4: 大綱生成
- S5: AI 寫作（Claude 3.5）
- S7: Markdown 輸出
- S8: 基礎編輯介面

**目標**
- 可完整生成一篇 85 分文章
- 驗證核心工作流程
- 收集早期使用者回饋

### Phase 2: 完整版
**新增功能**
- S3: 風格知識庫
- S6: 完整品質檢核
- S2 強化：多源真實資訊搜尋
- S7 強化：Schema 生成、多格式匯出
- S8 強化：版本控制、協作功能

**目標**
- 達到生產級穩定度
- 支援團隊協作
- E-E-A-T 分數穩定 > 85

### Phase 3: 規模化
**新增功能**
- S0: 完整專案管理系統
- 批次處理（一次生成 50 篇）
- CMS 整合（WordPress、Webflow）
- 效能優化（快取、並行處理）

**目標**
- 支援企業級使用量
- 單日可處理 1000+ 篇文章
- 系統穩定性 99.9%

### Phase 4: 智能化
**新增功能**
- AI 自動優化建議
- 內容效果追蹤與再優化
- 預測性 SEO 建議
- 自動化內容策略規劃

**目標**
- 從「工具」進化為「顧問」
- AI 可主動建議內容方向
- 閉環優化（發布→追蹤→優化）

---

## 十二、實際使用情境對比

### **情境：撰寫「iPhone 15 評測」**

#### 傳統人工流程（8 小時）
```
第 1 天：
- 購買並使用 iPhone 15（1-7 天）
- 拍攝 10 張照片（1 小時）
- 整理測試數據（1 小時）
- 撰寫 2500 字文章（4 小時）
- 查找並引用來源（1 小時）
- 排版與 SEO 優化（1 小時）

總耗時：8 小時（純創作時間）
```

#### 舊版設計流程（錯誤，3-4 小時）
```
問題：要求使用者先準備素材

第 1 天：
- 購買並使用 iPhone 15（1-7 天）
- 拍攝 10 張照片（1 小時）
- 整理心得 500 字（1 小時）
- 登入系統，上傳素材（30 分鐘）
- 等待 AI 生成（5 分鐘）
- 人工修改排版（30 分鐘）

總耗時：3 小時（前期準備佔大部分）
問題：AI 價值僅剩「文字擴寫」，不是真正的效率提升
```

#### 新版設計流程（正確，20 分鐘）
```
✅ 降低啟動門檻，AI 先完成 85% 工作

第 1 天（5 分鐘）- 立即啟動：
- 登入系統
- 輸入「iPhone 15 評測」+ 關鍵字
- 點擊「開始生成」
- AI 自動生成 2500 字基礎文章（85 分）
  （包含：SERP 分析、資料搜尋、大綱、完整內容）

第 2-7 天：
- 使用者正常使用 iPhone 15
- 無需刻意準備素材

第 7 天（15 分鐘）- 經驗補充：
- 打開 S8 智能二修工作台
- 系統自動標記 3-5 處「經驗缺口」：
  
  🔴 段落 3：「外觀與手感」
  💡 建議：加入 1 張實拍照 + 20 字握持手感描述
  預估提升：E-E-A-T +12 分
  
  🔴 段落 7：「電池續航」
  💡 建議：補充「我實測 8 小時使用後剩餘 X%」
  預估提升：可信度 +15 分
  
  🟡 段落 5：「相機表現」
  💡 建議：上傳 1 張實拍照片
  預估提升：視覺吸引力 +8 分

- 快速補充：
  ✓ 輸入手感描述：「握持時稍微偏重，單手操作需要適應」（10 秒）
  ✓ 上傳 2 張照片（30 秒）
  ✓ 補充電池數據：「實測剩餘 35%」（10 秒）
  ✓ 點擊「自動重寫銜接」（AI 處理 20 秒）

- 檢視結果：
  E-E-A-T 分數：82 → 94 ⬆️ +12
  
- 發布或匯出

總耗時：20 分鐘（5 分鐘啟動 + 15 分鐘補充）
效率提升：24 倍（8 小時 → 20 分鐘）
```

### **關鍵差異分析**

| 比較項目 | 傳統人工 | 舊版設計（錯誤） | 新版設計（正確） |
|---------|---------|-----------------|----------------|
| 啟動門檻 | 高（需完整體驗產品） | 高（需先準備素材） | **低（只需輸入主題）** |
| 前期準備 | 3-4 小時 | 2-3 小時 | **5 分鐘** |
| AI 價值 | 無 | 低（僅文字擴寫） | **高（完整內容生成）** |
| 人類專注 | 所有工作 | 素材準備 + 修改 | **僅補充經驗** |
| 總耗時 | 8 小時 | 3-4 小時 | **20 分鐘** |
| E-E-A-T | 90+ (需經驗) | 85 (缺經驗) | **94 (AI+經驗)** |

### **核心洞察**

#### 錯誤假設（舊版）
> 「使用者願意在看到成果前，先投入大量時間準備素材」

#### 正確理解（新版）
> 「使用者希望先看到 80% 的成果，再決定是否投入精力優化」

**這就像：**
- ❌ **錯誤**：要求使用者先畫設計圖，AI 再幫你上色
- ✅ **正確**：AI 先畫好草圖，使用者再修改細節

### **系統價值重新定位**

**從「素材整合工具」→ 變成「內容加速器」**

```
使用者價值：
1. 5 分鐘得到 85 分可用內容（立即價值）
2. 15 分鐘補強至 95 分（選擇性投入）
3. 而非從零開始的 8 小時（傳統方式）
```

**真正的效率提升來自：**
- AI 處理「通用資訊整理」（80%）
- 人類專注「獨特經驗補充」（20%）

而非讓人類先準備素材，AI 再幫忙排版（那只是文書工具，不是 AI 的真正價值）。

---
