---
name: product-quoting
description: 产品编码匹配与自动报价技能 - 使用统一核心库，与CLI/Web 100%一致
parameters:
  - name: action
    description: 操作类型
    required: true
    type: string
    enum: [quote, update, init, check, help]
  - name: file_path
    description: 订单/反馈文件路径
    required: false
    type: string
  - name: code_col
    description: 产品编码列号 (A=0, B=1...)
    required: false
    type: integer
    default: 0
  - name: qty_col
    description: 数量列号（报价时需要）
    required: false
    type: integer
    default: 1
  - name: price_col
    description: 价格列号（更新时需要）
    required: false
    type: integer
    default: 5
  - name: label_col
    description: 匹配标注列号（更新时需要）
    required: false
    type: integer
    default: 10
examples:
  - prompt: "对订单报价，产品在B列，数量在D列"
    params:
      action: quote
      file_path: /path/to/order.xlsx
      code_col: 1
      qty_col: 3
  - prompt: "从反馈更新标准库"
    params:
      action: update
      file_path: /path/to/feedback.xlsx
      code_col: 0
      price_col: 5
      label_col: 10
  - prompt: "检查标准库重复编码"
    params:
      action: check
---

# 产品报价技能 (v3.0 核心库版)

## ⚠️  重要架构说明

**单一核心库架构**：本技能是薄包装层，**不包含任何匹配逻辑**。所有匹配规则、标准库操作都统一在项目根目录的 `product_quoting_core/` 中实现。

好处：
- ✅ CLI / Web / Codex Skill 三者匹配逻辑 **100% 一致**
- ✅ 一处修改，所有入口自动生效
- ✅ 避免代码重复导致的行为不一致

架构图：
```
              ┌───────────────────────────┐
              │  product_quoting_core/    │
              │  所有匹配逻辑唯一位置     │
              │  matcher.py (5条规则)     │
              └─────────────┬─────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼───────┐  ┌────────▼─────────┐  ┌──────▼───────┐
│ product_quoting_web │  │ src/quoting_skill.py │  │ 本技能 (.Codex/) │
│   (Flask Web应用)   │  │   (CLI脚本)          │  │  (薄包装，仅导入)│
│ quoting_wrapper.py  │  │  (直接import核心)    │  │  main.py          │
└─────────────────────┘  └─────────────────────┘  └───────────────────┘
```

## 快速开始

### 报价

```bash
cd /Users/aaron/product_data_clean/.Codex/skills/product-quoting
python scripts/main.py quote /path/to/订单.xlsx 1 3
#   产品列=1, 数量列=3
```

### 更新标准库

```bash
python scripts/main.py update /path/to/反馈.xlsx 0 5 10
#   产品列=0, 价格列=5, 标注列=10
```

### 检查重复编码

```bash
python scripts/main.py check
```

## 五条匹配规则（优先级从高到低）

| 规则 | 说明 |
|-----|------|
| **直接匹配** | 编码与标准库完全一致 |
| **规则一** | 去掉`-`后第五位字符 1↔2 双向互换 |
| **规则二** | 移除编码末尾的 `T`（预处理变体） |
| **规则三** | 去掉 `*` 及其后面直到下一个 `-` 的内容 |
| **规则四** | 字母 `O/o` 替换为数字 `0` |
| **规则五** | 前五位编码按映射表匹配（可配置扩展） |

> 规则二、三支持变体组合（去T+去*，去*+去T），所有变体都依次尝试规则一、五、四

## 规则五扩展方式

编辑项目根目录 `data/matching_rules_config.json`：
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

## 数据文件位置（项目根目录）

| 文件 | 路径 |
|------|------|
| 标准产品库 | `data/standard_product_library.xlsx` |
| 规则配置 | `data/matching_rules_config.json` |
| 订单输入 | `order/` |
| 报价输出 | `output/` |
| 反馈文件 | `feedback/` |
| 运行日志 | `logs/` |

## 飞书机器人集成

已配置飞书 Bot，Chat ID: `oc_af677b42686cb33271f07e05979e18fe`

```bash
# 报价（结果自动发飞书）
python scripts/feishu_quote_bot.py quote --file /path/to/order.xlsx --code-col 1 --qty-col 3

# 更新标准库（结果自动发飞书）
python scripts/feishu_quote_bot.py update --file /path/to/feedback.xlsx --code-col 0 --price-col 5 --label-col 10

# 检查重复
python scripts/feishu_quote_bot.py check
```

## 完整工作流

```
1. 收到订单Excel → quote报价
        ↓
2. 人工打开 feedback/xxx_quoted.xlsx 填写无匹配产品价格
        ↓
3. update更新标准库（新增产品自动入库）
        ↓
4. 下次相同编码自动匹配
```

## 注意事项

- ⚠️ **绝对不要**在本技能的 scripts/ 中修改任何匹配逻辑
- ⚠️ 所有匹配规则的修改都必须在 `product_quoting_core/matcher.py` 中进行
- ⚠️ 标准产品库统一使用项目根目录的 `data/`，不是 skill 自己的 data/
- ✅ 列号从 0 开始：A=0, B=1, C=2, D=3, E=4, F=5...
