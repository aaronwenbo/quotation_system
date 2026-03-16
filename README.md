# 液压管接头报价管理系统

> 一套面向液压管接头行业的专业报价管理系统，支持 **Web 版**（需服务器）和 **Windows 桌面版**（免安装、无需 MySQL）。

---

## 🌟 核心功能

| 模块 | 功能 |
|------|------|
| **产品管理** | 添加/编辑/删除产品，支持成本价、基础售价、规格说明；Excel 批量导入导出 |
| **客户管理** | 管理客户档案（名称、联系人、电话、地址） |
| **报价模板** | 创建多套价格体系（代理价、零售价等），支持 Excel 批量导入更新价格 |
| **报价单** | 创建/编辑报价单，关联客户和模板，支持整单折扣；Excel 导入明细快速生成 |
| **毛利分析** | 每行明细和汇总均实时显示**毛利**与**毛利率**，辅助决策 |
| **价格历史** | 点击单价旁的图标，可查看该产品过往最近 5 次成交价格记录 |
| **导出报告** | 一键导出**专业 PDF 报价单**或 **Excel 工作表**，支持中英文双语 |
| **多语言** | 界面支持中文 / English 一键切换（i18next） |

---

## 🛠️ 技术栈

**Web 版**
- 前端：React 19 + Vite + Ant Design 6 + i18next + XLSX
- 后端：Node.js + Express + mysql2
- 数据库：MySQL 8.0+

**桌面版（Windows）**
- 外壳：Electron 31
- 数据库：**SQLite**（嵌入式，无需安装，数据存为本地 `.db` 文件）
- 打包：electron-packager → 单目录绿色版 `.exe`

---

## 🚀 快速开始

### 方式一：Web 版（MySQL）

**1. 配置数据库**
```
修改 server/database.js 中的 dbConfig（host / user / password）
```

**2. 启动后端**
```bash
cd server
npm install
npm run dev
# 运行于 http://localhost:3001
```

**3. 启动前端**
```bash
cd client
npm install
npm run dev
# 运行于 http://localhost:5173
```

---

### 方式二：Windows 桌面版（SQLite，无需 MySQL）

**开发运行**
```bash
# 前置：先确保 server/node_modules 中已有 sqlite3 和 sqlite
cd server && npm install

cd ../desktop && npm install
npm run dev          # 启动 Electron 窗口（自动内嵌后端+前端）
```

**打包为独立 .exe**
```bash
# 先构建前端
cd client && npm run build

# 再拷贝资源并打包
cd ../desktop
npm run pack         # 输出至 desktop/build/ 目录
```

> 打包产物：`desktop/build/液压管接头报价系统-win32-x64/液压管接头报价系统.exe`

---

## 📖 使用说明

### 报价单操作流程
1. **建立产品库**：在"产品管理"中添加产品（或批量 Excel 导入）。
2. **创建客户**：在"客户管理"中登记客户信息。
3. **设置模板**（可选）：在"报价模板"中为不同客户群体设置价格体系。
4. **创建报价单**：选择客户 → 选择模板 → 添加/导入产品明细 → 查看毛利分析 → 保存。
5. **导出**：在报价单列表点击 PDF / Excel 图标一键下载。

### 折扣规则
- 每行产品有独立"行折扣"（默认 100 = 原价）：`行金额 = 数量 × 单价 × 行折扣 / 100`
- 报价单顶部有"整单折扣率"：`合计 = 小计 × (1 - 整单折扣率 / 100)`

---

## 🗂️ 项目结构

```
.
├── client/          # React 前端 (Vite)
│   └── src/
│       ├── pages/   # 页面组件
│       ├── services/# API 调用封装
│       └── locales/ # 中英文翻译文件
├── server/          # Node.js 后端 (Express)
│   ├── routes/      # API 路由（产品/客户/模板/报价/导入/导出）
│   ├── database.js  # 数据库初始化（兼容 MySQL & SQLite）
│   └── index.js     # 服务入口
└── desktop/         # Electron 桌面壳
    ├── main.js      # 主进程（管理窗口 & 启动后端）
    ├── client/      # 构建后的前端资源（打包时自动填充）
    └── server/      # 服务端代码副本（打包时自动填充）
```

---

## 🛡️ 数据安全

- **Web 版**：定期备份 MySQL `quotation_system` 数据库。
- **桌面版**：备份 `desktop/database.db` 文件即可。

---

## 📄 许可证

[MIT License](LICENSE)
