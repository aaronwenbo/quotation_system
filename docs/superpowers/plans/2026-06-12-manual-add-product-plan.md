# 手动添加产品到标准库 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 在 /library 页面顶部新增可折叠的"手动添加产品"表单，支持查重确认后入库或替换价格。

**架构:** 在 StandardLibrary 新增 update() 方法，QuotingService 新增 add_product() 封装业务逻辑，Flask 路由处理两步交互（首次添加 → 查重确认 → 强制替换），library.html 通过服务端渲染实现折叠表单和确认区域。

**技术栈:** Python 3, Flask, pandas, openpyxl, Jinja2

---

### Task 1: StandardLibrary 新增 update() 方法

**文件:**
- 修改: `product_quoting_core/library.py`（在 `add()` 方法后插入）

- [ ] **Step 1: 添加 update() 方法**

在 `add()` 方法（第66行 `return False`）之后，插入：

```python
    def update(self, code: str, price: float, spec: str = '',
               original_code: str = '') -> bool:
        """
        更新已有产品编码的价格和规格

        Args:
            code: 标准编码
            price: 新价格
            spec: 新规格
            original_code: 原始编码

        Returns:
            True 表示更新成功，False 表示编码不存在
        """
        code = code.strip()
        if code not in self.library:
            return False
        self.library[code]['价格'] = float(price)
        if spec:
            self.library[code]['规格'] = spec
        if original_code:
            self.library[code]['原规格编码'] = original_code
        return True
```

- [ ] **Step 2: 验证 Python 语法**

```bash
python3 -c "from product_quoting_core.library import StandardLibrary; print('import OK')"
```

- [ ] **Step 3: 提交**

```bash
git add product_quoting_core/library.py
git commit -m "feat: add update() method to StandardLibrary for price replacement

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: QuotingService 新增 add_product() 方法

**文件:**
- 修改: `product_quoting_core/service.py`（在 `check_duplicates()` 方法后插入）

- [ ] **Step 1: 添加 add_product() 方法**

在 `check_duplicates()` 方法（第303行 `return self.lib.check_duplicates()`）之后，空行之后 `save_styled_quote()` 之前插入：

```python
    def add_product(self, code: str, price: float, spec: str = '',
                    force: bool = False) -> Dict:
        """
        手动添加产品到标准库

        Args:
            code: 产品编码
            price: 价格
            spec: 规格描述
            force: 是否强制替换已存在的编码

        Returns:
            {
                'status': 'added' | 'exists' | 'updated' | 'error',
                'existing': {...}  仅 status='exists' 时返回现有产品信息
                'message': str
            }
        """
        code = code.strip()
        if not code:
            return {'status': 'error', 'message': '编码不能为空'}

        try:
            price = float(price)
        except (ValueError, TypeError):
            return {'status': 'error', 'message': '价格格式无效'}

        if not self.lib.has(code):
            if force:
                return {'status': 'error', 'message': f'编码 {code} 不存在，无法替换'}
            # 编码不存在，直接添加
            self.lib.add(code, price, spec, code)
            self.lib.save()
            self._write_update_log([{'std': code, 'original': code, 'price': price}])
            logger.info(f"手动添加产品: {code}, 价格: {price}")
            return {'status': 'added', 'message': f'产品 {code} 已成功添加到标准库'}
        else:
            existing = self.lib.get(code)
            if not force:
                # 编码已存在，返回现有信息等待用户确认
                return {
                    'status': 'exists',
                    'message': f'编码 {code} 已存在',
                    'existing': existing
                }
            else:
                # 强制替换（调用方应先在路由层 backup_library）
                old_price = existing.get('价格', 'N/A')
                self.lib.update(code, price, spec, code)
                self.lib.save()
                self._write_update_log([{'std': code, 'original': code, 'price': price}])
                logger.info(f"手动替换产品: {code}, 新价格: {price}, 旧价格: {old_price}")
                return {
                    'status': 'updated',
                    'message': f'产品 {code} 价格已替换',
                    'existing': existing
                }
```

- [ ] **Step 2: 验证 Python 语法**

```bash
python3 -c "from product_quoting_core.service import QuotingService; print('import OK')"
```

- [ ] **Step 3: 提交**

```bash
git add product_quoting_core/service.py
git commit -m "feat: add add_product() method to QuotingService for manual product entry

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Flask 新增 /add-to-library 路由 + 更新 /library 路由

