# SEO ContentForge (ContentPilot)

> **AI 骨架 + 人類靈魂 = 滿分 SEO 內容**
> 
> 將人工 8 小時的 SEO 文章創作壓縮至 20 分鐘。AI 負責 85 分的基礎建設，人類專注於最後 15 分的真實經驗補充。

## 📖 專案簡介

**SEO ContentForge** (原名 ContentPilot) 是一個企業級的自動化內容生產系統。不同於一般的 AI 寫作工具，本系統導入了 **"Human-in-the-loop" (人類介入)** 的設計哲學。

我們認為 AI 擅長整理通用資訊 (General Information)，但無法憑空產生真實體驗 (Authentic Experience)。因此，本系統設計了 **S8 智能二修工作台**，主動偵測文章中的「經驗缺口」，引導人類作者補充真實案例與觀點，最終由 AI 完美融合，產出符合 Google E-E-A-T 標準的高品質內容。

## 🌟 核心價值與特色

### 1. 嚴格的品質守門員 (Quality Gate)
系統內建 **S6 品質檢核模組**，在文章生成前後進行多重把關：
- **Schema 驗證**：確保 Brief 包含所有必要欄位 (TA、Tone、交付形式)。
- **來源檢核**：強制要求特定領域 (如 Health/Finance) 的最低來源數量。
- **安全性檢查**：自動偵測並注入必要的安全警語與行動框架。
- **讀者模擬評測**：內建 LLM 模擬挑剔讀者，提供 100 分制量化評分與具體修改建議。

### 2. 智能經驗缺口偵測 (Experience Gap Detection)
系統能自動分析文章段落，識別出「缺乏真實體驗」的區域 (S8 模組)：
- **紅燈區**：純理論描述，急需補充實作細節。
- **黃燈區**：有提到概念，但缺乏數據或案例佐證。
- **引導式寫作**：系統會生成具體的問題 (例如：「您在執行此步驟時遇過什麼困難？」)，引導作者快速輸入經驗。

### 3. 智能融合重寫 (Smart Rewrite)
作者只需輸入口語化的經驗描述，AI 會自動將其轉化為專業的段落，並完美融入原文結構中，保持文風一致。

### 4. 完整專案管理 (S0)
- 支援多專案/多網站管理。
- 關鍵字庫與內容行事曆規劃。
- 視覺化儀表板監控內容品質分數。

## 🏗️ 系統架構 (S0-S8)

本系統依據 [完整開發計畫](SEO%20自動化內容生產系統完整開發計.md) 實作，包含以下核心模組：

- **S0 專案管理層**：React 前端專案管理介面。
- **S1 內容策劃輸入**：圖形化 Brief 設定 (Persona, Tone, Unique Angle)。
- **S2 智能資訊採集**：整合 Serper.dev 進行即時 SERP 分析。
- **S4 內容大綱生成**：基於競爭者分析的結構化大綱。
- **S5 AI 寫作引擎**：支援 Gemini/OpenAI/Claude 的多模型生成。
- **S6 品質檢核**：Schema 驗證、來源計數、讀者評分。
- **S8 智能二修工作台**：經驗缺口偵測與互動式修訂。

## 🚀 快速開始

### 前置需求
- Node.js 18+
- PostgreSQL (透過 Docker)
- API Keys (Gemini/OpenAI, Serper.dev)

### 安裝步驟

1. **啟動資料庫**
   ```bash
   docker-compose up -d
   ```

2. **初始化資料庫 Schema**
   ```bash
   docker exec -i contentpilot-postgres psql -U postgres -d contentpilot_dev < backend/src/models/schema.sql
   ```

3. **環境變數設定**
   - 複製 `backend/.env.example` 到 `backend/.env` 並填入 API Keys。
   - 複製 `frontend/.env.example` 到 `frontend/.env`。

4. **啟動後端 (Backend)**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   服務運行於: `http://localhost:3000`

5. **啟動前端 (Frontend)**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   介面運行於: `http://localhost:5173`

## 📚 相關文件

- [完整開發計畫](SEO%20自動化內容生產系統完整開發計.md)
- [內容設定 Schema 規範](backend/docs/CONTENT_CONFIG_SCHEMA.md)
- [讀者評估 Prompt 設計](backend/docs/CONTENT_EVALUATION_PROMPT.md)
- [內容評量標準](backend/docs/CONTENT_EVALUATION_STANDARDS.md)

## 🛠️ 技術棧

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend**: Node.js, Express, PostgreSQL, Redis
- **AI Models**: Google Gemini Pro (Default), OpenAI GPT-4o, Claude 3.5 Sonnet
- **Tools**: Docker, Cheerio, Puppeteer

---
© 2025 SEO ContentForge Team. All Rights Reserved.
