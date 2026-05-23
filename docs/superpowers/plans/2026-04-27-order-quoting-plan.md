# 订单报价功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现订单自动报价功能，支持0/O字符混淆容错匹配，对两个订单文件生成报价结果。

**Architecture:** 新建独立脚本 `src/quote_order.py`，加载标准产品库，按规则匹配订单编码并填充价格、标准编码、标注信息。输出到 output/ 目录。

**Tech Stack:** Python 3, pandas, openpyxl

---

### Task 1: 脚本框架与日志配置

**Files:**
- Create: `src/quote_order.py`

- [ ] **Step 1: 创建脚本基础框架（日志、路径配置）**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
订单报价工具
功能：基于标准产品库对订单文件进行自动报价，支持0/O字符混淆容错匹配
"""

import pandas as pd
import logging
import os
from typing import Dict, Tuple, Optional

# 配置日志系统
os.makedirs('logs', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/quote_order.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 确保输出目录存在
OUTPUT_DIR = 'output'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 文件路径配置
STANDARD_LIB_PATH = 'data/standard_product_library.xlsx'
ORDER_20260420_PATH = 'order/20260420.xlsx'
ORDER_HT_PATH = 'order/HT.xlsx'
```

- [ ] **Step 2: 运行脚本验证无语法错误**

Run: `cd src && python -c "import quote_order; print('OK')"`
Expected: OK

- [ ] **Step 3: Commit**

```bash
git add src/quote_order.py
git commit -m "feat: add quote_order script framework"
```

---

### Task 2: 标准产品库加载函数

**Files:**
- Modify: `src/quote_order.py`

- [ ] **Step 1: 添加加载标准产品库函数**

```python
def load_standard_library() -> Dict[str, Dict]:
    """
    加载标准产品库，构建编码→产品信息的映射字典

    Returns:
        Dict: {标准编码: {'价格': float, '原规格编码': str, '规格': str}}
    """
    logger.info("正在加载标准产品库...")
    df = pd.read_excel(STANDARD_LIB_PATH)

    lib = {}
    for _, row in df.iterrows():
        code = str(row['标准编码']).strip()
        lib[code] = {
            '价格': row['价格'],
            '原规格编码': str(row['原规格编码']).strip(),
            '规格': str(row['规格']).strip()
        }

    logger.info(f"标准产品库加载完成，共 {len(lib)} 个产品")
    return lib
```

- [ ] **Step 2: 验证函数正常工作**

Run: `cd src && python -c "
from quote_order import load_standard_library
lib = load_standard_library()
print(f'加载成功: {len(lib)} 个产品')
print(f'示例: 00110-04 = {lib.get('00110-04', {})}')
"`
Expected: 加载成功: 1948 个产品，示例显示正确价格

- [ ] **Step 3: Commit**

```bash
git add src/quote_order.py
git commit -m "feat: add standard library loading function"
```

---

### Task 3: 编码匹配与O→0转换函数

**Files:**
- Modify: `src/quote_order.py`

- [ ] **Step 1: 添加编码清理和匹配函数**

```python
def clean_code(code: Optional[str]) -> str:
    """清理产品编码，去除空格"""
    if pd.isna(code) or code is None:
        return ''
    return str(code).replace(' ', '').strip()

def match_code(code: str, standard_lib: Dict[str, Dict]) -> Tuple[Optional[Dict], str]:
    """
    匹配产品编码，支持O→0转换容错

    Args:
        code: 待匹配的产品编码
        standard_lib: 标准产品库字典

    Returns:
        (产品信息字典, 匹配类型标注)
        匹配类型: "直接匹配" / "O→0转换匹配" / "" (无匹配)
    """
    code_clean = clean_code(code)

    if not code_clean:
        return None, ''

    # 直接匹配
    if code_clean in standard_lib:
        return standard_lib[code_clean], "直接匹配"

    # O→0转换匹配
    code_converted = code_clean.replace('O', '0').replace('o', '0')
    if code_converted != code_clean and code_converted in standard_lib:
        return standard_lib[code_converted], "O→0转换匹配"

    return None, "无匹配"
```

- [ ] **Step 2: 验证匹配函数**

Run: `cd src && python -c "
from quote_order import load_standard_library, match_code
lib = load_standard_library()
# 直接匹配
info, label = match_code('00110-04', lib)
print(f'00110-04: 价格={info[\"价格\"] if info else None}, 标注={label}')
# O→0转换匹配
info, label = match_code('00TFO-05', lib)
print(f'00TFO-05: 价格={info[\"价格\"] if info else None}, 标注={label}')
# 无匹配
info, label = match_code('XXXX-99', lib)
print(f'XXXX-99: 价格={info}, 标注={label}')
"`
Expected: 直接匹配成功，O→0转换匹配成功（价格0.339），无匹配返回None

- [ ] **Step 3: Commit**

```bash
git add src/quote_order.py
git commit -m "feat: add code matching function with O->0 conversion"
```

---

### Task 4: 处理20260420.xlsx主订单文件

**Files:**
- Modify: `src/quote_order.py`

- [ ] **Step 1: 添加主订单处理函数**

```python
def is_product_code(code: str) -> bool:
    """判断是否为产品编码（非标题行）"""
    code_clean = clean_code(code)
    if not code_clean:
        return False
    # 排除标题关键词
    exclude_keywords = ['FERRULE', 'PART', 'NO', 'HOSE', 'BSP', 'JIC', 'METRIC',
                        'SAE', 'FLANGE', 'CONNECTOR', 'BANJO', 'JIS', 'ORFS', 'ITEM',
                        'FOR', 'EN', 'ISO', 'DIN', 'GB/T', 'L.T.', 'H.T.', 'SEAT']
    for kw in exclude_keywords:
        if kw.upper() in code_clean.upper():
            return False
    # 产品编码通常包含'-'且长度在5-20之间
    return '-' in code_clean and 5 <= len(code_clean) <= 20

def process_main_order(standard_lib: Dict[str, Dict]) -> pd.DataFrame:
    """
    处理20260420.xlsx主订单文件

    Returns:
        处理后的DataFrame
    """
    logger.info("正在处理主订单文件 20260420.xlsx...")
    df = pd.read_excel(ORDER_20260420_PATH, header=None)

    # 确保有足够的列（扩展到K列，索引10）
    while len(df.columns) < 11:
        df[len(df.columns)] = None

    # 统计变量
    total_rows = 0
    direct_match = 0
    o0_match = 0
    no_match = 0
    no_match_codes = []

    for idx, row in df.iterrows():
        code = row.iloc[0]

        if not is_product_code(code):
            continue

        total_rows += 1
        product_info, match_label = match_code(code, standard_lib)

        if product_info:
            # G列 = 价格
            df.iloc[idx, 6] = product_info['价格']
            # I列 = 标准编码（O→0转换后的）
            df.iloc[idx, 8] = clean_code(code).replace('O', '0').replace('o', '0') if 'O→0' in match_label else clean_code(code)
            # J列 = 原规格编码
            df.iloc[idx, 9] = product_info['原规格编码']
            # K列 = 匹配标注
            df.iloc[idx, 10] = match_label

            if match_label == "直接匹配":
                direct_match += 1
            else:
                o0_match += 1
        else:
            df.iloc[idx, 10] = match_label
            no_match += 1
            no_match_codes.append(clean_code(code))

        # H列 = 总价 = F列数量 × G列单价
        quantity = row.iloc[5]
        price = df.iloc[idx, 6]
        if pd.notna(quantity) and pd.notna(price):
            try:
                df.iloc[idx, 7] = float(quantity) * float(price)
            except (ValueError, TypeError):
                pass

    logger.info(f"主订单处理完成: 共 {total_rows} 行产品")
    logger.info(f"  直接匹配: {direct_match} 行")
    logger.info(f"  O→0转换匹配: {o0_match} 行")
    logger.info(f"  无匹配: {no_match} 行")
    if no_match_codes:
        logger.info(f"  无匹配编码列表: {no_match_codes}")

    return df
```

- [ ] **Step 2: 验证处理函数**

Run: `cd src && python -c "
from quote_order import load_standard_library, process_main_order
lib = load_standard_library()
df = process_main_order(lib)
print(f'处理后形状: {df.shape}')
print(f'检查O→0转换匹配行:')
for idx, row in df.iterrows():
    if row.iloc[10] == 'O→0转换匹配':
        print(f'  行{idx}: {row.iloc[0]} -> 价格={row.iloc[6]}, 总价={row.iloc[7]}')
        break
"`
Expected: 显示处理后的形状，找到O→0转换匹配的行（00TFO-XX系列）并显示正确价格

- [ ] **Step 3: Commit**

```bash
git add src/quote_order.py
git commit -m "feat: add main order processing function"
```

---

### Task 5: 处理HT.xlsx订单文件

**Files:**
- Modify: `src/quote_order.py`

- [ ] **Step 1: 添加HT订单处理函数**

```python
def process_ht_order(standard_lib: Dict[str, Dict]) -> pd.DataFrame:
    """
    处理HT.xlsx订单文件

    Returns:
        处理后的DataFrame
    """
    logger.info("正在处理HT订单文件 HT.xlsx...")
    df = pd.read_excel(ORDER_HT_PATH, header=None)

    # 确保有足够的列（扩展到F列，索引5）
    while len(df.columns) < 6:
        df[len(df.columns)] = None

    # 统计变量
    total_rows = 0
    direct_match = 0
    o0_match = 0
    no_match = 0
    no_match_codes = []

    for idx, row in df.iterrows():
        code = row.iloc[0]

        if not is_product_code(code):
            continue

        total_rows += 1
        product_info, match_label = match_code(code, standard_lib)

        if product_info:
            # C列 = 价格
            df.iloc[idx, 2] = product_info['价格']
            # D列 = 标准编码
            df.iloc[idx, 3] = clean_code(code).replace('O', '0').replace('o', '0') if 'O→0' in match_label else clean_code(code)
            # E列 = 原规格编码
            df.iloc[idx, 4] = product_info['原规格编码']
            # F列 = 匹配标注
            df.iloc[idx, 5] = match_label

            if match_label == "直接匹配":
                direct_match += 1
            else:
                o0_match += 1
        else:
            df.iloc[idx, 5] = match_label
            no_match += 1
            no_match_codes.append(clean_code(code))

    logger.info(f"HT订单处理完成: 共 {total_rows} 行产品")
    logger.info(f"  直接匹配: {direct_match} 行")
    logger.info(f"  O→0转换匹配: {o0_match} 行")
    logger.info(f"  无匹配: {no_match} 行")
    if no_match_codes:
        logger.info(f"  无匹配编码列表: {no_match_codes}")

    return df
```

- [ ] **Step 2: 验证HT处理函数**

Run: `cd src && python -c "
from quote_order import load_standard_library, process_ht_order
lib = load_standard_library()
df = process_ht_order(lib)
print(f'处理后形状: {df.shape}')
matched = df[df.iloc[:, 5].isin(['直接匹配', 'O→0转换匹配'])]
print(f'匹配成功行数: {len(matched)}')
"`
Expected: 显示处理后的形状和匹配成功行数

- [ ] **Step 3: Commit**

```bash
git add src/quote_order.py
git commit -m "feat: add HT order processing function"
```

---

### Task 6: 主函数与文件保存

**Files:**
- Modify: `src/quote_order.py`

- [ ] **Step 1: 添加主函数**

```python
def main():
    """主函数：处理所有订单文件"""
    logger.info("=" * 50)
    logger.info("开始订单报价处理")
    logger.info("=" * 50)

    # 加载标准产品库
    standard_lib = load_standard_library()

    # 处理主订单
    df_main = process_main_order(standard_lib)
    output_main = os.path.join(OUTPUT_DIR, '20260420_quoted.xlsx')
    df_main.to_excel(output_main, index=False, header=False)
    logger.info(f"主订单结果已保存到: {output_main}")

    # 处理HT订单
    df_ht = process_ht_order(standard_lib)
    output_ht = os.path.join(OUTPUT_DIR, 'HT_quoted.xlsx')
    df_ht.to_excel(output_ht, index=False, header=False)
    logger.info(f"HT订单结果已保存到: {output_ht}")

    logger.info("=" * 50)
    logger.info("所有订单报价处理完成")
    logger.info("=" * 50)

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: 运行完整脚本**

Run: `cd src && python quote_order.py`
Expected: 日志显示处理完成，output/目录生成两个文件

- [ ] **Step 3: 验证输出文件**

Run: `cd src && python -c "
import pandas as pd
df_main = pd.read_excel('output/20260420_quoted.xlsx', header=None)
df_ht = pd.read_excel('output/HT_quoted.xlsx', header=None)
print(f'20260420_quoted.xlsx: {df_main.shape}')
print(f'HT_quoted.xlsx: {df_ht.shape}')
# 检查K列标注
labels = df_main.iloc[:, 10].dropna().value_counts()
print(f'主订单匹配标注统计:\\n{labels}')
"`
Expected: 两个文件都生成，标注统计显示直接匹配和O→0转换匹配的数量

- [ ] **Step 4: Commit**

```bash
git add src/quote_order.py
git commit -m "feat: add main function and complete order quoting"
```

---

### Task 7: 更新CLAUDE.md文档

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 在 Key Scripts 中添加新脚本**

在 Key Scripts 表格中添加一行：
| `quote_order.py` | 订单报价 - 基于标准产品库对订单文件自动报价，支持0/O字符混淆容错匹配 | `output/20260420_quoted.xlsx`, `output/HT_quoted.xlsx` |

在 Common Commands 中添加：
```bash
# 4. 对订单文件进行报价
python quote_order.py
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with quote_order script"
```
