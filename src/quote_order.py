#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
订单报价工具
功能：基于标准产品库对订单文件进行自动报价，支持0/O字符混淆容错匹配
"""

import pandas as pd
import logging
import os
from typing import Dict, Tuple, Optional

# 配置日志系统
os.makedirs('../logs', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('../logs/quote_order.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 确保输出目录存在
OUTPUT_DIR = '../output'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 文件路径配置
STANDARD_LIB_PATH = '../data/standard_product_library.xlsx'
ORDER_20260420_PATH = '../order/20260420.xlsx'
ORDER_HT_PATH = '../order/HT.xlsx'


def load_standard_library() -> Dict[str, Dict]:
    """
    加载标准产品库，构建编码→产品信息的映射字典

    Returns:
        Dict: {标准编码: {'价格': float, '原规格编码': str, '规格': str}}
    """
    logger.info("正在加载标准产品库...")
    df = pd.read_excel(STANDARD_LIB_PATH)

    lib = {}
    for _, row in df.iterrows():
        code = str(row['标准编码']).strip()
        lib[code] = {
            '价格': row['价格'],
            '原规格编码': str(row['原规格编码']).strip(),
            '规格': str(row['规格']).strip()
        }

    logger.info(f"标准产品库加载完成，共 {len(lib)} 个产品")
    return lib
