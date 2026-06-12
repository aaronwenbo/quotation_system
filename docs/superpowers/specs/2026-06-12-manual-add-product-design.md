# 手动添加产品到标准库 — 设计规格

## 目标

在 /library 页面顶部新增手动添加产品编码的表单区域，支持查重确认后入库或替换价格。

## 用户交互流程

```
用户打开 /library 页面
  ┌─────────────────────────────────┐
  │  [+] 手动添加产品                │  ← 可折叠表单区
  │  编码: [________]  价格: [____] │
  │  规格: [________]               │
  │  [添加到标准库]                  │
  └─────────────────────────────────┘
         ↓ 提交 POST /add-to-library

  服务端检查 → 编码不存在？
    ├─ 是 → 直接入库，flash "添加成功"，刷新页面
    └─ 否 → 同位置展开确认区：
              ┌─────────────────────────────────┐
              │ ⚠️ 编码 20411-16-05 已存在      │
              │ 现有价格: 28.30 | 新价格: 35.00  │
              │ 现有规格: SS316 | 新规格: SS304  │
              │ [确认替换]  [取消]               │
              └─────────────────────────────────┘
                  ↓ 确认 → POST /add-to-library (force=1)
                  备份旧库 → 替换价格/规格 → 记日志 → flash "已替换"
```

## 改动文件

| 文件 | 改动内容 |
|------|---------|
| `product_quoting_core/library.py` | 新增 `update(code, price, spec, original_code)` 方法 |
| `product_quoting_core/service.py` | 新增 `add_product(code, price, spec, force)` 方法 |
| `product_quoting_web/app.py` | 新增 `/add-to-library` POST 路由 |
| `product_quoting_web/templates/library.html` | 顶部新增折叠表单 + 确认替换区域 |

## 核心方法签名

### library.py — StandardLibrary.update()

```python
def update(self, code: str, price: float, spec: str = '',
           original_code: str = '') -> bool:
    """更新已有产品编码的价格和规格，返回 True 表示成功"""
```

### service.py — QuotingService.add_product()

```python
def add_product(self, code: str, price: float, spec: str = '',
                force: bool = False) -> Dict:
    """
    手动添加产品到标准库
    force=False: 编码存在时返回现有信息，不执行添加
    force=True:  编码存在时先备份再替换价格/规格，记录日志
    Returns: {'status': 'added'|'exists'|'updated', ...}
    """
```

### app.py — /add-to-library

```
POST /add-to-library
参数:
  code:     产品编码 (str)
  price:    价格 (float)
  spec:     规格 (str)
  force:    0 或 1，默认 0
```

## 非功能性要求

- 复用现有 flash 消息机制显示操作结果
- 复用现有 `_write_update_log()` 记录替换操作
- force=1 时自动调用 `backup_library()` 后再替换
- 表单区默认折叠，点击展开
- 确认替换区域通过服务端渲染显示（无需 AJAX）
