@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   AI Todo · 前后端同时启动（开发版）
echo   后端: http://localhost:3001
echo   前端: http://localhost:5173
echo  ========================================
echo.

if not exist "node_modules\" (
  echo [提示] 首次运行，正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo [错误] npm install 失败
    pause
    exit /b 1
  )
)

if not exist ".env" (
  if exist ".env.example" copy /y ".env.example" ".env" >nul
)

call npm run dev:all
pause
