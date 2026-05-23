# Python API 文档

本技能可作为Python模块导入使用。

## 快速开始

```python
# 导入模块
import sys
sys.path.insert(0, '/path/to/skill/product-quoting/scripts')

from product_quoting import StandardLibrary, MatchingRules, CodeMatcher

# 初始化
lib = StandardLibrary()                    # 使用默认数据目录
rules = MatchingRules()
matcher = CodeMatcher(lib, rules)

# 匹配编码
matched_code, product_info, label = matcher.match("22611-04-04T")
print(f"匹配结果: {label}, 价格: {product_info['价格']}")
```

## StandardLibrary 类

### 构造函数

```python
StandardLibrary(lib_path: Optional[str] = None)
```

- `lib_path`: 标准库Excel文件路径。默认：`{DATA_DIR}/standard_product_library.xlsx`

### 方法

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `get(code: str)` | 获取产品信息 | Dict 或 None |
| `has(code: str) -> bool` | 检查编码是否存在 | bool |
| `add(code, price, spec='', original='')` | 添加新产品 | bool (是否成功) |
| `save()` | 保存到Excel | None |
| `size() -> int` | 获取产品总数 | int |
| `all_codes() -> List[str]` | 获取所有编码列表 | List[str] |
| `check_duplicates() -> List[str]` | 检查重复编码 | List[str] |

### 产品信息结构

```python
{
    '价格': float,      # 标准单价
    '规格': str,        # 产品类型说明
    '原规格编码': str    # 原始来源编码
}
```

## MatchingRules 类

### 构造函数

```python
MatchingRules(config_path: Optional[str] = None)
```

### 方法

| 方法 | 说明 |
|------|------|
| `get_rule5_mapping(prefix: str)` | 获取前五位映射 |
| `add_rule5_mapping(prefix, target, description)` | 添加映射 |
| `save()` | 保存配置 |

## CodeMatcher 类

### 构造函数

```python
CodeMatcher(library: StandardLibrary, rules: MatchingRules)
```

### 方法

| 方法 | 说明 |
|------|------|
| `clean_code(code) -> str` | 清理编码格式 |
| `match(raw_code) -> Tuple[Optional[str], Optional[Dict], str]` | 匹配编码 |
| `clean_for_library(code: str) -> Tuple[str, List[str]]` | 清理编码用于入库 |

### match() 返回值说明

```python
(
    "22611-04-04",           # 匹配到的标准编码
    {
        "价格": 0.6625,
        "规格": "套筒",
        "原规格编码": "22611-04-04"
    },
    "去T+规则一(1→2)匹配"    # 匹配标注
)
```

## 完整示例

### 批量处理订单

```python
import pandas as pd
from product_quoting import StandardLibrary, MatchingRules, CodeMatcher

def batch_quote(excel_path, code_col, qty_col):
    lib = StandardLibrary()
    rules = MatchingRules()
    matcher = CodeMatcher(lib, rules)
    
    df = pd.read_excel(excel_path, header=None)
    results = []
    
    for _, row in df.iterrows():
        code = str(row.iloc[code_col])
        qty = float(row.iloc[qty_col])
        
        matched_code, product, label = matcher.match(code)
        
        if product:
            total = qty * product['价格']
            results.append({
                '原始编码': code,
                '标准编码': matched_code,
                '数量': qty,
                '单价': product['价格'],
                '总价': total,
                '匹配类型': label
            })
        else:
            results.append({
                '原始编码': code,
                '标准编码': None,
                '数量': qty,
                '单价': None,
                '总价': None,
                '匹配类型': '无匹配'
            })
    
    return pd.DataFrame(results)

# 使用
result_df = batch_quote("订单.xlsx", code_col=1, qty_col=2)
result_df.to_excel("报价结果.xlsx", index=False)
```

### 自定义匹配规则扩展

```python
from product_quoting import CodeMatcher

class CustomCodeMatcher(CodeMatcher):
    """扩展自定义匹配规则"""
    
    def apply_custom_rule(self, code: str):
        """自定义规则：例如特定前缀替换"""
        if code.startswith('OLD-'):
            return code.replace('OLD-', 'NEW-'), "自定义前缀替换"
        return None
    
    def match(self, raw_code):
        # 先尝试原有规则
        result = super().match(raw_code)
        if result[0] is not None:
            return result
        
        # 原有规则未匹配，尝试自定义规则
        code_clean = self.clean_code(raw_code)
        transformed, label = self.apply_custom_rule(code_clean)
        if transformed and self.library.has(transformed):
            return transformed, self.library.get(transformed), label
        
        return None, None, "无匹配"
```

## 批量导入现有标准库

```python
from product_quoting import StandardLibrary

# 创建新库
lib = StandardLibrary('/new/path/library.xlsx')

# 从现有CSV批量导入
import csv
with open('existing_products.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        lib.add(
            code=row['标准编码'],
            price=float(row['价格']),
            spec=row.get('规格', ''),
            original_code=row.get('原规格编码', row['标准编码'])
        )

# 保存
lib.save()
```
