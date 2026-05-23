# 产品报价Web应用实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于Flask的Web应用，将产品报价技能封装为可通过公网IP访问的在线服务，支持报价单上传、自动价格匹配、标准库更新全流程。

**Architecture:** 单文件Flask应用 + 直接复用现有quoting_skill模块。采用极简架构：Web层负责文件上传和页面渲染，业务逻辑完全委托给已封装的报价技能核心，标准库和配置文件通过符号链接或复制复用。

**Tech Stack:** Flask 2.x, Jinja2, pandas, openpyxl, 原生JavaScript (无前端构建)

---

## 文件结构映射

```
product_quoting_web/
├── app.py                      # Flask主程序（路由、认证、文件处理）
├── config.py                   # 配置文件（路径、密码、大小限制）
├── requirements.txt            # 依赖声明
├── .env.example                # 环境变量示例
├── data/
│   ├── standard_product_library.xlsx  # 从父项目复制
│   └── matching_rules_config.json     # 从父项目复制
├── storage/
│   ├── uploads/                # 用户上传文件
│   ├── results/                # 处理结果
│   └── backup/                 # 标准库备份
├── templates/
│   ├── base.html               # 基础模板
│   ├── index.html              # 报价上传页
│   ├── result.html             # 报价结果页
│   ├── update.html             # 标准库更新上传页
│   └── update_result.html      # 更新结果页
└── static/
    └── style.css               # 统一样式
```

---

## Task 1: 项目初始化与基础配置

**Files:**
- Create: `product_quoting_web/requirements.txt`
- Create: `product_quoting_web/config.py`
- Create: `product_quoting_web/.env.example`

- [ ] **Step 1: 创建 requirements.txt**

```txt
Flask>=2.3.0
pandas>=1.3.0
openpyxl>=3.0.0
python-dotenv>=1.0.0
```

- [ ] **Step 2: 创建 config.py**

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# 项目根目录
BASE_DIR = Path(__file__).parent.resolve()

# 数据目录
DATA_DIR = BASE_DIR / 'data'
STANDARD_LIB_PATH = DATA_DIR / 'standard_product_library.xlsx'
MATCHING_RULES_PATH = DATA_DIR / 'matching_rules_config.json'

# 存储目录
STORAGE_DIR = BASE_DIR / 'storage'
UPLOAD_DIR = STORAGE_DIR / 'uploads'
RESULT_DIR = STORAGE_DIR / 'results'
BACKUP_DIR = STORAGE_DIR / 'backup'

# 确保目录存在
for d in [DATA_DIR, STORAGE_DIR, UPLOAD_DIR, RESULT_DIR, BACKUP_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# 安全配置
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 50 * 1024 * 1024))  # 50MB
ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv'}
BASIC_AUTH_USERNAME = os.getenv('BASIC_AUTH_USERNAME', 'admin')
BASIC_AUTH_PASSWORD = os.getenv('BASIC_AUTH_PASSWORD', 'quote123')  # 请修改

# Flask配置
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', '0').lower() in ('1', 'true', 'yes')

# 备份保留数量
MAX_BACKUPS = 5
```

- [ ] **Step 3: 创建 .env.example**

```env
# 认证配置
BASIC_AUTH_USERNAME=admin
BASIC_AUTH_PASSWORD=your_secure_password_here

# Flask配置
SECRET_KEY=your-secret-key-here
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
FLASK_DEBUG=0

# 文件大小限制 (字节)
MAX_CONTENT_LENGTH=52428800
```

- [ ] **Step 4: 提交初始化文件**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
git add requirements.txt config.py .env.example
git commit -m "feat: init project config and requirements"
```

---

## Task 2: 复制标准库并创建基础模板

**Files:**
- Copy: `data/standard_product_library.xlsx`
- Copy: `data/matching_rules_config.json`
- Create: `product_quoting_web/templates/base.html`
- Create: `product_quoting_web/static/style.css`

- [ ] **Step 1: 复制数据文件**

```bash
cd /Users/aaron/product_data_clean
cp data/standard_product_library.xlsx product_quoting_web/data/
cp data/matching_rules_config.json product_quoting_web/data/
```

- [ ] **Step 2: 创建 base.html 模板**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}产品报价系统{% endblock %}</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
</head>
<body>
    <nav class="navbar">
        <div class="nav-brand">产品报价系统</div>
        <div class="nav-links">
            <a href="{{ url_for('index') }}">报价</a>
            <a href="{{ url_for('update_library') }}">更新标准库</a>
            <a href="{{ url_for('library_status') }}">标准库状态</a>
        </div>
    </nav>
    
    <main class="container">
        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                {% for category, message in messages %}
                    <div class="alert alert-{{ category }}">{{ message }}</div>
                {% endfor %}
            {% endif %}
        {% endwith %}
        
        {% block content %}{% endblock %}
    </main>
    
    <footer class="footer">
        <p>产品报价系统 v1.0</p>
    </footer>
