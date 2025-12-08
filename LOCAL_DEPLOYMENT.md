# ContentPilot 本地部署指南

本指南將協助您在 Windows 本地環境快速部署 ContentPilot 開發環境。

---

## 📋 前置需求

### 必須安裝的軟體

1. **Node.js 18+**
   - 下載: https://nodejs.org/
   - 驗證: `node --version`

2. **Docker Desktop**
   - 下載: https://www.docker.com/products/docker-desktop
   - 驗證: `docker --version`
   - ⚠️ 確保 Docker Desktop 已啟動並運行

3. **PowerShell 5.1+** (Windows 內建)
   - 驗證: `$PSVersionTable.PSVersion`

### 需要的 API Keys

請先註冊並取得以下服務的 API Keys：

- **Anthropic Claude API**: https://console.anthropic.com/
- **OpenAI API** (選用): https://platform.openai.com/
- **Serper API** (搜尋引擎): https://serper.dev/

---

## 🚀 快速開始（一鍵安裝）

### 步驟 1: 自動設定環境

在專案根目錄執行：

```powershell
.\setup-local.ps1
```

這個腳本會自動：
- ✅ 檢查 Docker 與 Node.js 環境
- ✅ 啟動 PostgreSQL、MongoDB、Redis 容器
- ✅ 初始化資料庫 Schema
- ✅ 建立環境變數範本檔案

### 步驟 2: 填寫 API Keys

編輯 `backend\.env` 檔案，填入您的 API Keys：

```env
# AI Services - Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-your-key-here

# AI Services - OpenAI (Fallback)
OPENAI_API_KEY=sk-your-openai-key-here

# Search API - Serper
SERPER_API_KEY=your-serper-key-here
```

### 步驟 3: 安裝依賴套件

```powershell
# 安裝後端依賴
cd backend
npm install

# 安裝前端依賴
cd ..\frontend
npm install
```

### 步驟 4: 啟動開發伺服器

回到專案根目錄：

```powershell
cd ..
.\start-dev.ps1
```

此腳本會在新視窗自動啟動：
- **Backend API**: http://localhost:3000
- **Frontend UI**: http://localhost:5173

---

## 📦 服務運行狀態檢查

### 檢查資料庫容器

```powershell
docker ps
```

應該看到 3 個容器運行中：
- `contentpilot-postgres` (Port 5433)
- `contentpilot-mongo` (Port 27017)
- `contentpilot-redis` (Port 6379)

### 檢查 Backend API

瀏覽器開啟: http://localhost:3000/health

應該返回：
```json
{
  "status": "OK",
  "timestamp": "2025-12-07T..."
}
```

### 檢查 Frontend

瀏覽器開啟: http://localhost:5173

應該看到登入頁面。

---

## 🧪 測試整合功能

### 執行整合測試

```powershell
cd backend
node test-integration.js
```

測試涵蓋完整用戶流程：
1. ✅ 用戶註冊
2. ✅ 用戶登入
3. ✅ 建立專案
4. ✅ 批次新增關鍵字
5. ✅ AI 生成大綱
6. ✅ AI 生成文章
7. ✅ 取得文章詳情

### 使用 Postman 測試 API

1. 匯入 `backend/ContentPilot-API-Tests.postman_collection.json`
2. 設定環境變數：
   - `base_url`: http://localhost:3000
3. 依序執行測試案例

---

## 🛑 停止開發環境

### 方法 1: 使用停止腳本

```powershell
.\stop-dev.ps1
```

此腳本會：
- 停止所有 Node.js 進程
- 停止 Docker 容器

### 方法 2: 手動停止

```powershell
# 停止容器
docker-compose down

# 停止 Node 進程
Get-Process -Name node | Stop-Process -Force
```

---

## 🗂️ 資料庫管理

### 連線到 PostgreSQL

```powershell
docker exec -it contentpilot-postgres psql -U postgres -d contentpilot_dev
```

常用 SQL 指令：
```sql
-- 查看所有表
\dt

-- 查看用戶
SELECT * FROM users;

-- 查看專案
SELECT * FROM projects;

-- 清空資料（重置）
TRUNCATE users, projects, keywords, articles CASCADE;
```

### 連線到 MongoDB

```powershell
docker exec -it contentpilot-mongo mongosh contentpilot
```

