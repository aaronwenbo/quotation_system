# 部署指南

本技能可在任何服务器上部署使用，不依赖特定路径。

## 快速部署

### 方式一：直接复制

```bash
# 1. 复制整个技能目录到目标服务器
scp -r product-quoting/ user@server:/opt/skills/product-quoting/

# 2. 登录服务器
ssh user@server

# 3. 安装依赖
cd /opt/skills/product-quoting
pip install pandas openpyxl

# 4. 初始化
python scripts/main.py init

# 5. 开始使用
python scripts/main.py quote /path/to/your/order.xlsx 0 1
```

### 方式二：Docker部署

```dockerfile
# Dockerfile
FROM python:3.9-slim

WORKDIR /skill

# 复制技能文件
COPY . .

# 安装依赖
RUN pip install --no-cache-dir pandas openpyxl

# 配置环境
ENV PRODUCT_QUOTING_DATA_DIR=/data

# 数据卷
VOLUME ["/data"]

# 入口
ENTRYPOINT ["python", "scripts/main.py"]
```

```bash
# 构建镜像
docker build -t product-quoting .

# 使用（挂载本地数据目录）
docker run -v /my/local/data:/data product-quoting quote /data/order.xlsx 0 1

# 或直接处理容器内的文件
docker run -v /my/local/data:/data -v /my/local/orders:/orders \
  product-quoting quote /orders/order.xlsx 0 1
```

### 方式三：作为Python包使用

```python
# 将 skills/ 加入 sys.path
import sys
sys.path.insert(0, '/opt/skills')

from product_quoting import StandardLibrary, CodeMatcher

# 使用
lib = StandardLibrary('/custom/data/path')
matcher = CodeMatcher(lib)
result = matcher.match("22611-04-04")
```

## 环境变量配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `PRODUCT_QUOTING_DATA_DIR` | 数据根目录 | `/data/product-quoting` |
| `PRODUCT_QUOTING_OUTPUT_DIR` | 输出目录 | `/data/output` |
| `PRODUCT_QUOTING_FEEDBACK_DIR` | 反馈目录 | `/data/feedback` |
| `PRODUCT_QUOTING_LOG_DIR` | 日志目录 | `/var/log/product-quoting` |

```bash
# 全局配置（写入 ~/.bashrc 或 /etc/profile）
export PRODUCT_QUOTING_DATA_DIR=/data/product-quoting
export PRODUCT_QUOTING_LOG_DIR=/var/log/product-quoting
```

## 生产环境部署建议

### 1. 数据目录分离

```bash
# 生产环境建议将数据目录放在独立分区：
# /opt/skills/product-quoting/  # 代码（只读）
# /data/product-quoting/          # 数据（可读写）

# 使用符号链接
ln -s /data/product-quoting /opt/skills/product-quoting/data
```

### 2. 备份策略

```bash
# 每日备份标准库
cat > /etc/cron.daily/product-quoting-backup << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
cp /data/standard_product_library.xlsx /backup/standard_$DATE.xlsx
# 保留30天
find /backup/ -name "standard_*.xlsx" -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/product-quoting-backup
```

### 3. Nginx上传接口（可选）

可通过简单的Flask接口提供HTTP API。

## 多环境配置示例

### 开发环境

```bash
cd ~/dev/product-quoting
# 使用默认配置，数据在技能目录内
python scripts/main.py init
```

### 测试环境

```bash
export PRODUCT_QUOTING_DATA_DIR=/test/data
python scripts/main.py init
```

### 生产环境

```bash
export PRODUCT_QUOTING_DATA_DIR=/prod/data
export PRODUCT_QUOTING_LOG_DIR=/var/log/product-quoting
python scripts/main.py init
```

## 验证部署

```bash
# 运行检查命令
python scripts/main.py check

# 查看输出
# ✅ 所有标准编码唯一，共 XXX 个
```

如果看到上面的输出，说明部署成功！
