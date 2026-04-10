#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
产品编码统一合并工具
功能：合并两份来源不同的报价文件，生成统一产品编码库，更新库存文件
"""

import pandas as pd
import logging
import os
from typing import Dict, List, Tuple, Optional

# 配置日志系统
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('unify_products.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 确保输出目录存在
OUTPUT_DIR = 'output'
os.makedirs(OUTPUT_DIR, exist_ok=True)


def clean_product_code(code) -> str:
    """
    清理产品编码，统一格式：
    - 去除所有空格
    - 去除首尾特殊字符

    Args:
        code: 原始产品编码（任意类型）

    Returns:
        清理后的编码字符串
    """
    if pd.isna(code):
        return ""

    code_str = str(code)
    # 去除所有空格
    code_str = code_str.replace(" ", "").strip()
    # 如果为空，返回空字符串
    if not code_str:
        return ""

    return code_str


if __name__ == '__main__':
    # 这里后续放主逻辑
    pass