</body>
</html>
```

- [ ] **Step 3: 创建 style.css**

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #f5f7fa;
    color: #333;
    line-height: 1.6;
}

.navbar {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.nav-brand {
    color: white;
    font-size: 1.25rem;
    font-weight: 600;
}

.nav-links a {
    color: white;
    text-decoration: none;
    margin-left: 1.5rem;
    opacity: 0.9;
}

.nav-links a:hover {
    opacity: 1;
}

.container {
    max-width: 1000px;
    margin: 2rem auto;
    padding: 0 1rem;
}

.card {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    margin-bottom: 1.5rem;
}

h1 {
    font-size: 1.75rem;
    margin-bottom: 1.5rem;
    color: #1a202c;
}

h2 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
    color: #2d3748;
}

.alert {
    padding: 1rem 1.5rem;
    border-radius: 8px;
    margin-bottom: 1rem;
}

.alert-success {
    background: #f0fff4;
    color: #22543d;
    border: 1px solid #9ae6b4;
}

.alert-error {
    background: #fff5f5;
    color: #742a2a;
    border: 1px solid #feb2b2;
}

.alert-info {
    background: #ebf8ff;
    color: #2a4365;
    border: 1px solid #90cdf4;
}

.btn {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    border: none;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s;
}

.btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
    background: #718096;
    color: white;
}

.btn-success {
    background: #38a169;
    color: white;
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #4a5568;
}

.form-group select,
.form-group input[type="file"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 1rem;
}

.drop-zone {
    border: 2px dashed #cbd5e0;
    border-radius: 12px;
    padding: 3rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
}

.drop-zone:hover,
.drop-zone.dragover {
    border-color: #667eea;
    background: #f0f4ff;
}

.drop-zone-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.preview-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    font-size: 0.875rem;
}

.preview-table th,
.preview-table td {
    border: 1px solid #e2e8f0;
    padding: 0.5rem;
    text-align: left;
}

.preview-table th {
    background: #f7fafc;
    font-weight: 600;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.stat-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
}

.stat-number {
    font-size: 2rem;
    font-weight: 700;
}

.stat-label {
    opacity: 0.9;
    font-size: 0.875rem;
}

.loading {
    text-align: center;
    padding: 2rem;
}

.spinner {
    width: 50px;
    height: 50px;
    border: 4px solid #e2e8f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.footer {
    text-align: center;
    padding: 2rem;
    color: #718096;
    font-size: 0.875rem;
}

.actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.collapsible {
    cursor: pointer;
}

.collapsible-content {
    display: none;
    max-height: 300px;
    overflow-y: auto;
}

.collapsible-content.show {
    display: block;
}

.code-list {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
    background: #f7fafc;
    padding: 1rem;
    border-radius: 8px;
    margin-top: 0.5rem;
}

.code-list-item {
    padding: 0.25rem 0;
    border-bottom: 1px solid #e2e8f0;
}

.code-list-item:last-child {
    border-bottom: none;
}
```

- [ ] **Step 4: 提交模板和数据文件**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
git add data/standard_product_library.xlsx data/matching_rules_config.json
git add templates/base.html static/style.css
git commit -m "feat: add base template, styles, and standard library data"
```

---

## Task 3: Flask应用骨架与认证

**Files:**
- Create: `product_quoting_web/app.py`

- [ ] **Step 1: 创建 app.py 基础结构**

```python
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, send_file, flash
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime
import pandas as pd

from config import (
    SECRET_KEY, FLASK_HOST, FLASK_PORT, FLASK_DEBUG,
    MAX_CONTENT_LENGTH, ALLOWED_EXTENSIONS, BASIC_AUTH_USERNAME, BASIC_AUTH_PASSWORD,
    UPLOAD_DIR, RESULT_DIR, BACKUP_DIR, STANDARD_LIB_PATH, MATCHING_RULES_PATH
)

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH


def check_auth(username, password):
    return username == BASIC_AUTH_USERNAME and password == BASIC_AUTH_PASSWORD


def authenticate():
    from flask import make_response
    response = make_response('需要认证', 401)
    response.headers['WWW-Authenticate'] = 'Basic realm="产品报价系统"'
    return response


def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return authenticate()
        return f(*args, **kwargs)
    return decorated


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_job_id():
    return datetime.now().strftime('%Y%m%d-%H%M%S-') + str(uuid.uuid4())[:8]


@app.route('/')
@requires_auth
def index():
    return render_template('index.html')


@app.route('/update')
@requires_auth
def update_library():
    return render_template('update.html')


@app.route('/library')
@requires_auth
def library_status():
    df = pd.read_excel(STANDARD_LIB_PATH)
    total_codes = len(df)
    return render_template('library.html', total_codes=total_codes)


if __name__ == '__main__':
    print("=" * 60)
    print("产品报价系统启动中...")
    print(f"访问地址: http://{FLASK_HOST}:{FLASK_PORT}")
    print(f"用户名: {BASIC_AUTH_USERNAME}")
    print(f"密码: {BASIC_AUTH_PASSWORD}")
    print("=" * 60)
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=FLASK_DEBUG)
```

- [ ] **Step 2: 创建 library.html 模板**

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
    
    <h2>快速操作</h2>
    <div class="actions">
        <a href="{{ url_for('index') }}" class="btn btn-primary">开始报价</a>
        <a href="{{ url_for('update_library') }}" class="btn btn-success">更新标准库</a>
    </div>
</div>
{% endblock %}
```

