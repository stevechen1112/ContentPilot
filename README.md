# SEO ContentForge (ContentPilot)

SEO 自動化內容生產系統 - 結合 AI 骨架與人類靈魂的高效寫作平台。

## 🚀 專案簡介

ContentPilot 是一個協助內容創作者快速生產高品質 SEO 文章的工具。它利用 AI 自動生成 85 分的基礎內容，並提供智能介面引導使用者補充關鍵的「真實經驗」，最終產出符合 Google E-E-A-T 標準的優質文章。

## 🛠️ 技術架構

- **Frontend**: React 19.2, TypeScript, Vite, Tailwind CSS, Zustand, React Query
- **Backend**: Node.js, Express, JWT Authentication
- **AI Service**: Anthropic Claude Sonnet 4.5, OpenAI GPT-4o, Ollama (Local LLM)
- **Database**: PostgreSQL (關聯資料), MongoDB (文件資料), Redis (快取/佇列)
- **Infrastructure**: Docker, Nginx

## 🔄 核心工作流程 (S1-S8)

本系統採用模組化設計，模擬專業 SEO 團隊的運作流程：

1.  **S1 內容策劃**: 專案與關鍵字管理，定義目標受眾。
2.  **S2 深度閱讀 (Deep Reading)**: 
    - **黑名單機制**: 排除維基百科等非原創來源，優先抓取商業網站、新聞媒體與部落格。
    - **全文抓取**: 讀取來源網頁前 1500 字內文，而非僅依賴搜尋摘要，確保引用內容精準。
3.  **S3 策略分析**: 分析競爭對手結構，找出內容缺口。
4.  **S4 大綱生成**: AI 規劃最佳化文章結構 (H2/H3)。
5.  **S5 雙重生成 (Two-Pass Generation)**: 
    - **Pass 1 (Drafting)**: 結合深度閱讀資料，生成內容初稿。
    - **Pass 2 (Deep Refinement)**: 啟動「嚴格主編」AI，進行去蕪存菁、結構修復與語氣潤飾。
6.  **S6 結構強制 (Code-Level SEO)**: 由系統代碼強制插入 H2 標籤，不依賴 AI 生成，確保 100% 完美的 HTML 結構。
7.  **S7 格式輸出**: 生成標準 HTML 格式，自動注入真實引用連結。
8.  **S8 經驗缺口檢測**: 獨家功能，識別內容中缺乏「真實經驗」的段落，引導人工補強。

## 🏆 SEO 品質標準

系統產出的內容嚴格遵循以下標準：

- **Google E-E-A-T**:
    - **Experience (經驗)**: 透過 S8 模組確保包含真實案例。
    - **Expertise (專業)**: 引用權威來源 (.gov, .edu, 學術期刊) 與優質商業來源。
    - **Authoritativeness (權威)**: 建立正確的知識圖譜，避免內容空洞。
    - **Trustworthiness (信任)**: 嚴格的事實查核，所有引用連結皆經過預先驗證 (Pre-verified)。
- **結構完美性**: 
    - **H2/H3 層級**: 由代碼強制控制，杜絕標題斷裂或重複。
    - **Scope Control**: 嚴格限制 AI 寫作範圍，防止段落間內容重複。
- **原創性 (Originality)**: 確保內容非抄襲，通過相似度檢測。
- **結構化數據**: 自動生成 H1-H3 標籤、Meta Description 與目錄。

## ⚡ 快速開始（Windows）

### 1. 一鍵啟動（推薦）

我們提供了自動化 PowerShell 腳本，讓您能一鍵啟動完整的開發環境。

```powershell
# 1. 檢查環境狀態 (Node.js, Docker, Ports)
.\check-env.ps1

# 2. 啟動所有服務 (Backend + Frontend)
.\start-dev.ps1
```

啟動後，請開啟瀏覽器訪問：
- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3000

若要停止服務，請執行：
```powershell
.\stop-dev.ps1
```

### 2. 手動啟動

如果您偏好手動控制每個服務：

**步驟 1: 啟動資料庫**
```bash
docker-compose up -d
```

**步驟 2: 啟動後端 (Port 3000)**
```bash
cd backend
npm install
node server.js
```

**步驟 3: 啟動前端 (Port 5173)**
```bash
cd frontend
npm install
npm run dev
```

## 📖 文件導航

| 文件 | 說明 |
|------|------|
| [LOCAL_DEPLOYMENT.md](LOCAL_DEPLOYMENT.md) | 📦 完整本地部署與環境配置指南 |
| [OLLAMA_INTEGRATION.md](OLLAMA_INTEGRATION.md) | 🦙 本地 LLM (Ollama) 整合說明 |
| [backend/API_TESTING.md](backend/API_TESTING.md) | 🧪 API 測試與端點說明 |

## 🧪 測試與驗證

本專案包含完整的端到端測試腳本，用於驗證 SEO 生成流程。

### 執行完整 E2E 測試
```bash
cd backend
node test-full-e2e.js
```
此測試將模擬真實用戶行為：
1. 登入並創建專案
2. 分析 SERP 資料
3. 生成文章大綱與內容
4. 執行 SEO 與 E-E-A-T 品質檢測
5. 產出 `generated-article.html` 與 `test-report.json`

## 📂 專案結構

```
ContentPilot/
├── backend/        # Node.js 後端 API (Express)
├── frontend/       # React 前端應用 (Vite)
├── docs/           # 專案設計文件
├── docker/         # Docker 配置
├── check-env.ps1   # 環境檢查腳本
├── start-dev.ps1   # 啟動腳本
└── docker-compose.yml
```

## 📝 開發狀態

- **後端核心**: ✅ 完成 (S1-S8 模組)
- **AI 引擎**: ✅ 完成 (支援 Claude, OpenAI, Ollama)
- **前端介面**: 🚧 開發中
