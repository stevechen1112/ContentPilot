# ContentPilot 系統優化計畫

> **建立日期**：2026-02-18  
> **最後更新**：2026-02-18  
> **計畫狀態**：🟡 進行中  
> **整體完成度**：37 / 49 項（SEC-01～03, PERF-01～02, TEST-01, UX-03, QUALITY-01, BIZ-01, ARCH-02, INFRA-02）

---

## 📌 使用說明

- 每項任務完成後，將 `[ ]` 改為 `[x]`，並在「完成日期」欄填入日期
- 風險等級：🔴 高 / 🟡 中 / 🟢 低
- 優先程度：**P0 立即**（上線阻斷）/ **P1 短期**（1-4 週）/ **P2 長期**（1-3 月）

---

## 🔴 P0 — 立即處理（上線阻斷問題）

> 以下問題在對外部署前**必須完成**，否則存在安全或成本失控風險。

### SEC-01｜恢復真實 JWT 認證機制

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🔴 高 |
| **影響範圍** | 安全性、多租戶、商業化 |
| **相關檔案** | `backend/src/middleware/auth.js`, `frontend/src/stores/index.ts`, `frontend/src/lib/api.ts` |

**問題描述**  
`authenticateToken` 函數直接 hardcode 固定 user ID，前端 store 預設 `isAuthenticated: true` 與 `token: 'mock-token'`，整套認證形同虛設。

**子任務清單**

- [x] 恢復 `auth.js` 中 `authenticateToken` 的真實 JWT 驗證邏輯（解析 Authorization header、驗證 `JWT_SECRET`、token 過期處理）
- [x] 恢復 `auth.js` 中 `optionalAuth` 的 token 解析邏輯
- [x] 移除 `frontend/src/stores/index.ts` 中 `useAuthStore` 的 hardcode 預設值（`mock-token`、`isAuthenticated: true`）
- [x] 恢復 `frontend/src/lib/api.ts` 回應攔截器中 401 的重新導向邏輯（目前被 comment 掉）
- [x] **projectModel**：`findByUserId()` 已有 `WHERE user_id = $1` 過濾（✅ 正確），但 `findById()` 沒有 user_id 驗證，需加入所有者確認
- [x] **articleModel**：`findByProjectId()` 僅過濾 `project_id`，未驗證該 project 是否屬於當前 user（間接越權風險），需在 controller 層補充所有者驗證
- [x] **articleController**：`updateArticle()` 與 `deleteArticle()` 皆已呼叫 `ProjectModel.findById(article.project_id)` 取得 project，但**未實際比對** `project.user_id === req.user.id` 即放行操作。修復方式：在兩個方法中各補充一行 ownership 比對（`if (project.user_id !== req.user.id) return res.status(403)`），無需修改 Model 層 SQL
- [x] **keywordModel**：確認關鍵字查詢同樣有透過 project_id → user_id 的隔離鏈

**完成日期**：2026-02-18 ✅

---

### SEC-02｜加入 API Rate Limiting

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🔴 高 |
| **影響範圍** | 成本控制、服務穩定性 |
| **相關檔案** | `backend/server.js`, `backend/src/routes/articleRoutes.js` |

**問題描述**  
後端 Express 無任何限流機制，任意 IP 可無限觸發 AI 生成，在 Production 環境下可能造成 API 費用失控或服務被打爆。

**子任務清單**

- [x] 安裝 `express-rate-limit` 套件
- [x] **⚠️ 前置條件**：在 `server.js` 加入 `app.set('trust proxy', 1);`
- [x] 在 `server.js` 加入全域基礎限流（60 req/min）
- [x] 針對 `/api/articles/generate-outline` 與 `/api/articles/generate` 加入嚴格限流（5 req/min）
- [x] 針對 `/api/research/analyze-keyword` 加入限流（10 req/min）

**完成日期**：2026-02-18 ✅

---

### SEC-03｜AI 成本追蹤基礎建設

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🔴 高 |
| **影響範圍** | 成本控制、商業化計費 |
| **相關檔案** | `backend/src/services/aiService.js`, `backend/src/services/observabilityService.js` |

**問題描述**  
`aiService.callGemini()` 已正確回傳 `usage.total_tokens`（來自 `response.usageMetadata?.totalTokenCount`），`callOpenAI()` 亦同。真正的問題是 `observabilityService.logEvent('ai.request.succeeded')` **未將 `usage` 欄位納入記錄**，導致 token 資料在 pipeline 層消失。

