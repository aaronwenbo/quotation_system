# 制作安装程序 (.exe Setup) 指南

如果您希望将程序发给其他人使用，就像安装普通软件一样有一个“安装向导”，您可以生成一个 **NSIS 安装包**。

### 🛠️ 什么是安装包？
- **输出**: 一个名为 `液压管接头报价系统-Setup-1.0.0.exe` 的安装文件。
- **功能**: 用户双击后会弹出安装界面，允许选择安装位置、创建桌面快捷方式等。
- **优点**: 显得更专业，且会自动在 Windows “开始”菜单中添加入口。

---

### 🚀 快速生成安装包

我为您准备了专门的自动化脚本 `build-installer.ps1`。

**操作步骤**：
1. 打开 PowerShell 终端。
2. 进入项目根目录。
3. 执行脚本：
   ```powershell
   .\build-installer.ps1
   ```

打包完成后，安装文件将出现在：`desktop/dist-win/` 目录下。

---

### 📝 定制安装程序

如果您想修改安装程序的名称或行为，可以编辑 `desktop/package.json` 中的 `nsis` 部分：

```json
"nsis": {
  "oneClick": false,                        // 是否一键静默安装（false 表示显示安装向导）
  "allowToChangeInstallationDirectory": true, // 是否允许用户修改安装路径
  "createDesktopShortcut": true,             // 是否创建桌面快捷方式
  "shortcutName": "液压管接头报价系统"         // 快捷方式的名称
}
```

### ⚠️ 注意事项
1. **网络连接**: 第一次运行安装包打包时，`electron-builder` 可能会自动从 GitHub 下载打包工具（如 NSIS 引擎），请确保网络畅通。
2. **图标**: 如果您想设置自己的软件图标，请准备一张 `.ico` 图片并将其路径填入 `package.json` 的 `installerIcon` 中。
