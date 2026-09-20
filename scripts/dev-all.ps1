# AI Todo · 前后端同时启动（开发版）
# 用法: powershell -ExecutionPolicy Bypass -File .\scripts\dev-all.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ''
Write-Host '  ========================================' -ForegroundColor Green
Write-Host '   AI Todo · 前后端同时启动（开发版）' -ForegroundColor Green
Write-Host '   后端: http://localhost:3001' -ForegroundColor Green
Write-Host '   前端: http://localhost:5173' -ForegroundColor Green
Write-Host '  ========================================' -ForegroundColor Green
Write-Host ''

if (-not (Test-Path 'node_modules')) {
  Write-Host '[提示] 首次运行，正在安装依赖...' -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install 失败' }
}

if (-not (Test-Path '.env') -and (Test-Path '.env.example')) {
  Copy-Item '.env.example' '.env'
}

npm run dev:all
