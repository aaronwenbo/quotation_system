# 标准库价格查询 — 设计规格

## 目标

在 Web 端新增独立的"价格查询"Tab 页面，支持通过编码或关键词搜索标准库中的产品价格信息。

## 用户交互流程

```
用户打开 /search 页面
  ┌─────────────────────────────────┐
  │  搜索: [_______________] [查询] │
  └─────────────────────────────────┘
          ↓ GET /search?q=xxx

  服务端搜索 → 匹配结果？
    ├─ 精确匹配 1 条 → 展示单条详情（编码、价格、规格、原始编码）
    ├─ 模糊匹配多条   → 表格列表展示（序号、编码、价格、规格、原始编码）
    └─ 无匹配         → 提示 "未找到相关产品，请尝试其他关键词"
```

## 搜索逻辑

- 输入完整编码（如 `20411-16-05`）→ 先在字典中精确查找
- 精确命中 1 条 → 直接返回该条
- 精确未命中 → 遍历库中所有编码，匹配编码或规格中包含关键词的记录（不区分大小写）
- 返回所有模糊匹配结果

## 改动文件

| 文件 | 改动内容 |
|------|---------|
| `product_quoting_core/service.py` | 新增 `search_library(keyword)` 方法 |
| `product_quoting_web/app.py` | 新增 `GET /search` 路由 |
| `product_quoting_web/templates/base.html` | 导航栏新增"价格查询"链接 |
| `product_quoting_web/templates/search.html` | 新建查询页面模板 |

## 核心方法签名

### service.py — QuotingService.search_library()

```python
def search_library(self, keyword: str) -> List[Dict]:
    """
    在标准库中搜索产品

    Args:
        keyword: 搜索关键词，支持编码或规格模糊匹配

    Returns:
        匹配产品列表，每项包含: 标准编码, 价格, 规格, 原规格编码
    """
```

### app.py — GET /search

```
GET /search?q=关键词
  参数 q: 搜索关键词，可选，为空时不搜索仅显示页面
```

## 非功能性要求

- 复用现有 `StandardLibrary` 的 `library` 字典进行内存搜索
- 搜索不区分大小写
- 结果按编码字母序排列
- 样式与现有页面保持一致
- 复用 HTTP Basic Auth
