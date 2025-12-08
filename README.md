# ContentPilot (SEO ContentForge)

SEO 自動化內容生產系統 - 結合 AI 骨架與人類靈魂的高效寫作平台。

## 🚀 專案簡介

ContentPilot 是一個協助內容創作者快速生產高品質 SEO 文章的工具。它利用 **Google Gemini 2.0 Flash** 的強大能力自動生成 85 分的基礎內容，並提供智能介面引導使用者補充關鍵的「真實經驗」，最終產出符合 Google E-E-A-T 標準的優質文章。

本系統已全面採用 **Gemini API** 作為核心 AI 引擎，移除了對本地 LLM (Ollama) 的依賴，大幅降低部署門檻並提升生成速度與品質。

## 🛠️ 技術架構

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **AI Engine**: Google Gemini API (Gemini 2.0 Flash / Pro)
- **Search Engine**: Serper.dev API (Google Search Results)
- **Database**: PostgreSQL (主要資料), MongoDB (日誌/文件), Redis (快取)

## ✨ 核心功能

### 1. 主題驅動生成 (Topic-Driven Generation)
- **關鍵字即主題**：直接輸入目標關鍵字（如「上背痛原因」），系統自動判讀意圖並生成對應文章。
- **客製化設定**：支援設定「目標受眾」（如：一般大眾、專業人士）與「語氣」（如：專業親切、幽默風趣）。

### 2. 智能大綱與研究 (Smart Outline & Research)
- **SERP 分析**：自動分析 Google 前幾名搜尋結果，提取熱門標題與結構。
- **競爭對手分析**：深入分析競爭對手的文章結構 (H2/H3)，找出內容缺口。
- **People Also Ask**：自動整合使用者常見問題，增加內容豐富度。

### 3. 高品質文章寫作 (High-Quality Writing)
- **Gemini 全面驅動**：從大綱規劃、引言撰寫到內文生成，全程使用 Gemini 模型，確保邏輯連貫與語意通順。
- **E-E-A-T 優化**：內建權威來源檢索 (Librarian Service)，確保引用資料的可信度。
- **自動引用**：文章中會自動標註參考來源，提升 SEO 權重。

### 4. 智能二修與經驗補強 (Smart Refinement)
- **經驗缺口檢測 (Experience Gap Detection)**：AI 自動識別文章中缺乏「真實體驗」的段落。
- **引導式補充**：系統提示使用者輸入個人經驗或案例。
- **智能融合**：AI 將使用者的真實經驗無縫融入文章中，打造獨一無二的原創內容。

## 🔄 工作流程 (S1-S8)

1.  **S1 內容策劃**: 設定關鍵字、受眾與語氣。
2.  **S2 深度搜尋**: 透過 Serper API 獲取 SERP 資料與競爭對手資訊。
3.  **S3 策略分析**: 分析搜尋意圖與內容缺口。
4.  **S4 大綱生成**: Gemini 規劃最佳化文章結構。
5.  **S5 全文生成**: 
    - **Librarian**: 預先檢索權威來源。
    - **Writing**: Gemini 逐段撰寫，確保內容深度。
6.  **S6 結構優化**: 強制 HTML 結構 (H2/H3) 輸出。
7.  **S7 格式輸出**: 生成標準 HTML，包含 Meta Description 與引用連結。
8.  **S8 經驗補強**: 檢測並引導補充真實經驗。

## ⚡ 快速開始

### 1. 環境準備
- Node.js (v18+)
- Google Gemini API Key
- Serper.dev API Key

### 2. 安裝依賴

```bash
# 安裝後端依賴
cd backend
npm install

# 安裝前端依賴
cd ../frontend
npm install
```

### 3. 設定環境變數

請參考 `.env.example` 建立 `.env` 檔案：

**Backend (`backend/.env`)**:
```env
PORT=3000
# AI Configuration
GOOGLE_GEMINI_API_KEY=your_gemini_key
GOOGLE_GEMINI_MODEL=gemini-2.0-flash-exp

# Search Configuration
SERPER_API_KEY=your_serper_key

# Database (Optional for local dev if using mock)
POSTGRES_HOST=localhost
...
```

### 4. 啟動專案

**啟動後端**:
```bash
cd backend
npm start
# 或使用開發模式
npm run dev
```

**啟動前端**:
```bash
cd frontend
npm run dev
```

前端預設運行於 `http://localhost:5173`，後端 API 運行於 `http://localhost:3000`。

## 🧪 測試腳本

專案包含多個測試腳本，位於 `backend/` 目錄下：

- `node test-gemini-only.js`: 測試單篇 Gemini 文章生成流程。
- `node batch-generate-articles.js`: 批量生成文章測試。
- `node generate-real-article.js`: 生成真實完整的 HTML 文章檔案。

## 📄 授權

MIT License
