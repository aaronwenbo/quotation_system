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


def clean_code(code: Optional[str]) -> str:
    """清理产品编码，去除空格"""
    if pd.isna(code) or code is None:
        return ''
    return str(code).replace(' ', '').strip()


def match_code(code: str, standard_lib: Dict[str, Dict]) -> Tuple[Optional[Dict], str]:
    """
    匹配产品编码，支持O→0转换容错

    Args:
        code: 待匹配的产品编码
        standard_lib: 标准产品库字典

    Returns:
        (产品信息字典, 匹配类型标注)
        匹配类型: "直接匹配" / "O→0转换匹配" / "" (无匹配)
    """
    code_clean = clean_code(code)

    if not code_clean:
        return None, ''

    # 直接匹配
    if code_clean in standard_lib:
        return standard_lib[code_clean], "直接匹配"

    # O→0转换匹配
    code_converted = code_clean.replace('O', '0').replace('o', '0')
    if code_converted != code_clean and code_converted in standard_lib:
        return standard_lib[code_converted], "O→0转换匹配"

    return None, "无匹配"


def is_product_code(code: str) -> bool:
    """判断是否为产品编码（非标题行）"""
    code_clean = clean_code(code)
    if not code_clean:
        return False
    # 排除标题关键词
    exclude_keywords = ['FERRULE', 'PART', 'NO', 'HOSE', 'BSP', 'JIC', 'METRIC',
                        'SAE', 'FLANGE', 'CONNECTOR', 'BANJO', 'JIS', 'ORFS', 'ITEM',
                        'FOR', 'EN', 'ISO', 'DIN', 'GB/T', 'L.T.', 'H.T.', 'SEAT']
    for kw in exclude_keywords:
        if kw.upper() in code_clean.upper():
            return False
    # 产品编码通常包含'-'且长度在5-20之间
    return '-' in code_clean and 5 <= len(code_clean) <= 20


def process_main_order(standard_lib: Dict[str, Dict]) -> pd.DataFrame:
    """
    处理20260420.xlsx主订单文件

    Returns:
        处理后的DataFrame
    """
    logger.info("正在处理主订单文件 20260420.xlsx...")
    df = pd.read_excel(ORDER_20260420_PATH, header=None)

    # 确保有足够的列（扩展到K列，索引10）
    while len(df.columns) < 11:
        df[len(df.columns)] = None

    # 统计变量
    total_rows = 0
    direct_match = 0
    o0_match = 0
    no_match = 0
    no_match_codes = []

    for idx, row in df.iterrows():
        code = row.iloc[0]

        if not is_product_code(code):
            continue

        total_rows += 1
        product_info, match_label = match_code(code, standard_lib)

        if product_info:
            # G列 = 价格
            df.iloc[idx, 6] = product_info['价格']
            # I列 = 标准编码（O→0转换后的）
            df.iloc[idx, 8] = clean_code(code).replace('O', '0').replace('o', '0') if 'O→0' in match_label else clean_code(code)
            # J列 = 原规格编码
            df.iloc[idx, 9] = product_info['原规格编码']
            # K列 = 匹配标注
            df.iloc[idx, 10] = match_label

            if match_label == "直接匹配":
                direct_match += 1
            else:
                o0_match += 1
        else:
            df.iloc[idx, 10] = match_label
            no_match += 1
            no_match_codes.append(clean_code(code))

        # H列 = 总价 = F列数量 × G列单价
        quantity = row.iloc[5]
        price = df.iloc[idx, 6]
        if pd.notna(quantity) and pd.notna(price):
            try:
                df.iloc[idx, 7] = float(quantity) * float(price)
            except (ValueError, TypeError):
                pass

    logger.info(f"主订单处理完成: 共 {total_rows} 行产品")
    logger.info(f"  直接匹配: {direct_match} 行")
    logger.info(f"  O→0转换匹配: {o0_match} 行")
    logger.info(f"  无匹配: {no_match} 行")
    if no_match_codes:
        logger.info(f"  无匹配编码列表: {no_match_codes}")

    return df