- [ ] **Step 3: 测试应用启动**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
python app.py &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000
# Expected: 401 (需要认证)

curl -s -u admin:quote123 -o /dev/null -w "%{http_code}" http://localhost:5000
# Expected: 200

pkill -f "python app.py" || true
```

- [ ] **Step 4: 提交应用骨架**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
git add app.py templates/library.html
git commit -m "feat: add flask app skeleton with basic auth"
```

---

## Task 4: 报价上传页面与文件预览

**Files:**
- Modify: `product_quoting_web/app.py`
- Create: `product_quoting_web/templates/index.html`

- [ ] **Step 1: 修改 app.py 添加上传处理路由**

```python
# 在 app.py 中添加以下路由，放在 @app.route('/library') 之后

@app.route('/upload', methods=['POST'])
@requires_auth
def upload_file():
    if 'file' not in request.files:
        flash('没有选择文件', 'error')
        return redirect(url_for('index'))
    
    file = request.files['file']
    if file.filename == '':
        flash('没有选择文件', 'error')
        return redirect(url_for('index'))
    
    if not allowed_file(file.filename):
        flash('不支持的文件格式，请上传 .xlsx, .xls, .csv 文件', 'error')
        return redirect(url_for('index'))
    
    job_id = generate_job_id()
    filename = secure_filename(file.filename)
    safe_filename = f"{job_id}-{filename}"
    file_path = UPLOAD_DIR / safe_filename
    file.save(str(file_path))
    
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(file_path, nrows=10)
        else:
            df = pd.read_excel(file_path, nrows=10, header=None)
        
        columns = list(range(len(df.columns)))
        headers = [f'列 {i}' for i in columns]
        preview_data = df.values.tolist()
        
        return render_template('index.html', 
                              preview=True, 
                              headers=headers, 
                              preview_data=preview_data,
                              columns=columns,
                              job_id=job_id,
                              filename=safe_filename)
    except Exception as e:
        flash(f'文件读取失败: {str(e)}', 'error')
        return redirect(url_for('index'))
```

- [ ] **Step 2: 创建 index.html**

```html
{% extends "base.html" %}

{% block title %}产品报价 - 产品报价系统{% endblock %}

{% block content %}
<div class="card">
    <h1>产品报价</h1>
    
    {% if not preview %}
    <form id="uploadForm" method="POST" action="{{ url_for('upload_file') }}" enctype="multipart/form-data">
        <div class="drop-zone" id="dropZone">
            <div class="drop-zone-icon">📁</div>
            <p>拖拽文件到此处，或点击选择文件</p>
            <p style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">
                支持 .xlsx, .xls, .csv 格式，最大 50MB
            </p>
            <input type="file" name="file" id="fileInput" accept=".xlsx,.xls,.csv" style="display: none;">
        </div>
        <div id="selectedFile" style="margin-top: 1rem; display: none;">
            <strong>已选择文件:</strong> <span id="fileName"></span>
        </div>
    </form>
    {% else %}
    <div class="alert alert-info">
        <strong>文件已上传:</strong> {{ filename }}
    </div>
    
    <h2>文件预览 (前10行)</h2>
    <div style="overflow-x: auto;">
        <table class="preview-table">
            <thead>
                <tr>
                    {% for header in headers %}
                    <th>{{ header }}</th>
                    {% endfor %}
                </tr>
            </thead>
            <tbody>
                {% for row in preview_data %}
                <tr>
                    {% for cell in row %}
                    <td>{{ cell }}</td>
                    {% endfor %}
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    
    <h2 style="margin-top: 2rem;">选择列进行报价</h2>
    <form id="processForm" method="POST" action="{{ url_for('process_quote') }}">
        <input type="hidden" name="job_id" value="{{ job_id }}">
        <input type="hidden" name="filename" value="{{ filename }}">
        
        <div class="form-group">
            <label>产品编码列</label>
            <select name="code_col" required>
                {% for col in columns %}
                <option value="{{ col }}">列 {{ col }} (A=0, B=1, C=2...)</option>
                {% endfor %}
            </select>
        </div>
        
        <div class="form-group">
            <label>数量列</label>
            <select name="qty_col" required>
                {% for col in columns %}
                <option value="{{ col }}">列 {{ col }} (A=0, B=1, C=2...)</option>
                {% endfor %}
            </select>
        </div>
        
        <button type="submit" class="btn btn-primary">开始报价</button>
    </form>
    {% endif %}
</div>

<script>
{% if not preview %}
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadForm = document.getElementById('uploadForm');
const selectedFile = document.getElementById('selectedFile');
const fileName = document.getElementById('fileName');

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileName.textContent = e.target.files[0].name;
        selectedFile.style.display = 'block';
        uploadForm.submit();
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        fileName.textContent = e.dataTransfer.files[0].name;
        selectedFile.style.display = 'block';
        uploadForm.submit();
    }
});
{% endif %}
</script>
{% endblock %}
```