**文件:**
- 修改: `product_quoting_web/app.py`（新增路由 + 修改 library_status 函数）

- [ ] **Step 1: 在 library_status() 中提取确认表单状态**

修改 `library_status()` 函数，在有表单确认数据时传递给模板。找到 `app.py:70-98` 的 `library_status()` 函数，将最后的 `return render_template(...)` 改为：

```python
    # 检查是否有来自 /add-to-library 的确认请求待处理
    confirm_code = request.args.get('confirm_code', '')
    confirm_price = request.args.get('confirm_price', '')
    confirm_spec = request.args.get('confirm_spec', '')
    existing_info = None
    if confirm_code:
        # 直接查库确认编码是否存在（GET 请求不应有副作用）
        if quoting_service.lib.has(confirm_code):
            existing_info = {
                'status': 'exists',
                'existing': quoting_service.lib.get(confirm_code)
            }
        else:
            # 编码已被删除，清除确认参数
            confirm_code = ''
            confirm_price = ''
            confirm_spec = ''

    return render_template('library.html',
                          total_codes=total_codes,
                          backups=backups,
                          update_logs=update_logs,
                          confirm_code=confirm_code,
                          confirm_price=confirm_price,
                          confirm_spec=confirm_spec,
                          existing_info=existing_info)
```

注意：需要在 `library_status()` 函数前添加 `request` 参数 — 但 `request` 是 Flask 全局变量，已自动可用。

- [ ] **Step 2: 添加 /add-to-library POST 路由**

在 `process_update()` 函数之后（`if __name__ == '__main__':` 之前）插入：

```python
@app.route('/add-to-library', methods=['POST'])
@requires_auth
def add_to_library():
    """手动添加产品到标准库"""
    code = request.form.get('code', '').strip()
    price = request.form.get('price', '').strip()
    spec = request.form.get('spec', '').strip()
    force = request.form.get('force', '0') == '1'

    if not code:
        flash('请输入产品编码', 'error')
        return redirect(url_for('library_status'))

    if not price:
        flash('请输入价格', 'error')
        return redirect(url_for('library_status'))

    try:
        result = quoting_service.add_product(code, float(price), spec, force=force)

        if result['status'] == 'added':
            flash(result['message'], 'success')
            return redirect(url_for('library_status'))

        elif result['status'] == 'updated':
            # force=1 时先备份再替换
            quoting_service.backup_library(str(BACKUP_DIR))
            flash(result['message'], 'success')
            return redirect(url_for('library_status'))

        elif result['status'] == 'exists':
            # 编码已存在，重定向回 library 页面并带上待确认参数
            return redirect(url_for('library_status',
                                    confirm_code=code,
                                    confirm_price=price,
                                    confirm_spec=spec))

        else:
            flash(result.get('message', '操作失败'), 'error')
            return redirect(url_for('library_status'))

    except Exception as e:
        flash(f'操作失败: {str(e)}', 'error')
        return redirect(url_for('library_status'))
```

- [ ] **Step 3: 验证路由无语法错误**

```bash
python3 -c "from product_quoting_web.app import app; print('Flask app import OK, routes:', [r.rule for r in app.url_map.iter_rules() if 'add-to-library' in r.rule])"
```

- [ ] **Step 4: 提交**

```bash
git add product_quoting_web/app.py
git commit -m "feat: add /add-to-library route with two-step confirmation for duplicate codes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: library.html 添加折叠表单 + 确认替换区域

**文件:**
- 修改: `product_quoting_web/templates/library.html`

- [ ] **Step 1: 替换 library.html 全文**

将 `library.html` 替换为以下完整内容：

```html
{% extends "base.html" %}

{% block title %}标准库状态 - 产品报价系统{% endblock %}