常用指令：
```javascript
// 查看所有 collections
show collections

// 查看文章
db.articles.find().pretty()

// 清空資料
db.articles.deleteMany({})
```

### 連線到 Redis

```powershell
docker exec -it contentpilot-redis redis-cli
```

常用指令：
```bash
# 查看所有 keys
KEYS *

# 查看某個 key 的值
GET session:xyz

# 清空快取
FLUSHDB
```

---

## 🔧 故障排除

### 問題 1: Docker 容器無法啟動

**錯誤**: `Error response from daemon: driver failed`

**解決方法**:
```powershell
# 清理舊容器
docker-compose down -v

# 重新啟動
docker-compose up -d
```

### 問題 2: Port 衝突

**錯誤**: `Port 3000 is already in use`

**解決方法**:
```powershell
# 找出佔用的進程
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Get-Process -Id <ProcessID>

# 停止進程
Stop-Process -Id <ProcessID> -Force
```

### 問題 3: 資料庫連線失敗

**錯誤**: `Connection to database failed`

**檢查步驟**:
1. 確認容器運行中: `docker ps`
2. 檢查容器日誌: `docker logs contentpilot-postgres`
3. 確認 `.env` 的資料庫設定正確

### 問題 4: Frontend 無法連線到 Backend

**錯誤**: `Network Error` 或 `CORS Error`

**檢查步驟**:
1. 確認 Backend 運行在 Port 3000
2. 檢查 `frontend/.env.local`:
   ```env
   VITE_API_BASE_URL=http://localhost:3000/api
   ```
3. 確認 `backend/.env`:
   ```env
   FRONTEND_URL=http://localhost:5173
   ```

### 問題 5: AI 生成失敗

**錯誤**: `404 Not Found` 或 `Invalid API Key`

**檢查步驟**:
1. 確認 API Key 正確填入 `backend/.env`
2. 檢查模型名稱是否為最新版本：
   ```env
   CLAUDE_MODEL=claude-sonnet-4-5-20250929
   ```
3. 確認 API 額度未用盡

---

## 📊 開發環境架構

```
┌─────────────────────────────────────────────────┐
│         Frontend (React + Vite)                 │
│         http://localhost:5173                   │
└─────────────────┬───────────────────────────────┘
                  │ HTTP Requests
                  ▼
┌─────────────────────────────────────────────────┐
│         Backend API (Express)                   │
│         http://localhost:3000                   │
└─────┬───────────┬───────────┬───────────────────┘
      │           │           │
      ▼           ▼           ▼
┌──────────┐ ┌─────────┐ ┌─────────┐
│PostgreSQL│ │ MongoDB │ │  Redis  │
│  :5433   │ │ :27017  │ │  :6379  │
└──────────┘ └─────────┘ └─────────┘
```

---

## 📝 開發工作流程

### 日常開發流程

1. **啟動環境**
   ```powershell
   .\start-dev.ps1
   ```

2. **開發與測試**
   - 修改程式碼（Frontend 支援 HMR 熱更新）
   - Backend 修改需手動重啟

3. **提交前檢查**
   ```powershell
   # 執行整合測試
   cd backend
   node test-integration.js
   ```

4. **停止環境**
   ```powershell
   .\stop-dev.ps1
   ```

### 資料庫重置

如需清空測試資料重新開始：

```powershell
# 停止並刪除所有資料
docker-compose down -v

# 重新啟動（會建立乾淨的資料庫）
.\setup-local.ps1
```

---

## 🔗 相關文件

- **API 測試指南**: `backend/API_TESTING.md`
- **任務計畫**: `TASK_PLAN.md`
- **UI 架構**: `UI 介面架構.md`
- **生產環境部署**: `部署說明.md`

---

## 🆘 需要協助？

如遇到其他問題，請檢查：

1. **終端機錯誤訊息**: 提供完整的錯誤堆疊
2. **Docker 日誌**: `docker logs <container-name>`
3. **Backend 日誌**: 檢查啟動 Backend 的終端機輸出
4. **環境變數**: 確認所有必要的 Keys 都已填寫

---

**最後更新**: 2025-12-07  
**版本**: v0.1.0  
**適用系統**: Windows 10/11 + Docker Desktop
