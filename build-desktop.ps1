# 液压管接头报价系统 - 桌面版全自动打包脚本
# 用法: 在 PowerShell 中运行 .\build-desktop.ps1

$ErrorActionPreference = "Stop"

Write-Host "--- 1. 开始构建前端 ---" -ForegroundColor Cyan
cd client
npm run build
cd ..

Write-Host "--- 2. 同步资源到 desktop 目录 ---" -ForegroundColor Cyan
# 清理并创建目录
if (Test-Path "desktop/client/dist") { Remove-Item -Recurse -Force "desktop/client/dist" }
New-Item -ItemType Directory -Force -Path "desktop/client/dist"
if (Test-Path "desktop/server") { Remove-Item -Recurse -Force "desktop/server" }
New-Item -ItemType Directory -Force -Path "desktop/server"

# 拷贝前端
Copy-Item -Recurse -Path "client/dist/*" -Destination "desktop/client/dist"

# 拷贝后端 (排除不需要打包的文件)
Copy-Item -Recurse -Path "server/*" -Destination "desktop/server" -Exclude "node_modules", "database.db", ".env", "*.log"

Write-Host "--- 3. 安装后端生产依赖 ---" -ForegroundColor Cyan
cd desktop/server
npm install --production --no-package-lock
cd ../..

Write-Host "--- 4. 执行 Electron 打包 ---" -ForegroundColor Cyan
cd desktop
npm run pack

Write-Host "`n"
Write-Host "==========================================" -ForegroundColor Green
Write-Host "打包成功！" -ForegroundColor Green
Write-Host "产物目录: d:\antigravity projects\desktop\build\液压管接头报价系统-win32-x64\" -ForegroundColor Green
Write-Host "您可以双击目录下的 .exe 文件运行系统。" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
cd ..
