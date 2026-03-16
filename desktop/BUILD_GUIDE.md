# 桌面版全自动构建与打包指南

如果您未来修改了前端代码或后端代码，需要更新桌面端的 `.exe` 文件，请按照以下步骤操作。

### 快捷方式（推荐）：运行脚本
我在根目录为您创建了一个 `build-desktop.ps1` 脚本，它可以自动完成所有同步和打包工作。

**操作步骤**：
1. 打开 PowerShell 终端。
2. 进入项目根目录：`cd "d:\antigravity projects"`
3. 执行脚本：
   ```powershell
   .\build-desktop.ps1
   ```

---

### 手动构建步骤（如果脚本运行受限）

如果您想手动执行，请依次运行以下命令：

#### 1. 构建前端
```powershell
cd client
npm run build
cd ..
```

#### 2. 同步资源到桌面目录
```powershell
# 同步前端构建产物
Remove-Item -Recurse -Force "desktop/client/dist" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "desktop/client/dist"
Copy-Item -Recurse -Path "client/dist/*" -Destination "desktop/client/dist"

# 同步后端代码 (不包含旧的 node_modules)
Remove-Item -Recurse -Force "desktop/server" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "desktop/server"
Copy-Item -Recurse -Path "server/*" -Destination "desktop/server" -Exclude "node_modules", "database.db", ".env"

# 在桌面端的 server 目录安装生产环境依赖
cd desktop/server
npm install --production --no-package-lock
cd ../..
```

#### 3. 执行 Electron 打包
```powershell
cd desktop
npm run pack
```

**打包结果**位于：`desktop/build/液压管接头报价系统-win32-x64/`