{% block content %}
<div class="card">
    <h1>标准产品库状态</h1>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">{{ total_codes }}</div>
            <div class="stat-label">产品编码总数</div>
        </div>
    </div>

    <!-- ========== 手动添加产品表单 ========== -->
    <h2 onclick="toggleAddForm()" style="cursor: pointer; user-select: none;">
        <span id="add-form-toggle-icon">▶</span> 手动添加产品
    </h2>
    <div id="add-product-form" style="display: none;">
        {% if existing_info and existing_info['status'] == 'exists' %}
        <!-- 确认替换模式 -->
        <div class="alert alert-warning">
            <strong>⚠️ 编码 <code>{{ confirm_code }}</code> 已存在于标准库中</strong>
        </div>
        <div class="confirm-compare">
            <table class="data-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>现有值</th>
                        <th>新值</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>价格</strong></td>
                        <td>¥{{ "%.2f"|format(existing_info['existing']['价格']) }}</td>
                        <td><strong>¥{{ "%.2f"|format(confirm_price|float) }}</strong></td>
                    </tr>
                    <tr>
                        <td><strong>规格</strong></td>
                        <td>{{ existing_info['existing']['规格'] or '(无)' }}</td>
                        <td><strong>{{ confirm_spec or '(无)' }}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <form method="POST" action="{{ url_for('add_to_library') }}" style="margin-top: 1rem;">
            <input type="hidden" name="code" value="{{ confirm_code }}">
            <input type="hidden" name="price" value="{{ confirm_price }}">
            <input type="hidden" name="spec" value="{{ confirm_spec }}">
            <input type="hidden" name="force" value="1">
            <button type="submit" class="btn btn-danger" onclick="return confirm('确认用新价格 ¥{{ "%.2f"|format(confirm_price|float) }} 替换编码 {{ confirm_code }} 的现有价格 ¥{{ "%.2f"|format(existing_info['existing']['价格']) }} 吗？')">✅ 确认替换</button>
            <a href="{{ url_for('library_status') }}" class="btn btn-secondary">取消</a>
        </form>
        {% else %}
        <!-- 普通添加模式 -->
        <form method="POST" action="{{ url_for('add_to_library') }}" class="inline-form">
            <input type="hidden" name="force" value="0">
            <div class="form-row">
                <div class="form-group">
                    <label for="code">产品编码 *</label>
                    <input type="text" id="code" name="code" placeholder="如 20411-16-05" required>
                </div>
                <div class="form-group">
                    <label for="price">价格 *</label>
                    <input type="number" id="price" name="price" placeholder="如 28.30" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label for="spec">规格</label>
                    <input type="text" id="spec" name="spec" placeholder="如 SS316">
                </div>
                <div class="form-group" style="align-self: flex-end;">
                    <button type="submit" class="btn btn-success">添加到标准库</button>
                </div>
            </div>
        </form>
        {% endif %}
    </div>

    <!-- 如果确认替换模式，默认展开表单 -->
    {% if existing_info and existing_info['status'] == 'exists' %}
    <script>document.getElementById('add-product-form').style.display = 'block'; document.getElementById('add-form-toggle-icon').textContent = '▼';</script>
    {% endif %}

    <h2>快速操作</h2>
    <div class="actions">
        <a href="{{ url_for('index') }}" class="btn btn-primary">开始报价</a>
        <a href="{{ url_for('update_library') }}" class="btn btn-success">更新标准库</a>
        <form method="POST" action="{{ url_for('backup_library') }}" style="display: inline;">
            <button type="submit" class="btn btn-warning" onclick="return confirm('确定要备份标准库吗？')">
                💾 备份标准库
            </button>
        </form>
    </div>

    <h2>历史备份</h2>
    {% if backups %}
    <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th>序号</th>
                    <th>备份时间</th>
                    <th>文件大小</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                {% for backup in backups %}
                <tr>
                    <td>{{ loop.index }}</td>
                    <td>{{ backup.formatted_date }}</td>
                    <td>{{ backup.size }} KB</td>
                    <td>
                        <a href="{{ url_for('download_backup', filename=backup.filename) }}"
                           class="btn btn-sm btn-primary" target="_blank">
                            📥 下载
                        </a>
                    </td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% else %}
    <div class="alert alert-info">
        暂无备份文件，点击上方"备份标准库"按钮创建第一个备份。
    </div>
    {% endif %}

    <h2>更新日志</h2>
    {% if update_logs %}
    <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th>序号</th>
                    <th>加入时间</th>
                    <th>标准编码</th>
                    <th>原始编码</th>
                    <th>价格</th>
                </tr>
            </thead>
            <tbody>
                {% for log in update_logs %}
                <tr>
                    <td>{{ loop.index }}</td>
                    <td>{{ log.get('加入时间', '') }}</td>
                    <td><code>{{ log.get('标准编码', '') }}</code></td>
                    <td>{{ log.get('原始编码', '') }}</td>
                    <td>¥{{ "%.4f"|format(log.get('价格', 0)) }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% else %}
    <div class="alert alert-info">
        暂无更新记录，更新标准库后将在此显示详细记录。
    </div>
    {% endif %}