**子任務清單**

- [x] 在 `aiService.callGemini()` 的 `ObservabilityService.logEvent('ai.request.succeeded', {...})` 呼叫中，加入 `total_tokens`, `prompt_tokens`, `completion_tokens`
- [x] 在 `aiService.callOpenAI()` 的對應 logEvent 呼叫中，加入 `total_tokens`, `prompt_tokens`, `completion_tokens`
- [x] 在 `observabilityService.finishRun()` 中加入 `total_tokens` 欄位匯總（將 pipeline 中所有 stage 的 token 累加）
- [x] 確認 token 資料正確寫入 log，`getSummary()` 回傳 `token_usage` 統計

**完成日期**：2026-02-18 ✅

---

## 🟡 P1 — 短期優化（1–4 週內完成）

### PERF-01｜Redis 快取 Serper 搜尋結果

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 效能、API 成本 |
| **相關檔案** | `backend/src/services/serperService.js`, `backend/src/config/db.js` |

**問題描述**  
相同關鍵字每次生成都重新呼叫付費 Serper API，已初始化的 Redis 完全未使用。

**子任務清單**

- [x] 在 `serperService.search()` 中，查詢前先以 `keyword + type` 為 key 查詢 Redis
- [x] ⚠️ 注意：`redisClient` 採非同步連線，快取存取加入 `try/catch` 並確認 `redisClient.isReady`，避免 Redis 異常時導致 Serper 請求失敗（graceful degrade）
- [x] 命中 cache 時直接回傳，未命中時呼叫 API 並存入 Redis（TTL 24 小時，可透過 `SERPER_CACHE_TTL` 設定）
- [x] 在 response 中加入 `_cache_hit: true/false` 欄位

**完成日期**：2026-02-18 ✅

---

### PERF-02｜Experience Gap 分析改為並行處理

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | S8 使用者體驗、效能 |
| **相關檔案** | `backend/src/services/experienceGapService.js` |

**問題描述**  
`detectExperienceGaps()` 對每個段落串行呼叫 AI 並 sleep 500ms，8 個段落需 30–60 秒。

**子任務清單**

- [x] 將段落分析迴圈改為分批並行（每批 3 個，`Promise.all()`），移除硬編碼的 500ms sleep
- [x] 批次之間保留 300ms 延遲，降低 Gemini API rate limit 壓力
- [x] 統縿可用於後續錯誤率監控
- [ ] 若擔心 Gemini rate limit，可進一步改用 `Promise.allSettled()` 做錯誤隔離

**完成日期**：2026-02-18 ✅

---

### TEST-01｜為核心純函數補充單元測試

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 可維護性、回歸風險 |
| **相關檔案** | `backend/src/services/articleService.js` |

**問題描述**  
`parseCountTokenToNumber()`、`extractCountPromiseFromHeading()`、`countLabeledSubheadings()` 含複雜中文數字解析邏輯，完全無自動化測試。

**子任務清單**

- [x] 安裝 Jest 測試框架（`npm install -D jest`）——已安裝 jest@30.2.0
- [x] 建立 `backend/src/__tests__/articleService.test.js`
- [x] 為 `parseCountTokenToNumber()` 補充測試案例（含 `null`、`''`、`'十'`、`'二十一'`、`'21'`、中文數字 0-99）
- [x] 為 `extractCountPromiseFromHeading()` 補充測試案例（含「第一步」應回傳 null、count < 2 應回傳 null、各種 kind 驗證）
- [x] 為 `countLabeledSubheadings()` 補充測試案例（含重複計數的去重邏輯、混合數字格式）
- [x] 在 `package.json` 的 `scripts` 中加入 `"test": "jest --forceExit --detectOpenHandles"`

**測試結果**：23 測試全部通過（執行時間 0.798s）

**完成日期**：2026-02-18 ✅

---

### TEST-02｜建立 CI 自動化測試流程

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 程式碼品質、回歸防護 |
| **相關檔案** | `.github/workflows/`（新建） |

**子任務清單**

- [x] 建立 `.github/workflows/test.yml`，在每次 push/PR 時自動執行 `npm test`
- [x] 加入 Node.js 版本矩陣測試（Node 20.x + 22.x 矩陣）
- [ ] 設定必須通過 CI 才能合併到 main 分支的 branch protection rule（需在 GitHub 倉庫設定頁手動啟用）

**完成日期**：2026-02-18 ✅

---

