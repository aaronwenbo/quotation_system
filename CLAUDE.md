# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

产品编码统一与自动报价系统。对订单报价表中的产品编码，通过5条智能匹配规则识别并自动填充价格，形成"报价→人工补价→更新标准库"的闭环流程。

**核心定位：** 不是一次性数据清洗脚本，而是持续运行的业务工具

---

## 统一核心库架构（非常重要）

为确保所有入口点（CLI脚本、Web应用、Claude技能）的匹配逻辑100%一致，项目采用**单一核心库 + 单一数据目录**架构。

### 架构图示

```
                  ┌───────────────────────────┐
                  │  product_quoting_core/    │
                  │  所有匹配逻辑唯一位置     │
                  │  matcher.py (5条规则)     │
                  │  library.py (库CRUD)      │
                  │  service.py (报价服务)    │
                  └─────────────┬─────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
┌─────────▼─────────┐  ┌────────▼─────────┐  ┌────────▼─────────┐
│ product_quoting_web │  │ src/quoting_skill.py │  │  Claude Skill   │
│   (Flask Web应用)   │  │   (CLI脚本)          │  │ (.agents/skills)│
│ quoting_wrapper.py  │  │  (直接import核心)    │  │  core_compat.py │
│    (仅导入，无逻辑) │  │                      │  │  (仅导入，无逻辑)│
└─────────────────────┘  └─────────────────────┘  └──────────────────┘
                                │
                                ▼
                  ┌───────────────────────────┐
                  │ product_quoting_web/data/ │
                  │  唯一数据目录              │
                  │  standard_product_library  │
                  │  matching_rules_config.json│
                  └───────────────────────────┘
```

### 绝对原则

| 层面 | 唯一真实位置 | 说明 |
|-----|-------------|------|
| **匹配逻辑** | `product_quoting_core/matcher.py` | 禁止在上层添加/修改匹配规则 |
| **标准产品库** | `product_quoting_web/data/standard_product_library.xlsx` | 一处修改，三处同步 |
| **规则配置** | `product_quoting_web/data/matching_rules_config.json` | 新增规则五映射只需编辑此处 |

### 核心调用流程

```
订单报价流程：
  quoting_skill.py quote / web app.py
    ↓
  service.QuotingService.process_quote()
    ↓
  加载 StandardLibrary + MatchingRules
    ↓
  CodeMatcher.match() 生成预处理变体 → 对每个变体依次尝试直接匹配、规则一、规则五、规则四
    ↓
  save_styled_quote() 生成带颜色样式的Excel → output/ + feedback/

标准库更新流程：
  quoting_skill.py update / web app.py
    ↓
  service.QuotingService.update_library()
    ↓
  筛选标注为"无匹配"且有价格的行
    ↓
  CodeMatcher.clean_for_library() 清洗编码（先规则三去*，再规则二去T）
    ↓
  追加到标准库Excel + 写入 library_updates.xlsx 日志 + 生成备份
```

### 匹配算法细节（多文件才能理解）

`matcher.py` 的 `match()` 方法不是逐条应用规则，而是**先枚举所有预处理变体，再对每个变体尝试所有转换规则**：

1. **生成变体**（`generate_variants`）：原始编码 → 去T → 去* → 去T+去* → 去*+去T，最多5个变体
2. **对每个变体依次尝试**：直接匹配 → 规则一(1↔2) → 规则五(前五位映射) → 规则四(O→0)
3. **一旦命中立即停止**，返回匹配的变体 + 规则组合标签

**入库清洗顺序**（`clean_for_library`）：先规则三去*，再规则二去T。这与匹配时的变体生成顺序不同，会影响最终入库的标准编码形态。

---

## 推荐工作流

### 方式一：命令行（最常用）

```bash
cd src

# 1. 对订单报价
python quoting_skill.py quote ../order/询价文件.xlsx <产品列号> <数量列号>
# 示例: python quoting_skill.py quote ../order/接头询价\(4.xls 1 2

# 2. 人工打开 ../feedback/xxx_quoted.xlsx 填写未匹配产品的价格

# 3. 从反馈更新标准库（新增产品自动入库）
python quoting_skill.py update ../feedback/xxx_quoted.xlsx <产品列号> <价格列号> <标注列号>
# 示例: python quoting_skill.py update ../feedback/接头询价\(4_quoted.xlsx 0 5 10
```

