# 产品报价系统

一个基于Flask的Web应用，支持产品编码自动匹配报价和标准库更新。

## 功能特性

- 📊 支持 Excel (.xlsx, .xls) 和 CSV 格式
- 🔐 密码保护的Web访问（HTTP Basic Auth）
- 🎯 多条匹配规则智能匹配
- 📈 实时匹配率统计
- 💾 标准库自动备份
- 🖥️ 公网IP部署支持

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置密码（可选）

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

### 更新标准库流程

1. 下载报价结果后，手动填写"无匹配"产品的价格
2. 点击"更新标准库"，上传已填写价格的文件
3. 选择产品列、价格列、匹配标注列
4. 点击"更新标准库"
5. 查看新增和跳过的编码详情

## 匹配规则

系统支持以下自动匹配规则，按优先级顺序尝试：

1. **直接匹配** - 编码完全一致
2. **规则一** - 第五位 1↔2 双向互换
3. **规则二** - 末尾 T 移除
4. **规则三** - 去掉 * 及后续字符
5. **规则五** - 前五位编码映射（可配置）

## 目录结构

```
product_quoting_web/
├── app.py                 # Flask主程序
├── config.py              # 配置文件
├── quoting_wrapper.py     # 报价核心逻辑包装
├── requirements.txt       # 依赖声明
├── .env.example           # 环境变量模板
├── data/                  # 标准库数据
│   ├── standard_product_library.xlsx
│   └── matching_rules_config.json
├── storage/
│   ├── uploads/           # 用户上传文件
│   ├── results/           # 处理结果
│   └── backup/            # 标准库备份（保留5个版本）
├── templates/             # HTML模板
└── static/                # 静态资源
    └── style.css
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
- **认证**: HTTP Basic Authentication

## 常见问题

### Q: 文件上传失败，提示"不支持的文件格式"
A: 请确保上传的是 .xlsx, .xls 或 .csv 格式的文件。

### Q: 匹配率低怎么办？
A: 可以手动填写未匹配产品的价格，然后通过"更新标准库"功能添加到标准库中，
下次就会自动匹配了。

### Q: 如何恢复标准库？
A: 在 `storage/backup/` 目录中找到对应的备份文件，替换 `data/standard_product_library.xlsx` 即可。

## License

内部使用