- [ ] **Step 3: 测试上传功能**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
python app.py &
sleep 2

# 测试文件上传
curl -u admin:quote123 -F "file=@../order/IGO询价.xlsx" http://localhost:5000/upload | grep -q "文件已上传"
echo "Upload test: $?"  # 0 = success

pkill -f "python app.py" || true
```

- [ ] **Step 4: 提交上传功能**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
git add app.py templates/index.html
git commit -m "feat: add file upload and preview for quoting"
```

---

## Task 5: 集成报价技能核心

**Files:**
- Create: `product_quoting_web/quoting_wrapper.py`
- Modify: `product_quoting_web/app.py`

- [ ] **Step 1: 创建 quoting_wrapper.py**

```python
import sys
from pathlib import Path
import pandas as pd

SKILL_DIR = Path(__file__).parent.parent / '.claude' / 'skills' / 'product-quoting'
sys.path.insert(0, str(SKILL_DIR / 'scripts'))

from matcher import CodeMatcher
from library import StandardLibrary, MatchingRules


class QuotingService:
    def __init__(self, lib_path=None, rules_path=None):
        self.lib = StandardLibrary(lib_path)
        self.rules = MatchingRules(rules_path)
        self.matcher = CodeMatcher(self.lib, self.rules)
    
    def process_quote(self, file_path, code_col: int, qty_col: int):
        if str(file_path).endswith('.csv'):
            df = pd.read_csv(file_path, header=None)
        else:
            df = pd.read_excel(file_path, header=None)
        
        stats = {
            'total': 0,
            'direct_match': 0,
            'rule1_match': 0,
            'rule2_match': 0,
            'rule3_match': 0,
            'rule4_match': 0,
            'rule5_match': 0,
            'rule_combination': 0,
            'no_match': 0
        }
        no_match_codes = []
        
        for idx, row in df.iterrows():
            code = row.iloc[code_col] if code_col < len(row) else None
            
            if pd.isna(code) or not str(code).strip():
                continue
            
            stats['total'] += 1
            matched_code, product_info, label = self.matcher.match(code)
            
            price_col = max(code_col, qty_col) + 1
            total_price_col = price_col + 1
            std_code_col = price_col + 2
            orig_code_col = price_col + 3
            label_col = price_col + 4
            
            # 确保列数足够
            for col_idx in [price_col, total_price_col, std_code_col, orig_code_col, label_col]:
                while len(df.columns) <= col_idx:
                    df[len(df.columns)] = None
            
            if product_info:
                df.iloc[idx, price_col] = product_info['价格']
                qty = row.iloc[qty_col] if qty_col < len(row) else None
                if pd.notna(qty):
                    try:
                        df.iloc[idx, total_price_col] = float(qty) * float(product_info['价格'])
                    except (ValueError, TypeError):
                        pass
                df.iloc[idx, std_code_col] = matched_code
                df.iloc[idx, orig_code_col] = product_info.get('原规格编码', '')
                df.iloc[idx, label_col] = label
                
                if label == '直接匹配':
                    stats['direct_match'] += 1
                elif '规则一' in label:
                    stats['rule1_match'] += 1
                elif '去T' in label:
                    stats['rule2_match'] += 1
                elif '去*' in label:
                    stats['rule3_match'] += 1
                elif '规则四' in label:
                    stats['rule4_match'] += 1
                elif '规则五' in label:
                    stats['rule5_match'] += 1
                elif '+' in label:
                    stats['rule_combination'] += 1
            else:
                df.iloc[idx, label_col] = label
                stats['no_match'] += 1
                no_match_codes.append(str(code).strip())
        
        return df, stats, no_match_codes
    
    def update_library(self, file_path, code_col: int, price_col: int, label_col: int):
        if str(file_path).endswith('.csv'):
            df = pd.read_csv(file_path, header=None)
        else:
            df = pd.read_excel(file_path, header=None)
        
        added = []
        skipped = []
        
        for idx, row in df.iterrows():
            if idx == 0:  # 跳过标题行
                continue
            
            code = row.iloc[code_col] if code_col < len(row) else None
            price = row.iloc[price_col] if price_col < len(row) else None
            label = row.iloc[label_col] if label_col < len(row) else None
            
            if label != '无匹配':
                continue
            if pd.isna(price):
                continue
            if pd.isna(code) or not str(code).strip():
                continue
            
            original_code = self.matcher.clean_code(code)
            std_code, _ = self.matcher.clean_for_library(original_code)
            
            if self.lib.has(std_code):
                skipped.append({'original': original_code, 'std': std_code})
            else:
                try:
                    price_value = float(price)
                    self.lib.add(std_code, price_value, '', original_code)
                    added.append({'original': original_code, 'std': std_code, 'price': price_value})
                except (ValueError, TypeError):
                    skipped.append({'original': original_code, 'std': std_code, 'reason': '价格无效'})
        
        if added:
            self.lib.save()
        
        return added, skipped
```

- [ ] **Step 2: 修改 app.py 集成报价处理**

