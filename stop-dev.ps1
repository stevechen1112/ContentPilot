# ContentPilot 停止開發環境腳本

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  停止 ContentPilot 開發環境" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 停止 Node 進程
Write-Host "[1/2] 停止 Node.js 進程..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "✓ 已停止 $($nodeProcesses.Count) 個 Node.js 進程" -ForegroundColor Green
} else {
    Write-Host "⚠ 未找到運行中的 Node.js 進程" -ForegroundColor Yellow
}

# 停止資料庫容器
Write-Host "[2/2] 停止資料庫容器..." -ForegroundColor Yellow
docker-compose down
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 資料庫容器已停止" -ForegroundColor Green
} else {
    Write-Host "⚠ 停止容器時發生錯誤" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✓ 開發環境已完全停止" -ForegroundColor Green
Write-Host ""
