@echo off
cd /d "%~dp0"

echo ========================================
echo 产品报价系统启动脚本
echo ========================================

if not exist ".env" (
    echo 提示: 未找到 .env 文件，使用默认配置
    echo 建议复制 .env.example 为 .env 并修改密码
)

echo.
echo 启动服务...
echo 访问地址: http://0.0.0.0:5000
echo 按 Ctrl+C 停止服务
echo.

python app.py
