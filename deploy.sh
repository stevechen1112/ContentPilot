#!/bin/bash

# ContentPilot 部署腳本 - Linode Server
# 使用方式: bash deploy.sh

set -e

echo "🚀 開始部署 ContentPilot 到 Linode..."

# 1. 更新系統套件
echo "📦 更新系統套件..."
sudo apt update
sudo apt upgrade -y

# 2. 安裝 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
    echo "🐳 安裝 Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    echo "✅ Docker 已安裝"
fi

if ! command -v docker-compose &> /dev/null; then
    echo "🐳 安裝 Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "✅ Docker Compose 已安裝"
fi

# 3. 安裝 Node.js 18
if ! command -v node &> /dev/null; then
    echo "📦 安裝 Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js 已安裝 (版本: $(node -v))"
fi

# 4. 安裝 Git
if ! command -v git &> /dev/null; then
    echo "📦 安裝 Git..."
    sudo apt install -y git
else
    echo "✅ Git 已安裝"
fi

# 5. 克隆專案 (如果不存在)
PROJECT_DIR="/opt/ContentPilot"
if [ ! -d "$PROJECT_DIR" ]; then
    echo "📥 克隆專案..."
    sudo git clone https://github.com/stevechen1112/ContentPilot.git $PROJECT_DIR
    sudo chown -R $USER:$USER $PROJECT_DIR
else
    echo "🔄 更新專案..."
    cd $PROJECT_DIR
    git pull origin master
fi

cd $PROJECT_DIR

# 6. 設定環境變數
echo "⚙️ 設定環境變數..."
if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
    echo "請手動建立 backend/.env 檔案，參考 backend/.env.example"
    echo "必要的環境變數："
    echo "  - GOOGLE_GEMINI_API_KEY"
    echo "  - SERPER_API_KEY"
    exit 1
fi

# 7. 啟動資料庫
echo "🗄️ 啟動資料庫服務..."
docker-compose up -d

# 等待資料庫啟動
echo "⏳ 等待資料庫啟動..."
sleep 10

# 8. 安裝後端依賴並啟動
echo "🔧 安裝後端依賴..."
cd $PROJECT_DIR/backend
npm install

# 9. 使用 PM2 啟動後端
if ! command -v pm2 &> /dev/null; then
    echo "📦 安裝 PM2..."
    sudo npm install -g pm2
fi

echo "🚀 啟動後端服務..."
pm2 stop contentpilot-backend || true
pm2 delete contentpilot-backend || true
pm2 start npm --name "contentpilot-backend" -- start
pm2 save

# 10. 安裝前端依賴並構建
echo "🔧 安裝前端依賴並構建..."
cd $PROJECT_DIR/frontend
npm install
npm run build

# 11. 使用 PM2 啟動前端 (serve)
sudo npm install -g serve
pm2 stop contentpilot-frontend || true
pm2 delete contentpilot-frontend || true
pm2 start serve --name "contentpilot-frontend" -- -s dist -l 5173
pm2 save

# 12. 設定 PM2 開機自動啟動
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 服務狀態："
pm2 list
echo ""
echo "🌐 訪問網址："
echo "   Frontend: http://172.238.31.80:5173"
echo "   Backend:  http://172.238.31.80:3000"
echo ""
echo "📝 有用的指令："
echo "   pm2 logs contentpilot-backend   # 查看後端日誌"
echo "   pm2 logs contentpilot-frontend  # 查看前端日誌"
echo "   pm2 restart all                 # 重啟所有服務"
echo "   pm2 stop all                    # 停止所有服務"
echo "   docker-compose logs -f          # 查看資料庫日誌"
echo ""
