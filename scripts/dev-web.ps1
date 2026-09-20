# AI Todo · 前端 Web（开发版）
# 用法: powershell -ExecutionPolicy Bypass -File .\scripts\dev-web.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ''
Write-Host '  ========================================' -ForegroundColor Magenta
Write-Host '   AI Todo · 前端 Web（开发版）' -ForegroundColor Magenta
Write-Host '   端口: 5173  (/api -> 3001)' -ForegroundColor Magenta
Write-Host '  ========================================' -ForegroundColor Magenta
Write-Host ''

if (-not (Test-Path 'node_modules')) {
  Write-Host '[提示] 首次运行，正在安装依赖...' -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install 失败' }
}

if (-not (Test-Path '.env') -and (Test-Path '.env.example')) {
  Copy-Item '.env.example' '.env'
}

npm run dev:web