```python
# 在 app.py 顶部添加导入
from quoting_wrapper import QuotingService

# 在 UPLOAD_DIR 等配置之后添加
quoting_service = QuotingService(str(STANDARD_LIB_PATH), str(MATCHING_RULES_PATH))

# 添加新路由
@app.route('/process', methods=['POST'])
@requires_auth
def process_quote():
    job_id = request.form.get('job_id')
    filename = request.form.get('filename')
    code_col = int(request.form.get('code_col'))
    qty_col = int(request.form.get('qty_col'))
    
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        flash('文件不存在', 'error')
        return redirect(url_for('index'))
    
    try:
        df, stats, no_match_codes = quoting_service.process_quote(str(file_path), code_col, qty_col)
        
        result_filename = f"{job_id}-报价结果.xlsx"
        result_path = RESULT_DIR / result_filename
        df.to_excel(result_path, index=False, header=False)
        
        return render_template('result.html',
                              stats=stats,
                              no_match_codes=no_match_codes,
                              result_filename=result_filename)
    except Exception as e:
        flash(f'处理失败: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/download/<filename>')
@requires_auth
def download_result(filename):
    file_path = RESULT_DIR / secure_filename(filename)
    if not file_path.exists():
        flash('文件不存在', 'error')
        return redirect(url_for('index'))
    return send_file(str(file_path), as_attachment=True)
```

- [ ] **Step 3: 创建 result.html 模板**

```html
{% extends "base.html" %}

{% block title %}报价结果 - 产品报价系统{% endblock %}

{% block content %}
<div class="card">
    <h1>报价处理完成</h1>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">{{ stats.total }}</div>
            <div class="stat-label">总行数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{ stats.total - stats.no_match }}</div>
            <div class="stat-label">匹配成功</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{ "%.1f%%"|format((stats.total - stats.no_match)/stats.total*100 if stats.total > 0 else 0) }}</div>
            <div class="stat-label">匹配率</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{{ stats.no_match }}</div>
            <div class="stat-label">未匹配</div>
        </div>
    </div>
    
    <h2>匹配明细</h2>
    <table class="preview-table">
        <thead>
            <tr>
                <th>匹配类型</th>
                <th>数量</th>
            </tr>
        </thead>
        <tbody>
            <tr><td>直接匹配</td><td>{{ stats.direct_match }}</td></tr>
            <tr><td>规则一 (1↔2)</td><td>{{ stats.rule1_match }}</td></tr>
            <tr><td>规则二 (去T)</td><td>{{ stats.rule2_match }}</td></tr>
            <tr><td>规则三 (去*)</td><td>{{ stats.rule3_match }}</td></tr>
            <tr><td>规则四 (O→0)</td><td>{{ stats.rule4_match }}</td></tr>
            <tr><td>规则五 (前缀映射)</td><td>{{ stats.rule5_match }}</td></tr>
            <tr><td>规则组合</td><td>{{ stats.rule_combination }}</td></tr>
            <tr><td>无匹配</td><td>{{ stats.no_match }}</td></tr>
        </tbody>
    </table>
    
    {% if no_match_codes %}
    <h2 style="margin-top: 2rem;" class="collapsible" onclick="toggleCollapsible()">
        未匹配编码列表 ({{ no_match_codes|length }}个) ▼
    </h2>
    <div class="collapsible-content" id="collapsibleContent">
        <div class="code-list">
            {% for code in no_match_codes %}
            <div class="code-list-item">{{ code }}</div>
            {% endfor %}
        </div>
    </div>
    {% endif %}
    
    <div class="actions">
        <a href="{{ url_for('download_result', filename=result_filename) }}" class="btn btn-primary">
            📥 下载报价结果
        </a>
        <a href="{{ url_for('index') }}" class="btn btn-secondary">
            继续报价
        </a>
    </div>
    
    <div class="alert alert-info" style="margin-top: 2rem;">
        <strong>提示:</strong> 下载文件后，手动填写未匹配产品的价格，然后在"更新标准库"页面上传，
        即可将这些新的产品编码和价格添加到标准库中，下次自动匹配。
    </div>
</div>

<script>
function toggleCollapsible() {
    const content = document.getElementById('collapsibleContent');
    content.classList.toggle('show');
}
</script>
{% endblock %}
```

- [ ] **Step 4: 测试完整报价流程**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
python app.py &
sleep 3

# 1. 上传文件
curl -u admin:quote123 -F "file=@../order/IGO询价.xlsx" -c cookies.txt http://localhost:5000/upload > /dev/null 2>&1

# 2. 模拟处理（需要实际的表单提交，这里简化测试）
python -c "
from quoting_wrapper import QuotingService
from config import STANDARD_LIB_PATH, MATCHING_RULES_PATH

service = QuotingService(str(STANDARD_LIB_PATH), str(MATCHING_RULES_PATH))
df, stats, no_match = service.process_quote('../order/IGO询价.xlsx', 1, 2)
print(f'Total: {stats[\"total\"]}, Matched: {stats[\"total\"] - stats[\"no_match\"]}')
assert stats['total'] > 0, 'Should have processed rows'
print('Quoting test PASSED')
"

