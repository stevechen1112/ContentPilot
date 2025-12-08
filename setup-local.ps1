# ContentPilot 本地開發環境自動設定腳本
# PowerShell Script for Windows

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  ContentPilot 本地環境設定工具" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 Docker 是否安裝
Write-Host "[1/7] 檢查 Docker 環境..." -ForegroundColor Yellow
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "✓ Docker 已安裝" -ForegroundColor Green
} else {
    Write-Host "✗ 未偵測到 Docker，請先安裝 Docker Desktop" -ForegroundColor Red
    Write-Host "下載連結: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    exit 1
}

# 檢查 Docker 是否運行
Write-Host "[2/7] 檢查 Docker 服務狀態..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker 服務運行中" -ForegroundColor Green
} else {
    Write-Host "✗ Docker 服務未啟動，請啟動 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 檢查 Node.js
Write-Host "[3/7] 檢查 Node.js 環境..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "✓ Node.js 已安裝 ($nodeVersion)" -ForegroundColor Green
} else {
    Write-Host "✗ 未偵測到 Node.js，請先安裝 Node.js 18+" -ForegroundColor Red
    exit 1
}

# 啟動資料庫容器
Write-Host "[4/7] 啟動資料庫容器 (PostgreSQL, MongoDB, Redis)..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 資料庫容器啟動成功" -ForegroundColor Green
} else {
    Write-Host "✗ 資料庫容器啟動失敗" -ForegroundColor Red
    exit 1
}

# 等待資料庫就緒
Write-Host "[5/7] 等待資料庫初始化..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 初始化資料庫 Schema
Write-Host "[6/7] 初始化 PostgreSQL Schema..." -ForegroundColor Yellow
if (Test-Path ".\backend\src\models\schema.sql") {
    $env:PGPASSWORD = "postgres"
    Get-Content ".\backend\src\models\schema.sql" | docker exec -i contentpilot-postgres psql -U postgres -d contentpilot_dev
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 資料庫 Schema 建立成功" -ForegroundColor Green
    } else {
        Write-Host "⚠ Schema 建立失敗 (可能已存在)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ 找不到 schema.sql 檔案" -ForegroundColor Yellow
}

# 檢查環境變數檔案
Write-Host "[7/7] 檢查環境變數設定..." -ForegroundColor Yellow

if (-not (Test-Path ".\backend\.env")) {
    Write-Host "⚠ 未找到 backend\.env，複製範本..." -ForegroundColor Yellow
    if (Test-Path ".\backend\.env.example") {
        Copy-Item ".\backend\.env.example" ".\backend\.env"
        Write-Host "✓ 已建立 backend\.env (請填入 API Keys)" -ForegroundColor Green
    } else {
        Write-Host "✗ 找不到 .env.example 檔案" -ForegroundColor Red
    }
} else {
    Write-Host "✓ backend\.env 已存在" -ForegroundColor Green
}

if (-not (Test-Path ".\frontend\.env.local")) {
    Write-Host "⚠ 未找到 frontend\.env.local，複製範本..." -ForegroundColor Yellow
    if (Test-Path ".\frontend\.env.example") {
        Copy-Item ".\frontend\.env.example" ".\frontend\.env.local"
        Write-Host "✓ 已建立 frontend\.env.local" -ForegroundColor Green
    } else {
        Write-Host "✗ 找不到 .env.example 檔案" -ForegroundColor Red
    }
} else {
    Write-Host "✓ frontend\.env.local 已存在" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  環境設定完成！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "1. 編輯 backend\.env 填入以下 API Keys：" -ForegroundColor White
Write-Host "   - ANTHROPIC_API_KEY" -ForegroundColor Gray
Write-Host "   - OPENAI_API_KEY" -ForegroundColor Gray
Write-Host "   - SERPER_API_KEY" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 安裝依賴套件：" -ForegroundColor White
Write-Host "   cd backend && npm install" -ForegroundColor Gray
Write-Host "   cd frontend && npm install" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 啟動開發伺服器：" -ForegroundColor White
Write-Host "   .\start-dev.ps1" -ForegroundColor Gray
Write-Host ""
