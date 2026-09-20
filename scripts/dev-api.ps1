# AI Todo · 后端 API（开发版）
# 用法: powershell -ExecutionPolicy Bypass -File .\scripts\dev-api.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ''
Write-Host '  ========================================' -ForegroundColor Cyan
Write-Host '   AI Todo · 后端 API（开发版）' -ForegroundColor Cyan
Write-Host '   端口: 3001' -ForegroundColor Cyan
Write-Host '  ========================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path 'node_modules')) {
  Write-Host '[提示] 首次运行，正在安装依赖...' -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install 失败' }
}

if (-not (Test-Path '.env') -and (Test-Path '.env.example')) {
  Copy-Item '.env.example' '.env'
}

npm run dev:api