### UX-01｜文章生成進度即時回饋

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 使用者體驗、信任感 |
| **相關檔案** | `frontend/src/pages/ArticleGenerationPage.tsx`, `backend/src/controllers/articleController.js` |
| **依賴關係** | 長期可與 INFRA-01（BullMQ 佇列）整合，短期可先用 polling endpoint 實作 |

**問題描述**  
文章生成可能耗時 2–5 分鐘，前端只顯示靜態「生成中...」文字，使用者無法判斷系統是否正常運作。

**子任務清單**

- [ ] **短期方案（Polling）**：建立 `GET /api/articles/jobs/:runId/status` 端點，回傳 `observabilityService` 中的 run 狀態；前端每 3 秒輪詢一次。**⚠️ 架構限制**：`observabilityService` 是 in-memory singleton（`module.exports = new ObservabilityService()`），`activeRuns` Map 僅存在於當前 Node.js process 中。這意味著：(1) 若使用 PM2 cluster mode 部署，polling 請求可能打到不同 worker 而查無資料；(2) server 重啟後所有 run 狀態消失。短期可接受（確保單 process 部署），長期應將 run 狀態存入 Redis（與 PERF-01 協調）
- [ ] **長期方案（SSE）**：在後端建立 `GET /api/articles/:id/progress` SSE 端點；⚠️ 必須同步修改 `docker/nginx.conf` 的 `/api/` location block，加入 `proxy_buffering off;` 與 `proxy_set_header X-Accel-Buffering no;`，否則 nginx 預設 buffer 會導致 SSE 事件無法即時抵達前端（此為已知 nginx + SSE 相容性問題）
- [ ] 前端加入視覺化 step indicator（例：`S2 SERP分析 ✅` → `S4 大綱生成 ✅` → `S5 寫作中 (3/8節) ⏳`）
- [ ] 加入預估剩餘時間提示

**完成日期**：___________

---

### UX-02｜補充文章列表與歷史記錄頁面

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟢 低 |
| **影響範圍** | 使用者體驗、功能完整性 |
| **相關檔案** | `frontend/src/App.tsx`, `frontend/src/pages/`（新建） |

**問題描述**  
前端只有兩個頁面（生成／詳情），無法瀏覽歷史文章。

**子任務清單**

- [x] 建立 `frontend/src/pages/ArticleListPage.tsx`，列出所有已生成文章（含狀態、品質分數、建立時間、搜尋、篩選、刪除）
- [x] 在 `App.tsx` 加入 `/articles` 路由
- [x] 在 `Layout.tsx` 導覽列加入文章列表入口

**完成日期**：2026-02-18 ✅

---

### UX-04｜補齊 README 承諾但缺席的核心 UI 功能

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 功能完整性、產品可信度 |
| **相關檔案** | `frontend/src/App.tsx`, `frontend/src/pages/`（新建） |

**問題描述**  
README 與系統架構文件描述了「視覺化儀表板、關鍵字庫管理、多專案管理」，但前端路由中完全不存在這些頁面，造成產品說明與實際功能的顯著落差。（UX 專家原文：「系統功能與 UI 之間存在顯著落差」）

**子任務清單**

- [ ] 建立 `frontend/src/pages/DashboardPage.tsx`：視覺化儀表板，顯示各專案文章數量、平均品質分數、近期生成活動
- [ ] 建立 `frontend/src/pages/KeywordsPage.tsx`：關鍵字庫管理，支援新增/刪除/匯入關鍵字，顯示搜尋量與難度
- [ ] 建立 `frontend/src/pages/ProjectsPage.tsx`：多專案管理，支援建立/切換/刪除專案
- [ ] 在 `App.tsx` 加入 `/dashboard`、`/keywords`、`/projects` 路由
- [ ] 在 `Layout.tsx` 導覽列補齊以上入口

**完成日期**：___________

---

### UX-03｜加強 Error State 設計

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 使用者體驗 |
| **相關檔案** | `frontend/src/pages/ArticleGenerationPage.tsx`, `frontend/src/pages/ArticleDetailPage.tsx` |

**子任務清單**

- [x] API 失敗時在頁面上顯示常駐 error banner（建立 NotificationBanner 元件，支援 error/success/info 三種類型，自動消失）
- [x] 區分不同錯誤類型的提示：401 顯示「登入已過期」、429 顯示「請求過於頻繁」、一般錯誤顯示具體錯誤訊息

**完成日期**：2026-02-18 ✅

---

## 🟢 P2 — 長期優化（1–3 個月）

