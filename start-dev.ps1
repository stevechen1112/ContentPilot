# ContentPilot 開發伺服器啟動腳本
# 同時啟動 Backend 與 Frontend

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  ContentPilot 開發伺服器啟動中..." -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 檢查資料庫容器
Write-Host "[1/3] 檢查資料庫容器狀態..." -ForegroundColor Yellow
$containers = docker ps --format "{{.Names}}" | Select-String -Pattern "contentpilot"
if ($containers.Count -ge 3) {
    Write-Host "✓ 資料庫容器運行中" -ForegroundColor Green
} else {
    Write-Host "⚠ 資料庫容器未完全啟動，正在啟動..." -ForegroundColor Yellow
    docker-compose up -d
    Start-Sleep -Seconds 5
}

# 檢查環境變數
Write-Host "[2/3] 檢查環境變數..." -ForegroundColor Yellow
if (-not (Test-Path ".\backend\.env")) {
    Write-Host "✗ 找不到 backend\.env，請先執行 setup-local.ps1" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 環境變數檔案存在" -ForegroundColor Green

# 啟動服務
Write-Host "[3/3] 啟動開發伺服器..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend API: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend UI: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服務" -ForegroundColor Yellow
Write-Host ""

# 建立後端啟動指令
$backendCmd = "cd backend; node server.js"
$frontendCmd = "cd frontend; npm run dev"

# 使用 Start-Process 在新視窗啟動 Backend
Write-Host "啟動 Backend (Port 3000)..." -ForegroundColor Green
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -PassThru

# 等待後端啟動
Start-Sleep -Seconds 3

# 使用 Start-Process 在新視窗啟動 Frontend
Write-Host "啟動 Frontend (Port 5173)..." -ForegroundColor Green
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -PassThru

Write-Host ""
Write-Host "✓ 開發伺服器已在新視窗啟動" -ForegroundColor Green
Write-Host ""
Write-Host "提示：" -ForegroundColor Yellow
Write-Host "- 前端自動在瀏覽器開啟 http://localhost:5173" -ForegroundColor White
Write-Host "- API 文件請參考 backend/API_TESTING.md" -ForegroundColor White
Write-Host "- 停止服務請關閉對應的 PowerShell 視窗" -ForegroundColor White
Write-Host ""

# 保持腳本運行
Write-Host "按任意鍵關閉此視窗 (服務將繼續運行)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