CLI 入口会同时生成两份输出：`output/`（结果存档）和 `feedback/`（待人工填写价格后用于 update）。

### 方式二：Web应用

```bash
cd product_quoting_web

# 安装依赖（首次）
pip install -r requirements.txt

# 可选：配置环境变量
cp .env.example .env
# 编辑 .env 修改密码等配置

# 启动服务
python app.py
```

**Web 应用环境变量配置：**
| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BASIC_AUTH_USERNAME` | 登录用户名 | `admin` |
| `BASIC_AUTH_PASSWORD` | 登录密码 | `quote123` |
| `SECRET_KEY` | Flask密钥 | 开发默认值 |
| `FLASK_PORT` | 监听端口 | `5001`（config.py 中硬编码默认值） |
| `FLASK_HOST` | 监听地址 | `0.0.0.0` |
| `FLASK_DEBUG` | 调试模式 | `0`（关闭） |

Web 使用 HTTP Basic Auth（非 Session/Cookie），每次请求都带 Authorization 头。默认账号 `admin` / `quote123`。

### 方式三：Claude Skill

```bash
cd .agents/skills/product-quoting
python scripts/main.py quote ../../order/询价文件.xlsx 1 2
```

Skill 的 `update` 命令实际通过 `subprocess` 调用 `src/quoting_skill.py update`，而非直接调用核心库（因核心库 update_library 签名与 CLI 需求不同）。

**核心库版本：** `product_quoting_core.__version__` = "2.0.0"，通过 `__init__.py` 导出 `StandardLibrary`, `MatchingRules`, `CodeMatcher`, `QuotingService` 四个公共类。

---

## 五条匹配规则（优先级从高到低）

| 规则 | 说明 |
|-----|------|
| **直接匹配** | 编码与标准库完全一致 |
| **规则一** | 去掉`-`后第五位字符 1↔2 双向互换 |
| **规则二** | 移除编码末尾的 `T`（预处理变体） |
| **规则三** | 去掉 `*` 及其后面直到下一个 `-` 的内容（预处理变体） |
| **规则四** | 字母 `O/o` 替换为数字 `0` |
| **规则五** | 前五位编码按映射表匹配（可配置扩展） |

> 规则二、三支持变体组合（去T+去*，去*+去T），所有变体都依次尝试规则一、五、四

### 规则五扩展方式

编辑 `product_quoting_web/data/matching_rules_config.json`：

```json
{
  "rule5_prefix_mapping": {
    "mappings": {
      "30411": ["20411", "30411→20411"],
      "你的前五位": ["目标前五位", "说明"]
    }
  }
}
```

---

## 目录结构（维护边界）

```
product_data_clean/
├── product_quoting_core/   # 核心维护代码 - 所有业务逻辑唯一位置
│   ├── matcher.py          # ← 修改匹配规则只改这里
│   ├── library.py          # ← 修改标准库CRUD改这里
│   └── service.py          # ← 修改报价流程改这里
│
├── product_quoting_web/    # Web应用入口
│   ├── data/               # ← 唯一数据目录（三处共用）
│   │   ├── standard_product_library.xlsx
│   │   └── matching_rules_config.json
│   ├── storage/            # Web运行时数据（uploads/results/backup/logs）
│   ├── app.py              # Flask路由
│   ├── config.py           # 配置（含目录创建、默认值）
│   └── quoting_wrapper.py  # 薄包装层（无逻辑）
│
├── src/                     # ⚠️ 遗留代码区 - 尽量不要修改
│   ├── quoting_skill.py    # CLI入口（纯包装，无逻辑）
│   └── build_standard_product_library.py  # 重建标准库（极少用）
│
├── .agents/skills/product-quoting/  # Claude Skill入口（纯包装）
│
├── order/                   # 输入：待报价订单
├── output/                  # 输出：报价结果
├── feedback/                # 输入：人工补价后
└── logs/                    # 运行日志 + library_updates.xlsx
```

---

## 标准产品库数据结构

| 列 | 说明 |
|----|------|
| 标准编码 | 清洗后的主键（去T、去*） |
| 价格 | 标准单价 |
| 规格 | 产品类型描述 |
| 原规格编码 | 原始来源编码 |

---

## Dependencies

```bash
pip install pandas openpyxl xlrd flask python-dotenv
```

---

## 开发与测试

### 代码修改验证流程

**修改 `product_quoting_core/` 后必须验证：**

```bash
# 1. 运行CLI回归测试（用标准测试文件）
cd src
python quoting_skill.py quote ../order/接头询价\(4.xls 1 2

# 预期输出:
# - 匹配率: ~36-37%
# - 直接匹配: ~94 行
# - 规则一: 1 行
# - 规则二: 3 行
# - 规则四: 3 行
# - 规则五: 8 行

# 2. 验证数据文件未被意外修改（可选）
# 检查标准库大小是否合理
ls -lh ../product_quoting_web/data/standard_product_library.xlsx
```

**匹配率异常排查：**
- 如果匹配率为 0%：检查文件列号是否正确
- 如果匹配率大幅下降：检查 `matcher.py` 是否引入了bug
- 如果规则五匹配数为 0：检查 `matching_rules_config.json` 是否存在且格式正确

### Web 应用验证

```bash
cd product_quoting_web
python app.py &
curl -I http://localhost:5001  # 注意默认端口是 5001，不是 5000
kill %1
```

### 本项目暂无自动化测试套件

所有修改通过**文件级回归测试**验证：
- CLI: `order/接头询价(4.xls` 作为标准测试文件
- 预期: 匹配率 ~36.9%，行数 295 行
- 确保修改前后输出一致

---

## 常用命令

```bash
# ========== 日常使用 ==========
cd src

# 对订单报价
python quoting_skill.py quote ../order/询价.xlsx <产品列号> <数量列号>

# 从反馈更新标准库
python quoting_skill.py update ../feedback/报价结果.xlsx <产品列> <价格列> <标注列>

# ========== Web 应用 ==========
cd product_quoting_web
python app.py  # 启动Web服务，默认 http://localhost:5001

# ========== 维护命令（极少用） ==========

# 重建标准产品库（内线表变更时）
python build_standard_product_library.py

# 查看更新日志（Excel格式）
ls ../logs/library_updates.xlsx
# 查看运行日志（文本格式）
tail ../logs/quoting_skill.log
```

---

## 排错指南

| 问题 | 排查方法 |
|------|---------|
| 匹配率低 | 查看未匹配编码列表，考虑在 `product_quoting_web/data/matching_rules_config.json` 新增规则五映射 |
| 标准库无更新 | 确认反馈文件的标注列包含"无匹配"且价格列有数值；检查 `logs/library_updates.xlsx` 是否有写入记录 |
| Excel读取错误 | 确认文件未被 Excel 程序打开，检查文件后缀是否为 `.xlsx` 或 `.xls` |
| 匹配结果不一致 | 检查是否使用了不同的标准库数据文件（应统一使用 `product_quoting_web/data/`） |
| ModuleNotFoundError | 确认 PYTHONPATH 包含项目根目录，或在 src/ 下运行（已自动添加路径） |
| Web 启动失败 | 检查 5001 端口是否被占用，或通过 `FLASK_PORT` 更换端口 |

---

## 代码规范

- 所有代码注释使用中文
- 所有脚本必须记录完整日志（输出到 `logs/` + 控制台）
- 关键操作（如新增产品到标准库）必须记录上下文
- **最重要：匹配逻辑只存在于 `product_quoting_core/matcher.py`**
  - 不允许在其他任何文件中复制/修改匹配代码
  - 新增规则只改 `matcher.py`
  - 修改后所有入口点自动生效
  - **src/ 和 product_quoting_web/ 只允许 import 核心库，不允许重写逻辑**