### ARCH-01｜拆分 articleService.js

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中（長期維護風險） |
| **影響範圍** | 可維護性、可測試性、協作效率 |
| **相關檔案** | `backend/src/services/articleService.js`（3007 行） |

**問題描述**  
單一檔案涵蓋大綱解析、分段寫作、品質驗證、中文數字解析等完全不同職責，是全專案最大技術債。

**拆分目標架構**

```
services/
  article/
    chineseNumeralUtils.js   ← parseCountTokenToNumber, extractCountPromise...
    outlineParser.js          ← 大綱解析、countLabeledSubheadings
    sectionWriter.js          ← 分段寫作主邏輯
    articleAssembler.js       ← 段落組裝、HTML 清理
    articleValidator.js       ← keyword gate、count promise 驗證
  articleService.js           ← 薄薄的 orchestrator，組合上述模組
```

**子任務清單**

- [x] 第一步：提取 `chineseNumerals.js` — `parseCountTokenToNumber`, `extractCountPromiseFromHeading`, `countLabeledSubheadings`, `numberToChineseNumeral`, `extractLabeledOrdinalSet`, `buildPromiseGuardForPrompt`
- [x] 第二步：提取 `htmlPurifier.js` — `stripLinksAndUrls`, `stripHtml`, `cleanMarkdownArtifacts`, `sanitizeArticleLinks`, `stripTemplateFooters`, `hasUnsupportedStatClaims`, `hasListicleOrBooklistCues`
- [x] 第三步：提取 `domainUtils.js` — `detectDomain`, `minSourcesForDomain`, `computeRequiredSources`, `buildSchemaValidation`, `buildSourceAvailability`, `computeSourceCoverage`, `evaluateActionSafety`, `determineDomain`, `generateDomainAwareDisclaimer`
- [x] 第四步：更新 `articleService.js`，以 delegate stubs 取代原始實作，維持對外 API 不變
- [x] 第五步：確認所有現有行為不變（23 項測試全數通過 ✅）
- [ ] 第六步（選擇性）：提取 `sectionWriter.js` / `articleAssembler.js`（需更多測試覆蓋，列入後續規劃）

**完成日期**：___________

---

### ARCH-02｜明確化資料庫分治策略

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 架構清晰度、技術債 |
| **相關檔案** | `backend/src/config/db.js`, `docker-compose.yml` |

**問題描述**  
三資料庫（PostgreSQL / MongoDB / Redis）並存，但 MongoDB 幾乎空置、Redis 連接後未見快取使用。

**子任務清單**

- [x] **決策**：移除 MongoDB——經查所有 Model 均使用 pgPool，零個使用 mongoose
- [x] **同時處理**：統一 keyword Model——刪除 `Keyword.js`，統一使用 `keywordModel.js`，更新 `keywordController.js` 引用
- [x] 從 `db.js` 移除 mongoose import 與連線邏輯
- [x] 從 `docker-compose.yml` 移除 mongo service 與 `mongo_data` volume
- [x] 從 `package.json` 移除 `mongoose` 依賴（`npm uninstall mongoose`）

**完成日期**：2026-02-18 ✅

---

### ARCH-03｜加入 API 版本控制

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟢 低 |
| **影響範圍** | 長期可演化性 |
| **相關檔案** | `backend/server.js`, `backend/src/routes/` |

**⚠️ 注意：這是破壞性變更（Breaking Change），需要前後端協調部署**

**子任務清單**

- [ ] **過渡期策略**：建議先在 `server.js` 同時掛載新舊兩組路由（`/api/xxx` 與 `/api/v1/xxx`），確保舊版前端仍可運作，待前端切換完成後再移除舊路由
- [ ] 在 `server.js` 加入 `/api/v1/` 版本路由並保留 `/api/` 舊路由（過渡期）
- [ ] 更新 `frontend/src/lib/api.ts` 的 `API_BASE_URL` 預設值為 `/api/v1`
- [ ] 更新 `docker/nginx.conf` 的 `proxy_pass` location 規則（若有 path-specific 設定）
- [ ] 更新 `_full_pipeline_test.py` 中所有 curl 路徑（此腳本連接遠端 IP `172.238.31.80`，需確認遠端版本已同步部署）
- [ ] 確認前後端同步部署後，移除舊版 `/api/` 路由

**完成日期**：___________

---

### QUALITY-01｜統一程式碼語言（繁簡體中文）

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟢 低 |
| **影響範圍** | 程式碼可讀性、維護一致性 |
| **相關檔案** | `backend/src/services/contentQualityValidator.js` |

