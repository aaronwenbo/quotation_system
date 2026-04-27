# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ERP系统初始化 - 产品编码统一整理项目。
统一两个来源（蘑菇+内线）的产品报价数据，按照三条规则识别产品别名，建立标准产品库，用于更新库存文件中的产品编码。

## Architecture

项目采用**分步流水线**架构：
1. **数据合并层**：合并多来源Excel报价文件，统一格式
2. **别名识别层**：跨文件按三条规则识别产品编码别名对
3. **标准库构建层**：从内线表整理生成标准产品库，自动处理`*`和`T`
4. **库存匹配层**：统计库存文件与标准产品库的匹配情况，识别无归属编码

## Directory Structure

```
product_data_clean/
├── src/                    # Python脚本源代码（按执行顺序排列）
├── data/                   # 原始数据文件和输出数据
├── logs/                   # 程序运行日志（每个脚本独立日志文件）
├── docs/                   # 项目文档、进度备忘录、实施计划
├── output/                 # 中间输出文件
├── order/                  # 订单数据文件（用于库存更新的输入）
└── CLAUDE.md               # 此文件
```

## Key Scripts in `src/`

按**执行顺序**排列：

| Script | Purpose | 输出文件 |
|--------|---------|----------|
| `merge_products.py` | 基础合并 - 将多sheet合并为单表，提取产品编码、规格、售价 | 统一格式的报价文件 |
| `merge_product_codes.py` | 编码整合 - 整合多个来源的产品数据，建立统一全面的产品编码列表 | `output/unified_product_list.xlsx` |
| `build_standard_product_library.py` | 标准库构建 - 整理内线表，自动处理`*`和`T`生成干净标准编码 | `data/standard_product_library.xlsx` |
| `build_standard_alias.py` | **别名识别主程序** - 跨文件（蘑菇+内线）按三条规则识别别名 | `data/alias_mapping.xlsx` |
| `stock_matching_stat.py` | 库存匹配统计 - 统计库存与标准库的匹配率，输出无归属编码 | `data/stock_unmatched_codes.xlsx` |
| `quote_order.py` | 订单报价 - 基于标准产品库对订单文件自动报价，支持0/O字符混淆容错匹配 | `output/20260420_quoted.xlsx`, `output/HT_quoted.xlsx` |
| `unify_products.py` | 最终统一 - 合并两份报价，生成统一产品编码库，更新库存文件 | 更新后的库存文件 |

> **注意**：`unify_products.py` 是早期版本，新流程使用 `build_standard_alias.py` + `build_standard_product_library.py` + `stock_matching_stat.py` 组合。

## Three Alias Detection Rules

所有规则都要求**规格相同**作为前提条件：

1. **规则一（第五位1/2差异）**：去掉`-`后长度相同，仅第五位一个是`1`一个是`2` → 第五位是`2`的作为别名
2. **规则二（末尾T差异）**：一个编码末尾是`T`，去掉`T`后完全相同 → 末尾带`T`的作为别名
3. **规则三（含*号尺寸标记）**：一个包含`*`（尺寸标记），去掉`*`及后续直到下一个`-`后相同 → 带`*`的作为别名

## Output Data Files in `data/`

| File | Description |
|------|-------------|
| `product_import_template.xlsx` | 原始数据 - 蘑菇报价（1497条，规格从编码前三位提取） |
| `product_import_template_neixian.xlsx` | 原始数据 - 内线报价（1727条，规格列已有值） |
| `initial-bin-stock-template.xlsx` | 原始数据 - 库存（1827条，含产品编码、库位、数量） |
| `alias_mapping.xlsx` | 别名映射表（蘑菇 → 内线，共316条） |
| `standard_product_library.xlsx` | 标准产品库（四列：标准编码、规格、价格、别名集合，共2369条） |
| `stock_unmatched_codes.xlsx` | 库存中无法匹配的唯一编码（共519个） |
| `stock_unmatched_after_conversion.xlsx` | 转换后仍然无法匹配的库存记录 |

## Project Statistics

- 蘑菇 + 内线 原始编码总数：3224
- 去除重复后唯一编码：2685 个
- 去除别名后标准产品：2369 个
- 库存匹配率：32.3%（590/1827）

## Common Commands

```bash
# 进入源码目录
cd src

# 1. 构建标准产品库
python build_standard_product_library.py

# 2. 跨文件识别别名（蘑菇 + 内线）
python build_standard_alias.py

# 3. 统计库存匹配情况
python stock_matching_stat.py

# 4. 对订单文件进行报价
python quote_order.py

# 查看日志（按脚本名查看对应日志）
tail -f ../logs/build_standard_alias.log
tail -f ../logs/build_standard_product_library.log
tail -f ../logs/stock_matching_stat.log
```

## Code Rules

- 所有代码注释必须使用中文
- 编写程序必须包含完备的日志系统（分级日志输出到文件和控制台）
- 关键操作、分支判断、异常处理都需要输出相应日志
- 所有脚本必须独立可运行，依赖项仅为 pandas 和标准库
