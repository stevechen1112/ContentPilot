# ContentPilot Environment Check Script

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  ContentPilot Environment Check" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Node.js
Write-Host "[Node.js]" -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "  OK Version: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  X Not installed" -ForegroundColor Red
    $allGood = $false
}

# Check npm
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = npm --version
    Write-Host "  OK npm: v$npmVersion" -ForegroundColor Green
} else {
    Write-Host "  X npm not installed" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

# Check Docker
Write-Host "[Docker]" -ForegroundColor Yellow
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerVersion = docker --version
    Write-Host "  OK $dockerVersion" -ForegroundColor Green
    
    $testDockerPs = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK Docker daemon running" -ForegroundColor Green
    } else {
        Write-Host "  X Docker daemon not started" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "  X Not installed" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

# Check Database Containers
Write-Host "[Database Containers]" -ForegroundColor Yellow
$containers = @{
    "contentpilot-postgres" = "PostgreSQL"
    "contentpilot-mongo" = "MongoDB"
    "contentpilot-redis" = "Redis"
}

foreach ($container in $containers.Keys) {
    $status = docker ps --filter "name=$container" --format "{{.Status}}" 2>$null
    if ($status) {
        Write-Host "  OK $($containers[$container]): $status" -ForegroundColor Green
    } else {
        Write-Host "  X $($containers[$container]): Not running" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""

# Check Environment Files
Write-Host "[Environment Files]" -ForegroundColor Yellow

$envPath = Join-Path $PSScriptRoot ".env.local"
if (Test-Path $envPath) {
    Write-Host "  OK Root .env.local exists" -ForegroundColor Green
} else {
    Write-Host "  X Root .env.local not found" -ForegroundColor Red
    $allGood = $false
}

$frontendEnvPath = Join-Path $PSScriptRoot "frontend\.env.local"
if (Test-Path $frontendEnvPath) {
    Write-Host "  OK frontend\.env.local exists" -ForegroundColor Green
} else {
    Write-Host "  ! frontend\.env.local not found" -ForegroundColor Yellow
}

Write-Host ""

# Check Dependencies
Write-Host "[Dependencies]" -ForegroundColor Yellow

$backendModules = Join-Path $PSScriptRoot "backend\node_modules"
if (Test-Path $backendModules) {
    $backendPackages = (Get-ChildItem $backendModules -Directory).Count
    Write-Host "  OK Backend: $backendPackages packages" -ForegroundColor Green
} else {
    Write-Host "  X Backend: not installed" -ForegroundColor Red
    $allGood = $false
}

$frontendModules = Join-Path $PSScriptRoot "frontend\node_modules"
if (Test-Path $frontendModules) {
    $frontendPackages = (Get-ChildItem $frontendModules -Directory).Count
    Write-Host "  OK Frontend: $frontendPackages packages" -ForegroundColor Green
} else {
    Write-Host "  X Frontend: not installed" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

# Check Port Status
Write-Host "[Port Status]" -ForegroundColor Yellow

$ports = @{
    3000 = "Backend API"
    5173 = "Frontend Dev"
    5433 = "PostgreSQL"
    27017 = "MongoDB"
    6379 = "Redis"
}

foreach ($port in $ports.Keys) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "  ! Port $port ($($ports[$port])): In use by $($process.Name)" -ForegroundColor Yellow
    } else {
        Write-Host "  OK Port $port ($($ports[$port])): Available" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "  OK Environment ready" -ForegroundColor Green
    Write-Host ""
    Write-Host "Start development:" -ForegroundColor White
    Write-Host "  .\start-dev.ps1" -ForegroundColor Cyan
} else {
    Write-Host "  X Environment check failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Run setup:" -ForegroundColor White
    Write-Host "  .\setup-local.ps1" -ForegroundColor Cyan
}

Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