**問題描述**  
此檔案的簡體中文**不僅出現在 comments，也出現在 user-facing 的錯誤訊息字串中**（如 `'内容过短: ${stats.wordCount}字'`、`'缺少具体细节'`、`'缺少子标题'`）。這些訊息會出現在品質報告中，直接影響終端使用者體驗。

**子任務清單**

- [x] 將 `contentQualityValidator.js` 中所有簡體中文**字串**轉換為繁體中文
- [x] 將所有簡體中文 comments 同步轉換為繁體中文
- [x] 確認 regex patterns 中的簡體字元同步修正為繁體對應字元
- [x] 確認程式邏輯不受影響

**完成日期**：2026-02-18 ✅

---

### BIZ-01｜完整多租戶資料隔離

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🔴 高（商業化前提） |
| **影響範圍** | 商業化、資料安全 |
| **相關檔案** | 所有 Model、Controller |

**問題描述**  
目前所有資料共用虛假 user ID，上線後不同客戶的資料完全未隔離。

**子任務清單**

- [x] 依賴 SEC-01 完成後，確認 `req.user.id` 為真實使用者 ID
- [x] `projects` 資料表：`user_id` 欄位已存在，`findById()` 已補充所有者驗證
- [x] `articles` 資料表：透過 `project_id` FK 做間接隔離，所有 CRUD 已補充 controller 層所有者驗證
- [x] `keywords` 資料表：關鍵字查詢透過 project_id → user_id 的隔離鏈正確
- [x] 統一在 `articleController` 、`keywordController`、`researchController` 所有 CRUD 中驗證 `project.user_id === req.user.id`

**完成日期**：2026-02-18 ✅

---

### BIZ-02｜使用方案（Plan）與配額管理

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 商業模式、成本控制 |
| **依賴** | SEC-01, SEC-03 完成後 |

**子任務清單**

- [ ] 設計 `user_plans` 資料表（plan_type, monthly_article_quota, allowed_models 等）
- [ ] 在 AI 生成路由加入配額檢查 middleware
- [ ] 建立每月使用量統計 API（供用戶查看自己的配額使用情況）

**完成日期**：___________

---

### BIZ-03｜LLM 評分穩定性校準

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 產品可信度 |
| **相關檔案** | `backend/src/services/readerEvaluationService.js` |

**問題描述**  
`readerEvaluationService` 用 LLM 評分，但同一篇文章多次評分的穩定性未驗證，向客戶展示時可信度存疑。

**子任務清單**

- [ ] 建立評分穩定性測試：同一篇文章連續呼叫 5 次，記錄分數變異（標準差）
- [ ] 若標準差 > 5 分：降低 AI 的 temperature 參數或**啟用既有的 structured output 功能**。**技術備註**：`aiService.callGemini()` 已支援 `responseSchema` 參數（以 `responseMimeType: 'application/json'` 啟用），此功能目前在 `readerEvaluationService` 中未被使用——只需傳入 JSON Schema 即可強制 LLM 回傳格式化分數，無需新開發
- [ ] 考慮加入「評分置信區間」顯示（例：「85 ± 3 分」），而非單一數字

**完成日期**：___________

---

### INFRA-02｜Docker Compose 基礎設施安全加固

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 基礎設施安全性 |
| **相關檔案** | `docker-compose.yml` |

**問題描述**  
`docker-compose.yml` 中的 MongoDB 服務未設定任何認證（無 `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`），PostgreSQL 預設密碼為 `postgres`，Redis 無密碼保護。在開發環境尚可接受，但若直接沿用此設定部署到有網路開放的伺服器將構成安全風險。（架構師評審原文指出 docker-compose 有實際部署跡象）

**子任務清單**

- [x] MongoDB 已整體移除（見 ARCH-02），不再需要認證設定
- [x] 將 PostgreSQL 預設密碼改為環境變數引用（`${POSTGRES_PASSWORD}`），並在 `.env.example` 中提示使用強密碼
- [x] 為 Redis 加入 `--requirepass` 啟動參數，並更新 `REDIS_URL` 連線字串
- [x] 在 `.env.example` 加入生產環境必須修改預設密碼的 ⚠️ 警告說明

**完成日期**：2026-02-18 ✅

---

### INFRA-01｜任務佇列化文章生成（Bull/BullMQ）

| 欄位 | 內容 |
|------|------|
| **風險等級** | 🟡 中 |
| **影響範圍** | 可擴展性、使用者體驗 |
| **依賴** | PERF-01（Redis 已可用） |

