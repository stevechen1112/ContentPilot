# ContentPilot - Linode 部署指南

## 伺服器資訊
- **IP**: 172.238.31.80
- **作業系統**: Ubuntu 20.04/22.04 (建議)
- **使用者**: root

## 快速部署步驟

### 1. 連線到伺服器

```bash
ssh root@172.238.31.80
```

### 2. 上傳並執行部署腳本

**選項 A: 直接在伺服器上執行**

```bash
# 克隆專案
git clone https://github.com/stevechen1112/ContentPilot.git /opt/ContentPilot
cd /opt/ContentPilot

# 設定環境變數
nano backend/.env
```

在 `backend/.env` 中添加：

```env
# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=http://172.238.31.80:5173
BACKEND_URL=http://172.238.31.80:3000

# Database - PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/contentpilot_dev
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=contentpilot_dev

# Database - MongoDB
MONGODB_URI=mongodb://localhost:27017/contentpilot_dev
MONGODB_DB=contentpilot_dev

# Database - Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Authentication
JWT_SECRET=your-production-secret-change-this
JWT_EXPIRES_IN=7d

# AI Services - Google Gemini (Primary)
GOOGLE_GEMINI_API_KEY=你的_GEMINI_API_KEY
GOOGLE_GEMINI_MODEL=gemini-2.0-flash-exp
GOOGLE_GEMINI_MAX_TOKENS=8192
GOOGLE_GEMINI_TEMPERATURE=0.7

# AI Provider Selection
AI_PROVIDER=gemini

# Search API - Serper
SERPER_API_KEY=你的_SERPER_API_KEY

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

```bash
# 執行部署腳本
chmod +x deploy.sh
bash deploy.sh
```

**選項 B: 從本地電腦上傳**

```powershell
# 在 Windows (本地)
scp C:\Users\User\Desktop\ContentPilot\deploy.sh root@172.238.31.80:/tmp/

# 在伺服器上
ssh root@172.238.31.80
bash /tmp/deploy.sh
```

### 3. 配置防火牆

```bash
# 允許必要的端口
ufw allow 22/tcp      # SSH
ufw allow 3000/tcp    # Backend API
ufw allow 5173/tcp    # Frontend
ufw enable
```

### 4. 設定 Nginx 反向代理 (可選，推薦)

```bash
# 安裝 Nginx
apt install -y nginx

# 建立配置
cat > /etc/nginx/sites-available/contentpilot << 'EOF'
server {
    listen 80;
    server_name 172.238.31.80;

    # 前端
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 後端 API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# 啟用配置
ln -s /etc/nginx/sites-available/contentpilot /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

使用 Nginx 後，訪問網址變為：
- Frontend: `http://172.238.31.80`
- Backend API: `http://172.238.31.80/api`

## 驗證部署

### 檢查服務狀態

```bash
# PM2 服務狀態
pm2 list
pm2 logs contentpilot-backend --lines 50
pm2 logs contentpilot-frontend --lines 50

# Docker 容器狀態
docker-compose ps
docker-compose logs -f --tail=50

# 檢查端口
netstat -tlnp | grep -E '3000|5173|5432|27017|6379'
```

### 測試 API

```bash
# 測試後端 API
curl http://localhost:3000/api/health

# 測試前端
curl http://localhost:5173
```

## 常用維護指令

### PM2 管理

```bash
# 查看服務列表
pm2 list

# 查看日誌
pm2 logs contentpilot-backend
pm2 logs contentpilot-frontend

# 重啟服務
pm2 restart contentpilot-backend
pm2 restart contentpilot-frontend
pm2 restart all

# 停止服務
pm2 stop contentpilot-backend
pm2 stop all

# 刪除服務
pm2 delete contentpilot-backend
```

### Docker 管理

```bash
# 查看容器狀態
docker-compose ps

# 查看日誌
docker-compose logs -f postgres
docker-compose logs -f mongo
docker-compose logs -f redis

# 重啟容器
docker-compose restart

# 停止容器
docker-compose down

# 重新啟動所有容器
docker-compose up -d
```

### 更新應用程式

```bash
cd /opt/ContentPilot

# 拉取最新代碼
git pull origin master

# 更新後端
cd backend
npm install
pm2 restart contentpilot-backend

# 更新前端
cd ../frontend
npm install
npm run build
pm2 restart contentpilot-frontend
```

## 備份與還原

### 資料庫備份

```bash
# PostgreSQL 備份
docker exec contentpilot-postgres pg_dump -U postgres contentpilot_dev > backup_$(date +%Y%m%d).sql

# MongoDB 備份
docker exec contentpilot-mongo mongodump --out /tmp/backup
docker cp contentpilot-mongo:/tmp/backup ./mongo_backup_$(date +%Y%m%d)

# Redis 備份
docker exec contentpilot-redis redis-cli SAVE
docker cp contentpilot-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb
```

### 資料庫還原

```bash
# PostgreSQL 還原
docker exec -i contentpilot-postgres psql -U postgres contentpilot_dev < backup_20231209.sql

# MongoDB 還原
docker cp ./mongo_backup_20231209 contentpilot-mongo:/tmp/backup
docker exec contentpilot-mongo mongorestore /tmp/backup
```

## 監控與告警

### 設定 PM2 監控

```bash
# 安裝 PM2 Plus (可選)
pm2 link <secret_key> <public_key>

# 設定記憶體限制重啟
pm2 start npm --name "contentpilot-backend" --max-memory-restart 500M -- start
```

### 系統資源監控

```bash
# 安裝 htop
apt install -y htop

# 查看系統資源
htop

# 查看磁碟使用
df -h

# 查看 Docker 資源
docker stats
```

## 故障排除

### 後端無法啟動

```bash
# 檢查日誌
pm2 logs contentpilot-backend --err

# 檢查環境變數
cat /opt/ContentPilot/backend/.env

# 檢查資料庫連線
docker-compose logs postgres
```

### 前端無法訪問

```bash
# 檢查 PM2 狀態
pm2 list

# 檢查端口
netstat -tlnp | grep 5173

# 檢查防火牆
ufw status
```

### 資料庫連線錯誤

```bash
# 檢查容器狀態
docker-compose ps

# 重啟資料庫
docker-compose restart postgres mongo redis

# 檢查資料庫日誌
docker-compose logs postgres
```

## 安全性建議

1. **更改預設密碼**
   - 修改 PostgreSQL 預設密碼
   - 修改 JWT_SECRET

2. **設定 SSL/TLS**
   - 使用 Let's Encrypt 免費 SSL 憑證
   - 配置 Nginx HTTPS

3. **限制訪問**
   - 設定防火牆規則
   - 只開放必要端口
   - 使用 SSH 金鑰認證

4. **定期更新**
   - 更新系統套件
   - 更新 Node.js 依賴
   - 更新 Docker 映像

## 效能優化

1. **啟用 Nginx 快取**
2. **設定 Redis 快取**
3. **使用 CDN (Cloudflare)**
4. **啟用 Gzip 壓縮**
5. **優化資料庫查詢**

## 支援資源

- **GitHub**: https://github.com/stevechen1112/ContentPilot
- **PM2 文件**: https://pm2.keymetrics.io/
- **Docker 文件**: https://docs.docker.com/
- **Nginx 文件**: https://nginx.org/en/docs/
