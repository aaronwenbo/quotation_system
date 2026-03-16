# 液压管接头报价系统 - 安装程序 (.exe Setup) 生成脚本
# 用法: 在 PowerShell 中运行 .\build-installer.ps1

$ErrorActionPreference = "Stop"

Write-Host "--- 1. 开始构建前端 ---" -ForegroundColor Cyan
cd client
npm run build
cd ..

Write-Host "--- 2. 同步资源到 desktop 目录 ---" -ForegroundColor Cyan
if (Test-Path "desktop/client/dist") { Remove-Item -Recurse -Force "desktop/client/dist" }
New-Item -ItemType Directory -Force -Path "desktop/client/dist"
if (Test-Path "desktop/server") { Remove-Item -Recurse -Force "desktop/server" }
New-Item -ItemType Directory -Force -Path "desktop/server"

Copy-Item -Recurse -Path "client/dist/*" -Destination "desktop/client/dist"
Copy-Item -Recurse -Path "server/*" -Destination "desktop/server" -Exclude "node_modules", "database.db", ".env", "*.log"

Write-Host "--- 3. 安装后端生产依赖 ---" -ForegroundColor Cyan
cd desktop/server
npm install --production --no-package-lock
cd ../..

Write-Host "--- 4. 生成 NSIS 安装程序 ---" -ForegroundColor Cyan
cd desktop
# 使用 electron-builder 生成安装包
npx electron-builder --win --x64

Write-Host "`n"
Write-Host "==========================================" -ForegroundColor Green
Write-Host "安装程序生成成功！" -ForegroundColor Green
Write-Host "安装包位置: d:\antigravity projects\desktop\dist-win\液压管接头报价系统-Setup-1.0.0.exe" -ForegroundColor Green
Write-Host "您可以将此文件发送给其他用户安装使用。" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
cd ..