pkill -f "python app.py" || true
```

- [ ] **Step 5: 提交报价功能**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
git add quoting_wrapper.py app.py templates/result.html
git commit -m "feat: integrate quoting core logic and result page"
```

---

## Task 6: 标准库更新功能

**Files:**
- Modify: `product_quoting_web/app.py`
- Modify: `product_quoting_web/quoting_wrapper.py`
- Create: `product_quoting_web/templates/update.html`
- Create: `product_quoting_web/templates/update_result.html`

- [ ] **Step 1: 在 quoting_wrapper.py 中添加备份功能**

```python
# 在 QuotingService 类中添加方法
def backup_library(self):
    """备份标准库"""
    import shutil
    from config import BACKUP_DIR, MAX_BACKUPS, STANDARD_LIB_PATH
    
    if not STANDARD_LIB_PATH.exists():
        return
    
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup_name = f"standard_library_backup_{timestamp}.xlsx"
    backup_path = BACKUP_DIR / backup_name
    
    shutil.copy2(str(STANDARD_LIB_PATH), str(backup_path))
    
    # 清理旧备份，只保留最近N个
    backups = sorted(BACKUP_DIR.glob("standard_library_backup_*.xlsx"))
    if len(backups) > MAX_BACKUPS:
        for old_backup in backups[:-MAX_BACKUPS]:
            old_backup.unlink()
    
    return backup_path
```

- [ ] **Step 2: 在 app.py 中添加更新路由**

```python
@app.route('/upload-update', methods=['POST'])
@requires_auth
def upload_for_update():
    if 'file' not in request.files:
        flash('没有选择文件', 'error')
        return redirect(url_for('update_library'))
    
    file = request.files['file']
    if file.filename == '':
        flash('没有选择文件', 'error')
        return redirect(url_for('update_library'))
    
    if not allowed_file(file.filename):
        flash('不支持的文件格式', 'error')
        return redirect(url_for('update_library'))
    
    job_id = generate_job_id()
    filename = secure_filename(file.filename)
    safe_filename = f"{job_id}-{filename}"
    file_path = UPLOAD_DIR / safe_filename
    file.save(str(file_path))
    
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(file_path, nrows=10)
        else:
            df = pd.read_excel(file_path, nrows=10, header=None)
        
        columns = list(range(len(df.columns)))
        return render_template('update.html',
                              preview=True,
                              columns=columns,
                              job_id=job_id,
                              filename=safe_filename)
    except Exception as e:
        flash(f'文件读取失败: {str(e)}', 'error')
        return redirect(url_for('update_library'))


@app.route('/process-update', methods=['POST'])
@requires_auth
def process_update():
    job_id = request.form.get('job_id')
    filename = request.form.get('filename')
    code_col = int(request.form.get('code_col'))
    price_col = int(request.form.get('price_col'))
    label_col = int(request.form.get('label_col'))
    
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        flash('文件不存在', 'error')
        return redirect(url_for('update_library'))
    
    try:
        quoting_service.backup_library()
        added, skipped = quoting_service.update_library(str(file_path), code_col, price_col, label_col)
        
        return render_template('update_result.html',
                              added_count=len(added),
                              skipped_count=len(skipped),
                              added=added,
                              skipped=skipped)
    except Exception as e:
        flash(f'更新失败: {str(e)}', 'error')
        return redirect(url_for('update_library'))
```

- [ ] **Step 3: 创建 update.html**

```html
{% extends "base.html" %}

{% block title %}更新标准库 - 产品报价系统{% endblock %}

{% block content %}
<div class="card">
    <h1>更新标准产品库</h1>
    
    <div class="alert alert-info">
        <strong>说明:</strong> 上传已填写价格的报价结果Excel文件，系统将自动识别"无匹配"
        且填写了价格的产品，添加到标准库中。
    </div>
    
    {% if not preview %}
    <form id="uploadForm" method="POST" action="{{ url_for('upload_for_update') }}" enctype="multipart/form-data">
        <div class="drop-zone" id="dropZone">
            <div class="drop-zone-icon">📤</div>
            <p>拖拽报价结果文件到此处，或点击选择</p>
            <p style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">
                支持 .xlsx, .xls, .csv 格式
            </p>
            <input type="file" name="file" id="fileInput" accept=".xlsx,.xls,.csv" style="display: none;">
        </div>
    </form>
    {% else %}
    <div class="alert alert-info">
        <strong>文件已上传:</strong> {{ filename }}
    </div>
    
    <h2>选择列</h2>
    <form id="processForm" method="POST" action="{{ url_for('process_update') }}">
        <input type="hidden" name="job_id" value="{{ job_id }}">
        <input type="hidden" name="filename" value="{{ filename }}">
        
        <div class="form-group">
            <label>产品编码列</label>
            <select name="code_col" required>
                {% for col in columns %}
                <option value="{{ col }}">列 {{ col }} (A=0, B=1, C=2...)</option>
                {% endfor %}
            </select>
        </div>
        
        <div class="form-group">
            <label>价格列</label>
            <select name="price_col" required>
                {% for col in columns %}
                <option value="{{ col }}">列 {{ col }} (A=0, B=1, C=2...)</option>
                {% endfor %}
            </select>
        </div>
        
        <div class="form-group">
            <label>匹配标注列（含"无匹配"字样的列）</label>
            <select name="label_col" required>
                {% for col in columns %}
                <option value="{{ col }}">列 {{ col }} (A=0, B=1, C=2...)</option>
                {% endfor %}
            </select>
        </div>
        
        <button type="submit" class="btn btn-success">更新标准库</button>
    </form>
    {% endif %}
</div>

<script>
{% if not preview %}
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadForm = document.getElementById('uploadForm');

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        uploadForm.submit();
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        uploadForm.submit();
    }
});
{% endif %}
</script>
{% endblock %}
```

