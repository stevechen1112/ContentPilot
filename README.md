# ContentPilot - SEO 自動化內容生產系統 (POC)

Google 風格的極簡文章生成工具 - 輸入關鍵字，自動生成完整 SEO 優化文章。

## 🌐 線上 Demo

**正式環境**: [http://172.238.31.80](http://172.238.31.80)

- **Demo 模式**：無需登入即可使用所有功能
- **自動認證**：系統自動使用 demo-user 身份
- **完整體驗**：包含文章生成、查看、管理等所有功能

## 🚀 快速開始

### 前置需求
- Node.js 18+
- PostgreSQL (透過 Docker)

### 本地開發安裝步驟

1. **啟動資料庫**
   ```bash
   docker-compose up -d
   ```

2. **初始化資料庫**
   ```bash
   # 連接到 PostgreSQL 容器
   docker exec -i contentpilot-postgres psql -U postgres -d contentpilot_dev < backend/schema.sql
   ```

3. **配置環境變數**
   ```bash
   # 後端環境變數
   cp backend/.env.example backend/.env
   # 編輯 backend/.env，填入 API Keys
   
   # 前端環境變數
   cp frontend/.env.example frontend/.env
   # 設定 VITE_API_URL=http://localhost:3000/api
   ```

4. **啟動後端**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   後端運行於 `http://localhost:3000`

5. **啟動前端**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   前端運行於 `http://localhost:5173`

6. **開始使用**
   - 打開瀏覽器訪問 `http://localhost:5173`
   - 輸入關鍵字（例如：日本旅遊、健康飲食）
   - 點擊生成按鈕
   - 等待 1-3 分鐘即可獲得完整文章

## ✨ 主要功能

### 🎯 Google 風格介面
- 極簡搜尋框設計
- 無需登入，直接使用
- 一鍵生成完整文章

### 📝 文章生成
- **深度內容策劃**：支援設定作者人設、目標受眾、核心價值觀與獨特觀點
- **自動大綱生成**：根據關鍵字與策劃設定，生成結構化大綱
- **完整內容撰寫**：包含引言、多個章節、結論，並融入真實經驗案例
- **SEO 優化**：自動整合權威來源引用與競爭對手分析
- **生成時間**：約 1-3 分鐘

### 📄 文章管理
- **全頁面顯示**：獨立的文章閱讀介面
- **一鍵複製**：複製 HTML 格式內容
- **匯出 PDF**：使用瀏覽器列印功能匯出

## 🛠️ 技術架構

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **AI Engine**: Google Gemini API (`gemini-2.0-flash-exp`)
- **Database**: PostgreSQL
- **搜尋整合**: Serper.dev API

## 📁 專案結構

```
ContentPilot/
├── frontend/          # React 前端應用
│   ├── src/
│   │   ├── pages/     # 頁面組件
│   │   ├── components/# 共用組件
│   │   ├── lib/       # API 客戶端
│   │   └── stores/    # 狀態管理
│   └── package.json
├── backend/           # Node.js 後端 API
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/  # AI 服務層
│   │   ├── routes/
│   │   └── middleware/
│   └── .env          # 環境變數配置
├── docker-compose.yml # 資料庫容器配置
└── README.md

```

## ⚙️ 環境變數配置

後端環境變數位於 `backend/.env`：

```env
# AI Provider
AI_PROVIDER=gemini
GOOGLE_GEMINI_API_KEY=你的API金鑰
GOOGLE_GEMINI_MODEL=gemini-2.0-flash-exp

# 搜尋 API
SERPER_API_KEY=你的API金鑰

# 資料庫
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/contentpilot_dev
```

## 🎨 使用範例

1. **輸入關鍵字**：日本旅遊
2. **系統處理**：
   - 分析關鍵字意圖
   - 生成文章大綱（5-7 個章節）
   - 撰寫完整內容（引言、章節、結論）
   - 整合權威來源引用
3. **獲得文章**：
   - 標題：「掌握日本旅遊的 5 大策略」
   - 完整內容：約 2000-3000 字
   - 包含權威來源連結
   - 符合 SEO 優化標準

## 📊 效能指標

- **大綱生成**：10-30 秒
- **文章生成**：1-3 分鐘
- **文章長度**：2000-3000 字
- **章節數量**：5-7 個
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
GOOGLE_GEMINI_MODEL=gemini-3-pro-preview

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

## 🚀 生產環境部署

### 系統架構
- **伺服器**: Linode Ubuntu (172.238.31.80)
- **前端**: React + Vite (port 5173) - PM2 管理
- **後端**: Node.js + Express (port 3000) - PM2 管理
- **資料庫**: Docker Compose
  - PostgreSQL (port 5433)
  - MongoDB (port 27017)
  - Redis (port 6379)
- **Web 伺服器**: Nginx 反向代理

### 部署步驟

1. **安裝依賴**
   ```bash
   # 安裝 Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # 安裝 PM2
   sudo npm install -g pm2
   
   # 安裝 Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. **Clone 專案**
   ```bash
   cd /opt
   git clone https://github.com/stevechen1112/ContentPilot.git
   cd ContentPilot
   ```

3. **啟動資料庫**
   ```bash
   docker-compose up -d
   ```

4. **初始化資料庫**
   ```bash
   docker exec -i contentpilot-postgres psql -U postgres -d contentpilot_dev < backend/schema.sql
   ```

5. **配置環境變數**
   ```bash
   # 後端 .env
   cd /opt/ContentPilot/backend
   nano .env
   ```
   
   設定內容：
   ```env
   PORT=3000
   NODE_ENV=production
   
   # AI Provider
   AI_PROVIDER=gemini
   GOOGLE_GEMINI_API_KEY=你的金鑰
   GOOGLE_GEMINI_MODEL=gemini-2.0-flash-exp
   
   # Database
   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/contentpilot_dev
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5433
   POSTGRES_DB=contentpilot_dev
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   
   # APIs
   SERPER_API_KEY=你的金鑰
   ```
   
   前端 .env：
   ```bash
   cd /opt/ContentPilot/frontend
   nano .env
   ```
   
   設定內容：
   ```env
   VITE_API_URL=http://172.238.31.80/api
   ```

6. **啟動後端 (PM2)**
   ```bash
   cd /opt/ContentPilot/backend
   npm install --production
   pm2 start npm --name "contentpilot-backend" -- run start
   ```

7. **啟動前端 (PM2)**
   ```bash
   cd /opt/ContentPilot/frontend
   npm install
   pm2 start npm --name "contentpilot-frontend" -- run dev -- --host
   ```

8. **配置 Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/contentpilot
   ```
   
   配置內容：
   ```nginx
   server {
       listen 80;
       server_name 172.238.31.80;

       # 前端
       location / {
           proxy_pass http://127.0.0.1:5173;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # 後端 API (延長 timeout 以支援 AI 生成)
       location /api/ {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_read_timeout 600s;
           proxy_connect_timeout 600s;
           proxy_send_timeout 600s;
       }
   }
   ```
   
   啟用配置：
   ```bash
   sudo ln -s /etc/nginx/sites-available/contentpilot /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

9. **設定 PM2 開機啟動**
   ```bash
   pm2 save
   pm2 startup
   ```

### PM2 管理指令

```bash
# 查看狀態
pm2 status

# 查看日誌
pm2 logs contentpilot-backend
pm2 logs contentpilot-frontend

# 重啟服務
pm2 restart contentpilot-backend
pm2 restart contentpilot-frontend

# 停止服務
pm2 stop contentpilot-backend
pm2 stop contentpilot-frontend
```

### Demo 模式說明

目前系統運行在 **Demo 模式**，特點如下：

- **無需登入**：所有 API 請求自動使用 `demo-user` 身份
- **無權限檢查**：所有使用者可存取所有專案和文章
- **快速體驗**：適合展示和測試系統功能

認證中介層 (`backend/src/middleware/auth.js`) 已配置為自動返回 demo 使用者：
```javascript
// 所有請求自動認證為 demo-user
req.user = {
  id: 'demo-user',
  email: 'admin@example.com'
};
```

**轉換為正式環境**：若需啟用完整的使用者註冊/登入系統，需重新實作 JWT 驗證邏輯。

## 📄 授權

MIT License
