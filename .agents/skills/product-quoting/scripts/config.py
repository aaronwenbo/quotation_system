#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全局配置管理 - 支持环境变量覆盖，完全可移植
"""

import os
from pathlib import Path

# 技能根目录（自动检测脚本位置）
SKILL_ROOT = Path(__file__).parent.parent.resolve()

# 数据目录（可通过环境变量覆盖）
DATA_DIR = Path(os.getenv(
    'PRODUCT_QUOTING_DATA_DIR',
    SKILL_ROOT / 'data'
)).resolve()

# 子目录配置
OUTPUT_DIR = Path(os.getenv(
    'PRODUCT_QUOTING_OUTPUT_DIR',
    DATA_DIR / 'output'
)).resolve()

FEEDBACK_DIR = Path(os.getenv(
    'PRODUCT_QUOTING_FEEDBACK_DIR',
    DATA_DIR / 'feedback'
)).resolve()

LOG_DIR = Path(os.getenv(
    'PRODUCT_QUOTING_LOG_DIR',
    DATA_DIR / 'logs'
)).resolve()

# 文件路径
STANDARD_LIB_PATH = DATA_DIR / 'standard_product_library.xlsx'
MATCHING_RULES_PATH = DATA_DIR / 'matching_rules_config.json'

# 确保目录存在
def ensure_dirs():
    """确保所有必要目录存在"""
    for d in [DATA_DIR, OUTPUT_DIR, FEEDBACK_DIR, LOG_DIR]:
        d.mkdir(parents=True, exist_ok=True)
    return True

# 默认配置模板
DEFAULT_RULES_CONFIG = {
    "version": "1.0",
    "description": "产品编码匹配规则配置",
    "rule5_prefix_mapping": {
        "description": "规则五：前五位编码匹配表",
        "mappings": {}
    }
}

DEFAULT_LIBRARY_COLUMNS = ['标准编码', '价格', '规格', '原规格编码']