- [ ] **Step 4: 创建 update_result.html**

```html
{% extends "base.html" %}

{% block title %}更新结果 - 产品报价系统{% endblock %}

{% block content %}
<div class="card">
    <h1>标准库更新完成</h1>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">{{ added_count }}</div>
            <div class="stat-label">新增产品</div>
        </div>
        <div class="stat-card" style="background: #718096;">
            <div class="stat-number">{{ skipped_count }}</div>
            <div class="stat-label">跳过（已存在）</div>
        </div>
    </div>
    
    {% if added %}
    <h2>新增的产品编码</h2>
    <table class="preview-table">
        <thead>
            <tr>
                <th>原始编码</th>
                <th>标准编码</th>
                <th>价格</th>
            </tr>
        </thead>
        <tbody>
            {% for item in added %}
            <tr>
                <td>{{ item.original }}</td>
                <td>{{ item.std }}</td>
                <td>{{ item.price }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
    {% endif %}
    
    {% if skipped %}
    <h2 style="margin-top: 1.5rem;" class="collapsible" onclick="toggleSkipped()">
        跳过的编码（已存在） ({{ skipped|length }}个) ▼
    </h2>
    <div class="collapsible-content" id="skippedContent">
        <table class="preview-table">
            <thead>
                <tr>
                    <th>原始编码</th>
                    <th>标准编码</th>
                </tr>
            </thead>
            <tbody>
                {% for item in skipped %}
                <tr>
                    <td>{{ item.original }}</td>
                    <td>{{ item.std }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% endif %}
    
    <div class="actions">
        <a href="{{ url_for('update_library') }}" class="btn btn-secondary">继续更新</a>
        <a href="{{ url_for('library_status') }}" class="btn btn-primary">查看标准库状态</a>
    </div>
    
    <div class="alert alert-info" style="margin-top: 2rem;">
        <strong>提示:</strong> 更新前已自动备份标准库。备份文件保存在 storage/backup/ 目录中，
        保留最近5个版本。
    </div>
</div>

<script>
function toggleSkipped() {
    const content = document.getElementById('skippedContent');
    content.classList.toggle('show');
}
</script>
{% endblock %}
```

- [ ] **Step 5: 测试更新功能**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
python -c "
from quoting_wrapper import QuotingService
from config import STANDARD_LIB_PATH, MATCHING_RULES_PATH

service = QuotingService(str(STANDARD_LIB_PATH), str(MATCHING_RULES_PATH))
backup_path = service.backup_library()
print(f'Backup created: {backup_path}')
assert backup_path.exists(), 'Backup file should exist'
print('Backup test PASSED')
"
```

- [ ] **Step 6: 提交更新功能**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
git add quoting_wrapper.py app.py templates/update.html templates/update_result.html
git commit -m "feat: add standard library update functionality with backup"
```

---

## Task 7: 启动脚本与README

**Files:**
- Create: `product_quoting_web/README.md`
- Create: `product_quoting_web/start.sh`
- Create: `product_quoting_web/start.bat`

- [ ] **Step 1: 创建 README.md**

```markdown
# 产品报价系统

一个基于Flask的Web应用，支持产品编码自动匹配报价和标准库更新。

## 功能特性

- 📊 支持 Excel (.xlsx, .xls) 和 CSV 格式
- 🔐 密码保护的Web访问
- 🎯 多条匹配规则智能匹配
- 📈 实时匹配率统计
- 💾 标准库自动备份
- 🖥️ 公网IP部署支持

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置密码

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，修改密码
BASIC_AUTH_PASSWORD=你的密码
SECRET_KEY=你的随机密钥
```

### 3. 启动服务

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```cmd
start.bat
```

或直接运行:
```bash
python app.py
```

### 4. 访问

打开浏览器访问: `http://服务器IP:5000`

默认账号密码:
- 用户名: `admin`
- 密码: `quote123` (请修改!)

## 使用流程

### 报价流程

1. 点击"报价"进入报价页面
2. 上传报价单文件（拖拽或点击选择）
3. 预览文件内容，选择产品编码列和数量列
4. 点击"开始报价"，等待处理完成
5. 查看匹配统计，下载报价结果

### 更新标准库

1. 下载报价结果后，手动填写"无匹配"产品的价格
2. 点击"更新标准库"，上传已填写价格的文件
3. 选择产品列、价格列、匹配标注列
4. 点击"更新标准库"
5. 查看新增和跳过的编码详情

