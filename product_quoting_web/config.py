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
LOG_DIR = STORAGE_DIR / 'logs'

# 确保目录存在
for d in [DATA_DIR, STORAGE_DIR, UPLOAD_DIR, RESULT_DIR, BACKUP_DIR, LOG_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# 安全配置
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 50 * 1024 * 1024))  # 50MB
ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv'}
BASIC_AUTH_USERNAME = os.getenv('BASIC_AUTH_USERNAME', 'admin')
BASIC_AUTH_PASSWORD = os.getenv('BASIC_AUTH_PASSWORD', 'mushroom123')  # 请修改

# Flask配置
SECRET_KEY = os.getenv('SECRET_KEY', '7ef5dbcbc04322d7b39e8c60126c82167ca46afa1e8267c6e5b9caf80397d72b')
FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
FLASK_PORT = int(os.getenv('FLASK_PORT', 5001))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', '0').lower() in ('1', 'true', 'yes')

# 备份保留数量
MAX_BACKUPS = 5