</div>

<script>
function toggleAddForm() {
    var form = document.getElementById('add-product-form');
    var icon = document.getElementById('add-form-toggle-icon');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        icon.textContent = '▼';
    } else {
        form.style.display = 'none';
        icon.textContent = '▶';
    }
}
</script>
{% endblock %}
```

- [ ] **Step 2: 确认模板渲染正常**

```bash
python3 -c "
from product_quoting_web.app import app
with app.test_client() as c:
    c.auth = ('admin', 'quote123')
    # 简单测试 library 页面加载
    import base64
    headers = {'Authorization': 'Basic ' + base64.b64encode(b'admin:quote123').decode()}
    r = c.get('/library', headers=headers)
    print(f'Status: {r.status_code}')
    print(f'Contains add form: {\"add-product-form\" in r.data.decode()}')
    print(f'Contains toggleAddForm: {\"toggleAddForm\" in r.data.decode()}')
"
```

- [ ] **Step 3: 提交**

```bash
git add product_quoting_web/templates/library.html
git commit -m "feat: add collapsible manual add product form to library page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: 端到端手动验证

- [ ] **Step 1: 启动 Web 服务**

```bash
cd product_quoting_web && python3 app.py &
sleep 2
```

- [ ] **Step 2: 测试新增产品（编码不存在）**

```bash
# 使用一个不存在的编码测试添加
curl -s -u admin:quote123 -X POST http://localhost:5001/add-to-library \
  -d "code=TEST-ADD-001&price=99.99&spec=测试规格&force=0" \
  -w "\nHTTP %{http_code}\n" -o /dev/null -L
```

预期: HTTP 302 → 重定向到 /library，flash 消息显示"已成功添加"

- [ ] **Step 3: 测试重复编码触发确认**

```bash
# 再次提交相同编码，应触发确认
curl -s -u admin:quote123 -X POST http://localhost:5001/add-to-library \
  -d "code=TEST-ADD-001&price=88.88&spec=新规格&force=0" \
  -w "\nHTTP %{http_code}\n" -o /dev/null -L
```

预期: HTTP 302 → 重定向到 /library?confirm_code=TEST-ADD-001&confirm_price=88.88... → 页面显示确认替换区域

- [ ] **Step 4: 测试 force 替换**

```bash
curl -s -u admin:quote123 -X POST http://localhost:5001/add-to-library \
  -d "code=TEST-ADD-001&price=88.88&spec=新规格&force=1" \
  -w "\nHTTP %{http_code}\n" -o /dev/null -L
```

预期: HTTP 302 → 价格已替换

- [ ] **Step 5: 清理测试数据**

```bash
python3 -c "
import sys; sys.path.insert(0, '.')
from product_quoting_core.library import StandardLibrary
lib = StandardLibrary('product_quoting_web/data/standard_product_library.xlsx')
# 删除测试编码
if 'TEST-ADD-001' in lib.library:
    del lib.library['TEST-ADD-001']
    lib.save()
    print('已清理测试数据')
else:
    print('测试编码不存在，无需清理')
"
```

- [ ] **Step 6: 停止 Web 服务**

```bash
kill %1 2>/dev/null; echo "Web服务已停止"
```

- [ ] **Step 7: 提交（如有修改）**

```bash
# 仅当手动测试发现问题需要修复时才提交
git status
```

---

### Task 6: 同步到 production 分支

- [ ] **Step 1: Cherry-pick 所有新 commit 到 production**

```bash
# 获取刚才在 main 上的 3 个新 commit
COMMITS=$(git log --oneline main --not production | head -3 | awk '{print $1}' | tac)

# 切到 production 并 cherry-pick
git checkout production
for commit in $COMMITS; do
    git cherry-pick $commit
done
```

- [ ] **Step 2: 推送到远程**

```bash
git push origin production
git checkout main
```

---

### Task 7: 更新 CLAUDE.md

- [ ] **Step 1: 在 CLAUDE.md 的 Web 应用路由表中添加新路由**

找到 CLAUDE.md 中 Web 应用路由说明区域（约在 `/library` 路由描述附近），添加新路由说明。在 `| /library | GET |` 行之后插入：

```markdown
| `/add-to-library` | POST | 手动添加产品到标准库 | 重定向到 `/library` |
```

- [ ] **Step 2: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: add /add-to-library route to CLAUDE.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