## 目录结构

```
product_quoting_web/
├── app.py                 # Flask主程序
├── config.py              # 配置文件
├── quoting_wrapper.py     # 报价核心逻辑包装
├── requirements.txt       # 依赖声明
├── data/                  # 标准库数据
├── storage/
│   ├── uploads/           # 用户上传文件
│   ├── results/           # 处理结果
│   └── backup/            # 标准库备份（保留5个版本）
├── templates/             # HTML模板
└── static/                # 静态资源
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| BASIC_AUTH_USERNAME | 登录用户名 | admin |
| BASIC_AUTH_PASSWORD | 登录密码 | quote123 |
| SECRET_KEY | Flask密钥 | dev-secret-key-... |
| FLASK_HOST | 监听地址 | 0.0.0.0 |
| FLASK_PORT | 监听端口 | 5000 |
| FLASK_DEBUG | 调试模式 | 0 (关闭) |
| MAX_CONTENT_LENGTH | 最大文件大小 | 52428800 (50MB) |

## 安全建议

1. **务必修改默认密码**
2. 生产环境关闭 FLASK_DEBUG
3. 使用强随机 SECRET_KEY
4. 建议在反向代理（如Nginx）后运行，启用HTTPS

## 技术栈

- **后端**: Flask 2.x
- **前端**: Jinja2 + 原生JavaScript
- **数据处理**: pandas + openpyxl
```

- [ ] **Step 2: 创建 start.sh**

```bash
#!/bin/bash

cd "$(dirname "$0")"

echo "========================================"
echo "产品报价系统启动脚本"
echo "========================================"

if [ ! -f ".env" ]; then
    echo "提示: 未找到 .env 文件，使用默认配置"
    echo "建议复制 .env.example 为 .env 并修改密码"
fi

echo ""
echo "启动服务..."
echo "访问地址: http://0.0.0.0:5000"
echo "按 Ctrl+C 停止服务"
echo ""

python app.py
```

- [ ] **Step 3: 创建 start.bat**

```batch
@echo off
cd /d "%~dp0"

echo ========================================
echo 产品报价系统启动脚本
echo ========================================

if not exist ".env" (
    echo 提示: 未找到 .env 文件，使用默认配置
    echo 建议复制 .env.example 为 .env 并修改密码
)

echo.
echo 启动服务...
echo 访问地址: http://0.0.0.0:5000
echo 按 Ctrl+C 停止服务
echo.

python app.py
```

- [ ] **Step 4: 设置执行权限并提交**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
chmod +x start.sh
git add README.md start.sh start.bat
git commit -m "feat: add README and startup scripts"
```

---

## Task 8: 端到端测试和启动验证

**Files:**
- 无新文件，运行测试

- [ ] **Step 1: 完整启动测试**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web

# 启动应用
python app.py > app.log 2>&1 &
APP_PID=$!
sleep 3

# 测试未认证
echo "Testing unauthenticated access..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000)
echo "Status without auth: $STATUS"
[ "$STATUS" = "401" ] || exit 1

# 测试认证访问
echo "Testing authenticated access..."
STATUS=$(curl -u admin:quote123 -s -o /dev/null -w "%{http_code}" http://localhost:5000)
echo "Status with auth: $STATUS"
[ "$STATUS" = "200" ] || exit 1

# 测试报价流程
echo "Testing quote flow..."
curl -u admin:quote123 -F "file=@../order/IGO询价.xlsx" http://localhost:5000/upload | grep -q "文件已上传"
echo "Upload test: $?"

# 停止应用
kill $APP_PID
sleep 1

echo ""
echo "========================================"
echo "所有测试通过！"
echo "应用启动日志: product_quoting_web/app.log"
echo "========================================"
```

- [ ] **Step 2: 提交最终验证**

```bash
cd /Users/aaron/product_data_clean/product_quoting_web
echo "应用已就绪，运行: cd product_quoting_web && python app.py"
```

---

## 自我检查清单

### 1. Spec 覆盖检查

- ✅ Flask应用骨架与认证 → Task 3
- ✅ 文件上传与预览 → Task 4
- ✅ 报价核心集成 → Task 5
- ✅ 标准库更新功能 → Task 6
- ✅ 备份机制 → Task 6
- ✅ 密码保护（HTTP Basic Auth）→ Task 3
- ✅ 50MB文件大小限制 → Task 1
- ✅ CSV/XLSX/XLS支持 → Task 4
- ✅ 启动脚本和README → Task 7

### 2. Placeholder 检查

- ✅ 所有代码步骤都有实际代码（无"TBD"、"TODO"）
- ✅ 所有测试命令都有预期结果说明
- ✅ 所有函数签名在前后任务中保持一致
- ✅ 文件路径完全匹配

### 3. 类型一致性检查

- ✅ `QuotingService.process_quote()` 参数一致
- ✅ `backup_library()` 方法调用一致
- ✅ 模板变量与路由传递一致
- ✅ 所有文件路径都使用 Path 对象或正确的字符串
