#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
产品编码统一合并工具
功能：合并两份来源不同的报价文件，生成统一产品编码库，更新库存文件
"""

import pandas as pd
import logging
import os
from typing import Dict, List, Tuple, Optional, Any

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


def clean_product_code(code: Optional[Any]) -> str:
    """
    清理产品编码，统一格式：
    - 去除所有空格
    - 去除首尾空白字符

    Args:
        code: 原始产品编码（任意类型）

    Returns:
        清理后的编码字符串
    """
    if pd.isna(code):
        logger.debug(f"输入产品编码为NaN，返回空字符串")
        return ""

    code_str = str(code)
    # 去除所有空格
    code_str = code_str.replace(" ", "").strip()
    # 如果为空，返回空字符串
    if not code_str:
        logger.debug(f"清理后的产品编码为空，输入值: {code}")
        return ""

    return code_str


def read_quote_file(file_path: str) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """
    读取报价文件，提取产品编码和相关信息，同时清理编码

    Args:
        file_path: 报价文件路径

    Returns:
        (DataFrame, original_to_clean_map):
            DataFrame 包含列: original_code, cleaned_code, 产品名称, 规格, 单位, 成本价, 售价, 分类
            original_to_clean_map: 原始编码 -> 清理后编码 的映射字典
    """
    logger.info(f"开始读取报价文件: {file_path}")

    try:
        # 读取Excel，第一个sheet
        df = pd.read_excel(file_path, sheet_name=0, header=0)
        logger.info(f"文件读取完成，共 {len(df)} 行原始数据")

        # 识别各列 - 根据模板，列名是固定的
        # 列名: 产品编码(必填), 产品名称, 英文名称, 分类, 规格, 单位, 成本价, 售价, 安全库存, 当前库存
        result_data = []
        original_to_clean: Dict[str, str] = {}

        product_code_col = '产品编码(必填)'

        for idx, row in df.iterrows():
            original_code = row[product_code_col]
            cleaned_code = clean_product_code(original_code)
            if cleaned_code == "":
                continue  # 跳过空编码

            # 提取其他信息，处理NaN
            product_name = row.get('产品名称', None)
            spec = row.get('规格', None)
            unit = row.get('单位', None)
            cost_price = row.get('成本价', None)
            sale_price = row.get('售价', None)
            category = row.get('分类', None)

            # 如果售价为空，跳过
            if pd.isna(sale_price):
                continue

            result_data.append({
                'original_code': str(original_code) if not pd.isna(original_code) else "",
                'cleaned_code': cleaned_code,
                'product_name': product_name if not pd.isna(product_name) else None,
                'spec': spec if not pd.isna(spec) else None,
                'unit': unit if not pd.isna(unit) else None,
                'cost_price': cost_price,
                'sale_price': sale_price,
                'category': category if not pd.isna(category) else None,
            })

            original_to_clean[str(original_code)] = cleaned_code

        result_df = pd.DataFrame(result_data)
        logger.info(f"过滤后剩余 {len(result_df)} 条有效产品数据")
        return result_df, original_to_clean

    except Exception as e:
        logger.error(f"读取报价文件失败: {str(e)}", exc_info=True)
        raise


if __name__ == '__main__':
    # 这里后续放主逻辑
    pass
