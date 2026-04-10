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