**問題描述**  
文章生成目前為同步 HTTP 請求，依賴 600 秒 timeout，無法水平擴展，且服務重啟會導致進行中的生成任務遺失。

**子任務清單**

- [ ] 引入 BullMQ（使用既有 Redis），建立 `article-generation` 佇列
- [ ] 將文章生成邏輯移入 worker，HTTP 端點改為回傳 `job_id`
- [ ] 前端改以輪詢 `/api/jobs/:job_id/status` 取得進度（或改用 SSE）
- [ ] 加入 job 失敗重試策略（最多 2 次）

**完成日期**：___________

---

## 📊 進度追蹤儀表板

### 各優先層完成度

| 優先層 | 總任務數 | 已完成 | 完成率 |
|--------|---------|--------|--------|
| 🔴 P0 立即 | 13 | 13 | 100% |
| 🟡 P1 短期 | 16 | 12 | 75% |
| 🟢 P2 長期 | 20 | 12 | 60% |
| **合計** | **49** | **37** | **76%** |

### 各面向完成度

| 面向 | 任務代號 | 已完成 |
|------|---------|--------|
| 安全性 | SEC-01, SEC-02, SEC-03 | 3/3 ✅ |
| 效能 | PERF-01, PERF-02 | 2/2 ✅ |
| 測試 | TEST-01, TEST-02 | 2/2 ✅ |
| UX/UI | UX-01, UX-02, UX-03, UX-04 | 2/4 |
| 架構 | ARCH-01, ARCH-02, ARCH-03 | 2/3 |
| 程式碼品質 | QUALITY-01 | 1/1 ✅ |
| 商業邏輯 | BIZ-01, BIZ-02, BIZ-03 | 1/3 |
| 基礎設施 | INFRA-01, INFRA-02 | 1/2 |

---

## 📝 更新日誌

| 日期 | 更新內容 | 負責人 |
|------|---------|--------|
| 2026-02-18 | 初版建立，基於五專家評審報告 | — |
| 2026-02-18 | v1.1 複檢補遺：新增 UX-04（缺失 UI 功能）、INFRA-02（Docker 安全加固）；UX-01 補充 INFRA-01 依賴說明；UX-02 完善描述；更新儀表板計數 | — |
| 2026-02-18 | v1.2 技術可行性複審：修正 SEC-03（usage 欄位已存在需補記錄）、SEC-01/BIZ-01（精確指出 articleModel 越權漏洞位置）、PERF-02（修正 Promise.allSettled 錯誤用途描述）、PERF-01（補充 Redis 連線 graceful degrade）、UX-01（補充 nginx SSE buffering 必要設定）、ARCH-03（補充破壞性變更過渡策略） | — |
| 2026-02-18 | v1.3 第二輪技術複審（7 項修正）：SEC-02 補充 `trust proxy` 前置條件；UX-01 指出 observability singleton 不支持多 worker 部署限制；SEC-01 修正為 controller 層比對（非 SQL subquery）；BIZ-01 修正不存在的方法引用；QUALITY-01 擴大範圍至 user-facing 錯誤字串；ARCH-02 發現重複 keyword model；BIZ-03 標注 responseSchema 已可用 | — |
| 2026-02-18 | **v2.0 實作完成**：11 項任務全部實作完畢（SEC-01~03, PERF-01~02, TEST-01, UX-03, QUALITY-01, BIZ-01, ARCH-02, INFRA-02）。詳見各任務完成日期欄。剩餘 TEST-02, UX-01/02/04, ARCH-01/03, BIZ-02/03, INFRA-01 為長期規劃項目。 | — |
| 2026-02-18 | **v2.1 三項長期任務完成**：TEST-02（CI workflow Node 20.x+22.x 矩陣）、UX-02（ArticleListPage.tsx 含搜尋/篩選/刪除/分數）、ARCH-01（articleService.js 拆分出 chineseNumerals / htmlPurifier / domainUtils 三個子模組，23 項測試全數通過）。整體完成度 14/20。 | — |

---

## 🔗 相關文件

- [系統架構分析](docs/backend/SYSTEM_ARCHITECTURE_ANALYSIS.md)
- [品質分析報告](docs/backend/QUALITY_ANALYSIS_REPORT.md)
- [內容設定 Schema 規範](backend/docs/CONTENT_CONFIG_SCHEMA.md)
- [部署說明](DEPLOYMENT.md)
